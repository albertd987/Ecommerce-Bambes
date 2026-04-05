<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Lunar\Models\ProductVariant;
use Lunar\Models\Order;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Barryvdh\DomPDF\Facade\Pdf;
use App\Mail\OrderConfirmationMail;
use Illuminate\Support\Facades\Mail;
use App\Services\StockService;

class CheckoutController extends Controller
{
    /** Tarifa plana d'enviament en centims (4.99€) */
    private const SHIPPING_FLAT_RATE = 499;

    /** Tipus d'IVA (21% Espanya) — NOMÉS informatiu (preus ja inclouen IVA) */
    private const TAX_RATE = 0.21;

    private function customerValidationRules(): array
    {
        return [
            'customer.first_name' => ['required', 'string', 'max:255'],
            'customer.last_name' => ['required', 'string', 'max:255'],
            'customer.email' => ['required', 'email', 'max:255'],
            'customer.phone' => ['nullable', 'string', 'max:50'],

            'billing.line_one' => ['required', 'string', 'max:255'],
            'billing.line_two' => ['nullable', 'string', 'max:255'],
            'billing.city' => ['required', 'string', 'max:255'],
            'billing.postcode' => ['required', 'string', 'max:20'],
            'billing.state' => ['nullable', 'string', 'max:255'],
            'billing.country_code' => ['nullable', 'string', 'max:2'],

            'shipping_same_as_billing' => ['required', 'boolean'],

            'shipping.line_one' => ['required_if:shipping_same_as_billing,false', 'nullable', 'string', 'max:255'],
            'shipping.line_two' => ['nullable', 'string', 'max:255'],
            'shipping.city' => ['required_if:shipping_same_as_billing,false', 'nullable', 'string', 'max:255'],
            'shipping.postcode' => ['required_if:shipping_same_as_billing,false', 'nullable', 'string', 'max:20'],
            'shipping.state' => ['nullable', 'string', 'max:255'],
            'shipping.country_code' => ['nullable', 'string', 'max:2'],
        ];
    }

