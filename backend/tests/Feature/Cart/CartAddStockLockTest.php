<?php

namespace Tests\Feature\Cart;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class CartAddStockLockTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
    }

    /** @test */
    public function adding_more_than_stock_fails_even_when_splitting_the_request(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $data = $this->createProductWithVariantAndPrice(5000, 3);
        $variant = $data['variant'];

        $first = $this->actingAs($user)
            ->postJson('/api/cart/add', [
                'variant_id' => $variant->id,
                'quantity' => 2,
            ]);
        $first->assertStatus(200);

        $cartToken = $first->json('data.cart_token');

        // second request: 2 more would total 4, but only 3 in stock
        $this->actingAs($user)
            ->postJson('/api/cart/add', [
                'variant_id' => $variant->id,
                'quantity' => 2,
                'cart_token' => $cartToken,
            ])
            ->assertStatus(400)
            ->assertJsonPath('error', 'Stock insuficient')
            ->assertJsonPath('available_stock', 1);
    }

    /** @test */
    public function adding_up_to_exact_stock_succeeds(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $data = $this->createProductWithVariantAndPrice(5000, 3);
        $variant = $data['variant'];

        $first = $this->actingAs($user)
            ->postJson('/api/cart/add', [
                'variant_id' => $variant->id,
                'quantity' => 2,
            ]);
        $first->assertStatus(200);

        $cartToken = $first->json('data.cart_token');

        // second request: 1 more = 3 total, exactly matches stock
        $this->actingAs($user)
            ->postJson('/api/cart/add', [
                'variant_id' => $variant->id,
                'quantity' => 1,
                'cart_token' => $cartToken,
            ])
            ->assertStatus(200);
    }
}
