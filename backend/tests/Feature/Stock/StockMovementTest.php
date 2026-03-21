<?php

namespace Tests\Feature\Stock;

use App\Models\StockMovement;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class StockMovementTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
    }

    public function test_product_api_returns_stock_status_not_stock_number(): void
    {
        ['product' => $product] = $this->createProductWithVariantAndPrice(stock: 20);

        $response = $this->getJson("/api/products/{$product->id}");

        $response->assertOk();
        $variant = $response->json('data.variants.0');
        $this->assertArrayHasKey('stock_status', $variant);
        $this->assertArrayNotHasKey('stock', $variant);
        $this->assertEquals('in_stock', $variant['stock_status']);
    }

    public function test_product_api_returns_low_stock_status(): void
    {
        ['product' => $product] = $this->createProductWithVariantAndPrice(stock: 5);

        $response = $this->getJson("/api/products/{$product->id}");

        $response->assertOk();
        $this->assertEquals('low_stock', $response->json('data.variants.0.stock_status'));
    }

    public function test_product_api_returns_out_of_stock_status(): void
    {
        ['product' => $product] = $this->createProductWithVariantAndPrice(stock: 0);

        $response = $this->getJson("/api/products/{$product->id}");

        $response->assertOk();
        $this->assertEquals('out_of_stock', $response->json('data.variants.0.stock_status'));
    }

    public function test_cart_add_still_validates_stock(): void
    {
        ['product' => $product, 'variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 2);

        $response = $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity' => 5,
        ]);

        $response->assertStatus(400);
        $response->assertJsonFragment(['available_stock' => 2]);
    }

    public function test_stock_movement_history_is_recorded(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 0);
        $service = app(StockService::class);

        $service->setInitial($variant, 50);
        $service->sell($variant, 3, 1);
        $service->receive($variant, 10, 'New batch', null);

        $movements = StockMovement::where('product_variant_id', $variant->id)
            ->orderBy('created_at')
            ->get();

        $this->assertCount(3, $movements);
        $this->assertEquals('initial', $movements[0]->type);
        $this->assertEquals(50, $movements[0]->quantity);
        $this->assertEquals('sale', $movements[1]->type);
        $this->assertEquals(-3, $movements[1]->quantity);
        $this->assertEquals('reception', $movements[2]->type);
        $this->assertEquals(10, $movements[2]->quantity);

        $variant->refresh();
        $this->assertEquals(57, $variant->stock);
    }
}
