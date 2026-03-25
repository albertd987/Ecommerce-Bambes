<?php
namespace App\Services;

use App\Models\Product;
use App\Models\ProductColor;
use App\Services\StockService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Price;
use Lunar\Models\ProductOption;
use Lunar\Models\ProductOptionValue;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;

class ProductColorManager
{
    public function __construct(private readonly SkuGenerator $skuGenerator) {}

    /**
     * Create or update a color for a product, syncing Lunar variants to match
     * the requested sizes. Safe to call multiple times — idempotent.
     */
    public function syncColor(Product $product, string $colorName, array $sizes): ProductColor
    {
        $colorName = strtoupper(trim($colorName));

        $productColor = ProductColor::firstOrNew(
            ['product_id' => $product->id, 'name' => $colorName]
        );

        if (!$productColor->exists) {
            $productColor->sort_order = ProductColor::where('product_id', $product->id)->count();
        }

        $productColor->sizes = array_values($sizes);
        $productColor->save();

        $this->syncVariants($product, $productColor, $sizes);

        return $productColor->fresh();
    }

    /**
     * Remove a color and all its Lunar variants from a product.
     */
    public function removeColor(Product $product, string $colorName): void
    {
        $colorName    = strtoupper(trim($colorName));
        $productColor = ProductColor::where('product_id', $product->id)
                                     ->where('name', $colorName)
                                     ->firstOrFail();

        // Find ALL color option values that match this name (there can be duplicates
        // with different casings created by different code paths).
        $colorOption = $this->getOrCreateOption('color', 'Color');
        $matchingValueIds = ProductOptionValue::where('product_option_id', $colorOption->id)
                                ->get()
                                ->filter(fn($v) => $this->getValueText($v->name) === $colorName)
                                ->pluck('id');

        if ($matchingValueIds->isNotEmpty()) {
            $junctionTable = $this->getVariantValuesTable();
            $variantIds    = DB::table($junctionTable)
                               ->whereIn('value_id', $matchingValueIds)
                               ->pluck('variant_id')
                               ->unique();

            if ($variantIds->isNotEmpty()) {
                // Clean up junction table rows first to avoid orphaned records
                DB::table($junctionTable)->whereIn('variant_id', $variantIds)->delete();

                $product->variants()
                        ->whereIn('id', $variantIds)
                        ->delete();
            }
        }

        $productColor->delete();
    }

    /**
     * Return all ProductColor records for a product, ordered by sort_order.
     */
    public function getColors(Product $product): Collection
    {
        return ProductColor::where('product_id', $product->id)
                           ->orderBy('sort_order')
                           ->orderBy('name')
                           ->get();
    }

    /**
     * Return colors with image URLs and per-size variant stock data.
     * Used by the API controller.
     */
    public function getColorsWithVariantData(Product $product): array
    {
        $colors                = $this->getColors($product);
        $variantsByColorAndSize = $this->buildVariantIndex($product);

        return $colors->map(function (ProductColor $color) use ($variantsByColorAndSize) {
            $sizeData = collect($color->sizes)->map(function (string $size) use ($color, $variantsByColorAndSize) {
                $key     = "{$color->name}|{$size}";
                $variant = $variantsByColorAndSize[$key] ?? null;

                return [
                    'size'         => $size,
                    'stock_status' => $variant ? StockService::getStatus($variant) : 'out_of_stock',
                    'variant_id'   => $variant?->id,
                ];
            })->values()->toArray();

            return [
                'name'   => $color->name,
                'images' => $color->image_urls,
                'sizes'  => $sizeData,
            ];
        })->toArray();
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function syncVariants(Product $product, ProductColor $productColor, array $sizes): void
    {
        $colorName   = $productColor->name;
        $sizeOption  = $this->getOrCreateOption('talla', 'Talla');
        $colorOption = $this->getOrCreateOption('color', 'Color');
        $colorValue  = $this->ensureOptionValue($colorOption, $colorName);
        $junctionTable = $this->getVariantValuesTable();

        // Find all variants for this product that have this color option value
        $variantIds       = DB::table($junctionTable)->where('value_id', $colorValue->id)->pluck('variant_id');
        $existingVariants = ProductVariant::whereIn('id', $variantIds)
                                          ->where('product_id', $product->id)
                                          ->with('values')
                                          ->get();

        // Index existing variants by size
        $sizeOptionId  = $sizeOption->id;
        $existingBySize = [];
        foreach ($existingVariants as $variant) {
            $sizeVal = $variant->values->firstWhere('product_option_id', $sizeOptionId);
            if ($sizeVal) {
                $sizeName = $this->getValueText($sizeVal->name);
                $existingBySize[$sizeName] = $variant;
            }
        }

        // Add missing variants
        foreach ($sizes as $size) {
            if (!isset($existingBySize[$size])) {
                $this->createVariant($product, $size, $colorName, $sizeOption, $colorValue);
            }
        }

        // Remove variants for sizes no longer in the list
        foreach ($existingBySize as $size => $variant) {
            if (!in_array($size, $sizes)) {
                $variant->delete();
            }
        }
    }

    private function createVariant(
        Product            $product,
        string             $size,
        string             $colorName,
        ProductOption      $sizeOption,
        ProductOptionValue $colorValue
    ): ProductVariant {
        $taxClass      = TaxClass::first();
        $currency      = Currency::where('default', true)->first();
        $customerGroup = CustomerGroup::first();

        $productName = $product->translateAttribute('name');
        $brandName   = $product->brand?->name;
        $sku         = $this->skuGenerator->generate($productName, $brandName, $size, $colorName);

        $variant = ProductVariant::create([
            'product_id'   => $product->id,
            'tax_class_id' => $taxClass->id,
            'sku'          => $sku,
            'purchasable'  => 'in_stock',
            'stock'        => 0,
        ]);

        // Attach color option value
        $this->attachOptionValue($variant, $colorValue->id);

        // Attach size option value
        if ($size !== '') {
            $sizeValue = $this->ensureOptionValue($sizeOption, $size);
            $this->attachOptionValue($variant, $sizeValue->id);
        }

        // Inherit price from an existing variant, or create 0-price record
        $existingPrice = $product->variants()
            ->whereKeyNot($variant->id)
            ->with('prices')
            ->first()?->prices->first();

        Price::create([
            'customer_group_id' => $customerGroup->id,
            'currency_id'       => $currency->id,
            'priceable_type'    => 'product_variant',
            'priceable_id'      => $variant->id,
            'price'             => $existingPrice ? $existingPrice->price->value : 0,
            'min_quantity'      => 1,
        ]);

        return $variant;
    }

    private function ensureOptionValue(ProductOption $option, string $name): ProductOptionValue
    {
        $upperName = strtoupper($name);
        $locale    = config('app.locale', 'en');

        // The name column is a JSON column; we must use JSON_EXTRACT to find existing values
        // because MySQL won't match an array against a stored JSON string via a plain WHERE.
        $existing = ProductOptionValue::where('product_option_id', $option->id)
            ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(name, '$." . $locale . "')) = ?", [$upperName])
            ->first();

        if ($existing) {
            return $existing;
        }

        return ProductOptionValue::create([
            'product_option_id' => $option->id,
            'name'              => [$locale => $upperName],
        ]);
    }

