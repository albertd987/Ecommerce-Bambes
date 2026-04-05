# Color & Image Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow backoffice users to manage per-color images, names, and available sizes per product, with the frontend displaying the correct images when a color is selected.

**Architecture:** A new `product_colors` table is the source of truth for which colors a product has and which sizes are available per color. Each `ProductColor` owns its images via Spatie MediaLibrary. A `ProductColorManager` service keeps Lunar variants in sync with the color/size data. A dedicated Filament page (same pattern as `ManageProductStock`) provides the UI. The API is updated to return a `colors` structure instead of a flat `variants` array. The frontend uses color images dynamically when a color is selected.

**Tech Stack:** Laravel 11, Lunar v1.2, Filament v3, Spatie MediaLibrary v11, Livewire v3, React 19

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `backend/config/bambes.php` | Available shoe sizes list (single source of truth) |
| `backend/database/migrations/2026_03_24_000001_create_product_colors_table.php` | Schema: product_colors table |
| `backend/app/Models/ProductColor.php` | Eloquent model with Spatie HasMedia |
| `backend/app/Services/ProductColorManager.php` | Business logic: sync colors ↔ Lunar variants |
| `backend/app/Filament/Lunar/Pages/ManageProductColors.php` | Filament Livewire page (colors UI) |
| `backend/app/Filament/Lunar/Extensions/ProductResourceColorsExtension.php` | Registers the ManageProductColors route + subnav |
| `backend/resources/views/filament/pages/manage-product-colors.blade.php` | Blade template for colors page |
| `backend/app/Console/Commands/MigrateProductColors.php` | One-time: convert existing variants → product_colors records |
| `backend/tests/Feature/ProductColors/ProductColorManagerTest.php` | Service unit tests |
| `backend/tests/Feature/Api/ProductColorsApiTest.php` | API response structure tests |

### Modified files
| File | Change |
|---|---|
| `backend/app/Providers/AppServiceProvider.php` | Register `ProductResourceColorsExtension` |
| `backend/app/Filament/Lunar/Extensions/ProductResourceExtension.php` | Redirect after product creation to colors page |
| `backend/app/Http/Controllers/Api/ProductController.php` | Return `colors` array (with images + sizes) in `show()` |
| `frontend/src/utils/variantParser.js` | Add `organizeColors()` helper for new API structure |
| `frontend/src/pages/ProductDetailPage.jsx` | Use `product.colors`, dynamic images per selected color |

---

## Critical patterns to follow

**Extension registration** (from `AppServiceProvider`):
```php
LunarPanel::extensions([
    LunarListProducts::class     => ProductResourceExtension::class,
    LunarProductResource::class  => ProductResourceStockExtension::class,
]);
```
Lunar's `extensions()` method supports **arrays of extensions per key** (verified in `LunarPanelManager::extensions()` lines 286–303). To add a second extension for the same resource, pass an array:
```php
LunarProductResource::class => [
    ProductResourceStockExtension::class,
    ProductResourceColorsExtension::class,
],
```
Each extension's hooks are called in order. Keep the two extension classes separate.

**Variant option value creation** (from `SimpleProductCreator::createVariantsWithOptions`):
- Always check if `handle` column exists on `lunar_product_option_values` before using it
- Use `$variant->optionValues()` if the method exists, otherwise `$variant->values()`
- `priceable_type` for Price records is the string `'product_variant'` (not `::class`)
- Stock is set to 0 on creation; use `StockService::setInitial()` for initial stock

**Media collections** (from `App\Models\Product`):
- Images stored via `$model->addMedia($file)->toMediaCollection('images')`
- Thumbnail set by updating `thumbnail_id` column with the media ID
- `ProductColor` uses the same Spatie pattern but with its own `images` collection

---

## Task 1: Available sizes config

**Files:**
- Create: `backend/config/bambes.php`

- [ ] **Step 1: Create config**

```php
<?php
// backend/config/bambes.php
return [
    /*
     * Available shoe sizes shown in the backoffice color management page.
     * Modify this list to add or remove sizes for all products.
     */
    'sizes' => ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'],
];
```

- [ ] **Step 2: Commit**
```bash
git add backend/config/bambes.php
git commit -m "feat: add bambes config with available shoe sizes"
```

---

## Task 2: ProductColor model and migration

**Files:**
- Create: `backend/database/migrations/2026_03_24_000001_create_product_colors_table.php`
- Create: `backend/app/Models/ProductColor.php`
- Create (test): `backend/tests/Feature/ProductColors/ProductColorManagerTest.php`

- [ ] **Step 1: Write the failing test (model basics)**

```php
<?php
// backend/tests/Feature/ProductColors/ProductColorManagerTest.php
namespace Tests\Feature\ProductColors;

use App\Models\ProductColor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\CustomerGroup;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class ProductColorManagerTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
        CustomerGroup::factory()->create(['default' => true]);
    }

    public function test_can_create_product_color_with_sizes_as_array(): void
    {
        $product = \Lunar\Models\Product::factory()->create([
            'product_type_id' => $this->productType->id,
            'status'          => 'published',
        ]);

        $color = ProductColor::create([
            'product_id' => $product->id,
            'name'       => 'BLANC',
            'sizes'      => ['41', '42', '43'],
            'sort_order' => 0,
        ]);

        $this->assertSame('BLANC', $color->name);
        $this->assertSame(['41', '42', '43'], $color->sizes);
        $this->assertSame($product->id, $color->product_id);
    }

    public function test_enforces_unique_name_per_product(): void
    {
        $product = \Lunar\Models\Product::factory()->create([
            'product_type_id' => $this->productType->id,
        ]);

        ProductColor::create(['product_id' => $product->id, 'name' => 'BLANC', 'sizes' => ['41']]);

        $this->expectException(\Illuminate\Database\QueryException::class);
        ProductColor::create(['product_id' => $product->id, 'name' => 'BLANC', 'sizes' => ['42']]);
    }
```