    public function createIntent(Request $request)
    {
        $user = $request->user();

        if (!$user || !$user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Has de verificar el teu email abans de comprar.',
                'code' => 'email_not_verified',
            ], 403);
        }

        $data = $request->validate(array_merge([
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.qty' => ['required', 'integer', 'min:1'],
            'lines.*.variant_id' => ['nullable', 'integer'],
            'lines.*.product_id' => ['nullable', 'integer'],
        ], $this->customerValidationRules()));

        $currency = \Lunar\Models\Currency::where('default', true)->first();
        $channel  = \Lunar\Models\Channel::getDefault();

        if (!$currency || !$channel) {
            Log::error('Checkout createIntent: missing default currency or channel');
            return response()->json([
                'message' => 'Configuració de botiga incompleta',
            ], 500);
        }

        try {
            $lines = $this->resolveVariantLines($data['lines']);
        } catch (\Throwable $e) {
            Log::warning('Checkout resolveVariantLines error', [
                'message' => $e->getMessage(),
            ]);
            return response()->json([
                'error' => 'Línies invàlides',
            ], 422);
        }

        $subtotal = $this->calculateAmountFromDb($lines, $currency->id);

        if ($subtotal <= 0) {
            return response()->json([
                'error' => 'Import invàlid',
                'message' => "No s'ha pogut calcular l'import del carret.",
            ], 422);
        }

        $shippingTotal = self::SHIPPING_FLAT_RATE;
        $gross = $subtotal + $shippingTotal;
        $taxTotal = (int) round($gross - ($gross / (1 + self::TAX_RATE)));
        $total = (int) $gross;

        $stockCheck = $this->validateStock($lines);
        if ($stockCheck !== true) {
            return response()->json($stockCheck, 400);
        }

        try {
            \Stripe\Stripe::setApiKey(config('services.stripe.secret'));

            $intent = \Stripe\PaymentIntent::create([
                'amount' => (int) $total,
                'currency' => strtolower($currency->code),
                'automatic_payment_methods' => ['enabled' => true],
                'metadata' => [
                    'source' => 'bambes',
                    'lines_count' => count($lines),
                    'user_id' => optional(auth()->user())->id,
                ],
            ]);

            return response()->json([
                'client_secret' => $intent->client_secret,
                'amount' => (int) $total,
                'totals' => [
                    'sub_total' => (int) $subtotal,
                    'shipping_total' => (int) $shippingTotal,
                    'tax_total' => (int) $taxTotal,
                    'total' => (int) $total,
                    'tax_included' => true,
                ],
                'resolved_lines' => $lines,
            ]);
        } catch (\Throwable $e) {
            Log::error('Stripe createIntent error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'error' => 'Error iniciant el pagament',
            ], 500);
        }
    }

    public function confirm(Request $request)
{
    $user = $request->user();

    if (!$user || !$user->hasVerifiedEmail()) {
        return response()->json([
            'message' => 'Has de verificar el teu email abans de comprar.',
            'code' => 'email_not_verified',
        ], 403);
    }

    $data = $request->validate(array_merge([
        'payment_intent_id' => ['required', 'string'],
        'lines' => ['required', 'array', 'min:1'],
        'lines.*.qty' => ['required', 'integer', 'min:1'],
        'lines.*.variant_id' => ['nullable', 'integer'],
        'lines.*.product_id' => ['nullable', 'integer'],
        'lang' => ['nullable', 'string'],
    ], $this->customerValidationRules()));

    $currency = \Lunar\Models\Currency::where('default', true)->first();
    $channel  = \Lunar\Models\Channel::getDefault();

    if (!$currency || !$channel) {
        Log::error('Checkout confirm: missing default currency or channel');
        return response()->json([
            'message' => 'Configuració de botiga incompleta',
        ], 500);
    }

    $currencyCode = $currency->code;

    $lines = $this->resolveVariantLines($data['lines']);

    $subtotal = $this->calculateAmountFromDb($lines, $currency->id);
    $shippingTotal = self::SHIPPING_FLAT_RATE;
    $gross = $subtotal + $shippingTotal;
    $taxTotal = (int) round($gross - ($gross / (1 + self::TAX_RATE)));
    $total = (int) $gross;

    \Stripe\Stripe::setApiKey(config('services.stripe.secret'));

    $pi = \Stripe\PaymentIntent::retrieve($data['payment_intent_id']);

    if (!$pi || $pi->status !== 'succeeded') {
        return response()->json([
            'message' => 'El pagament no està completat',
            'status' => $pi->status ?? 'unknown',
        ], 422);
    }

    if ((int) $pi->amount_received !== (int) $total) {
        return response()->json([
            'message' => 'Import no coincideix amb el servidor',
            'expected' => (int) $total,
            'received' => (int) $pi->amount_received,
        ], 422);
    }

    if (strtolower($pi->currency) !== strtolower($currencyCode)) {
        Log::warning('Checkout confirm: currency mismatch', [
            'pi_currency' => $pi->currency,
            'expected' => $currencyCode,
        ]);
        return response()->json([
            'message' => 'Moneda del pagament no vàlida',
        ], 422);
    }

    $existing = Order::query()->where('reference', $pi->id)->first();
    if ($existing) {
        return response()->json([
            'data' => $this->formatOrderFromDb($existing->id),
            'message' => 'Order ja existia',
        ]);
    }

    // Re-validar stock ABANS de crear la comanda. Si ha desaparegut entre
    // createIntent i confirm, retorna el pagament i aborta.
    $stockCheck = $this->validateStock($lines);
    if ($stockCheck !== true) {
        try {
            \Stripe\Refund::create(['payment_intent' => $pi->id]);
        } catch (\Throwable $refundException) {
            Log::critical('Stock gone AND refund failed', [
                'pi_id' => $pi->id,
                'user_id' => $user->id,
                'refund_error' => $refundException->getMessage(),
            ]);
        }

        return response()->json([
            'error' => 'Stock insuficient — pagament retornat',
            'details' => $stockCheck['details'] ?? [],
        ], 409);
    }

    $customer = $data['customer'];
    $billing = $data['billing'];
    $shippingSameAsBilling = (bool) $data['shipping_same_as_billing'];
    $shipping = $shippingSameAsBilling ? $billing : $data['shipping'];
    $now = now();

    DB::beginTransaction();

    try {
        $orderId = DB::table('lunar_orders')->insertGetId([
            'user_id' => $user->id,
            'channel_id' => $channel->id,
            'status' => 'paid',
            'reference' => $pi->id,

            'sub_total' => (int) $subtotal,
            'discount_total' => 0,
            'shipping_total' => (int) $shippingTotal,
            'tax_total' => (int) $taxTotal,
            'total' => (int) $total,

            'currency_code' => $currencyCode,
            'compare_currency_code' => $currencyCode,
            'exchange_rate' => 1,

            'tax_breakdown' => json_encode([]),
            'shipping_breakdown' => json_encode([]),
            'discount_breakdown' => json_encode([]),

            'placed_at' => $now,
            'meta' => json_encode(['stripe_payment_intent_id' => $pi->id]),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('lunar_order_addresses')->insert([
            'order_id' => $orderId,
            'type' => 'billing',
            'first_name' => $customer['first_name'],
            'last_name' => $customer['last_name'],
            'contact_email' => $customer['email'],
            'contact_phone' => $customer['phone'] ?? null,
            'line_one' => $billing['line_one'],
            'line_two' => $billing['line_two'] ?? null,
            'city' => $billing['city'],
            'state' => $billing['state'] ?? null,
            'postcode' => $billing['postcode'],
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('lunar_order_addresses')->insert([
            'order_id' => $orderId,
            'type' => 'shipping',
            'first_name' => $customer['first_name'],
            'last_name' => $customer['last_name'],
            'contact_email' => $customer['email'],
            'contact_phone' => $customer['phone'] ?? null,
            'line_one' => $shipping['line_one'],
            'line_two' => $shipping['line_two'] ?? null,
            'city' => $shipping['city'],
            'state' => $shipping['state'] ?? null,
            'postcode' => $shipping['postcode'],
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        foreach ($lines as $l) {
            $variantId = (int) $l['variant_id'];
            $qty = (int) $l['qty'];

            $unitPrice = $this->getUnitPriceFromDb($variantId, $currency->id);

            $variant = ProductVariant::with('product')->find($variantId);
            $desc = $variant?->product?->translateAttribute('name')
                ?? $variant?->product?->name
                ?? 'Producte';

            DB::table('lunar_order_lines')->insert([
                'order_id' => $orderId,
                'type' => 'physical',
                'identifier' => 'line_' . Str::uuid(),
                'purchasable_type' => 'product_variant',
                'purchasable_id' => $variantId,
                'quantity' => $qty,
                'unit_quantity' => 1,
                'unit_price' => $unitPrice,
                'sub_total' => $unitPrice * $qty,
                'discount_total' => 0,
                'tax_total' => 0,
                'tax_breakdown' => json_encode([]),
                'total' => $unitPrice * $qty,
                'description' => $desc,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            app(StockService::class)->sell($variant, $qty, $orderId);
        }

        DB::commit();

        $pdfPath = null;
        try {
            $formattedOrder = $this->formatOrderFromDb($orderId);

            $lang = $request->input('lang', 'ca');
            $lang = str_starts_with(strtolower((string) $lang), 'en') ? 'en' : 'ca';

            Log::info('Order confirmation language', [
                'order_id' => $orderId,
                'lang' => $lang,
                'customer_email' => $customer['email'] ?? null,
            ]);

            $pdfPath = $this->generateInvoicePdfPath($formattedOrder, $lang);

            if (!empty($customer['email'])) {
                Mail::to($customer['email'])->send(
                    new OrderConfirmationMail($formattedOrder, $pdfPath, $lang)
                );
            }
        } catch (\Throwable $mailException) {
            Log::error('Order confirmation email error: ' . $mailException->getMessage(), [
                'order_id' => $orderId,
                'trace' => $mailException->getTraceAsString(),
            ]);
        } finally {
            if ($pdfPath && file_exists($pdfPath)) {
                @unlink($pdfPath);
            }
        }

        return response()->json([
            'data' => $this->formatOrderFromDb($orderId),
        ], 201);

    } catch (\Throwable $e) {
        DB::rollBack();
        Log::error('Checkout confirm error: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString(),
        ]);
        return response()->json([
            'message' => 'Error creant la comanda',
        ], 500);
    }
}

    private function resolveVariantLines(array $lines): array
    {
        $out = [];

        foreach ($lines as $i => $line) {
            $qty = (int) ($line['qty'] ?? 1);
            if ($qty < 1) $qty = 1;

            $variantId = isset($line['variant_id']) ? (int) $line['variant_id'] : null;

            if (!$variantId) {
                $productId = isset($line['product_id']) ? (int) $line['product_id'] : null;

                if (!$productId) {
                    throw new \Exception("Línia #".($i+1).": falta variant_id o product_id.");
                }

                $variantId = ProductVariant::query()
                    ->where('product_id', $productId)
                    ->orderBy('id')
                    ->value('id');

                if (!$variantId) {
                    throw new \Exception("Línia #".($i+1).": no s'ha trobat cap variant pel producte {$productId}.");
                }
            }

            $out[] = [
                'variant_id' => (int) $variantId,
                'qty' => (int) $qty,
            ];
        }

        return $out;
    }

    private function calculateAmountFromDb(array $lines, int $currencyId): int
    {
        $variantIds = collect($lines)->pluck('variant_id')->unique()->values();

        $prices = DB::table('lunar_prices')
            ->where('priceable_type', 'product_variant')
            ->whereIn('priceable_id', $variantIds)
            ->where('currency_id', $currencyId)
            ->where('min_quantity', 1)
            ->pluck('price', 'priceable_id');

        $amount = 0;

        foreach ($lines as $line) {
            $variantId = (int) $line['variant_id'];
            $qty = (int) $line['qty'];

            if (!$prices->has($variantId)) {
                abort(422, "La variant {$variantId} no té preu configurat.");
            }

            $unitPrice = (int) $prices[$variantId];
            $amount += $unitPrice * $qty;
        }

        return (int) $amount;
    }

    private function validateStock(array $lines)
    {
        $errors = [];

        foreach ($lines as $line) {
            $variant = ProductVariant::with('product')->find($line['variant_id']);

            if (!$variant) {
                $errors[] = [
                    'variant_id' => $line['variant_id'],
                    'message' => 'Variant no trobada',
                ];
                continue;
            }

            if ($variant->stock < $line['qty']) {
                $productName = $variant->product?->translateAttribute('name')
                    ?? $variant->product?->name
                    ?? 'Producte';

                $errors[] = [
                    'variant_id' => $line['variant_id'],
                    'product' => $productName,
                    'requested' => $line['qty'],
                    'available' => $variant->stock,
                    'message' => "Stock insuficient per a '{$productName}': disponible {$variant->stock}, demanat {$line['qty']}",
                ];
            }
        }

        if (!empty($errors)) {
            return [
                'error' => 'Stock insuficient',
                'details' => $errors,
            ];
        }

        return true;
    }

    private function getUnitPriceFromDb(int $variantId, int $currencyId): int
    {
        $price = DB::table('lunar_prices')
            ->where('priceable_type', 'product_variant')
            ->where('priceable_id', $variantId)
            ->where('currency_id', $currencyId)
            ->where('min_quantity', 1)
            ->value('price');

        if ($price === null) {
            abort(422, "La variant {$variantId} no té preu configurat.");
        }

        return (int) $price;
    }

    private function formatOrderFromDb(int $orderId): array
    {
        $order = DB::table('lunar_orders')->where('id', $orderId)->first();
        if (!$order) {
            return ['id' => $orderId, 'error' => 'Not found'];
        }

        $lines = DB::table('lunar_order_lines')->where('order_id', $orderId)->get();
        $addresses = DB::table('lunar_order_addresses')->where('order_id', $orderId)->get();

        $billingAddr = $addresses->where('type', 'billing')->first();
        $shippingAddr = $addresses->where('type', 'shipping')->first();

        $formatAddress = function ($addr) {
            if (!$addr) return null;
            return [
                'first_name' => $addr->first_name,
                'last_name' => $addr->last_name,
                'line_one' => $addr->line_one,
                'line_two' => $addr->line_two,
                'city' => $addr->city,
                'state' => $addr->state,
                'postcode' => $addr->postcode,
                'contact_email' => $addr->contact_email,
                'contact_phone' => $addr->contact_phone,
            ];
        };

        return [
            'id' => $order->id,
            'reference' => $order->reference,
            'status' => $order->status,

            'currency' => [
                'code' => $order->currency_code ?? 'EUR',
                'decimal_places' => 2,
            ],

            'customer' => $billingAddr ? [
                'first_name' => $billingAddr->first_name,
                'last_name' => $billingAddr->last_name,
                'email' => $billingAddr->contact_email,
                'phone' => $billingAddr->contact_phone,
            ] : null,

            'billing_address' => $formatAddress($billingAddr),
            'shipping_address' => $formatAddress($shippingAddr),

            'totals' => [
                'sub_total' => (int) ($order->sub_total ?? 0),
                'discount_total' => (int) ($order->discount_total ?? 0),
                'shipping_total' => (int) ($order->shipping_total ?? 0),
                'tax_total' => (int) ($order->tax_total ?? 0),
                'total' => (int) ($order->total ?? 0),
            ],

            'lines' => $lines->map(function ($line) {
                return [
                    'id' => $line->id,
                    'name' => $line->description ?? 'Producte',
                    'quantity' => (int) ($line->quantity ?? 1),
                    'unit_price' => (int) ($line->unit_price ?? 0),
                    'sub_total' => (int) ($line->sub_total ?? 0),
                    'discount_total' => (int) ($line->discount_total ?? 0),
                    'tax_total' => (int) ($line->tax_total ?? 0),
                    'total' => (int) ($line->total ?? 0),
                ];
            })->values()->all(),

            'created_at' => $order->created_at,
        ];
    }

    private function generateInvoicePdfPath(array $formattedOrder, string $lang = 'ca'): string
    {
        $pdf = Pdf::loadView('pdf.invoice', [
            'order' => $formattedOrder,
            'lang' => $lang,
        ]);

        $tempDir = storage_path('app/temp');

        if (!file_exists($tempDir)) {
            mkdir($tempDir, 0777, true);
        }

        $filename = $lang === 'en'
            ? 'invoice-order-' . $formattedOrder['id'] . '.pdf'
            : 'factura-comanda-' . $formattedOrder['id'] . '.pdf';

        $pdfPath = $tempDir . DIRECTORY_SEPARATOR . $filename;
        $pdf->save($pdfPath);

        return $pdfPath;
    }
}