    private function getOrCreateOption(string $handle, string $displayName): ProductOption
    {
        $optCols   = Schema::getColumnListing('lunar_product_options');
        $hasHandle = in_array('handle', $optCols, true);

        if ($hasHandle) {
            return ProductOption::firstOrCreate(
                ['handle' => $handle],
                ['name' => [config('app.locale', 'en') => $displayName]]
            );
        }

        return ProductOption::firstOrCreate(['name' => $displayName]);
    }

    private function attachOptionValue(ProductVariant $variant, int $valueId): void
    {
        if (method_exists($variant, 'optionValues')) {
            $variant->optionValues()->syncWithoutDetaching([$valueId]);
        } else {
            $variant->values()->syncWithoutDetaching([$valueId]);
        }
    }

    private function getVariantValuesTable(): string
    {
        $tables = ['product_option_value_product_variant', 'lunar_product_option_value_product_variant'];
        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                return $table;
            }
        }
        throw new \RuntimeException('Cannot find product_option_value_product_variant junction table');
    }

    private function getValueText(mixed $name): string
    {
        // Lunar casts the name column as AsArrayObject — handle ArrayObject first
        if ($name instanceof \ArrayObject) {
            $arr = (array) $name;
            $locale = config('app.locale', 'en');
            return strtoupper($arr[$locale] ?? reset($arr) ?: '');
        }
        if (is_array($name)) {
            $locale = config('app.locale', 'en');
            return strtoupper($name[$locale] ?? reset($name) ?? '');
        }
        if (is_string($name)) {
            $decoded = json_decode($name, true);
            if (is_array($decoded)) {
                $locale = config('app.locale', 'en');
                return strtoupper($decoded[$locale] ?? reset($decoded) ?? '');
            }
            return strtoupper($name);
        }
        return '';
    }

    private function buildVariantIndex(Product $product): array
    {
        [$sizeOptionId, $colorOptionId] = $this->getOptionIdPair();

        $variants = $product->variants()->with('values')->get();
        $index    = [];

        foreach ($variants as $variant) {
            $sizeVal  = $variant->values->firstWhere('product_option_id', $sizeOptionId);
            $colorVal = $variant->values->firstWhere('product_option_id', $colorOptionId);

            if ($sizeVal && $colorVal) {
                $size  = $this->getValueText($sizeVal->name);
                $color = $this->getValueText($colorVal->name);
                $index["{$color}|{$size}"] = $variant;
            }
        }

        return $index;
    }

    private function getOptionIdPair(): array
    {
        $sizeOption  = ProductOption::where('handle', 'talla')->first()
                    ?? ProductOption::where('name', 'Talla')->first();
        $colorOption = ProductOption::where('handle', 'color')->first()
                    ?? ProductOption::where('name', 'Color')->first();

        return [$sizeOption?->id, $colorOption?->id];
    }
}