- [ ] **Step 2: Run tests — verify they fail**
```bash
cd backend && php artisan test --filter="ProductColorManagerTest" 2>&1 | head -20
```
Expected: FAIL — table `product_colors` does not exist

- [ ] **Step 3: Create migration**

```php
<?php
// backend/database/migrations/2026_03_24_000001_create_product_colors_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_colors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')
                  ->constrained('lunar_products')
                  ->cascadeOnDelete();
            $table->string('name', 100);   // Stored uppercase: "BLANC", "NEGRE"
            $table->json('sizes');          // ["41", "42", "43"]
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['product_id', 'name']); // One record per color per product
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_colors');
    }
};
```

- [ ] **Step 4: Create ProductColor model**

```php
<?php
// backend/app/Models/ProductColor.php
namespace App\Models;

use App\Models\Product;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class ProductColor extends Model implements HasMedia
{
    use InteractsWithMedia;

    protected $fillable = ['product_id', 'name', 'sizes', 'sort_order'];

    protected $casts = [
        'sizes' => 'array',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('images')
             ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('thumb')
             ->width(300)
             ->height(300)
             ->nonQueued();
    }

    /** Returns full URLs for all images in this color. */
    public function getImageUrlsAttribute(): array
    {
        return $this->getMedia('images')
                    ->map(fn($m) => $m->getUrl())
                    ->toArray();
    }
}
```

- [ ] **Step 5: Run migration**
```bash
cd backend && php artisan migrate
```
Expected: `product_colors` table created successfully

- [ ] **Step 6: Run tests — should pass**
```bash
cd backend && php artisan test --filter="ProductColorManagerTest"
```
Expected: 2 passed

- [ ] **Step 7: Commit**
```bash
git add backend/database/migrations/2026_03_24_000001_create_product_colors_table.php \
        backend/app/Models/ProductColor.php \
        backend/tests/Feature/ProductColors/ProductColorManagerTest.php
git commit -m "feat: add ProductColor model and migration"
```

---

## Task 3: ProductColorManager service

**Files:**
- Create: `backend/app/Services/ProductColorManager.php`
- Modify (tests): `backend/tests/Feature/ProductColors/ProductColorManagerTest.php`

This service is the core logic. It translates "color + sizes" definitions into Lunar variants, following the same patterns as `SimpleProductCreator::createVariantsWithOptions()`.

- [ ] **Step 1: Add service tests to the test file**

Add these methods to the `ProductColorManagerTest` class. Also add the missing imports at the top of the file:

```php
// Add to imports at top of ProductColorManagerTest.php:
use App\Services\ProductColorManager;
use Lunar\Models\ProductOption;
use Lunar\Models\ProductVariant;
use Illuminate\Support\Facades\Schema;
```

Add these to `setUp()` (after `$this->setUpLunar()`):
```php
// Ensure product options exist (required for variant creation)
$optCols   = Schema::getColumnListing('lunar_product_options');
$hasHandle = in_array('handle', $optCols);
if ($hasHandle) {
    ProductOption::firstOrCreate(['handle' => 'talla'], ['name' => ['en' => 'Size', 'ca' => 'Talla']]);
    ProductOption::firstOrCreate(['handle' => 'color'], ['name' => ['en' => 'Color', 'ca' => 'Color']]);
} else {
    ProductOption::firstOrCreate(['name' => 'Talla']);
    ProductOption::firstOrCreate(['name' => 'Color']);
}
```

Then add these test methods to the class:

```php
    private function makeProduct(): \Lunar\Models\Product
    {
        return \Lunar\Models\Product::factory()->create([
            'product_type_id' => $this->productType->id,
            'status'          => 'published',
        ]);
    }

    public function test_sync_color_creates_product_color_record(): void
    {
        $product = $this->makeProduct();
        $manager = app(ProductColorManager::class);

        $color = $manager->syncColor($product, 'BLANC', ['41', '42']);

        $this->assertTrue(
            ProductColor::where('product_id', $product->id)->where('name', 'BLANC')->exists()
        );
        $this->assertSame(['41', '42'], $color->sizes);
    }

    public function test_sync_color_creates_one_variant_per_size(): void
    {
        $product = $this->makeProduct();
        $manager = app(ProductColorManager::class);

        $manager->syncColor($product, 'BLANC', ['41', '42', '43']);

        $this->assertSame(3, $product->variants()->count());
    }

    public function test_sync_color_adding_sizes_creates_new_variants_without_touching_existing(): void
    {
        $product = $this->makeProduct();
        $manager = app(ProductColorManager::class);

        $manager->syncColor($product, 'BLANC', ['41', '42']);
        $existingIds = $product->variants()->pluck('id')->toArray();

        $manager->syncColor($product, 'BLANC', ['41', '42', '43']);

        $this->assertSame(3, $product->variants()->count());
        foreach ($existingIds as $id) {
            $this->assertNotNull(ProductVariant::find($id));
        }
    }

    public function test_sync_color_removing_sizes_deletes_corresponding_variant(): void
    {
        $product = $this->makeProduct();
        $manager = app(ProductColorManager::class);

        $manager->syncColor($product, 'BLANC', ['41', '42', '43']);
        $manager->syncColor($product, 'BLANC', ['41', '42']);

        $this->assertSame(2, $product->variants()->count());
    }

    public function test_two_colors_create_correct_total_variant_count(): void
    {
        $product = $this->makeProduct();
        $manager = app(ProductColorManager::class);

        $manager->syncColor($product, 'BLANC', ['41', '42']);
        $manager->syncColor($product, 'NEGRE', ['41', '43']);

        $this->assertSame(4, $product->variants()->count());
    }

    public function test_remove_color_deletes_product_color_and_variants(): void
    {
        $product = $this->makeProduct();
        $manager = app(ProductColorManager::class);

        $manager->syncColor($product, 'BLANC', ['41', '42']);
        $manager->removeColor($product, 'BLANC');

        $this->assertSame(0, ProductColor::where('product_id', $product->id)->count());
        $this->assertSame(0, $product->variants()->count());
    }

    public function test_remove_color_only_deletes_its_own_variants(): void
    {
        $product = $this->makeProduct();
        $manager = app(ProductColorManager::class);

        $manager->syncColor($product, 'BLANC', ['41', '42']);
        $manager->syncColor($product, 'NEGRE', ['41']);
        $manager->removeColor($product, 'BLANC');

        $this->assertSame(1, $product->variants()->count()); // Only NEGRE-41 remains
    }

    public function test_get_colors_returns_all_colors_for_product(): void
    {
        $product = $this->makeProduct();
        $manager = app(ProductColorManager::class);

        $manager->syncColor($product, 'BLANC', ['41']);
        $manager->syncColor($product, 'NEGRE', ['41']);

        $colors = $manager->getColors($product);

        $this->assertCount(2, $colors);
        $this->assertContains('BLANC', $colors->pluck('name')->toArray());
        $this->assertContains('NEGRE', $colors->pluck('name')->toArray());
    }
} // end class
```

