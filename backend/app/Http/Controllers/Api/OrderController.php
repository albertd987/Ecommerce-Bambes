<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Lunar\Models\Order;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;


/**
 * Controlador de comandes (orders) de l'API REST.
 *
 * Exposa dos endpoints de lectura per consultar les comandes
 * de l'usuari autenticat: llistat paginat i detall individual.
 *
 * La propietat de la comanda es verifica per user_id si la columna
 * existeix a la taula lunar_orders, o per email (customer_email/email)
 * com a alternativa, adaptant-se dinamicament a l'esquema de la BD.
 *
 * Endpoints:
 * - GET /api/orders      -> index() [autenticat]
 * - GET /api/orders/{id} -> show()  [autenticat]
 *
 * @package App\Http\Controllers\Api
 */
class OrderController extends Controller
{
    /**
     * Llista les comandes de l'usuari autenticat amb paginacio.
     *
     * Endpoint: GET /api/orders (requereix autenticacio).
     *
     * Filtra les comandes per user_id o per email segons l'esquema de la BD.
     * Inclou relacions lines.purchasable i currency. Suporta paginacio
     * amb el parametre 'per_page' (minim 1, maxim 50, per defecte 10).
     * Retorna les dades formatades per al frontend React amb metadades de paginacio.
     *
     * @param  \Illuminate\Http\Request  $request  Parametre opcional: per_page (int).
     * @return \Illuminate\Http\JsonResponse Llistat paginat de comandes amb meta de paginacio (HTTP 200).
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Order::query()
            ->with([
                'lines.purchasable', // variant/product (morph)
                'currency',
            ])
            ->orderByDesc('id');

        // Filtra comandes per user_id si existeix
        if ($this->ordersHasUserId()) {
            $query->where('user_id', $user->id);
        } else {
            // Fallback: filtra per email (si el projecte guarda email a Order)
            // NOTA: Lunar pot tenir camps diferents segons versió/implementació.
            // Intentem els més habituals: customer_email, email.
            $query->where(function ($q) use ($user) {
                $q->where('customer_email', $user->email)
                  ->orWhere('email', $user->email);
            });
        }

        // Paginació (per defecte 10, màxim 50)
        $perPage = (int) min(max($request->query('per_page', 10), 1), 50);
        $orders = $query->paginate($perPage);

        // Formata per React
        $data = $orders->getCollection()->map(fn ($order) => $this->formatOrderSummary($order));

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $orders->currentPage(),
                'per_page' => $orders->perPage(),
                'total' => $orders->total(),
                'last_page' => $orders->lastPage(),
            ],
        ]);
    }

    /**
     * Retorna el detall complet d'una comanda especifica.
     *
     * Endpoint: GET /api/orders/{id} (requereix autenticacio).
     *
     * Inclou linies amb nom de producte, quantitat, preus, SKU i informacio
     * del purchasable. Verifica que la comanda pertanyi a l'usuari autenticat
     * (per user_id o email) abans de retornar les dades.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int|string  $id  Identificador de la comanda.
     * @return \Illuminate\Http\JsonResponse Detall de la comanda (HTTP 200) o "No autoritzat" (HTTP 403).
     *
     * @throws \Illuminate\Database\Eloquent\ModelNotFoundException Si la comanda no existeix (HTTP 404).
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();

        $order = Order::query()
            ->with([
                'lines.purchasable',
                'currency',
                'addresses',
            ])
            ->findOrFail($id);

        // Seguretat: comprovar que la comanda és del user
        if (! $this->userOwnsOrder($user, $order)) {
            return response()->json(['message' => 'No autoritzat'], 403);
        }

        return response()->json([
            'data' => $this->formatOrderDetail($order),
        ]);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    /**
     * Detecta si la taula lunar_orders té la columna user_id.
     *
     * Consulta l'esquema de la BD per determinar la estratègia
     * de filtratge de comandes per usuari.
     *
     * @return bool True si la columna user_id existeix.
     */
    private function ordersHasUserId(): bool
    {
        try {
            return DB::getSchemaBuilder()->hasColumn('lunar_orders', 'user_id');
        } catch (\Throwable $e) {
            // Si hi ha qualsevol problema, no la fem servir
            return false;
        }
    }

    /**
     * Comprova si l'usuari és propietari de la comanda.
     *
     * Si existeix la columna user_id, compara per ID.
     * Si no, compara per email (customer_email o email).
     *
     * @param  \App\Models\User  $user  L'usuari autenticat.
     * @param  \Lunar\Models\Order  $order  La comanda a verificar.
     * @return bool True si l'usuari és propietari de la comanda.
     */
    private function userOwnsOrder($user, Order $order): bool
    {
        if ($this->ordersHasUserId()) {
            return (int) ($order->user_id ?? 0) === (int) $user->id;
        }

        $orderEmail = $order->customer_email ?? $order->email ?? null;
        return $orderEmail && strcasecmp($orderEmail, $user->email) === 0;
    }

    /**
     * Formata una comanda com a resum per al llistat.
     *
     * Inclou id, referència, estat, totals, moneda, nombre de línies i data.
     *
     * @param  \Lunar\Models\Order  $order  La comanda a formatar.
     * @return array Dades resumides de la comanda.
     */
    private function formatOrderSummary(Order $order): array
    {
        $linesCount = $order->lines?->sum('quantity') ?? $order->lines?->count() ?? 0;

        return [
            'id' => $order->id,
            'reference' => $order->reference ?? null,
            'status' => $order->status ?? null,

            // Lunar acostuma a guardar totals en "minor units" (cèntims).
            'totals' => [
                'sub_total' => $order->sub_total ?? null,
                'tax_total' => $order->tax_total ?? null,
                'shipping_total' => $order->shipping_total ?? null,
                'discount_total' => $order->discount_total ?? null,
                'total' => $order->total ?? null,
            ],

            'currency' => [
                'code' => $order->currency->code ?? null,
                'decimal_places' => $order->currency->decimal_places ?? null,
            ],

            'lines_count' => $linesCount,
            'created_at' => optional($order->created_at)->toISOString(),
        ];
    }

