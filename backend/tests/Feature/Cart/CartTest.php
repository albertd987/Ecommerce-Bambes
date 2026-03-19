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

    // ── Cart session persistence ──

    public function test_cart_hidden_after_logout_but_kept_in_db(): void
    {
        $user = \App\Models\User::factory()->create([
            'password' => bcrypt('password123'),
        ]);
        $variant = $this->createVariant();

        // Login + add to cart
        $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => 'password123',
        ])->assertStatus(200);

        $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity'   => 1,
        ])->assertStatus(200);

        $this->assertEquals(1, \Lunar\Models\Cart::count());

        // Logout
        $this->postJson('/api/logout')->assertStatus(200);

        // Cart still exists in DB (not soft-deleted)
        $this->assertEquals(1, \Lunar\Models\Cart::count(),
            'Cart should be kept in DB after logout');
    }

    public function test_cart_restored_after_relogin(): void
    {
        $user = \App\Models\User::factory()->create([
            'password' => bcrypt('password123'),
        ]);
        $variant = $this->createVariant();

        // Login + add to cart
        $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => 'password123',
        ])->assertStatus(200);

        $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity'   => 1,
        ])->assertStatus(200);

        // Logout
        $this->postJson('/api/logout')->assertStatus(200);

        // Re-login → Lunar should restore cart via user_id
        $this->actingAs($user);
        $cart = $this->getJson('/api/cart');
        $cart->assertStatus(200);
        $this->assertNotNull($cart->json('data'),
            'Cart should be restored after re-login');
    }

    public function test_guest_cart_is_associated_on_login(): void
    {
        $user = \App\Models\User::factory()->create([
            'password' => bcrypt('password123'),
        ]);
        $variant = $this->createVariant();

        // Create a guest cart with cart_token (simulates a guest adding items)
        $guestCart = \Lunar\Models\Cart::factory()->create([
            'meta' => ['token' => 'guest-token-abc123'],
        ]);
        $guestCart->lines()->create([
            'purchasable_type' => \Lunar\Models\ProductVariant::class,
            'purchasable_id'   => $variant->id,
            'quantity'         => 2,
            'meta'             => null,
        ]);

        $this->assertNull($guestCart->user_id, 'Guest cart should have no user_id before login');

        // Login with cart_token in payload
        $this->postJson('/api/login', [
            'email'      => $user->email,
            'password'   => 'password123',
            'cart_token' => 'guest-token-abc123',
        ])->assertStatus(200);

        // Guest cart should now be associated with the user
        $guestCart->refresh();
        $this->assertEquals($user->id, $guestCart->user_id,
            'Guest cart should be associated with user after login');

        // GET /api/cart should return the cart with the original lines
        $this->actingAs($user);
        $cart = $this->getJson('/api/cart');
        $cart->assertStatus(200);
        $this->assertNotEmpty($cart->json('data.lines'),
            'Cart should contain the guest lines after login');
    }

    public function test_guest_cart_merges_with_existing_user_cart_on_login(): void
    {
        $user = \App\Models\User::factory()->create([
            'password' => bcrypt('password123'),
        ]);
        $variant1 = $this->createVariant(3000, 10);
        $variant2 = $this->createVariant(5000, 10);

        // Create existing user cart with one line
        $userCart = \Lunar\Models\Cart::factory()->create(['user_id' => $user->id]);
        $userCart->lines()->create([
            'purchasable_type' => \Lunar\Models\ProductVariant::class,
            'purchasable_id'   => $variant1->id,
            'quantity'         => 1,
            'meta'             => null,
        ]);

        // Create guest cart with a different line
        $guestCart = \Lunar\Models\Cart::factory()->create([
            'meta' => ['token' => 'guest-token-merge-test'],
        ]);
        $guestCart->lines()->create([
            'purchasable_type' => \Lunar\Models\ProductVariant::class,
            'purchasable_id'   => $variant2->id,
            'quantity'         => 3,
            'meta'             => null,
        ]);

        // Login with cart_token
        $this->postJson('/api/login', [
            'email'      => $user->email,
            'password'   => 'password123',
            'cart_token' => 'guest-token-merge-test',
        ])->assertStatus(200);

        // After merge, user cart should have lines from both carts
        $this->actingAs($user);
        $cart = $this->getJson('/api/cart');
        $lines = $cart->json('data.lines');
        $this->assertCount(2, $lines,
            'Merged cart should have lines from both guest and user carts');
    }

    public function test_guest_cart_is_associated_on_register(): void
    {
        $variant = $this->createVariant(2500, 10);

        // Create guest cart with cart_token
        $guestCart = \Lunar\Models\Cart::factory()->create([
            'meta' => ['token' => 'register-guest-token'],
        ]);
        $guestCart->lines()->create([
            'purchasable_type' => \Lunar\Models\ProductVariant::class,
            'purchasable_id'   => $variant->id,
            'quantity'         => 2,
            'meta'             => null,
        ]);

        // Register with cart_token
        $this->postJson('/api/register', [
            'name'                  => 'New User',
            'email'                 => 'newuser@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
            'cart_token'            => 'register-guest-token',
        ])->assertStatus(201);

        // Guest cart should now have user_id
        $guestCart->refresh();
        $this->assertNotNull($guestCart->user_id,
            'Guest cart should be associated to the new user after register');
    }
}
