<?php
namespace Tests\Feature\ProductColors;

use App\Models\ProductColor;
use App\Services\ProductColorManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Lunar\Models\CustomerGroup;
use Lunar\Models\ProductOption;
use Lunar\Models\ProductVariant;
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
            \App\Models\ProductColor::where('product_id', $product->id)->where('name', 'BLANC')->exists()
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

        $this->assertSame(0, \App\Models\ProductColor::where('product_id', $product->id)->count());
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
}