- [ ] **Step 2: Run tests — verify they fail**
```bash
cd backend && php artisan test --filter="ProductColorManagerTest" 2>&1 | head -30
```
Expected: multiple FAILs — `ProductColorManager` class not found

- [ ] **Step 3: Implement ProductColorManager**

```php
<?php
// backend/app/Services/ProductColorManager.php
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

        // Find variant IDs linked to this color's option value
        $colorOption = $this->getOrCreateOption('color', 'Color');
        $locale      = config('app.locale', 'en');
        $colorValue  = ProductOptionValue::where('product_option_id', $colorOption->id)
                           ->get()
                           ->first(fn($v) => $this->getValueText($v->name) === $colorName);

        if ($colorValue) {
            $junctionTable  = $this->getVariantValuesTable();
            $variantIds     = DB::table($junctionTable)
                                ->where('value_id', $colorValue->id)
                                ->pluck('variant_id');

            ProductVariant::whereIn('id', $variantIds)
                          ->where('product_id', $product->id)
                          ->delete();
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
     *
     * Returns:
     * [
     *   ['name' => 'BLANC', 'images' => [...urls], 'sizes' => [
     *     ['size' => '41', 'stock_status' => 'in_stock', 'variant_id' => 5],
     *     ...
     *   ]],
     *   ...
     * ]
     */
    public function getColorsWithVariantData(Product $product): array
    {
        $colors       = $this->getColors($product);
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
        $variantIds     = DB::table($junctionTable)->where('value_id', $colorValue->id)->pluck('variant_id');
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
        $valCols   = Schema::getColumnListing('lunar_product_option_values');
        $hasHandle = in_array('handle', $valCols, true);

        if ($hasHandle) {
            return ProductOptionValue::firstOrCreate(
                ['product_option_id' => $option->id, 'name' => [$locale => $upperName]],
                ['handle' => strtolower($option->handle ?? 'opt') . '-' . \Illuminate\Support\Str::slug($upperName)]
            );
        }

        return ProductOptionValue::firstOrCreate(
            ['product_option_id' => $option->id, 'name' => [$locale => $upperName]]
        );
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
        // Determine the correct junction table name
        // Lunar uses 'product_option_value_product_variant' or similar
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
        if (is_array($name)) {
            return strtoupper($name['en'] ?? reset($name) ?? '');
        }
        if (is_string($name)) {
            $decoded = json_decode($name, true);
            if (is_array($decoded)) {
                return strtoupper($decoded['en'] ?? reset($decoded) ?? '');
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
```

- [ ] **Step 4: Run all service tests**
```bash
cd backend && php artisan test --filter="ProductColorManagerTest"
```
Expected: all 9 tests PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/Services/ProductColorManager.php \
        backend/tests/Feature/ProductColors/ProductColorManagerTest.php
git commit -m "feat: add ProductColorManager service with variant sync logic"
```

---

## Task 4: API update — return colors structure

**Files:**
- Modify: `backend/app/Http/Controllers/Api/ProductController.php`
- Create (test): `backend/tests/Feature/Api/ProductColorsApiTest.php`

The `show()` endpoint adds a `colors` key. The existing `variants` key is kept during transition so nothing breaks before the frontend is updated. `variants` will be removed in Task 9.

- [ ] **Step 1: Write API tests**

```php
<?php
// backend/tests/Feature/Api/ProductColorsApiTest.php
namespace Tests\Feature\Api;

