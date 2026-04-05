<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Pagination\LengthAwarePaginator;
use Lunar\Models\Product;
use Lunar\Models\Brand;
use Lunar\Models\Collection;
use Lunar\Models\ProductOption;
use App\Services\StockService;
use App\Services\ProductColorManager;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        try {
            // --- Query bàsica
            $q = $request->query('q');

            // --- Single (compat)
            $brandSingle = $request->query('brand');
            $typeSingle  = $request->query('type');
            $sizeSingle  = $request->query('size');
            $colorSingle = $request->query('color');

            // --- Multi (nou)
            $brandsParam = $request->query('brands');
            $typesParam  = $request->query('types');
            $sizesParam  = $request->query('sizes');
            $colorsParam = $request->query('colors');

            // --- Preus
            $minPriceCents = $request->query('min_price_cents');
            $maxPriceCents = $request->query('max_price_cents');

            if ($minPriceCents === null && $request->query('min_price') !== null) {
                $minPriceCents = (int) round(((float) $request->query('min_price')) * 100);
            }
            if ($maxPriceCents === null && $request->query('max_price') !== null) {
                $maxPriceCents = (int) round(((float) $request->query('max_price')) * 100);
            }

            $sort = $request->query('sort', 'newest');

            $perPage = (int) $request->query('per_page', 12);
            if ($perPage < 1) $perPage = 12;
            if ($perPage > 100) $perPage = 100;

            $page = (int) $request->query('page', 1);
            if ($page < 1) $page = 1;

            // --- Helper per normalitzar param -> array (CSV o array)
            $toList = function ($value) {
                if ($value === null || $value === '') return [];
                if (is_array($value)) {
                    return collect($value)->map(fn($v) => trim((string) $v))->filter()->values()->all();
                }
                return collect(explode(',', (string) $value))
                    ->map(fn($v) => trim($v))
                    ->filter()
                    ->values()
                    ->all();
            };

            // --- Normalitzem llistes finals (multi mana; si no, single)
            $brandsList = $toList($brandsParam);
            if (empty($brandsList) && $brandSingle) $brandsList = [trim((string) $brandSingle)];

            $typesList = $toList($typesParam);
            if (empty($typesList) && $typeSingle) $typesList = [trim((string) $typeSingle)];

            $sizesList = $toList($sizesParam);
            if (empty($sizesList) && $sizeSingle) $sizesList = [trim((string) $sizeSingle)];

            $colorsList = $toList($colorsParam);
            if (empty($colorsList) && $colorSingle) $colorsList = [trim((string) $colorSingle)];

            $brandsListNorm = collect($brandsList)->map(fn($b) => Str::lower($b))->values()->all();
            $typesListNorm  = collect($typesList)->map(fn($t) => Str::lower($t))->values()->all();
            $sizesListNorm  = collect($sizesList)->map(fn($s) => Str::lower($s))->values()->all();
            $colorsListNorm = collect($colorsList)->map(fn($c) => Str::lower($c))->values()->all();

            // ✅ Carreguem tot i filtrem en memòria (de moment)
            $products = Product::with([
                'variants.prices',
                'variants.values', // size/color
                'collections',     // type
                'thumbnailMedia',
                'brand',
            ])
                ->where('status', 'published')
                ->get();

            $getValueEn = function ($translated) {
                if (is_array($translated)) return $translated['en'] ?? null;
                if (is_object($translated) && isset($translated['en'])) return $translated['en'] ?? null;
                return null;
            };

            [$sizeOptionId, $colorOptionId] = $this->getOptionIds();

            $mapped = $products->map(function ($product) use ($getValueEn, $sizeOptionId, $colorOptionId) {
                $firstVariant = $product->variants->first();

                $priceCents = (int) ($firstVariant?->prices->first()?->price?->value ?? 0);

                $sizeValue = null;
                $colorValue = null;

                if ($firstVariant && $firstVariant->relationLoaded('values')) {
                    foreach ($firstVariant->values as $val) {
                        $vEn = $getValueEn($val->name);

                        if ($val->product_option_id === $sizeOptionId) $sizeValue = $vEn;
                        if ($val->product_option_id === $colorOptionId) $colorValue = $vEn;
                    }
                }

                $types = collect();
                if ($product->relationLoaded('collections')) {
                    $types = $product->collections
                        ->map(fn($c) => $c->translateAttribute('name'))
                        ->filter()
                        ->values();
                }

                return [
                    'id' => $product->id,
                    'name' => $product->translateAttribute('name'),
                    'brand' => $product->brand?->name ?? 'Sense marca',

                    'price' => $priceCents / 100,
                    'price_cents' => $priceCents,

                    'thumbnail' => $product->thumbnailMedia?->getUrl() ?? null,
                    'first_variant_id' => $firstVariant?->id,

                    'size' => $sizeValue,
                    'color' => $colorValue,
                    'types' => $types,

                    'stock_status' => $product->variants->isEmpty()
                        ? 'out_of_stock'
                        : ($product->variants->every(fn($v) => StockService::getStatus($v) === 'out_of_stock')
                            ? 'out_of_stock'
                            : 'in_stock'),

                    'created_at' => $product->created_at,
                ];
            });

            // --- Filtre: cerca
            if ($q) {
                $qNorm = Str::lower(trim($q));
                $mapped = $mapped->filter(function ($p) use ($qNorm) {
                    return Str::contains(Str::lower($p['name'] ?? ''), $qNorm);
                })->values();
            }

            // --- Brands (multi)
            if (!empty($brandsListNorm)) {
                $mapped = $mapped->filter(function ($p) use ($brandsListNorm) {
                    $b = Str::lower(trim((string) ($p['brand'] ?? '')));
                    return in_array($b, $brandsListNorm, true);
                })->values();
            }

            // --- Types (multi OR)
            if (!empty($typesListNorm)) {
                $mapped = $mapped->filter(function ($p) use ($typesListNorm) {
                    $types = collect($p['types'] ?? [])
                        ->map(fn($t) => Str::lower(trim((string) $t)))
                        ->values();

                    return $types->intersect($typesListNorm)->isNotEmpty();
                })->values();
            }

            // --- Sizes (multi)
            if (!empty($sizesListNorm)) {
                $mapped = $mapped->filter(function ($p) use ($sizesListNorm) {
                    $s = Str::lower(trim((string) ($p['size'] ?? '')));
                    return $s !== '' && in_array($s, $sizesListNorm, true);
                })->values();
            }

            // --- Colors (multi)
            if (!empty($colorsListNorm)) {
                $mapped = $mapped->filter(function ($p) use ($colorsListNorm) {
                    $c = Str::lower(trim((string) ($p['color'] ?? '')));
                    return $c !== '' && in_array($c, $colorsListNorm, true);
                })->values();
            }

            // --- Preu min/max
            if ($minPriceCents !== null && $minPriceCents !== '') {
                $min = (int) $minPriceCents;
                $mapped = $mapped->filter(fn($p) => (int) ($p['price_cents'] ?? 0) >= $min)->values();
            }
            if ($maxPriceCents !== null && $maxPriceCents !== '') {
                $max = (int) $maxPriceCents;
                $mapped = $mapped->filter(fn($p) => (int) ($p['price_cents'] ?? 0) <= $max)->values();
            }

            // --- Ordenació
            if ($sort === 'price_asc') {
                $mapped = $mapped->sortBy('price_cents')->values();
            } elseif ($sort === 'price_desc') {
                $mapped = $mapped->sortByDesc('price_cents')->values();
            } elseif ($sort === 'name_asc') {
                $mapped = $mapped->sortBy('name')->values();
            } elseif ($sort === 'name_desc') {
                $mapped = $mapped->sortByDesc('name')->values();
            } else {
                $mapped = $mapped->sortByDesc('created_at')->values();
            }

            // --- Paginació
            $total = $mapped->count();
            $itemsForCurrentPage = $mapped->slice(($page - 1) * $perPage, $perPage)->values();

            $paginator = new LengthAwarePaginator(
                $itemsForCurrentPage,
                $total,
                $perPage,
                $page,
                [
                    'path' => $request->url(),
                    'query' => $request->query(),
                ]
            );

            return response()->json([
                'data' => $paginator->items(),
                'meta' => [
                    'current_page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'last_page' => $paginator->lastPage(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error en obtenir productes',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function show($id)
    {
        $product = Product::with([
            'variants.prices',
            'variants.values',
            'thumbnailMedia',
        ])->findOrFail($id);

        $firstVariant = $product->variants->first();
        $priceValue   = $firstVariant?->prices->first()?->price->value ?? 0;

        [$sizeOptionId, $colorOptionId] = $this->getOptionIds();
        $getValueEn = fn($name) => is_array($name) ? ($name['en'] ?? null)
            : (is_object($name) ? ($name['en'] ?? null) : null);

        // Build colors structure from product_colors table
        $colors = app(ProductColorManager::class)->getColorsWithVariantData($product);

        return response()->json([
            'data' => [
                'id'          => $product->id,
                'name'        => $product->translateAttribute('name'),
                'description' => $product->translateAttribute('description'),
                'brand'       => $product->brand?->name ?? 'Sense marca',
                'price'       => $priceValue / 100,
                'thumbnail'   => $product->thumbnailMedia?->getUrl(),
                'images'      => [],
                'colors'      => $colors,   // NEW — per-color images + sizes
                'variants'    => $product->variants->map(function ($variant) use ($sizeOptionId, $colorOptionId, $getValueEn) {
                    $sizeVal  = $variant->values->first(fn($v) => $v->product_option_id === $sizeOptionId);
                    $colorVal = $variant->values->first(fn($v) => $v->product_option_id === $colorOptionId);

                    return [
                        'id'           => $variant->id,
                        'sku'          => $variant->sku,
                        'stock_status' => StockService::getStatus($variant),
                        'size'         => $sizeVal  ? $getValueEn($sizeVal->name)  : null,
                        'color'        => $colorVal ? $getValueEn($colorVal->name) : null,
                    ];
                }),
            ],
        ]);
    }

    /**
     * GET /api/products/filters
     */
    public function filters()
    {
        $brands = Brand::query()
            ->orderBy('name')
            ->pluck('name')
            ->values();

        $driver = DB::getDriverName();
        [$sizeOptionId, $colorOptionId] = $this->getOptionIds();

        $nameSelect = match ($driver) {
            'sqlite' => DB::raw("json_extract(name, '$.en') as name"),
            default  => DB::raw("JSON_UNQUOTE(JSON_EXTRACT(name, '$.en')) as name"),
        };

        $sizes = DB::table('lunar_product_option_values')
            ->select($nameSelect)
            ->where('product_option_id', $sizeOptionId)
            ->whereNotNull('name')
            ->distinct()
            ->orderBy('name')
            ->pluck('name')
            ->filter()
            ->values();

        $colors = DB::table('lunar_product_option_values')
            ->select($nameSelect)
            ->where('product_option_id', $colorOptionId)
            ->whereNotNull('name')
            ->distinct()
            ->orderBy('name')
            ->pluck('name')
            ->filter()
            ->values();

        $types = Collection::query()
            ->get()
            ->map(fn($c) => $c->translateAttribute('name'))
            ->filter()
            ->unique()
            ->values();

        return response()->json([
            'data' => [
                'brands' => $brands,
                'sizes'  => $sizes,
                'colors' => $colors,
                'types'  => $types,
            ],
        ]);
    }

    /**
     * Resol els IDs de les opcions 'talla' i 'color' per handle.
     * Evita dependre dels IDs numèrics de la BD.
     */
    private function getOptionIds(): array
    {
        $sizeOption  = ProductOption::where('handle', 'talla')->first();
        $colorOption = ProductOption::where('handle', 'color')->first();
        return [$sizeOption?->id, $colorOption?->id];
    }
}