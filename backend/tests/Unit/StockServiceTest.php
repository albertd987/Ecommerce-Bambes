<?php

namespace Tests\Unit;

use App\Models\StockMovement;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\ProductVariant;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class StockServiceTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    private StockService $stockService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
        $this->stockService = new StockService();
    }

    public function test_move_creates_movement_and_updates_stock(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 20);

        $movement = $this->stockService->move($variant, -5, StockMovement::TYPE_SALE, 'order:1');

        $this->assertDatabaseHas('stock_movements', [
            'product_variant_id' => $variant->id,
            'quantity' => -5,
            'type' => 'sale',
            'reference' => 'order:1',
        ]);

        $variant->refresh();
        $this->assertEquals(15, $variant->stock);
    }

    public function test_move_throws_on_negative_stock_when_purchasable_in_stock(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 3);
        $variant->update(['purchasable' => 'in_stock']);

        $this->expectException(\InvalidArgumentException::class);
        $this->stockService->move($variant, -5, StockMovement::TYPE_SALE);
    }

    public function test_move_allows_negative_stock_when_purchasable_always(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 3);
        $variant->update(['purchasable' => 'always']);

        $movement = $this->stockService->move($variant, -5, StockMovement::TYPE_SALE);

        $variant->refresh();
        $this->assertEquals(-2, $variant->stock);
    }

    public function test_move_throws_on_invalid_type(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 10);

        $this->expectException(\InvalidArgumentException::class);
        $this->stockService->move($variant, 5, 'invalid_type');
    }

    public function test_sell_creates_negative_movement(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 10);

        $movement = $this->stockService->sell($variant, 3, 42);

        $this->assertEquals(-3, $movement->quantity);
        $this->assertEquals('sale', $movement->type);
        $this->assertEquals('order:42', $movement->reference);

        $variant->refresh();
        $this->assertEquals(7, $variant->stock);
    }

    public function test_cancel_restores_stock(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 7);

        $movement = $this->stockService->cancel($variant, 3, 42);

        $this->assertEquals(3, $movement->quantity);
        $this->assertEquals('cancellation', $movement->type);

        $variant->refresh();
        $this->assertEquals(10, $variant->stock);
    }

    public function test_return_stock_restores_stock(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 7);

        $movement = $this->stockService->returnStock($variant, 2, 42);

        $this->assertEquals(2, $movement->quantity);
        $this->assertEquals('return', $movement->type);

        $variant->refresh();
        $this->assertEquals(9, $variant->stock);
    }

    public function test_adjust_can_increase_or_decrease(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 10);

        $this->stockService->adjust($variant, 5, 'Received extra', null);
        $variant->refresh();
        $this->assertEquals(15, $variant->stock);

        $this->stockService->adjust($variant, -3, 'Damaged items', null);
        $variant->refresh();
        $this->assertEquals(12, $variant->stock);
    }

    public function test_receive_adds_stock(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 5);

        $movement = $this->stockService->receive($variant, 20, 'New shipment', null);

        $this->assertEquals(20, $movement->quantity);
        $this->assertEquals('reception', $movement->type);

        $variant->refresh();
        $this->assertEquals(25, $variant->stock);
    }

    public function test_set_initial_works_on_new_variant(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 0);

        $movement = $this->stockService->setInitial($variant, 50);

        $this->assertEquals(50, $movement->quantity);
        $this->assertEquals('initial', $movement->type);

        $variant->refresh();
        $this->assertEquals(50, $variant->stock);
    }

    public function test_set_initial_throws_if_variant_has_movements(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 0);

        $this->stockService->setInitial($variant, 50);

        $this->expectException(\InvalidArgumentException::class);
        $this->stockService->setInitial($variant, 10);
    }

    public function test_get_status_returns_correct_status(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 20);
        $this->assertEquals('in_stock', StockService::getStatus($variant));

        $variant->update(['stock' => 10]);
        $variant->refresh();
        $this->assertEquals('low_stock', StockService::getStatus($variant));

        $variant->update(['stock' => 5]);
        $variant->refresh();
        $this->assertEquals('low_stock', StockService::getStatus($variant));

        $variant->update(['stock' => 0]);
        $variant->refresh();
        $this->assertEquals('out_of_stock', StockService::getStatus($variant));
    }

    public function test_move_dispatches_stock_updated_event(): void
    {
        \Illuminate\Support\Facades\Event::fake([\App\Events\StockUpdated::class]);

        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 10);

        $this->stockService->move($variant, -2, StockMovement::TYPE_SALE);

        \Illuminate\Support\Facades\Event::assertDispatched(\App\Events\StockUpdated::class, function ($event) use ($variant) {
            return $event->variant->id === $variant->id
                && $event->previousStock === 10
                && $event->movement->quantity === -2;
        });
    }
}
