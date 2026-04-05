<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Lunar\Facades\CartSession;
use Lunar\Models\ProductVariant;
use Lunar\Models\Cart;
use Illuminate\Support\Facades\Log;

/**
 * Controlador del carret de compra de l'API REST.
 *
 * Endpoints:
 * - GET    /api/cart            -> index()      [public]
 * - POST   /api/cart/add        -> add()        [public]
 * - PUT    /api/cart/line/{id}  -> updateLine() [public]
 * - DELETE /api/cart/line/{id}  -> removeLine() [public]
 * - DELETE /api/cart/clear      -> clear()      [public]
 */
class CartController extends Controller
{
    /** IVA inclòs (informatiu) */
    private const TAX_RATE = 0.21;

    /**
     * Resol el carret actiu per token UUID, sessió de Laravel, o user_id.
     *
     * Estratègia en 3 passos:
     * 1. cart_token (localStorage del frontend) → per carrets de convidats
     * 2. CartSession::current() → sessió de Lunar (si el listener l'ha restaurat)
     * 3. user_id (BD directe) → fallback robust per quan la sessió es regenera
     */
    private function getCartByTokenOrSession(Request $request)
    {
        // 1. Token explícit del frontend
        $cartToken = $request->input('cart_token') ?? $request->query('cart_token');

        if ($cartToken) {
            $cart = Cart::where('meta->token', $cartToken)->first();
            if ($cart) {
                CartSession::use($cart);
                return $cart;
            }
        }

        // 2. Sessió de Lunar (lunar_cart key a la sessió)
        $cart = CartSession::current();
        if ($cart) {
            return $cart;
        }

        // 3. Fallback: buscar per user_id directament a la BD
        //    - SoftDeletes ja filtra deleted_at automàticament
        //    - latest() per agafar el carret més recent si n'hi ha més d'un
        if (auth()->check()) {
            $cart = Cart::whereUserId(auth()->id())
                ->active()
                ->latest()
                ->first();

            if ($cart) {
                // Restaurar a la sessió de Lunar per les següents requests
                CartSession::use($cart);
                return $cart;
            }
        }

        return null;
    }