use App\Models\ProductColor;
use App\Services\ProductColorManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\CustomerGroup;
use Lunar\Models\ProductOption;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class ProductColorsApiTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
        CustomerGroup::factory()->create(['default' => true]);

        // Ensure color/size options exist
        ProductOption::firstOrCreate(['handle' => 'talla'], ['name' => ['en' => 'Size', 'ca' => 'Talla']]);
        ProductOption::firstOrCreate(['handle' => 'color'], ['name' => ['en' => 'Color', 'ca' => 'Color']]);
    }

    private function makeProduct(): \Lunar\Models\Product
    {
        return \Lunar\Models\Product::factory()->create([
            'product_type_id' => $this->productType->id,
            'status'          => 'published',
        ]);
    }

    public function test_returns_colors_array_in_product_show_response(): void
    {
        $product = $this->makeProduct();
        $manager = app(ProductColorManager::class);
        $manager->syncColor($product, 'BLANC', ['41', '42']);

        $response = $this->getJson("/api/products/{$product->id}");

        $response->assertOk();
        $response->assertJsonPath('data.colors.0.name', 'BLANC');
        $response->assertJsonPath('data.colors.0.sizes.0.size', '41');
        $response->assertJsonStructure(['data' => ['colors' => [['name', 'images', 'sizes']]]]);
    }

    public function test_returns_empty_images_array_when_no_images_uploaded(): void
    {
        $product = $this->makeProduct();
        app(ProductColorManager::class)->syncColor($product, 'NEGRE', ['41']);

        $response = $this->getJson("/api/products/{$product->id}");

        $response->assertOk();
        $response->assertJsonPath('data.colors.0.images', []);
    }

    public function test_returns_empty_colors_array_when_no_product_colors_exist(): void
    {
        $product = $this->makeProduct();

        $response = $this->getJson("/api/products/{$product->id}");

        $response->assertOk();
        $response->assertJsonPath('data.colors', []);
    }

    public function test_returns_stock_status_per_size_within_color(): void
    {
        $product = $this->makeProduct();
        app(ProductColorManager::class)->syncColor($product, 'BLANC', ['41']);

        $response = $this->getJson("/api/products/{$product->id}");

        $response->assertJsonPath('data.colors.0.sizes.0.stock_status', 'out_of_stock');
    }
}
```

- [ ] **Step 2: Run tests — verify they fail**
```bash
cd backend && php artisan test --filter="ProductColorsApiTest" 2>&1 | head -20
```
Expected: FAIL — `colors` key not in response

- [ ] **Step 3: Update `ProductController::show()`**

In `backend/app/Http/Controllers/Api/ProductController.php`, add the `colors` data to the response. Add these imports at the top:

```php
use App\Services\ProductColorManager;
```

Replace the `show()` method body to add `colors` alongside `variants`:

```php
public function show($id)
{
    $product = Product::with([
        'variants.prices',
        'variants.values',
        'thumbnail',
        'images',
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
            'thumbnail'   => $product->thumbnail?->getUrl(),
            'images'      => $product->images->map(fn($img) => $img->getUrl()),
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
```

- [ ] **Step 4: Run API tests**
```bash
cd backend && php artisan test --filter="ProductColorsApiTest"
```
Expected: 4 PASS

- [ ] **Step 5: Commit**
```bash
git add backend/app/Http/Controllers/Api/ProductController.php \
        backend/tests/Feature/Api/ProductColorsApiTest.php
git commit -m "feat: add colors array to product show API response"
```

---

## Task 5: ManageProductColors Filament page

**Files:**
- Create: `backend/app/Filament/Lunar/Pages/ManageProductColors.php`
- Create: `backend/resources/views/filament/pages/manage-product-colors.blade.php`
- Create: `backend/app/Filament/Lunar/Extensions/ProductResourceColorsExtension.php`

### Task 5a: The Filament page class

The page provides these Actions (all via Filament modals):
- **addColorAction** — name input + size checkboxes → calls `ProductColorManager::syncColor()`
- **editColorAction($colorId)** — same form pre-filled → updates sizes
- **addImagesAction($colorId)** — FileUpload → calls `$productColor->addMedia()`
- **deleteImageAction($mediaId, $colorId)** — confirmation → deletes media
- **deleteColorAction($colorId)** — confirmation → calls `ProductColorManager::removeColor()`

```php
<?php
// backend/app/Filament/Lunar/Pages/ManageProductColors.php
namespace App\Filament\Lunar\Pages;

use App\Models\ProductColor;
use App\Services\ProductColorManager;
use Filament\Actions\Action;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\Concerns\InteractsWithRecord;
use Filament\Resources\Pages\Page;
use Illuminate\Contracts\Support\Htmlable;
use Lunar\Admin\Filament\Resources\ProductResource;

class ManageProductColors extends Page implements HasForms
{
    use InteractsWithForms;
    use InteractsWithRecord;

    protected static string $resource = ProductResource::class;
    protected static string $view     = 'filament.pages.manage-product-colors';

    public function mount(int|string $record): void
    {
        $this->record = $this->resolveRecord($record);
    }

    public function getTitle(): string|Htmlable
    {
        return 'Colors i Imatges';
    }

    public static function getNavigationLabel(): string
    {
        return 'Colors i Imatges';
    }

    public static function getNavigationIcon(): ?string
    {
        return 'heroicon-o-swatch';
    }

    public function getBreadcrumb(): string
    {
        return 'Colors i Imatges';
    }

    /** Computed property — refreshes automatically after Livewire actions */
    public function getColorsProperty(): \Illuminate\Support\Collection
    {
        return app(ProductColorManager::class)
            ->getColors($this->getRecord())
            ->map(function (ProductColor $color) {
                return (object) [
                    'id'         => $color->id,
                    'name'       => $color->name,
                    'sizes'      => $color->sizes,
                    'images'     => $color->getMedia('images')->map(fn($m) => (object) [
                        'id'  => $m->id,
                        'url' => $m->getUrl(),
                    ]),
                ];
            });
    }

    public function getAvailableSizesProperty(): array
    {
        return config('bambes.sizes', []);
    }

    // -------------------------------------------------------------------------
    // Header Actions — ALL actions (visible and hidden modal triggers) go here.
    // In Filament v3, getActions() is deprecated; use getHeaderActions() only.
    // Hidden actions are not rendered as buttons but can be triggered via
    // $this->mountAction('name', arguments: [...]) from Livewire methods.
    // -------------------------------------------------------------------------

    protected function getHeaderActions(): array
    {
        return [
            // ── Visible button ───────────────────────────────────────────────
            Action::make('addColor')
                ->label('Afegir color nou')
                ->icon('heroicon-o-plus')
                ->form($this->colorForm())
                ->action(function (array $data): void {
                    app(ProductColorManager::class)->syncColor(
                        $this->getRecord(),
                        $data['name'],
                        $data['sizes'] ?? []
                    );
                    Notification::make()->title('Color afegit correctament')->success()->send();
                }),

            // ── Hidden modal: edit color (triggered from Blade via editColor()) ──
            Action::make('editColorModal')
                ->hidden()
                ->modalHeading('Editar color')
                ->form($this->colorForm())
                ->fillForm(fn(array $arguments) => [
                    'name'  => $arguments['name'] ?? '',
                    'sizes' => $arguments['sizes'] ?? [],
                ])
                ->action(function (array $data): void {
                    app(ProductColorManager::class)->syncColor(
                        $this->getRecord(),
                        $data['name'],
                        $data['sizes'] ?? []
                    );
                    Notification::make()->title('Color actualitzat')->success()->send();
                }),

            // ── Hidden modal: add images (triggered from Blade via addImages()) ──
            Action::make('addImagesModal')
                ->hidden()
                ->modalHeading('Afegir imatges')
                ->form([
                    FileUpload::make('images')
                        ->label('Selecciona les imatges')
                        ->multiple()
                        ->image()
                        ->reorderable()
                        ->maxFiles(10)
                        ->maxSize(5120)
                        ->acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])
                        ->helperText('Màx. 10 imatges, 5 MB cadascuna.'),
                ])
                ->action(function (array $data, array $arguments): void {
                    $color = ProductColor::where('product_id', $this->getRecord()->id)
                                         ->findOrFail($arguments['colorId']);
                    foreach ($data['images'] ?? [] as $file) {
                        if ($file) {
                            $color->addMedia($file)->toMediaCollection('images');
                        }
                    }
                    Notification::make()->title('Imatges afegides')->success()->send();
                }),
        ];
    }

    // -------------------------------------------------------------------------
    // Per-color Livewire methods (called from Blade with wire:click)
    // -------------------------------------------------------------------------

    public function editColor(int $colorId): void
    {
        $color = ProductColor::findOrFail($colorId);
        $this->mountAction('editColorModal', [
            'colorId' => $colorId,
            'name'    => $color->name,
            'sizes'   => $color->sizes,
        ]);
    }

    public function addImages(int $colorId): void
    {
        $this->mountAction('addImagesModal', ['colorId' => $colorId]);
    }

    public function deleteImage(int $mediaId): void
    {
        $media = \Spatie\MediaLibrary\MediaCollections\Models\Media::findOrFail($mediaId);
        // Security: ensure this media belongs to a ProductColor of this product
        $color = ProductColor::where('product_id', $this->getRecord()->id)->find($media->model_id);
        if ($color && $media->model_type === ProductColor::class) {
            $media->delete();
            Notification::make()->title('Imatge eliminada')->success()->send();
        }
    }

    public function deleteColor(int $colorId): void
    {
        $color = ProductColor::where('product_id', $this->getRecord()->id)->findOrFail($colorId);
        app(ProductColorManager::class)->removeColor($this->getRecord(), $color->name);
        Notification::make()->title('Color eliminat')->success()->send();
    }

    // -------------------------------------------------------------------------
    // Shared form schema
    // -------------------------------------------------------------------------

    private function colorForm(): array
    {
        return [
            TextInput::make('name')
                ->label('Nom del color')
                ->placeholder('Ex: BLANC, NEGRE, BLAU')
                ->required()
                ->maxLength(100)
                ->helperText('Escriu en majúscules. Ex: BLANC, NEGRE, BLAU FOSC'),

            CheckboxList::make('sizes')
                ->label('Tallas disponibles')
                ->options(
                    collect(config('bambes.sizes', []))->mapWithKeys(fn($s) => [$s => $s])->toArray()
                )
                ->columns(6)
                ->required()
                ->minItems(1),
        ];
    }
}
```

### Task 5b: Blade template

```blade
{{-- backend/resources/views/filament/pages/manage-product-colors.blade.php --}}
<x-filament-panels::page>
    @if ($this->colors->isEmpty())
        <div class="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
            <x-heroicon-o-swatch class="mx-auto h-12 w-12 text-gray-400" />
            <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Aquest producte encara no té colors definits.
            </p>
            <p class="text-sm text-gray-400 dark:text-gray-500">
                Fes clic a "Afegir color nou" per començar.
            </p>
        </div>
    @else
        <div class="space-y-6">
            @foreach ($this->colors as $color)
                <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                    {{-- Color header --}}
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                        <h3 class="text-base font-semibold tracking-wide">{{ $color->name }}</h3>
                        <div class="flex gap-2">
                            <x-filament::button
                                size="sm"
                                color="gray"
                                icon="heroicon-m-pencil"
                                wire:click="editColor({{ $color->id }})"
                            >
                                Editar
                            </x-filament::button>
                            <x-filament::button
                                size="sm"
                                color="danger"
                                icon="heroicon-m-trash"
                                wire:click="deleteColor({{ $color->id }})"
                                wire:confirm="Segur que vols eliminar el color {{ $color->name }} i totes les seves tallas i imatges?"
                            >
                                Eliminar
                            </x-filament::button>
                        </div>
                    </div>

                    <div class="px-6 py-4 space-y-4">
                        {{-- Tallas --}}
                        <div>
                            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Tallas disponibles
                            </p>
                            <div class="flex flex-wrap gap-2">
                                @foreach ($this->availableSizes as $size)
                                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border
                                        {{ in_array($size, $color->sizes)
                                            ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-300'
                                            : 'bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500' }}">
                                        {{ $size }}
                                        @if(in_array($size, $color->sizes))
                                            <x-heroicon-m-check class="ml-1 h-3 w-3" />
                                        @endif
                                    </span>
                                @endforeach
                            </div>
                        </div>

                        {{-- Imatges --}}
                        <div>
                            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                Imatges ({{ $color->images->count() }})
                            </p>
                            <div class="flex flex-wrap gap-3">
                                @foreach ($color->images as $image)
                                    <div class="relative group">
                                        <img
                                            src="{{ $image->url }}"
                                            alt="{{ $color->name }}"
                                            class="h-24 w-24 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                                        />
                                        <button
                                            wire:click="deleteImage({{ $image->id }})"
                                            wire:confirm="Eliminar aquesta imatge?"
                                            class="absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center
                                                   h-6 w-6 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600"
                                        >
                                            <x-heroicon-m-x-mark class="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                @endforeach

                                {{-- Add images button --}}
                                <button
                                    wire:click="addImages({{ $color->id }})"
                                    class="h-24 w-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600
                                           flex flex-col items-center justify-center gap-1
                                           text-gray-400 hover:border-primary-400 hover:text-primary-500
                                           dark:text-gray-500 dark:hover:border-primary-600 transition-colors"
                                >
                                    <x-heroicon-o-plus class="h-6 w-6" />
                                    <span class="text-xs">Afegir</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    @endif
</x-filament-panels::page>
```

### Task 5c: Colors Extension

```php
<?php
// backend/app/Filament/Lunar/Extensions/ProductResourceColorsExtension.php
namespace App\Filament\Lunar\Extensions;

use App\Filament\Lunar\Pages\ManageProductColors;
use Lunar\Admin\Support\Extending\BaseExtension;

class ProductResourceColorsExtension extends BaseExtension
{
    public function extendPages(array $pages): array
    {
        return array_merge($pages, [
            'colors' => ManageProductColors::route('/{record}/colors'),
        ]);
    }

    public function extendSubNavigation(array $pages): array
    {
        return array_merge($pages, [
            ManageProductColors::class,
        ]);
    }
}
```

- [ ] **Step 1: Create all three files** (page, blade, extension) with the code above.

- [ ] **Step 2: Register the extension in AppServiceProvider**

Lunar supports **arrays of extensions per key** (verified in source). Simply add the new extension to the existing array for `LunarProductResource::class` — both will be called in order.

**Update `AppServiceProvider::register()`** — add the new import and extend the array:

```php
// Add import:
use App\Filament\Lunar\Extensions\ProductResourceColorsExtension;

// In register():
LunarPanel::extensions([
    LunarListProducts::class    => ProductResourceExtension::class,
    LunarProductResource::class => [
        ProductResourceStockExtension::class,   // existing — keep it
        ProductResourceColorsExtension::class,  // new
    ],
]);
```

No other files need to change. `ProductResourceStockExtension.php` stays as-is.

- [ ] **Step 3: Open the backoffice and navigate to any product**

Expected:
- "Colors i Imatges" tab appears in the product subnav (alongside "Stock")
- Page loads without errors
- Empty state message shows if no colors yet
- "Afegir color nou" button opens a modal with name + size checkboxes
- Adding a color shows it on the page
- Adding images to a color shows thumbnails
- Deleting an image removes it from the gallery
- Deleting a color removes it and shows confirmation

- [ ] **Step 4: Commit**
```bash
git add backend/app/Filament/Lunar/Pages/ManageProductColors.php \
        backend/resources/views/filament/pages/manage-product-colors.blade.php \
        backend/app/Filament/Lunar/Extensions/ProductResourceColorsExtension.php \
        backend/app/Providers/AppServiceProvider.php
git commit -m "feat: add ManageProductColors Filament page with color/image/size management"
```

---

## Task 6: Redirect after product creation to the colors page

**Files:**
- Modify: `backend/app/Filament/Lunar/Extensions/ProductResourceExtension.php`

Currently, creating a product redirects to the Lunar edit page. Change it to redirect to the colors page so the user lands there immediately.

- [ ] **Step 1: Update the `successRedirectUrl` in `ProductResourceExtension`**

Find this block (line ~123):
```php
->successRedirectUrl(fn(Model $record): string => ProductResource::getUrl('edit', [
    'record' => $record,
]));
```

Replace with:
```php
->successRedirectUrl(fn(Model $record): string => ProductResource::getUrl('colors', [
    'record' => $record,
]));
```

- [ ] **Step 2: Test manually**

Create a new product via the backoffice. Expected: after saving, you land directly on the "Colors i Imatges" page for that product, ready to add colors.

- [ ] **Step 3: Commit**
```bash
git add backend/app/Filament/Lunar/Extensions/ProductResourceExtension.php
git commit -m "feat: redirect to colors page after product creation"
```

---

## Task 7: One-time migration command — existing variants → product_colors

**Files:**
- Create: `backend/app/Console/Commands/MigrateProductColors.php`

This command reads existing Lunar variants and creates `product_colors` records for them. Run once after deploying.

- [ ] **Step 1: Create the command**

```php
<?php
// backend/app/Console/Commands/MigrateProductColors.php
namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductColor;
use App\Services\ProductColorManager;
use Illuminate\Console\Command;
use Lunar\Models\ProductOption;

class MigrateProductColors extends Command
{
    protected $signature   = 'bambes:migrate-colors {--dry-run : Show what would be created without saving}';
    protected $description = 'Create product_colors records from existing Lunar variants (run once after deploying color management)';

    public function handle(ProductColorManager $manager): int
    {
        $isDryRun = $this->option('dry-run');

        $colorOption = ProductOption::where('handle', 'color')
                           ->orWhere('name', 'Color')
                           ->first();
        $sizeOption  = ProductOption::where('handle', 'talla')
                           ->orWhere('name', 'Talla')
                           ->first();

        if (!$colorOption) {
            $this->error('Color product option not found. Run database seeders first.');
            return self::FAILURE;
        }

        $products = Product::with(['variants.values'])->get();
        $created  = 0;
        $skipped  = 0;

        foreach ($products as $product) {
            // Skip products that already have product_colors records
            if (ProductColor::where('product_id', $product->id)->exists()) {
                $this->line("  SKIP  {$product->id}: {$product->translateAttribute('name')} (already has colors)");
                $skipped++;
                continue;
            }

            // Group variants by color
            $colorGroups = [];
            foreach ($product->variants as $variant) {
                $colorVal = $variant->values->firstWhere('product_option_id', $colorOption->id);
                $sizeVal  = $variant->values->firstWhere('product_option_id', $sizeOption?->id);

                $colorName = $colorVal ? $this->getEnText($colorVal->name) : 'DEFAULT';
                $sizeName  = $sizeVal  ? $this->getEnText($sizeVal->name)  : null;

                if ($sizeName) {
                    $colorGroups[$colorName][] = $sizeName;
                }
            }

            if (empty($colorGroups)) {
                $this->line("  SKIP  {$product->id}: {$product->translateAttribute('name')} (no color/size variants)");
                $skipped++;
                continue;
            }

            $sortOrder = 0;
            foreach ($colorGroups as $colorName => $sizes) {
                $sizes = array_unique($sizes);
                sort($sizes, SORT_NATURAL);

                $productName = $product->translateAttribute('name');
                $this->line("  CREATE {$product->id}: {$productName} → {$colorName} [" . implode(', ', $sizes) . "]");

                if (!$isDryRun) {
                    // Only create the ProductColor record — variants already exist
                    ProductColor::firstOrCreate(
                        ['product_id' => $product->id, 'name' => strtoupper($colorName)],
                        [
                            'sizes'      => array_values($sizes),
                            'sort_order' => $sortOrder,
                        ]
                    );
                }
                $sortOrder++;
                $created++;
            }
        }

        $this->newLine();
        $this->info("Done. Created: {$created}, Skipped: {$skipped}" . ($isDryRun ? ' (dry run — nothing saved)' : ''));

        return self::SUCCESS;
    }

    private function getEnText(mixed $name): string
    {
        if (is_array($name)) return strtoupper($name['en'] ?? reset($name) ?? '');
        if (is_string($name)) {
            $decoded = json_decode($name, true);
            if (is_array($decoded)) return strtoupper($decoded['en'] ?? reset($decoded) ?? '');
        }
        return strtoupper((string) $name);
    }
}
```

- [ ] **Step 2: Register the command** (Laravel auto-discovers commands in `app/Console/Commands`, so no manual registration needed in Laravel 11)

- [ ] **Step 3: Dry-run to verify**
```bash
cd backend && php artisan bambes:migrate-colors --dry-run
```
Expected: lists all products with their colors and sizes (nothing saved)

- [ ] **Step 4: Run the actual migration**
```bash
cd backend && php artisan bambes:migrate-colors
```
Expected: `product_colors` records created for existing products

- [ ] **Step 5: Verify in backoffice**

Open any product in the backoffice → "Colors i Imatges". The migrated colors should appear with their sizes. No images will be there yet (upload manually).

- [ ] **Step 6: Commit**
```bash
git add backend/app/Console/Commands/MigrateProductColors.php
git commit -m "feat: add MigrateProductColors command to backfill existing variants"
```

---

## Task 8: Frontend — update variantParser.js

**Files:**
- Modify: `frontend/src/utils/variantParser.js`

Add an `organizeColors()` helper for the new API structure. Keep `organizeVariants()` untouched (backward compat).

- [ ] **Step 1: Add `organizeColors()` to variantParser.js**

```javascript
/**
 * Organize the `colors` array returned by the new API.
 *
 * Input: colors array from API:
 * [{ name: 'BLANC', images: [...], sizes: [{ size: '41', stock_status: '...', variant_id: 5 }] }]
 *
 * Output:
 * {
 *   colorNames: ['BLANC', 'NEGRE'],          // ordered as returned
 *   sizesByColor: { BLANC: ['41','42'], ... }, // sizes available per color
 *   variantMap: Map('BLANC|41' → sizeData),   // for fast lookup
 *   imagesByColor: { BLANC: ['url1', ...], } // images per color
 * }
 */
export function organizeColors(colors) {
  if (!colors || !Array.isArray(colors) || colors.length === 0) {
    return { colorNames: [], sizesByColor: {}, variantMap: new Map(), imagesByColor: {} }
  }

  const colorNames   = colors.map((c) => c.name)
  const sizesByColor = {}
  const variantMap   = new Map()
  const imagesByColor = {}

  for (const color of colors) {
    sizesByColor[color.name]  = (color.sizes ?? []).map((s) => s.size)
    imagesByColor[color.name] = color.images ?? []

    for (const sizeData of color.sizes ?? []) {
      variantMap.set(`${color.name}|${sizeData.size}`, sizeData)
    }
  }

  return { colorNames, sizesByColor, variantMap, imagesByColor }
}

/**
 * Find a variant (sizeData object) given a color and size.
 * Returns { size, stock_status, variant_id } or null.
 */
export function findColorVariant(variantMap, colorName, size) {
  return variantMap.get(`${colorName}|${size}`) ?? null
}
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/utils/variantParser.js
git commit -m "feat: add organizeColors helper for new API colors structure"
```

---

## Task 9: Frontend — update ProductDetailPage

**Files:**
- Modify: `frontend/src/pages/ProductDetailPage.jsx`

Key changes:
1. When `product.colors` exists (new API), use `organizeColors()` instead of `organizeVariants()`
2. `allImages` becomes dynamic: shows the selected color's images
3. Reset `selectedImageIndex` to 0 when `selectedColor` changes
4. Size availability check uses new `variantMap` key format (`COLOR|SIZE`)
5. Add-to-cart uses `findColorVariant()` instead of `findVariant()`

- [ ] **Step 1: Update imports in ProductDetailPage.jsx**

Find the existing import line for variantParser:
```javascript
import { organizeVariants, findVariant } from '../utils/variantParser'
```
Replace with:
```javascript
import { organizeVariants, findVariant, organizeColors, findColorVariant } from '../utils/variantParser'
```

- [ ] **Step 2: Update the product data initialization in the `useEffect`**

Find (lines ~99-106):
```javascript
if (productData?.variants?.length > 0) {
  const organized = organizeVariants(productData.variants)
  setVariantsData(organized)

  if (organized.colors.length > 0) {
    setSelectedColor(organized.colors[0])
  }
}
```
Replace with:
```javascript
// Use new colors structure if available, fall back to legacy variants
if (productData?.colors?.length > 0) {
  const organized = organizeColors(productData.colors)
  setVariantsData({ ...organized, isNewFormat: true })
  setSelectedColor(organized.colorNames[0] ?? null)
} else if (productData?.variants?.length > 0) {
  const organized = organizeVariants(productData.variants)
  setVariantsData(organized)
  if (organized.colors.length > 0) {
    setSelectedColor(organized.colors[0])
  }
}
```

- [ ] **Step 3: Make `allImages` dynamic based on selected color**

Find (lines ~140-149):
```javascript
const allImages = useMemo(() => {
  if (!product) return []

  const thumb = getSafeImage(product.thumbnail)
  const rest = Array.isArray(product.images)
    ? product.images.map(getSafeImage).filter(Boolean)
    : []

  return [thumb, ...rest.filter((img) => img !== thumb)].filter(Boolean)
}, [product])
```
Replace with:
```javascript
const allImages = useMemo(() => {
  if (!product) return []

  // New format: images come from the selected color
  if (variantsData?.isNewFormat && selectedColor && variantsData.imagesByColor) {
    const colorImages = variantsData.imagesByColor[selectedColor] ?? []
    if (colorImages.length > 0) {
      return colorImages.filter(Boolean)
    }
  }

  // Legacy fallback: product-level thumbnail + images
  const thumb = getSafeImage(product.thumbnail)
  const rest  = Array.isArray(product.images)
    ? product.images.map(getSafeImage).filter(Boolean)
    : []
  return [thumb, ...rest.filter((img) => img !== thumb)].filter(Boolean)
}, [product, variantsData, selectedColor])
```

- [ ] **Step 4: Reset selectedImageIndex when selectedColor changes**

Find the `useEffect` that watches `[id, t]` (the product fetch). Add a new `useEffect`:

```javascript
// Reset image gallery to first image when color changes
useEffect(() => {
  setSelectedImageIndex(0)
}, [selectedColor])
```

- [ ] **Step 5: Update the add-to-cart handler to use new format**

Find (line ~157):
```javascript
const variant = findVariant(variantsData?.variantMap, selectedSize, selectedColor)
```
Replace with:
```javascript
const variant = variantsData?.isNewFormat
  ? findColorVariant(variantsData?.variantMap, selectedColor, selectedSize)
  : findVariant(variantsData?.variantMap, selectedSize, selectedColor)
```

Note: `findColorVariant` returns `{ size, stock_status, variant_id }` not a full variant object. The cart likely needs the `variant_id`. Update downstream usage accordingly — find where `variant.id` is used and change to `variant.variant_id` when `isNewFormat` is true, or add a `id` alias in `findColorVariant`.

The simplest fix — update `findColorVariant` to return an object compatible with the existing cart code:

```javascript
// In variantParser.js, update findColorVariant:
export function findColorVariant(variantMap, colorName, size) {
  const data = variantMap.get(`${colorName}|${size}`) ?? null
  if (!data) return null
  // Return shape compatible with legacy variant object
  return { id: data.variant_id, stock_status: data.stock_status, size: data.size }
}
```

- [ ] **Step 6: Update size availability check**

Find the part that checks if a size is available for the selected color (around line ~446):
```javascript
findVariant(variantsData.variantMap, size, selectedColor)
```
Replace with:
```javascript
variantsData?.isNewFormat
  ? findColorVariant(variantsData.variantMap, selectedColor, size)
  : findVariant(variantsData.variantMap, size, selectedColor)
```

- [ ] **Step 7: Verify in browser**

1. Open a product that has `product_colors` records (e.g., after adding via backoffice)
2. Confirm the color selector shows the correct colors
3. Click a color → images in the gallery change to that color's images
4. Size selector shows only sizes available for the selected color
5. Add to cart still works

- [ ] **Step 8: Commit**
```bash
git add frontend/src/pages/ProductDetailPage.jsx \
        frontend/src/utils/variantParser.js
git commit -m "feat: update frontend to use per-color images from new API structure"
```

---

## Task 10: End-to-end manual test + data upload

After all code tasks are done:

- [ ] **Run full test suite**
```bash
cd backend && php artisan test
```
Expected: all existing + new tests PASS

- [ ] **Upload images for the 3 multi-color products**

For each of Nike, Asics, Adidas:
1. Open product in backoffice → "Colors i Imatges"
2. Verify colors are listed (from migration command)
3. For each color: click "Afegir" → upload the 5 prepared images
4. Verify images appear as thumbnails

- [ ] **Verify in the frontend**

Open each of the 3 products. Confirm:
- Color selector shows correct colors
- Clicking each color changes the gallery to that color's images
- Size selector filters correctly per color
- Add to cart works

- [ ] **Final commit**
```bash
git add .
git commit -m "chore: complete color & image management feature"
```

---

## Known limitations & future improvements

1. **Image ordering**: Images are shown in upload order. Drag-to-reorder can be added later via Spatie's `order_column` on media.
2. **`variants` key in API**: Still returned for backward compat. Once frontend is confirmed working, remove it from `ProductController::show()`.
3. **Products without colors**: If a product has no `product_colors` records (and no variants either), the frontend shows no colors or sizes — this is correct for products that haven't been set up yet.
4. **Stock for new variants**: New variants created by `ProductColorManager` start at stock 0. Use the existing "Gestió d'Stock" page to set initial stock.
5. **Price on new variants**: Inherits from first existing variant's price. If no variant exists yet, price is 0 — edit via Lunar admin or add a price field to the colors form later.
