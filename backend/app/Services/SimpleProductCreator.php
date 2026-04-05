<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Lunar\FieldTypes\TranslatedText;
use App\Models\Product;
use Lunar\Models\Brand;
use Lunar\Models\Currency;
use Lunar\Models\CustomerGroup;
use Lunar\Models\Price;
use Lunar\Models\ProductOption;
use Lunar\Models\ProductOptionValue;
use Lunar\Models\ProductType;
use Lunar\Models\ProductVariant;
use Lunar\Models\TaxClass;
use App\Services\StockService;

/**
 * Crea productes complets a Lunar amb una interfície simplificada.
 *
 * Abstrau tota la complexitat de Lunar (ProductType, TaxClass, Currency,
 * CustomerGroup, attribute_data, etc.) i permet crear un producte complet
 * amb un sol array de dades simple.
 */
class SimpleProductCreator
{
    public function __construct(
        private readonly SkuGenerator $skuGenerator
    ) {}

    /**
     * Crea un producte complet a Lunar.
     *
     * @param  array{
     *   name: string,
     *   description: string|null,
     *   brand_id: int|null,
     *   new_brand_name: string|null,
     *   price: float,
     *   collection_ids: int[],
     *   images: \Illuminate\Http\UploadedFile[],
     *   stock: int,
     *   has_variants: bool,
     *   variants: array<array{size: string, color: string, stock: int}>
     * } $data
     * @return \Lunar\Models\Product
     */
    public function create(array $data): Product
    {
        return DB::transaction(function () use ($data) {
            $locale = config('app.locale') ?: 'en';

            // 1. Dependències fixes de Lunar
            $productType   = ProductType::first();
            $taxClass      = TaxClass::first();
            $currency      = Currency::where('default', true)->first();
            $customerGroup = CustomerGroup::first();

            // 2. Marca
            $brandId = $this->resolveBrandId($data);

            // 3. Crear producte
            $product = Product::create([
                'product_type_id' => $productType->id,
                'status'          => 'published',
                'brand_id'        => $brandId,
                'slug'            => $this->generateUniqueSlug($data['name']),
                'attribute_data'  => [
                    'name'        => new TranslatedText([$locale => $data['name']]),
                    'description' => new TranslatedText([$locale => $data['description'] ?? '']),
                ],
            ]);

            // 4. Crear variant(s) i preus
            $brandName = $brandId
                ? Brand::find($brandId)?->name
                : ($data['new_brand_name'] ?? null);

            $hasVariants = !empty($data['has_variants']) && !empty($data['variants']);

            if ($hasVariants) {
                $this->createVariantsWithOptions(
                    $product, $data['variants'], $data['price'],
                    $brandName, $taxClass, $currency, $customerGroup, $locale
                );
            } else {
                $this->createSimpleVariant(
                    $product, $data, $brandName, $taxClass, $currency, $customerGroup
                );
            }

            // 5. Col·leccions
            if (!empty($data['collection_ids'])) {
                $product->collections()->sync($data['collection_ids']);
            }

            // 6. Imatges
            if (!empty($data['images'])) {
                $this->processImages($product, $data['images']);
            }

            return $product->fresh();
        });
    }

    /**
     * Actualitza un producte existent.
     */
    public function update(Product $product, array $data): Product
    {
        return DB::transaction(function () use ($product, $data) {
            $locale    = config('app.locale') ?: 'en';
            $brandId   = $this->resolveBrandId($data);

            $product->update([
                'brand_id'       => $brandId,
                'attribute_data' => [
                    'name'        => new TranslatedText([$locale => $data['name']]),
                    'description' => new TranslatedText([$locale => $data['description'] ?? '']),
                ],
            ]);

            // Actualitzar preu de la primera variant (cas simple)
            $firstVariant = $product->variants()->first();
            if ($firstVariant && isset($data['price'])) {
                $currency      = Currency::where('default', true)->first();
                $customerGroup = CustomerGroup::first();

                $price = Price::where('priceable_type', 'product_variant')
                    ->where('priceable_id', $firstVariant->id)
                    ->where('currency_id', $currency->id)
                    ->where('customer_group_id', $customerGroup->id)
                    ->first();

                if ($price) {
                    $price->update(['price' => (int) round($data['price'] * 100)]);
                }

                if (isset($data['stock'])) {
                    $stockDiff = (int) $data['stock'] - $firstVariant->stock;
                    if ($stockDiff !== 0) {
                        app(StockService::class)->adjust($firstVariant, $stockDiff, 'Stock update via admin', null);
                    }
                }
            }

            if (isset($data['collection_ids'])) {
                $product->collections()->sync($data['collection_ids']);
            }

            if (!empty($data['images'])) {
                $this->processImages($product, $data['images']);
            }

            return $product->fresh();
        });
    }

    // -------------------------------------------------------------------------
    // Privats
    // -------------------------------------------------------------------------

    private function resolveBrandId(array $data): ?int
    {
        if (!empty($data['brand_id'])) {
            return (int) $data['brand_id'];
        }

        if (!empty($data['new_brand_name'])) {
            $brand = Brand::firstOrCreate(['name' => trim($data['new_brand_name'])]);
            return $brand->id;
        }

        return null;
    }

