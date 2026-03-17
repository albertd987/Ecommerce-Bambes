<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Lunar\Models\Order;
use Lunar\Models\Product;
use Lunar\Models\ProductVariant;
use Lunar\Models\Customer;
use Lunar\Models\Brand;

/**
 * Definicio i execucio de les eines (tools) disponibles per al chatbot.
 *
 * Cada metode public correspon a una funcio que el model Gemini pot invocar
 * mitjancant function calling. Les funcions consulten les taules de Lunar
 * i retornen dades de negoci en format estructurat.
 *
 * Totes les quantitats monetaries s'emmagatzemen en centims a la base de dades
 * i es converteixen a euros abans de retornar-les.
 *
 * @package App\Services
 */
class ChatbotTools
{
    /**
     * Retorna la definicio de totes les eines en format Gemini function calling.
     *
     * Cada eina te un nom, una descripcio i un esquema de parametres
     * que Gemini utilitza per decidir quina funcio cridar i amb quins arguments.
     *
     * @return array Llista de declaracions de funcions per a l'API de Gemini.
     */
    public static function getToolDefinitions(): array
    {
        return [
            [
                'name' => 'get_top_selling_products',
                'description' => 'Obte els productes mes venuts en un periode determinat. Retorna nom del producte, unitats venudes i ingressos generats.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'period' => [
                            'type' => 'string',
                            'description' => "Periode temporal en format YYYY-MM (mes concret) o YYYY (any sencer). Exemples: '2025-01' per gener 2025, '2025' per tot l'any 2025. Si no s'especifica, retorna dades globals.",
                        ],
                        'limit' => [
                            'type' => 'integer',
                            'description' => 'Nombre maxim de productes a retornar. Per defecte 5.',
                        ],
                    ],
                ],
            ],
            [
                'name' => 'get_total_revenue',
                'description' => "Obte els ingressos totals de la botiga en un periode. Inclou subtotal, impostos, descomptes i total net.",
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'period' => [
                            'type' => 'string',
                            'description' => "Periode temporal en format YYYY-MM o YYYY. Si no s'especifica, retorna el total historic.",
                        ],
                    ],
                ],
            ],
            [
                'name' => 'get_orders_by_status',
                'description' => "Obte el recompte de comandes agrupades per estat (paid, pending, dispatched, etc.).",
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'status' => [
                            'type' => 'string',
                            'description' => "Filtra per un estat concret. Si no s'especifica, retorna el recompte de tots els estats.",
                        ],
                    ],
                ],
            ],
            [
                'name' => 'get_low_stock_products',
                'description' => "Obte els productes amb estoc baix o exhaurit. Util per gestionar l'inventari.",
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'threshold' => [
                            'type' => 'integer',
                            'description' => 'Llindar d\'estoc per considerar-lo baix. Per defecte 10 unitats.',
                        ],
                    ],
                ],
            ],
            [
                'name' => 'get_recent_orders',
                'description' => "Obte les comandes mes recents amb el seu detall: referencia, estat, total i data.",
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'limit' => [
                            'type' => 'integer',
                            'description' => 'Nombre maxim de comandes a retornar. Per defecte 10.',
                        ],
                    ],
                ],
            ],
            [
                'name' => 'get_customer_count',
                'description' => "Obte estadistiques de clients: total de clients registrats i nous clients en un periode.",
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'period' => [
                            'type' => 'string',
                            'description' => "Periode temporal en format YYYY-MM o YYYY per filtrar nous clients.",
                        ],
                    ],
                ],
            ],
            [
                'name' => 'get_revenue_by_brand',
                'description' => "Obte els ingressos desglossats per marca. Permet veure quines marques generen mes vendes.",
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'period' => [
                            'type' => 'string',
                            'description' => "Periode temporal en format YYYY-MM o YYYY.",
                        ],
                        'limit' => [
                            'type' => 'integer',
                            'description' => 'Nombre maxim de marques a retornar. Per defecte 10.',
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * Executa una eina pel seu nom amb els arguments proporcionats per Gemini.
     *
     * Mapeja el nom de la funcio al metode corresponent i retorna el resultat
     * com a string JSON. Si la funcio no existeix, retorna un missatge d'error.
     *
     * @param  string  $name  Nom de la funcio a executar.
     * @param  array   $args  Arguments proporcionats per Gemini.
     * @return string Resultat en format JSON.
     */
    public static function execute(string $name, array $args): string
    {
        $result = match ($name) {
            'get_top_selling_products' => self::getTopSellingProducts($args),
            'get_total_revenue' => self::getTotalRevenue($args),
            'get_orders_by_status' => self::getOrdersByStatus($args),
            'get_low_stock_products' => self::getLowStockProducts($args),
            'get_recent_orders' => self::getRecentOrders($args),
            'get_customer_count' => self::getCustomerCount($args),
            'get_revenue_by_brand' => self::getRevenueByBrand($args),
            default => ['error' => "Funcio '$name' no reconeguda."],
        };

        return json_encode($result, JSON_UNESCAPED_UNICODE);
    }

    /**
     * Obte els productes mes venuts segons les linies de comanda.
     *
     * Agrupa les linies de comanda per producte, suma quantitats i ingressos,
     * i retorna els productes ordenats per unitats venudes descendentment.
     *
     * @param  array  $args  Parametres: 'period' (YYYY-MM o YYYY), 'limit' (int).
     * @return array Llista de productes amb nom, unitats venudes i ingressos en EUR.
     */
    private static function getTopSellingProducts(array $args): array
    {
        $limit = $args['limit'] ?? 5;
        $period = $args['period'] ?? null;

        $query = DB::table('lunar_order_lines')
            ->join('lunar_orders', 'lunar_order_lines.order_id', '=', 'lunar_orders.id')
            ->join('lunar_product_variants', function ($join) {
                $join->on('lunar_order_lines.purchasable_id', '=', 'lunar_product_variants.id')
                    ->where('lunar_order_lines.purchasable_type', 'LIKE', '%ProductVariant%');
            })
            ->join('lunar_products', 'lunar_product_variants.product_id', '=', 'lunar_products.id')
            ->select(
                'lunar_products.id',
                'lunar_products.attribute_data',
                DB::raw('SUM(lunar_order_lines.quantity) as total_units'),
                DB::raw('SUM(lunar_order_lines.sub_total) as total_revenue')
            )
            ->where('lunar_order_lines.type', 'physical')
            ->groupBy('lunar_products.id', 'lunar_products.attribute_data');

        if ($period) {
            $query = self::applyPeriodFilter($query, $period, 'lunar_orders.placed_at');
        }

        $results = $query->orderByDesc('total_units')->limit($limit)->get();

        return $results->map(function ($item) {
            return [
                'product_id' => $item->id,
                'name' => self::extractProductName($item->attribute_data),
                'units_sold' => (int) $item->total_units,
                'revenue_eur' => round($item->total_revenue / 100, 2),
            ];
        })->toArray();
    }

    /**
     * Calcula els ingressos totals de la botiga.
     *
     * Suma subtotal, impostos, descomptes i total de totes les comandes
     * dins del periode especificat.
     *
     * @param  array  $args  Parametres: 'period' (YYYY-MM o YYYY).
     * @return array Resum financer amb total_orders, subtotal, tax, discounts i total en EUR.
     */
    private static function getTotalRevenue(array $args): array
    {
        $period = $args['period'] ?? null;

        $query = Order::query();

        if ($period) {
            $query = self::applyPeriodFilterEloquent($query, $period, 'placed_at');
        }

        $stats = $query->selectRaw('
            COUNT(*) as total_orders,
            COALESCE(SUM(sub_total), 0) as subtotal,
            COALESCE(SUM(tax_total), 0) as tax,
            COALESCE(SUM(discount_total), 0) as discounts,
            COALESCE(SUM(total), 0) as total
        ')->first();

        return [
            'total_orders' => (int) $stats->total_orders,
            'subtotal_eur' => round($stats->subtotal / 100, 2),
            'tax_eur' => round($stats->tax / 100, 2),
            'discounts_eur' => round($stats->discounts / 100, 2),
            'total_eur' => round($stats->total / 100, 2),
            'period' => $period ?? 'all_time',
        ];
    }

    /**
     * Obte el recompte de comandes agrupades per estat.
     *
     * Si s'especifica un estat concret, retorna nomes el recompte d'aquell estat.
     * Si no, retorna tots els estats amb els seus recomptes.
     *
     * @param  array  $args  Parametres: 'status' (string opcional).
     * @return array Recompte de comandes per estat.
     */
    private static function getOrdersByStatus(array $args): array
    {
        $status = $args['status'] ?? null;

        $query = Order::query()
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status');

        if ($status) {
            $query->where('status', $status);
        }

        $results = $query->get();

        return [
            'statuses' => $results->map(fn ($item) => [
                'status' => $item->status,
                'count' => (int) $item->count,
            ])->toArray(),
            'total' => $results->sum('count'),
        ];
    }

    /**
     * Obte els productes amb estoc per sota del llindar especificat.
     *
     * Cerca variants de producte amb estoc inferior al llindar i retorna
     * informacio del producte, SKU i nivell d'estoc actual.
     *
     * @param  array  $args  Parametres: 'threshold' (int, per defecte 10).
     * @return array Llista de variants amb estoc baix.
     */
    private static function getLowStockProducts(array $args): array
    {
        $threshold = $args['threshold'] ?? 10;

        $variants = ProductVariant::with('product')
            ->where('stock', '<=', $threshold)
            ->orderBy('stock', 'asc')
            ->limit(20)
            ->get();

        return $variants->map(function ($variant) {
            return [
                'product_name' => self::extractProductName(
                    $variant->product?->attribute_data
                ),
                'sku' => $variant->sku,
                'current_stock' => $variant->stock,
                'purchasable' => $variant->purchasable,
            ];
        })->toArray();
    }

    /**
     * Obte les comandes mes recents amb el seu detall basic.
     *
     * Retorna referencia, estat, total, moneda i data de cada comanda,
     * ordenades de la mes recent a la mes antiga.
     *
     * @param  array  $args  Parametres: 'limit' (int, per defecte 10).
     * @return array Llista de comandes recents.
     */
    private static function getRecentOrders(array $args): array
    {
        $limit = $args['limit'] ?? 10;

        $orders = Order::with('lines')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        return $orders->map(function ($order) {
            return [
                'id' => $order->id,
                'reference' => $order->reference,
                'status' => $order->status,
                'total_eur' => round($order->total / 100, 2),
                'currency' => $order->currency_code,
                'items_count' => $order->lines->where('type', 'physical')->sum('quantity'),
                'placed_at' => $order->placed_at?->format('Y-m-d H:i'),
                'created_at' => $order->created_at->format('Y-m-d H:i'),
            ];
        })->toArray();
    }

    /**
     * Obte estadistiques de clients registrats.
     *
     * Retorna el total de clients i, si s'especifica un periode,
     * el nombre de nous clients dins d'aquell periode.
     *
     * @param  array  $args  Parametres: 'period' (YYYY-MM o YYYY).
     * @return array Estadistiques de clients.
     */
    private static function getCustomerCount(array $args): array
    {
        $period = $args['period'] ?? null;

        $total = Customer::count();

        $result = [
            'total_customers' => $total,
        ];

        if ($period) {
            $query = Customer::query();
            $query = self::applyPeriodFilterEloquent($query, $period, 'created_at');
            $result['new_customers'] = $query->count();
            $result['period'] = $period;
        }

        return $result;
    }

    /**
     * Obte els ingressos desglossats per marca de producte.
     *
     * Agrupa les vendes per marca utilitzant les relacions entre
     * linies de comanda, variants, productes i marques.
     *
     * @param  array  $args  Parametres: 'period' (YYYY-MM o YYYY), 'limit' (int, per defecte 10).
     * @return array Llista de marques amb unitats venudes i ingressos en EUR.
     */
    private static function getRevenueByBrand(array $args): array
    {
        $period = $args['period'] ?? null;
        $limit = $args['limit'] ?? 10;

        $query = DB::table('lunar_order_lines')
            ->join('lunar_orders', 'lunar_order_lines.order_id', '=', 'lunar_orders.id')
            ->join('lunar_product_variants', function ($join) {
                $join->on('lunar_order_lines.purchasable_id', '=', 'lunar_product_variants.id')
                    ->where('lunar_order_lines.purchasable_type', 'LIKE', '%ProductVariant%');
            })
            ->join('lunar_products', 'lunar_product_variants.product_id', '=', 'lunar_products.id')
            ->join('lunar_brands', 'lunar_products.brand_id', '=', 'lunar_brands.id')
            ->select(
                'lunar_brands.name as brand_name',
                DB::raw('SUM(lunar_order_lines.quantity) as total_units'),
                DB::raw('SUM(lunar_order_lines.sub_total) as total_revenue')
            )
            ->where('lunar_order_lines.type', 'physical')
            ->groupBy('lunar_brands.id', 'lunar_brands.name');

        if ($period) {
            $query = self::applyPeriodFilter($query, $period, 'lunar_orders.placed_at');
        }

        $results = $query->orderByDesc('total_revenue')->limit($limit)->get();

        return $results->map(function ($item) {
            return [
                'brand' => $item->brand_name,
                'units_sold' => (int) $item->total_units,
                'revenue_eur' => round($item->total_revenue / 100, 2),
            ];
        })->toArray();
    }

    /**
     * Aplica un filtre de periode a una consulta del Query Builder.
     *
     * Interpreta el format del periode (YYYY-MM o YYYY) i afegeix
     * les condicions WHERE corresponents a la consulta.
     *
     * @param  \Illuminate\Database\Query\Builder  $query  Consulta a filtrar.
     * @param  string  $period  Periode en format YYYY-MM o YYYY.
     * @param  string  $column  Nom de la columna de data a filtrar.
     * @return \Illuminate\Database\Query\Builder Consulta amb el filtre aplicat.
     */
    private static function applyPeriodFilter($query, string $period, string $column)
    {
        if (preg_match('/^\d{4}-\d{2}$/', $period)) {
            $start = $period . '-01 00:00:00';
            $end = date('Y-m-t 23:59:59', strtotime($start));
            $query->whereBetween($column, [$start, $end]);
        } elseif (preg_match('/^\d{4}$/', $period)) {
            $query->whereBetween($column, ["$period-01-01 00:00:00", "$period-12-31 23:59:59"]);
        }

        return $query;
    }

    /**
     * Aplica un filtre de periode a una consulta Eloquent.
     *
     * Versio per a Eloquent Builder del metode applyPeriodFilter.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query  Consulta Eloquent a filtrar.
     * @param  string  $period  Periode en format YYYY-MM o YYYY.
     * @param  string  $column  Nom de la columna de data a filtrar.
     * @return \Illuminate\Database\Eloquent\Builder Consulta amb el filtre aplicat.
     */
    private static function applyPeriodFilterEloquent($query, string $period, string $column)
    {
        if (preg_match('/^\d{4}-\d{2}$/', $period)) {
            $start = $period . '-01 00:00:00';
            $end = date('Y-m-t 23:59:59', strtotime($start));
            $query->whereBetween($column, [$start, $end]);
        } elseif (preg_match('/^\d{4}$/', $period)) {
            $query->whereBetween($column, ["$period-01-01 00:00:00", "$period-12-31 23:59:59"]);
        }

        return $query;
    }

    /**
     * Extreu el nom del producte del camp attribute_data de Lunar.
     *
     * Lunar emmagatzema els atributs dels productes en format JSON.
     * El nom pot estar dins d'un objecte amb clau 'value' o directament
     * com a string, depenent de la versio de Lunar.
     *
     * @param  mixed  $attributeData  Dades d'atributs del producte (JSON string o objecte).
     * @return string Nom del producte o 'Unknown' si no es pot extreure.
     */
    private static function extractProductName($attributeData): string
    {
        if (is_string($attributeData)) {
            $attributeData = json_decode($attributeData, true);
        }

        if (is_object($attributeData)) {
            $attributeData = json_decode(json_encode($attributeData), true);
        }

        if (!is_array($attributeData)) {
            return 'Unknown';
        }

        $name = $attributeData['name'] ?? null;

        if (is_array($name)) {
            return $name['value'] ?? ($name['en'] ?? 'Unknown');
        }

        if (is_string($name)) {
            return $name;
        }

        return 'Unknown';
    }
}
