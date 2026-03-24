<?php
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