    private function createSimpleVariant(
        Product $product,
        array $data,
        ?string $brandName,
        TaxClass $taxClass,
        Currency $currency,
        CustomerGroup $customerGroup
    ): ProductVariant {
        $sku = $this->skuGenerator->generate($data['name'], $brandName);

        $variant = ProductVariant::create([
            'product_id'  => $product->id,
            'tax_class_id'=> $taxClass->id,
            'sku'         => $sku,
            'purchasable' => 'in_stock',
            'stock'       => 0,
        ]);

        $stock = (int) ($data['stock'] ?? 0);
        if ($stock > 0) {
            app(StockService::class)->setInitial($variant, $stock);
        }

        Price::create([
            'customer_group_id' => $customerGroup->id,
            'currency_id'       => $currency->id,
            'priceable_type'    => 'product_variant',
            'priceable_id'      => $variant->id,
            'price'             => (int) round($data['price'] * 100),
            'min_quantity'      => 1,
        ]);

        return $variant;
    }

    private function createVariantsWithOptions(
        Product $product,
        array $variantsData,
        float $basePrice,
        ?string $brandName,
        TaxClass $taxClass,
        Currency $currency,
        CustomerGroup $customerGroup,
        string $locale
    ): void {
        $optCols   = Schema::getColumnListing('lunar_product_options');
        $valCols   = Schema::getColumnListing('lunar_product_option_values');
        $optHasHandle = in_array('handle', $optCols, true);
        $valHasHandle = in_array('handle', $valCols, true);

        $optSize  = $optHasHandle
            ? ProductOption::firstOrCreate(['handle' => 'talla'], ['name' => 'Talla'])
            : ProductOption::firstOrCreate(['name' => 'Talla']);

        $optColor = $optHasHandle
            ? ProductOption::firstOrCreate(['handle' => 'color'], ['name' => 'Color'])
            : ProductOption::firstOrCreate(['name' => 'Color']);

        foreach ($variantsData as $variantData) {
            $size  = trim($variantData['size'] ?? '');
            $color = trim($variantData['color'] ?? '');

            $optionValueIds = [];

            if ($size !== '') {
                $sizeValue = $valHasHandle
                    ? ProductOptionValue::firstOrCreate(
                        ['product_option_id' => $optSize->id, 'name' => [$locale => $size]],
                        ['handle' => 'talla-' . Str::slug($size)]
                    )
                    : ProductOptionValue::firstOrCreate(
                        ['product_option_id' => $optSize->id, 'name' => [$locale => $size]]
                    );
                $optionValueIds[] = $sizeValue->id;
            }

            if ($color !== '') {
                $colorValue = $valHasHandle
                    ? ProductOptionValue::firstOrCreate(
                        ['product_option_id' => $optColor->id, 'name' => [$locale => $color]],
                        ['handle' => 'color-' . Str::slug($color)]
                    )
                    : ProductOptionValue::firstOrCreate(
                        ['product_option_id' => $optColor->id, 'name' => [$locale => $color]]
                    );
                $optionValueIds[] = $colorValue->id;
            }

            $sku = $this->skuGenerator->generate(
                $product->translateAttribute('name'),
                $brandName,
                $size !== '' ? $size : null,
                $color !== '' ? $color : null
            );

            $variant = ProductVariant::create([
                'product_id'   => $product->id,
                'tax_class_id' => $taxClass->id,
                'sku'          => $sku,
                'purchasable'  => 'in_stock',
                'stock'        => 0,
            ]);

            $stock = (int) ($variantData['stock'] ?? 0);
            if ($stock > 0) {
                app(StockService::class)->setInitial($variant, $stock);
            }

            if (!empty($optionValueIds)) {
                if (method_exists($variant, 'optionValues')) {
                    $variant->optionValues()->syncWithoutDetaching($optionValueIds);
                } else {
                    $variant->values()->syncWithoutDetaching($optionValueIds);
                }
            }

            Price::create([
                'customer_group_id' => $customerGroup->id,
                'currency_id'       => $currency->id,
                'priceable_type'    => 'product_variant',
                'priceable_id'      => $variant->id,
                'price'             => (int) round($basePrice * 100),
                'min_quantity'      => 1,
            ]);
        }
    }

    private function processImages(Product $product, array $images): void
    {
        $isFirstImage = $product->thumbnail_id === null;

        foreach ($images as $image) {
            if (!$image) {
                continue;
            }

            if (is_string($image)) {
                if (!\Storage::disk('public')->exists($image)) {
                    continue;
                }
                $media = $product
                    ->addMediaFromDisk($image, 'public')
                    ->toMediaCollection('images');
            } else {
                if (!$image->isValid()) {
                    continue;
                }
                $media = $product
                    ->addMedia($image)
                    ->toMediaCollection('images');
            }

            if ($isFirstImage) {
                $product->update(['thumbnail_id' => $media->id]);
                $isFirstImage = false;
            }
        }
    }

    /**
     * Genera un slug únic per al producte.
     */
    public function generateUniqueSlug(string $name, ?int $excludeId = null): string
    {
        $base = Str::slug($name);
        if (!$base) {
            $base = 'producte';
        }

        $candidate = $base;
        $counter   = 1;

        while (
            Product::where('slug', $candidate)
                ->when($excludeId, fn($q) => $q->where('id', '!=', $excludeId))
                ->exists()
        ) {
            $counter++;
            $candidate = $base . '-' . $counter;
        }

        return $candidate;
    }
}
