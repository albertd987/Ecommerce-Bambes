<?php

namespace Tests\Feature\Favorites;

use App\Models\Favorite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\Product;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class FavoriteTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
    }

    private function createProduct(): Product
    {
        return Product::factory()->create([
            'product_type_id' => $this->productType->id,
        ]);
    }

    public function test_toggle_adds_favorite(): void
    {
        $user    = User::factory()->create();
        $product = $this->createProduct();

        $response = $this->actingAs($user)
                         ->postJson("/api/favorites/{$product->id}");

        $response->assertStatus(200)
                 ->assertJsonPath('favorited', true);

        $this->assertDatabaseHas('favorites', [
            'user_id'    => $user->id,
            'product_id' => $product->id,
        ]);
    }

    public function test_toggle_removes_favorite(): void
    {
        $user    = User::factory()->create();
        $product = $this->createProduct();

        Favorite::create(['user_id' => $user->id, 'product_id' => $product->id]);

        $response = $this->actingAs($user)
                         ->postJson("/api/favorites/{$product->id}");

        $response->assertStatus(200)
                 ->assertJsonPath('favorited', false);

        $this->assertDatabaseMissing('favorites', [
            'user_id'    => $user->id,
            'product_id' => $product->id,
        ]);
    }

    public function test_toggle_add_remove_add_is_consistent(): void
    {
        $user    = User::factory()->create();
        $product = $this->createProduct();

        $client = $this->actingAs($user);
        $client->postJson("/api/favorites/{$product->id}")
               ->assertJsonPath('favorited', true);

        $client->postJson("/api/favorites/{$product->id}")
               ->assertJsonPath('favorited', false);

        $client->postJson("/api/favorites/{$product->id}")
               ->assertJsonPath('favorited', true);

        $this->assertEquals(1, Favorite::where('user_id', $user->id)->count());
    }

    public function test_toggle_remove_leaves_no_duplicate(): void
    {
        $user    = User::factory()->create();
        $product = $this->createProduct();

        // Pre-seed a favorite, then toggle once (removes it) — count must be exactly 0
        Favorite::create(['user_id' => $user->id, 'product_id' => $product->id]);

        $this->actingAs($user)->postJson("/api/favorites/{$product->id}")
             ->assertJsonPath('favorited', false);

        $this->assertEquals(
            0,
            Favorite::where('user_id', $user->id)->where('product_id', $product->id)->count()
        );
    }

    public function test_favorite_nonexistent_product_returns_404(): void
    {
        $user = User::factory()->create();

        // ID 99999 is assumed not to exist (auto-increment starts at 1)
        $response = $this->actingAs($user)->postJson('/api/favorites/99999');

        $response->assertStatus(404);
    }

    public function test_toggle_without_auth_returns_401(): void
    {
        $product = $this->createProduct();

        $response = $this->postJson("/api/favorites/{$product->id}");

        $response->assertStatus(401);
    }

    public function test_get_favorites_without_auth_returns_401(): void
    {
        $response = $this->getJson('/api/favorites');

        $response->assertStatus(401);
    }

    public function test_get_favorites_returns_user_products(): void
    {
        $user    = User::factory()->create();
        $product = $this->createProduct();

        Favorite::create(['user_id' => $user->id, 'product_id' => $product->id]);

        // Other user's favorite should not appear
        $otherUser    = User::factory()->create();
        $otherProduct = $this->createProduct();
        Favorite::create(['user_id' => $otherUser->id, 'product_id' => $otherProduct->id]);

        $response = $this->actingAs($user)->getJson('/api/favorites');

        $response->assertStatus(200)
                 ->assertJsonCount(1, 'data');
    }
}