    /**
     * Formata una comanda amb detall complet, incloent-hi les línies.
     *
     * Cada línia inclou nom del producte, quantitat, preus, SKU
     * i informació del purchasable.
     *
     * @param  \Lunar\Models\Order  $order  La comanda a formatar.
     * @return array Dades completes de la comanda amb línies.
     */
    private function formatOrderDetail(Order $order): array
    {
        $lines = ($order->lines ?? collect())->map(function ($line) {
            $p = $line->purchasable;

            $name =
                $line->description
                ?? $p->product?->translateAttribute('name')
                ?? $p->product?->name
                ?? $p->name
                ?? 'Producte';

            return [
                'id' => $line->id,
                'name' => $name,
                'quantity' => (int) ($line->quantity ?? 1),
                'unit_price' => $line->unit_price ?? null,
                'total' => $line->total ?? null,
                'sku' => $p->sku ?? null,
                'purchasable_type' => $line->purchasable_type ?? null,
                'purchasable_id' => $line->purchasable_id ?? null,
            ];
        });

        // Adreces
        $billingAddr = $order->addresses?->where('type', 'billing')->first();
        $shippingAddr = $order->addresses?->where('type', 'shipping')->first();

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
            'reference' => $order->reference ?? null,
            'status' => $order->status ?? null,

            'totals' => [
                'sub_total' => $order->sub_total ?? null,
                'tax_total' => $order->tax_total ?? null,
                'shipping_total' => $order->shipping_total ?? null,
                'discount_total' => $order->discount_total ?? null,
                'total' => $order->total ?? null,
            ],

            'currency' => [
                'code' => $order->currency->code ?? null,
                'decimal_places' => $order->currency->decimal_places ?? null,
            ],

            'customer' => $billingAddr ? [
                'first_name' => $billingAddr->first_name,
                'last_name' => $billingAddr->last_name,
                'email' => $billingAddr->contact_email,
                'phone' => $billingAddr->contact_phone,
            ] : null,

            'billing_address' => $formatAddress($billingAddr),
            'shipping_address' => $formatAddress($shippingAddr),

            'lines' => $lines,
            'created_at' => optional($order->created_at)->toISOString(),
        ];
    }

    private function priceToInt($value): ?int
{
    if ($value === null) {
        return null;
    }

    if (is_int($value) || is_float($value) || is_numeric($value)) {
        return (int) $value;
    }

    // Casos típics Lunar / objectes serialitzats
    if (is_object($value)) {
        if (isset($value->value) && is_numeric($value->value)) {
            return (int) $value->value;
        }

        if (isset($value->amount) && is_numeric($value->amount)) {
            return (int) $value->amount;
        }

        if (method_exists($value, '__toString')) {
            $stringValue = (string) $value;
            if (is_numeric($stringValue)) {
                return (int) $stringValue;
            }
        }
    }

    if (is_array($value)) {
        if (isset($value['value']) && is_numeric($value['value'])) {
            return (int) $value['value'];
        }

        if (isset($value['amount']) && is_numeric($value['amount'])) {
            return (int) $value['amount'];
        }
    }

    return 0;
}

public function invoice(Request $request, $id)
{
    try {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'message' => 'No autenticat',
            ], 401);
        }

        $order = Order::query()
            ->with([
                'lines.purchasable',
                'currency',
                'addresses',
            ])
            ->findOrFail($id);

        if (! $this->userOwnsOrder($user, $order)) {
            return response()->json([
                'message' => 'No autoritzat',
            ], 403);
        }

        $formattedOrder = $this->formatOrderDetail($order);

        $formattedOrder['totals'] = [
            'sub_total' => $this->priceToInt($formattedOrder['totals']['sub_total'] ?? null),
            'tax_total' => $this->priceToInt($formattedOrder['totals']['tax_total'] ?? null),
            'shipping_total' => $this->priceToInt($formattedOrder['totals']['shipping_total'] ?? null),
            'discount_total' => $this->priceToInt($formattedOrder['totals']['discount_total'] ?? null),
            'total' => $this->priceToInt($formattedOrder['totals']['total'] ?? null),
        ];

        $formattedOrder['lines'] = collect($formattedOrder['lines'] ?? [])->map(function ($line) {
            $line['unit_price'] = $this->priceToInt($line['unit_price'] ?? null);
            $line['total'] = $this->priceToInt($line['total'] ?? null);
            return $line;
        })->values()->all();

        $lang = $request->query('lang', 'ca');
        if (!in_array($lang, ['ca', 'en'])) {
            $lang = 'ca';
        }

        $pdf = Pdf::loadView('pdf.invoice', [
            'order' => $formattedOrder,
            'lang' => $lang,
        ]);

        $filename = $lang === 'en'
            ? "invoice-order-{$order->id}.pdf"
            : "factura-comanda-{$order->id}.pdf";

        return $pdf->download($filename);
    } catch (\Throwable $e) {
        Log::error('Invoice PDF error', [
            'order_id' => $id,
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
        ]);

        return response()->json([
            'message' => 'Error generant la factura',
            'error' => $e->getMessage(),
        ], 500);
    }
}
}
