<?php
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
}
