<?php

namespace Tests\Feature\Cart;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\ProductVariant;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class CartTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
    }

    private function createVariant(int $priceCents = 5000, int $stock = 10): ProductVariant
    {
        $data = $this->createProductWithVariantAndPrice($priceCents, $stock);
        return $data['variant'];
    }

    public function test_add_product_to_cart(): void
    {
        $variant = $this->createVariant();

        $response = $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity'   => 1,
        ]);

        $response->assertStatus(200)
                 ->assertJsonStructure(['data' => ['cart_id', 'cart_token']]);
    }

    public function test_add_same_product_accumulates_quantity(): void
    {
        $variant = $this->createVariant(5000, 100);

        $cartToken = null;
        for ($i = 0; $i < 3; $i++) {
            $payload = [
                'variant_id' => $variant->id,
                'quantity'   => 1,
            ];
            if ($cartToken) {
                $payload['cart_token'] = $cartToken;
            }

            $response = $this->postJson('/api/cart/add', $payload);
            $response->assertStatus(200);
            $cartToken = $response->json('data.cart_token') ?? $cartToken;
        }

        $cartResponse = $this->getJson('/api/cart?cart_token=' . $cartToken);
        $cartResponse->assertStatus(200);

        $lines = $cartResponse->json('data.lines');
        $this->assertNotEmpty($lines);

        $totalQty = collect($lines)->sum('quantity');
        $this->assertEquals(3, $totalQty);
    }

    public function test_add_insufficient_stock_returns_400(): void
    {
        $variant = $this->createVariant(5000, 2);

        $response = $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity'   => 5,
        ]);

        $response->assertStatus(400)
                 ->assertJsonFragment(['error' => 'Stock insuficient']);
    }

    public function test_update_line_quantity(): void
    {
        $variant = $this->createVariant(5000, 50);

        $addResponse = $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity'   => 1,
        ]);
        $cartToken = $addResponse->json('data.cart_token');

        $cartResponse = $this->getJson('/api/cart?cart_token=' . $cartToken);
        $lineId = $cartResponse->json('data.lines.0.id');

        $response = $this->putJson("/api/cart/lines/{$lineId}", [
            'quantity'   => 3,
            'cart_token' => $cartToken,
        ]);

        $response->assertStatus(200);

        $updatedCart = $this->getJson('/api/cart?cart_token=' . $cartToken);
        $updatedCart->assertStatus(200);
        $updatedQty = collect($updatedCart->json('data.lines'))
            ->firstWhere('id', $lineId)['quantity'];
        $this->assertEquals(3, $updatedQty);
    }

    public function test_update_line_quantity_zero_returns_422(): void
    {
        $variant = $this->createVariant();

        $addResponse = $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity'   => 1,
        ]);
        $cartToken = $addResponse->json('data.cart_token');

        $cartResponse = $this->getJson('/api/cart?cart_token=' . $cartToken);
        $lineId = $cartResponse->json('data.lines.0.id');

        $response = $this->putJson("/api/cart/lines/{$lineId}", [
            'quantity'   => 0,
            'cart_token' => $cartToken,
        ]);

        $response->assertStatus(422);
    }

    public function test_remove_line_from_cart(): void
    {
        $variant = $this->createVariant();

        $addResponse = $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity'   => 1,
        ]);
        $cartToken = $addResponse->json('data.cart_token');

        $cartResponse = $this->getJson('/api/cart?cart_token=' . $cartToken);
        $lineId = $cartResponse->json('data.lines.0.id');

        $response = $this->deleteJson("/api/cart/lines/{$lineId}?cart_token={$cartToken}");

        $response->assertStatus(200);

        $afterCart = $this->getJson('/api/cart?cart_token=' . $cartToken);
        $afterCart->assertStatus(200);
        $lines = $afterCart->json('data.lines') ?? [];
        $this->assertEmpty($lines);
    }

    public function test_remove_nonexistent_line(): void
    {
        $variant = $this->createVariant();

        $addResponse = $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity'   => 1,
        ]);
        $cartToken = $addResponse->json('data.cart_token');

        // ID 99999 assumed not to exist (auto-increment starts at 1)
        // The controller's generic catch block returns 500 for a missing line (not 404 — known limitation)
        $response = $this->deleteJson("/api/cart/lines/99999?cart_token={$cartToken}");

        $response->assertStatus(500);
    }

    public function test_clear_cart(): void
    {
        $variant = $this->createVariant();

        $addResponse = $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity'   => 1,
        ]);
        $cartToken = $addResponse->json('data.cart_token');

        $response = $this->deleteJson('/api/cart', [
            'cart_token' => $cartToken,
        ]);

        $response->assertStatus(200);

        $afterClear = $this->getJson('/api/cart?cart_token=' . $cartToken);
        $afterClear->assertStatus(200)
                   ->assertJsonPath('data', null);
    }

    public function test_get_empty_cart(): void
    {
        $response = $this->getJson('/api/cart');

        $response->assertStatus(200)
                 ->assertJsonPath('data', null);
    }

    // ── Logout clears cart ──

    public function test_cart_is_empty_after_logout(): void
    {
        $user = \App\Models\User::factory()->create([
            'password' => bcrypt('password123'),
        ]);
        $variant = $this->createVariant();

        // Login via real session
        $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => 'password123',
        ])->assertStatus(200);

        // Add to cart
        $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity'   => 1,
        ])->assertStatus(200);

        // Verify a cart exists (not soft-deleted)
        $this->assertEquals(1, \Lunar\Models\Cart::count());

        // Logout (should soft-delete the cart via CartSession::forget())
        $this->postJson('/api/logout')->assertStatus(200);

        // Cart should be soft-deleted (count excludes soft-deleted)
        $this->assertEquals(0, \Lunar\Models\Cart::count(),
            'Cart should be soft-deleted after logout');
    }
}