    /**
     * Retorna el contingut complet del carret actiu.
     * IMPORTANT: Els preus ja són PVP (IVA inclòs). No afegim IVA al total.
     */
    public function index(Request $request)
    {
        try {
            $cart = $this->getCartByTokenOrSession($request);

            if (!$cart || $cart->lines->isEmpty()) {
                return response()->json([
                    'data' => null,
                    'message' => 'No hi ha carret actiu'
                ]);
            }

            $cart->load([
                'lines',
                'lines.purchasable',
                'lines.purchasable.product',
                'lines.purchasable.product.thumbnailMedia',
                'lines.purchasable.product.brand',
            ]);

            // Assegurar que té channel
            if (!$cart->channel_id) {
                $channel = \Lunar\Models\Channel::where('default', true)->first();
                $cart->channel_id = $channel?->id;
                $cart->save();
            }

            // Recalcular (ens serveix per subTotal i línies)
            $cart->calculate();

            $subTotal = (float) ($cart->subTotal?->decimal ?? 0);
            $gross = $subTotal; // al carret no hi afegim enviament

            // IVA inclòs (informatiu): gross - gross/(1+iva)
            $vatIncluded = $gross > 0
                ? ($gross - ($gross / (1 + self::TAX_RATE)))
                : 0;

            return response()->json([
                'data' => [
                    'id' => $cart->id,
                    'lines' => $cart->lines->map(function ($line) {
                        return [
                            'id' => $line->id,
                            'quantity' => $line->quantity,
                            'product' => [
                                'id' => $line->purchasable->product->id,
                                'name' => $line->purchasable->product->translateAttribute('name'),
                                'thumbnail' => $line->purchasable->product->thumbnailMedia?->getUrl(),
                                'brand' => $line->purchasable->product->brand?->name ?? null,
                            ],
                            'variant' => [
                                'id' => $line->purchasable->id,
                                'sku' => $line->purchasable->sku,
                            ],
                            'unit_price' => (float) ($line->unitPrice?->decimal ?? 0),
                            'sub_total' => (float) ($line->subTotal?->decimal ?? 0),
                        ];
                    })->values(),

                    // totals decimals (euros)
                    'sub_total' => round($subTotal, 2),
                    'tax_total' => round($vatIncluded, 2), // informatiu (IVA inclòs)
                    'total' => round($gross, 2),

                    'tax_included' => true,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Cart index error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Error al obtenir el carret',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Afegeix una variant de producte al carret.
     */
    public function add(Request $request)
    {
        $request->validate([
            'variant_id' => 'required|exists:lunar_product_variants,id',
            'quantity' => 'required|integer|min:1',
            'cart_token' => 'nullable|string',
        ]);

        try {
            $variant = ProductVariant::findOrFail($request->variant_id);

            if ($variant->stock < $request->quantity) {
                return response()->json([
                    'error' => 'Stock insuficient',
                    'available_stock' => $variant->stock
                ], 400);
            }

            // Cercar carret existent per token o crear-ne un de nou
            $cart = null;

            if ($request->cart_token) {
                $cart = Cart::where('meta->token', $request->cart_token)->first();
                if ($cart) {
                    CartSession::use($cart);
                }
            }

            if (!$cart) {
                $cart = CartSession::current();
            }

            if (!$cart) {
                $currency = \Lunar\Models\Currency::where('default', true)->first();

                if (!$currency) {
                    return response()->json(['error' => 'No hi ha cap moneda configurada'], 500);
                }

                $cartToken = \Illuminate\Support\Str::uuid();

                $cart = Cart::create([
                    'currency_id' => $currency->id,
                    'channel_id' => \Lunar\Models\Channel::getDefault()?->id,
                    'meta' => ['token' => $cartToken],
                ]);

                CartSession::use($cart);
            }

            // Associar el carret amb l'usuari autenticat (per restaurar-lo en re-login)
            if (auth()->check() && !$cart->user_id) {
                $cart->update(['user_id' => auth()->id()]);
            }

            // Afegir línia al carret
            CartSession::addLines([
                [
                    'purchasable' => $variant,
                    'quantity' => $request->quantity,
                ]
            ]);

            $cart = CartSession::current();

            return response()->json([
                'message' => 'Producte afegit al carret',
                'data' => [
                    'cart_id' => $cart->id,
                    'cart_token' => $cart->meta['token'] ?? null,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error en afegir al carret', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'error' => 'Error al afegir al carret',
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ], 500);
        }
    }

    /**
     * Modifica la quantitat d'una linia existent del carret.
     */
    public function updateLine(Request $request, $lineId)
    {
        $request->validate([
            'quantity' => 'required|integer|min:1',
            'cart_token' => 'nullable|string',
        ]);

        try {
            $cart = $this->getCartByTokenOrSession($request);

            if (!$cart) {
                return response()->json([
                    'error' => 'No hi ha carret actiu'
                ], 404);
            }

            CartSession::updateLines(collect([
                [
                    'id' => $lineId,
                    'quantity' => $request->quantity,
                ]
            ]));

            $cart = CartSession::current();
            $cart->calculate();

            // total (gross) al carret = subTotal
            $subTotal = (float) ($cart->subTotal?->decimal ?? 0);

            return response()->json([
                'message' => 'Quantitat actualitzada',
                'data' => [
                    'total' => round($subTotal, 2),
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al actualitzar',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Elimina una linia del carret.
     */
    public function removeLine(Request $request, $lineId)
    {
        try {
            $cart = $this->getCartByTokenOrSession($request);

            if (!$cart) {
                return response()->json([
                    'error' => 'No hi ha carret actiu'
                ], 404);
            }

            CartSession::remove($lineId);

            $cart = CartSession::current();
            $cart?->calculate();

            return response()->json([
                'message' => 'Producte eliminat del carret'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al eliminar',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Elimina totes les linies del carret i descarta la sessio de carret.
     */
    public function clear(Request $request)
    {
        try {
            $cart = $this->getCartByTokenOrSession($request);

            if (!$cart) {
                return response()->json([
                    'message' => 'No hi ha carret per buidar'
                ]);
            }

            // Esborra les línies del carret (l'usuari buidat explícitament)
            $cart->lines()->delete();
            CartSession::forget();

            return response()->json([
                'message' => 'Carret buidat'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al buidar el carret',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}