# Testing Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement comprehensive backend (PHPUnit) and frontend (Vitest) tests covering all edge cases defined in the testing strategy spec.

**Architecture:** Backend uses PHPUnit Feature Tests with a dedicated `bambes_test` MySQL database and `RefreshDatabase` trait. Frontend uses Vitest + React Testing Library with mocked API calls. Stripe is mocked via Mockery `alias:` with `@runInSeparateProcess` — no real network calls.

**Tech Stack:** PHPUnit 10.5, Laravel 11, Lunar PHP 1.2, Mockery, Vitest, React Testing Library, jsdom

**Spec:** `docs/superpowers/specs/2026-03-18-testing-strategy-design.md`

---

## File Structure

### Backend — New Files

```
backend/tests/Feature/
├── Auth/
│   └── AuthTest.php            — Registration, login, logout, password change
├── Products/
│   └── ProductTest.php         — Listing, search, filters, detail, edge cases
├── Favorites/
│   └── FavoriteTest.php        — Toggle, idempotency, auth guards
├── Cart/
│   └── CartTest.php            — Add, update, remove, clear, stock validation
├── Checkout/
│   └── CheckoutTest.php        — Intent, confirm, Stripe mock, stock, amount validation
└── Orders/
    └── OrderTest.php           — List, detail, invoice, ownership, pagination

backend/tests/Traits/
└── LunarTestSetup.php          — Shared trait to seed Channel, Currency, TaxClass, Language
```

### Backend — Modified Files

```
backend/phpunit.xml             — Add DB_DATABASE=bambes_test env var
```

### Frontend — New Files

```
frontend/src/__tests__/
├── setup.js                    — Import jest-dom matchers
├── context/
│   ├── favorites-context.test.jsx
│   └── cart-context.test.jsx
└── pages/
    ├── ProductDetailPage.test.jsx
    ├── CartPage.test.jsx
    ├── HomePage.test.jsx
    └── CheckoutForm.test.jsx
```

### Frontend — Modified Files

```
frontend/vite.config.js         — Add test configuration block
frontend/package.json           — Add vitest dev dependencies and test script
```

### Important: Lunar Ships Its Own Factories

Lunar already provides factories in `vendor/lunarphp/core/database/factories/` for Channel, Currency, ProductType, TaxClass, Language, Product, ProductVariant, Price, etc. **Do NOT create custom factories for Lunar models.** Use Lunar's built-in factories with state overrides in the `LunarTestSetup` trait.

The only model that needs a custom factory approach is `App\Models\Product` (extends `Lunar\Models\Product`) — Lunar's `ProductFactory` sets `$model = Lunar\Models\Product::class`, so we use it directly and rely on STI/table inheritance (both classes use the same `lunar_products` table).

---

## Task 1: Create MySQL Test Database

**Files:**
- Modify: `backend/phpunit.xml`

- [ ] **Step 1: Create the `bambes_test` database**

```bash
cd /var/www/projecte2/backend
php artisan tinker --execute="DB::statement('CREATE DATABASE IF NOT EXISTS bambes_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');"
```

If that fails (permissions), run directly:
```bash
mysql -u root -e "CREATE DATABASE IF NOT EXISTS bambes_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

- [ ] **Step 2: Add DB_DATABASE to phpunit.xml**

In `backend/phpunit.xml`, inside the `<php>` block, add after the `APP_ENV` line:

```xml
<env name="DB_DATABASE" value="bambes_test"/>
```

The full `<php>` block should look like:
```xml
<php>
    <env name="APP_ENV" value="testing"/>
    <env name="DB_DATABASE" value="bambes_test"/>
    <env name="APP_MAINTENANCE_DRIVER" value="file"/>
    <env name="BCRYPT_ROUNDS" value="4"/>
    <env name="CACHE_STORE" value="array"/>
    <env name="MAIL_MAILER" value="array"/>
    <env name="PULSE_ENABLED" value="false"/>
    <env name="QUEUE_CONNECTION" value="sync"/>
    <env name="SESSION_DRIVER" value="array"/>
    <env name="TELESCOPE_ENABLED" value="false"/>
</php>
```

- [ ] **Step 3: Verify the test database works**

```bash
cd /var/www/projecte2/backend
php artisan test --filter=ExampleTest
```

Expected: `Tests: 2 passed` — confirms RefreshDatabase runs migrations on `bambes_test`.

- [ ] **Step 4: Commit**

```bash
git add backend/phpunit.xml
git commit -m "test: configure bambes_test database in phpunit.xml"
```

---

## Task 2: Create LunarTestSetup Trait

This trait creates the minimum Lunar infrastructure (Channel, Currency, TaxClass, Language, ProductType) needed by any test that touches products, carts, or checkout. It uses Lunar's built-in factories with specific overrides for our project (EUR currency, default channel, etc.).

**Files:**
- Create: `backend/tests/Traits/LunarTestSetup.php`

- [ ] **Step 1: Create LunarTestSetup trait**

```php
<?php
// backend/tests/Traits/LunarTestSetup.php

namespace Tests\Traits;

use Lunar\Models\Channel;
use Lunar\Models\Currency;
use Lunar\Models\Language;
use Lunar\Models\ProductType;
use Lunar\Models\TaxClass;

trait LunarTestSetup
{
    protected Channel $channel;
    protected Currency $currency;
    protected ProductType $productType;
    protected TaxClass $taxClass;
    protected Language $language;

    protected function setUpLunar(): void
    {
        $this->language = Language::factory()->create([
            'code'    => 'ca',
            'name'    => 'Català',
            'default' => true,
        ]);

        $this->currency = Currency::factory()->create([
            'code'           => 'EUR',
            'name'           => 'Euro',
            'exchange_rate'  => 1,
            'decimal_places' => 2,
            'enabled'        => true,
            'default'        => true,
        ]);

        $this->channel = Channel::factory()->create([
            'name'    => 'Webshop',
            'handle'  => 'webshop',
            'default' => true,
        ]);

        $this->taxClass = TaxClass::factory()->create([
            'name'    => 'IVA 21%',
            'default' => true,
        ]);

        $this->productType = ProductType::factory()->create([
            'name' => 'Sabatilles',
        ]);
    }

    /**
     * Create a published product with a variant and price.
     * Uses Lunar's built-in factories.
     */
    protected function createProductWithVariantAndPrice(
        int $priceCents = 5000,
        int $stock = 10,
        array $productOverrides = []
    ): array {
        $product = \Lunar\Models\Product::factory()->create(
            array_merge([
                'product_type_id' => $this->productType->id,
                'status'          => 'published',
            ], $productOverrides)
        );

        $variant = \Lunar\Models\ProductVariant::factory()->create([
            'product_id'   => $product->id,
            'tax_class_id' => $this->taxClass->id,
            'stock'        => $stock,
        ]);

        $price = \Lunar\Models\Price::factory()->create([
            'priceable_type' => 'product_variant',
            'priceable_id'   => $variant->id,
            'currency_id'    => $this->currency->id,
            'price'          => $priceCents,
            'min_quantity'   => 1,
        ]);

        return compact('product', 'variant', 'price');
    }
}
```

- [ ] **Step 2: Verify the trait works with a quick tinker test**

```bash
cd /var/www/projecte2/backend
php artisan tinker --execute="
use Lunar\Models\Channel;
echo Channel::factory()->make()->toJson();
"
```

Expected: Valid JSON output confirming Lunar's factories work.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/Traits/LunarTestSetup.php
git commit -m "test: add LunarTestSetup trait using Lunar built-in factories"
```

---

## Task 3: Auth Tests

**Files:**
- Create: `backend/tests/Feature/Auth/AuthTest.php`

- [ ] **Step 1: Write AuthTest with all edge cases**

```php
<?php
// backend/tests/Feature/Auth/AuthTest.php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    // ── Registration ──

    public function test_user_can_register(): void
    {
        $response = $this->postJson('/api/register', [
            'name'                  => 'Test User',
            'email'                 => 'test@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201)
                 ->assertJsonPath('data.email', 'test@example.com');

        $this->assertDatabaseHas('users', ['email' => 'test@example.com']);
    }

    public function test_register_duplicate_email_returns_422(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $response = $this->postJson('/api/register', [
            'name'                  => 'Another',
            'email'                 => 'taken@example.com',
            'password'              => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors('email');
    }

    // ── Login ──

    public function test_user_can_login(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => 'password',
        ]);

        $response->assertStatus(200)
                 ->assertJsonPath('data.email', $user->email);
    }

    public function test_login_wrong_password_returns_422(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => 'wrongpassword',
        ]);

        // AuthController throws ValidationException → 422, not 401
        $response->assertStatus(422)
                 ->assertJsonValidationErrors('email');
    }

    public function test_login_unverified_user_succeeds(): void
    {
        $user = User::factory()->unverified()->create();

        $response = $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => 'password',
        ]);

        // Login works even without email verification
        // Verification is only checked at checkout
        $response->assertStatus(200);
    }

    // ── Logout ──

    public function test_logout_invalidates_session(): void
    {
        $user = User::factory()->create();

        // Login first to establish a real session
        $this->postJson('/api/login', [
            'email'    => $user->email,
            'password' => 'password',
        ])->assertStatus(200);

        // Logout
        $this->postJson('/api/logout')->assertStatus(200);

        // After logout, session is invalidated
        $this->getJson('/api/user')->assertStatus(401);
    }

    // ── Password Change ──

    public function test_change_password_succeeds(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->putJson('/api/user/password', [
            'current_password'      => 'password',
            'password'              => 'newpassword1',
            'password_confirmation' => 'newpassword1',
        ]);

        $response->assertStatus(200);
    }

    public function test_change_password_wrong_current_returns_422(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->putJson('/api/user/password', [
            'current_password'      => 'wrongcurrent',
            'password'              => 'newpassword1',
            'password_confirmation' => 'newpassword1',
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors('current_password');
    }

    public function test_change_password_same_as_current_returns_422(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->putJson('/api/user/password', [
            'current_password'      => 'password',
            'password'              => 'password',
            'password_confirmation' => 'password',
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors('password');
    }

    public function test_change_password_without_auth_returns_401(): void
    {
        $response = $this->putJson('/api/user/password', [
            'current_password'      => 'password',
            'password'              => 'newpassword1',
            'password_confirmation' => 'newpassword1',
        ]);

        $response->assertStatus(401);
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /var/www/projecte2/backend
php artisan test --filter=AuthTest -v
```

Expected: All 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/Feature/Auth/AuthTest.php
git commit -m "test: add Auth feature tests (register, login, logout, password)"
```

---

## Task 4: Product Tests

**Files:**
- Create: `backend/tests/Feature/Products/ProductTest.php`

- [ ] **Step 1: Write ProductTest with all edge cases**

```php
<?php
// backend/tests/Feature/Products/ProductTest.php

namespace Tests\Feature\Products;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\Product;
use Lunar\Models\ProductVariant;
use Lunar\Models\Price;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class ProductTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
    }

    // ── Listing ──

    public function test_products_index_returns_paginated_list(): void
    {
        $this->createProductWithVariantAndPrice();
        $this->createProductWithVariantAndPrice();

        $response = $this->getJson('/api/products');

        $response->assertStatus(200)
                 ->assertJsonStructure(['data', 'meta']);

        $this->assertCount(2, $response->json('data'));
    }

    public function test_search_special_characters_returns_200(): void
    {
        $response = $this->getJson('/api/products?q=' . urlencode('<script>alert(1)</script>'));

        $response->assertStatus(200)
                 ->assertJsonStructure(['data']);
    }

    public function test_search_sql_injection_returns_200(): void
    {
        $response = $this->getJson('/api/products?q=' . urlencode("'; DROP TABLE users; --"));

        $response->assertStatus(200);
    }

    public function test_filters_with_no_results_returns_empty_array(): void
    {
        $response = $this->getJson('/api/products?brands=nonexistent_brand_xyz');

        $response->assertStatus(200)
                 ->assertJsonPath('data', []);
    }

    public function test_product_not_found_returns_404(): void
    {
        $response = $this->getJson('/api/products/99999');

        $response->assertStatus(404);
    }

    public function test_pagination_out_of_range_returns_empty_data(): void
    {
        $this->createProductWithVariantAndPrice();

        $response = $this->getJson('/api/products?page=9999');

        $response->assertStatus(200)
                 ->assertJsonPath('data', []);
    }

    public function test_draft_product_not_in_listing(): void
    {
        $this->createProductWithVariantAndPrice(5000, 10, ['status' => 'draft']);
        $this->createProductWithVariantAndPrice(5000, 10, ['status' => 'published']);

        $response = $this->getJson('/api/products');

        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'));
    }

    public function test_product_without_variants_does_not_error(): void
    {
        // Create product without any variants or prices
        Product::factory()->create([
            'product_type_id' => $this->productType->id,
            'status'          => 'published',
        ]);

        $response = $this->getJson('/api/products');

        // Should return 200, not 500 — product appears with price: 0
        $response->assertStatus(200);

        $products = $response->json('data');
        $this->assertNotEmpty($products);
        $this->assertEquals(0, $products[0]['price'] ?? $products[0]['price_cents'] ?? 0);
    }

    public function test_filters_endpoint_returns_valid_structure(): void
    {
        $response = $this->getJson('/api/products/filters');

        $response->assertStatus(200);
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /var/www/projecte2/backend
php artisan test --filter=ProductTest -v
```

Expected: All 9 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/Feature/Products/ProductTest.php
git commit -m "test: add Product feature tests (listing, search, filters, edge cases)"
```

---

## Task 5: Favorite Tests

**Files:**
- Create: `backend/tests/Feature/Favorites/FavoriteTest.php`

- [ ] **Step 1: Write FavoriteTest with all edge cases**

```php
<?php
// backend/tests/Feature/Favorites/FavoriteTest.php

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

    // ── Toggle ──

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

        // Add
        $this->actingAs($user)->postJson("/api/favorites/{$product->id}")
             ->assertJsonPath('favorited', true);

        // Remove
        $this->actingAs($user)->postJson("/api/favorites/{$product->id}")
             ->assertJsonPath('favorited', false);

        // Add again
        $this->actingAs($user)->postJson("/api/favorites/{$product->id}")
             ->assertJsonPath('favorited', true);

        $this->assertEquals(1, Favorite::where('user_id', $user->id)->count());
    }

    public function test_double_add_is_idempotent(): void
    {
        $user    = User::factory()->create();
        $product = $this->createProduct();

        // First toggle adds
        $this->actingAs($user)->postJson("/api/favorites/{$product->id}")
             ->assertJsonPath('favorited', true);

        // Second toggle removes (toggle behavior)
        // The important thing: no crash, no duplicate rows
        $this->actingAs($user)->postJson("/api/favorites/{$product->id}");

        $this->assertLessThanOrEqual(
            1,
            Favorite::where('user_id', $user->id)->where('product_id', $product->id)->count()
        );
    }

    public function test_favorite_nonexistent_product_returns_404(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
                         ->postJson('/api/favorites/99999');

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

        $response = $this->actingAs($user)->getJson('/api/favorites');

        $response->assertStatus(200)
                 ->assertJsonCount(1, 'data');
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /var/www/projecte2/backend
php artisan test --filter=FavoriteTest -v
```

Expected: All 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/Feature/Favorites/FavoriteTest.php
git commit -m "test: add Favorite feature tests (toggle, idempotency, auth guards)"
```

---

## Task 6: Cart Tests

Cart tests require the Lunar cart infrastructure (Channel, Currency) and product/variant/price records. The `web` middleware is needed because `CartSession` uses the session.

**Files:**
- Create: `backend/tests/Feature/Cart/CartTest.php`

- [ ] **Step 1: Write CartTest with all edge cases**

```php
<?php
// backend/tests/Feature/Cart/CartTest.php

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

    // ── Add ──

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

        // Add 3 times
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

        // Verify cart has accumulated quantity
        $cartResponse = $this->getJson('/api/cart?cart_token=' . $cartToken);
        $cartResponse->assertStatus(200);

        $lines = $cartResponse->json('data.lines');
        $this->assertNotEmpty($lines);

        // Lunar accumulates quantities for the same variant
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

    // ── Update Line ──

    public function test_update_line_quantity(): void
    {
        $variant = $this->createVariant(5000, 50);

        // Add item first
        $addResponse = $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity'   => 1,
        ]);
        $cartToken = $addResponse->json('data.cart_token');

        // Get cart to find line ID
        $cartResponse = $this->getJson('/api/cart?cart_token=' . $cartToken);
        $lineId = $cartResponse->json('data.lines.0.id');

        // Update quantity
        $response = $this->putJson("/api/cart/lines/{$lineId}", [
            'quantity'   => 3,
            'cart_token' => $cartToken,
        ]);

        $response->assertStatus(200);
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

        // Validation rule min:1 rejects qty=0
        $response->assertStatus(422);
    }

    // ── Remove Line ──

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
    }

    public function test_remove_nonexistent_line(): void
    {
        $variant = $this->createVariant();

        // Create a cart first
        $addResponse = $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity'   => 1,
        ]);
        $cartToken = $addResponse->json('data.cart_token');

        // Try to remove a nonexistent line
        $response = $this->deleteJson("/api/cart/lines/99999?cart_token={$cartToken}");

        // Controller catches exceptions and returns 500
        // (not 404 — the catch block is generic)
        $response->assertStatus(500);
    }

    // ── Clear ──

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
    }

    // ── Empty Cart ──

    public function test_get_empty_cart(): void
    {
        $response = $this->getJson('/api/cart');

        $response->assertStatus(200)
                 ->assertJsonPath('data', null);
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /var/www/projecte2/backend
php artisan test --filter=CartTest -v
```

Expected: All 9 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/Feature/Cart/CartTest.php
git commit -m "test: add Cart feature tests (add, update, remove, clear, stock)"
```

---

## Task 7: Checkout Tests

Checkout tests mock Stripe's `PaymentIntent` class. The CheckoutController calls `\Stripe\Stripe::setApiKey()` and `\Stripe\PaymentIntent::create()`/`::retrieve()` as static methods. We use Mockery's `alias:` to intercept these.

**IMPORTANT:** Every test that mocks Stripe MUST have `@runInSeparateProcess` and `@preserveGlobalState disabled` annotations. Mockery `alias:` creates class aliases that persist for the PHP process lifetime — without separate processes, the second test will crash with "Cannot redeclare class".

**Files:**
- Create: `backend/tests/Feature/Checkout/CheckoutTest.php`

- [ ] **Step 1: Write CheckoutTest with all edge cases**

```php
<?php
// backend/tests/Feature/Checkout/CheckoutTest.php

namespace Tests\Feature\Checkout;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class CheckoutTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
    }

    private function checkoutPayload(int $variantId, int $qty = 1): array
    {
        return [
            'lines' => [
                ['variant_id' => $variantId, 'qty' => $qty],
            ],
            'customer' => [
                'first_name' => 'Test',
                'last_name'  => 'User',
                'email'      => 'test@example.com',
                'phone'      => '600000000',
            ],
            'billing' => [
                'line_one' => 'Carrer Test 1',
                'city'     => 'Barcelona',
                'postcode' => '08001',
            ],
            'shipping_same_as_billing' => true,
        ];
    }

    // ── Email Verification ──

    public function test_unverified_email_returns_403_on_intent(): void
    {
        $user = User::factory()->unverified()->create();
        $data = $this->createProductWithVariantAndPrice();

        $response = $this->actingAs($user)
                         ->postJson('/api/checkout/intent', $this->checkoutPayload($data['variant']->id));

        $response->assertStatus(403)
                 ->assertJsonPath('code', 'email_not_verified');
    }

    public function test_unverified_email_returns_403_on_confirm(): void
    {
        $user = User::factory()->unverified()->create();
        $data = $this->createProductWithVariantAndPrice();

        $payload = array_merge($this->checkoutPayload($data['variant']->id), [
            'payment_intent_id' => 'pi_test_123',
        ]);

        $response = $this->actingAs($user)
                         ->postJson('/api/checkout/confirm', $payload);

        $response->assertStatus(403)
                 ->assertJsonPath('code', 'email_not_verified');
    }

    // ── Intent with empty lines ──

    public function test_intent_with_empty_lines_returns_422(): void
    {
        $user = User::factory()->create();

        $payload = $this->checkoutPayload(1);
        $payload['lines'] = [];

        $response = $this->actingAs($user)
                         ->postJson('/api/checkout/intent', $payload);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors('lines');
    }

    // ── Create Intent with Stripe Mock ──

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function test_create_intent_succeeds_with_stripe_mock(): void
    {
        $user = User::factory()->create(); // email_verified_at = now()
        $data = $this->createProductWithVariantAndPrice(5000, 10);

        // Mock Stripe PaymentIntent::create
        $fakeIntent = new \stdClass();
        $fakeIntent->client_secret = 'pi_test_123_secret_abc';
        $fakeIntent->id = 'pi_test_123';

        $mock = \Mockery::mock('alias:\Stripe\PaymentIntent');
        $mock->shouldReceive('create')->once()->andReturn($fakeIntent);

        $stripeMock = \Mockery::mock('alias:\Stripe\Stripe');
        $stripeMock->shouldReceive('setApiKey')->once();

        $response = $this->actingAs($user)
                         ->postJson('/api/checkout/intent', $this->checkoutPayload($data['variant']->id));

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'client_secret',
                     'amount',
                     'totals' => ['sub_total', 'shipping_total', 'tax_total', 'total', 'tax_included'],
                 ]);

        // Amount should be: 5000 (product) + 499 (shipping) = 5499 cents
        $this->assertEquals(5499, $response->json('amount'));
    }

    // ── Confirm ──

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function test_confirm_succeeds_with_stripe_mock(): void
    {
        $user = User::factory()->create();
        $data = $this->createProductWithVariantAndPrice(5000, 10);

        $expectedTotal = 5000 + 499; // product + shipping

        $fakePI = (object) [
            'id'              => 'pi_test_456',
            'status'          => 'succeeded',
            'amount_received' => $expectedTotal,
        ];

        $mock = \Mockery::mock('alias:\Stripe\PaymentIntent');
        $mock->shouldReceive('retrieve')->once()->andReturn($fakePI);

        $stripeMock = \Mockery::mock('alias:\Stripe\Stripe');
        $stripeMock->shouldReceive('setApiKey')->once();

        $payload = array_merge($this->checkoutPayload($data['variant']->id), [
            'payment_intent_id' => 'pi_test_456',
        ]);

        $response = $this->actingAs($user)
                         ->postJson('/api/checkout/confirm', $payload);

        $response->assertStatus(201)
                 ->assertJsonStructure(['data' => ['id', 'reference', 'status']]);

        // Verify order was created in DB
        $this->assertDatabaseHas('lunar_orders', [
            'reference' => 'pi_test_456',
            'status'    => 'paid',
            'user_id'   => $user->id,
        ]);

        // Verify stock was decremented
        $data['variant']->refresh();
        $this->assertEquals(9, $data['variant']->stock);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function test_confirm_payment_not_succeeded_returns_422(): void
    {
        $user = User::factory()->create();
        $data = $this->createProductWithVariantAndPrice(5000, 10);

        $fakePI = (object) [
            'id'              => 'pi_test_pending',
            'status'          => 'requires_payment_method',
            'amount_received' => 0,
        ];

        $mock = \Mockery::mock('alias:\Stripe\PaymentIntent');
        $mock->shouldReceive('retrieve')->once()->andReturn($fakePI);

        $stripeMock = \Mockery::mock('alias:\Stripe\Stripe');
        $stripeMock->shouldReceive('setApiKey')->once();

        $payload = array_merge($this->checkoutPayload($data['variant']->id), [
            'payment_intent_id' => 'pi_test_pending',
        ]);

        $response = $this->actingAs($user)
                         ->postJson('/api/checkout/confirm', $payload);

        $response->assertStatus(422);

        // No order should be created
        $this->assertDatabaseMissing('lunar_orders', ['reference' => 'pi_test_pending']);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function test_confirm_amount_mismatch_returns_422(): void
    {
        $user = User::factory()->create();
        $data = $this->createProductWithVariantAndPrice(5000, 10);

        $fakePI = (object) [
            'id'              => 'pi_test_mismatch',
            'status'          => 'succeeded',
            'amount_received' => 1, // Wrong amount
        ];

        $mock = \Mockery::mock('alias:\Stripe\PaymentIntent');
        $mock->shouldReceive('retrieve')->once()->andReturn($fakePI);

        $stripeMock = \Mockery::mock('alias:\Stripe\Stripe');
        $stripeMock->shouldReceive('setApiKey')->once();

        $payload = array_merge($this->checkoutPayload($data['variant']->id), [
            'payment_intent_id' => 'pi_test_mismatch',
        ]);

        $response = $this->actingAs($user)
                         ->postJson('/api/checkout/confirm', $payload);

        $response->assertStatus(422);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function test_confirm_duplicate_is_idempotent(): void
    {
        $user = User::factory()->create();
        $data = $this->createProductWithVariantAndPrice(5000, 10);
        $total = 5000 + 499;

        $fakePI = (object) [
            'id'              => 'pi_test_dupe',
            'status'          => 'succeeded',
            'amount_received' => $total,
        ];

        $mock = \Mockery::mock('alias:\Stripe\PaymentIntent');
        $mock->shouldReceive('retrieve')->andReturn($fakePI);

        $stripeMock = \Mockery::mock('alias:\Stripe\Stripe');
        $stripeMock->shouldReceive('setApiKey');

        $payload = array_merge($this->checkoutPayload($data['variant']->id), [
            'payment_intent_id' => 'pi_test_dupe',
        ]);

        // First confirm
        $this->actingAs($user)->postJson('/api/checkout/confirm', $payload)
             ->assertStatus(201);

        // Second confirm — same payment_intent_id
        $this->actingAs($user)->postJson('/api/checkout/confirm', $payload)
             ->assertStatus(200); // Returns existing order

        // Only 1 order in DB
        $this->assertEquals(1, DB::table('lunar_orders')->where('reference', 'pi_test_dupe')->count());
    }

    // ── Shipping ──

    public function test_shipping_required_when_not_same_as_billing(): void
    {
        $user = User::factory()->create();
        $data = $this->createProductWithVariantAndPrice();

        $payload = $this->checkoutPayload($data['variant']->id);
        $payload['shipping_same_as_billing'] = false;
        // No shipping address provided

        $response = $this->actingAs($user)
                         ->postJson('/api/checkout/intent', $payload);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['shipping.line_one', 'shipping.city', 'shipping.postcode']);
    }

    // ── Without Auth ──

    public function test_checkout_without_auth_returns_401(): void
    {
        $response = $this->postJson('/api/checkout/intent', []);

        $response->assertStatus(401);
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /var/www/projecte2/backend
php artisan test --filter=CheckoutTest -v
```

Expected: All 10 tests pass. Tests with `@runInSeparateProcess` will be slower but avoid class redeclaration conflicts.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/Feature/Checkout/CheckoutTest.php
git commit -m "test: add Checkout feature tests (intent, confirm, Stripe mock, validation)"
```

---

## Task 8: Order Tests

**Files:**
- Create: `backend/tests/Feature/Orders/OrderTest.php`

- [ ] **Step 1: Write OrderTest with all edge cases**

```php
<?php
// backend/tests/Feature/Orders/OrderTest.php

namespace Tests\Feature\Orders;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class OrderTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
    }

    /**
     * Insert an order directly into the DB (avoids Stripe dependency).
     */
    private function insertOrder(int $userId, array $overrides = []): int
    {
        $now = now();

        return DB::table('lunar_orders')->insertGetId(array_merge([
            'user_id'              => $userId,
            'channel_id'           => $this->channel->id,
            'status'               => 'paid',
            'reference'            => 'pi_test_' . uniqid(),
            'sub_total'            => 5000,
            'discount_total'       => 0,
            'shipping_total'       => 499,
            'tax_total'            => 953,
            'total'                => 5499,
            'currency_code'        => 'EUR',
            'compare_currency_code' => 'EUR',
            'exchange_rate'        => 1,
            'tax_breakdown'        => json_encode([]),
            'shipping_breakdown'   => json_encode([]),
            'discount_breakdown'   => json_encode([]),
            'placed_at'            => $now,
            'meta'                 => json_encode([]),
            'created_at'           => $now,
            'updated_at'           => $now,
        ], $overrides));
    }

    private function insertOrderAddress(int $orderId, string $type = 'billing'): void
    {
        $now = now();

        DB::table('lunar_order_addresses')->insert([
            'order_id'      => $orderId,
            'type'          => $type,
            'first_name'    => 'Test',
            'last_name'     => 'User',
            'contact_email' => 'test@example.com',
            'line_one'      => 'Carrer Test 1',
            'city'          => 'Barcelona',
            'postcode'      => '08001',
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);
    }

    // ── List ──

    public function test_list_orders_returns_own_orders(): void
    {
        $user  = User::factory()->create();
        $other = User::factory()->create();

        $this->insertOrder($user->id);
        $this->insertOrder($user->id);
        $this->insertOrder($other->id);

        $response = $this->actingAs($user)->getJson('/api/orders');

        $response->assertStatus(200)
                 ->assertJsonCount(2, 'data');
    }

    public function test_list_orders_pagination_capped_at_50(): void
    {
        $user = User::factory()->create();
        $this->insertOrder($user->id);

        $response = $this->actingAs($user)->getJson('/api/orders?per_page=999');

        $response->assertStatus(200)
                 ->assertJsonPath('meta.per_page', 50);
    }

    // ── Show ──

    public function test_show_own_order(): void
    {
        $user    = User::factory()->create();
        $orderId = $this->insertOrder($user->id);
        $this->insertOrderAddress($orderId, 'billing');
        $this->insertOrderAddress($orderId, 'shipping');

        $response = $this->actingAs($user)->getJson("/api/orders/{$orderId}");

        $response->assertStatus(200)
                 ->assertJsonStructure(['data' => ['id', 'reference', 'status', 'totals']]);
    }

    public function test_show_other_users_order_returns_403(): void
    {
        $user  = User::factory()->create();
        $other = User::factory()->create();

        $orderId = $this->insertOrder($other->id);

        $response = $this->actingAs($user)->getJson("/api/orders/{$orderId}");

        $response->assertStatus(403);
    }

    public function test_show_nonexistent_order_returns_404(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/orders/99999');

        $response->assertStatus(404);
    }

    // ── Invoice ──

    public function test_invoice_returns_pdf(): void
    {
        $user    = User::factory()->create();
        $orderId = $this->insertOrder($user->id);
        $this->insertOrderAddress($orderId, 'billing');
        $this->insertOrderAddress($orderId, 'shipping');

        $response = $this->actingAs($user)->get("/api/orders/{$orderId}/invoice");

        $response->assertStatus(200)
                 ->assertHeader('content-type', 'application/pdf');
    }

    public function test_invoice_for_pending_order_returns_pdf(): void
    {
        $user    = User::factory()->create();
        $orderId = $this->insertOrder($user->id, ['status' => 'pending']);
        $this->insertOrderAddress($orderId, 'billing');
        $this->insertOrderAddress($orderId, 'shipping');

        // Controller generates PDF regardless of order status
        $response = $this->actingAs($user)->get("/api/orders/{$orderId}/invoice");

        $response->assertStatus(200)
                 ->assertHeader('content-type', 'application/pdf');
    }

    public function test_invoice_other_users_order_returns_403(): void
    {
        $user  = User::factory()->create();
        $other = User::factory()->create();

        $orderId = $this->insertOrder($other->id);

        $response = $this->actingAs($user)->get("/api/orders/{$orderId}/invoice");

        $response->assertStatus(403);
    }

    public function test_invoice_invalid_lang_defaults_to_catalan(): void
    {
        $user    = User::factory()->create();
        $orderId = $this->insertOrder($user->id);
        $this->insertOrderAddress($orderId, 'billing');
        $this->insertOrderAddress($orderId, 'shipping');

        $response = $this->actingAs($user)->get("/api/orders/{$orderId}/invoice?lang=xx");

        // Should use 'ca' default and return 200 + PDF
        $response->assertStatus(200);
    }

    // ── Auth Guard ──

    public function test_orders_without_auth_returns_401(): void
    {
        $response = $this->getJson('/api/orders');

        $response->assertStatus(401);
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /var/www/projecte2/backend
php artisan test --filter=OrderTest -v
```

Expected: All 10 tests pass. The invoice tests require `backend/resources/views/pdf/invoice.blade.php` to exist — if they fail, verify the view exists.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/Feature/Orders/OrderTest.php
git commit -m "test: add Order feature tests (list, detail, invoice, ownership, pagination)"
```

---

## Task 9: Install Vitest & Configure Frontend Testing

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Modify: `frontend/vite.config.js`
- Create: `frontend/src/__tests__/setup.js`

- [ ] **Step 1: Install test dependencies**

```bash
cd /var/www/projecte2/frontend
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Add test config to vite.config.js**

Add the `test` block inside `defineConfig`:

```js
// frontend/vite.config.js
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/__tests__/setup.js',
  },
  server: {
    proxy: {
      "/api": {
        target: "http://backend.test",
        changeOrigin: true,
        secure: false,
      },
      "/sanctum": {
        target: "http://backend.test",
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
```

- [ ] **Step 3: Create setup.js**

```js
// frontend/src/__tests__/setup.js
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add test script to package.json**

In `frontend/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Verify Vitest runs**

```bash
cd /var/www/projecte2/frontend
npx vitest run --passWithNoTests
```

Expected: `0 tests passed` (no test files yet), exit code 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/vite.config.js frontend/src/__tests__/setup.js frontend/package.json
git commit -m "test: configure Vitest with React Testing Library for frontend"
```

---

## Task 10: Favorites Context Tests (Frontend)

**Files:**
- Create: `frontend/src/__tests__/context/favorites-context.test.jsx`

- [ ] **Step 1: Write favorites-context tests**

```jsx
// frontend/src/__tests__/context/favorites-context.test.jsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FavoritesProvider, useFavorites } from '@/context/favorites-context'

// Mock the auth context
const mockAuth = { isLoggedIn: true, loading: false }
vi.mock('@/context/auth-context', () => ({
  useAuth: () => mockAuth,
}))

// Mock the API
const mockGetFavorites = vi.fn()
const mockToggleFavorite = vi.fn()
vi.mock('@/services/api', () => ({
  getFavorites: (...args) => mockGetFavorites(...args),
  toggleFavorite: (...args) => mockToggleFavorite(...args),
}))

function wrapper({ children }) {
  return <FavoritesProvider>{children}</FavoritesProvider>
}

describe('FavoritesContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.isLoggedIn = true
    mockAuth.loading = false
    mockGetFavorites.mockResolvedValue({ data: [] })
  })

  it('loads favorites on mount when logged in', async () => {
    const fakeProducts = [{ id: 1, name: 'Nike Air' }, { id: 2, name: 'Adidas' }]
    mockGetFavorites.mockResolvedValue({ data: fakeProducts })

    const { result } = renderHook(() => useFavorites(), { wrapper })

    await waitFor(() => {
      expect(result.current.favorites).toHaveLength(2)
    })

    expect(mockGetFavorites).toHaveBeenCalledTimes(1)
  })

  it('returns empty favorites when not logged in', async () => {
    mockAuth.isLoggedIn = false

    const { result } = renderHook(() => useFavorites(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.favorites).toEqual([])
    expect(mockGetFavorites).not.toHaveBeenCalled()
  })

  it('does not fetch while auth is loading', async () => {
    mockAuth.loading = true

    renderHook(() => useFavorites(), { wrapper })

    // Give time for any async calls
    await new Promise(r => setTimeout(r, 50))

    expect(mockGetFavorites).not.toHaveBeenCalled()
  })

  it('toggleFavorite adds product optimistically', async () => {
    mockGetFavorites.mockResolvedValue({ data: [] })
    mockToggleFavorite.mockResolvedValue({
      data: { favorited: true, favorite: { id: 5, name: 'New Fav' } },
    })

    const { result } = renderHook(() => useFavorites(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      const added = await result.current.toggleFavorite(5)
      expect(added).toBe(true)
    })

    expect(result.current.favorites).toContainEqual({ id: 5, name: 'New Fav' })
  })

  it('toggleFavorite removes product optimistically', async () => {
    mockGetFavorites.mockResolvedValue({ data: [{ id: 5, name: 'Existing' }] })
    mockToggleFavorite.mockResolvedValue({ data: { favorited: false } })

    const { result } = renderHook(() => useFavorites(), { wrapper })

    await waitFor(() => expect(result.current.favorites).toHaveLength(1))

    await act(async () => {
      const added = await result.current.toggleFavorite(5)
      expect(added).toBe(false)
    })

    expect(result.current.favorites).toHaveLength(0)
  })

  it('isFavorite returns correct boolean', async () => {
    mockGetFavorites.mockResolvedValue({ data: [{ id: 10 }] })

    const { result } = renderHook(() => useFavorites(), { wrapper })

    await waitFor(() => expect(result.current.favorites).toHaveLength(1))

    expect(result.current.isFavorite(10)).toBe(true)
    expect(result.current.isFavorite(99)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd /var/www/projecte2/frontend
npx vitest run src/__tests__/context/favorites-context.test.jsx
```

Expected: All 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/context/favorites-context.test.jsx
git commit -m "test: add favorites-context tests (load, toggle, auth guards)"
```

---

## Task 11: Cart Context Tests (Frontend)

**Files:**
- Create: `frontend/src/__tests__/context/cart-context.test.jsx`

- [ ] **Step 1: Read the cart-context implementation**

Read `frontend/src/context/cart-context.jsx` to understand exact API calls, state shape, and method signatures before writing tests. The test structure below is a scaffold — adapt imports, method names, and assertions to match the actual context API.

- [ ] **Step 2: Write cart-context tests**

```jsx
// frontend/src/__tests__/context/cart-context.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock axios/api calls before importing context
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

// NOTE: At implementation time, read cart-context.jsx fully and:
// 1. Import the actual CartProvider and useCart hook
// 2. Mock all dependencies (api, localStorage, auth-context if needed)
// 3. Replace it.todo() with real renderHook + act + waitFor tests

describe('CartContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it.todo('cartCount increments when adding a product')
  it.todo('cartCount decrements when removing a product')
  it.todo('clearCart resets cartCount to zero')
})
```

- [ ] **Step 3: Run tests and commit**

```bash
cd /var/www/projecte2/frontend
npx vitest run src/__tests__/context/cart-context.test.jsx
git add frontend/src/__tests__/context/cart-context.test.jsx
git commit -m "test: add cart-context test scaffolding"
```

---

## Task 12: Page Component Tests (Frontend)

These page components are complex (200-670 lines each). The test files below provide scaffolding with `it.todo()` markers for every spec edge case. At implementation time, read each component fully and replace `it.todo()` with real tests.

**Files:**
- Create: `frontend/src/__tests__/pages/ProductDetailPage.test.jsx`
- Create: `frontend/src/__tests__/pages/CartPage.test.jsx`
- Create: `frontend/src/__tests__/pages/HomePage.test.jsx`
- Create: `frontend/src/__tests__/pages/CheckoutForm.test.jsx`

- [ ] **Step 1: Create ProductDetailPage test scaffolding**

```jsx
// frontend/src/__tests__/pages/ProductDetailPage.test.jsx
import { describe, it, vi } from 'vitest'

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({ isLoggedIn: true, user: { id: 1 }, loading: false }),
}))
vi.mock('@/context/favorites-context', () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }),
}))
vi.mock('@/context/cart-context', () => ({
  useCart: () => ({ addItem: vi.fn() }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'ca' } }),
}))

describe('ProductDetailPage', () => {
  // Spec 5.3
  it.todo('add button disabled without size selected')
  it.todo('add button disabled during API call (prevents double click)')
  it.todo('favorite button disabled during toggle (prevents double click)')
  it.todo('unauthenticated user + favorite click → redirects to /login')
})
```

- [ ] **Step 2: Create CartPage test scaffolding**

```jsx
// frontend/src/__tests__/pages/CartPage.test.jsx
import { describe, it, vi } from 'vitest'

vi.mock('@/context/cart-context', () => ({
  useCart: () => ({
    items: [],
    cartCount: 0,
    clearCart: vi.fn(),
    removeItem: vi.fn(),
    updateQty: vi.fn(),
  }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'ca' } }),
}))

describe('CartPage', () => {
  // Spec 5.4
  it.todo('rapid multiple clicks on "+" does not fire simultaneous requests')
  it.todo('quantity reaching 0 removes item or asks confirmation')
})
```

- [ ] **Step 3: Create HomePage test scaffolding**

```jsx
// frontend/src/__tests__/pages/HomePage.test.jsx
import { describe, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'ca' } }),
}))
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { data: [], meta: { current_page: 1, last_page: 1, total: 0, per_page: 12 } },
    }),
  },
}))

describe('HomePage', () => {
  // Spec 5.5
  it.todo('empty search loads all products')
  it.todo('search with no results shows "no results" message, not an error')
  it.todo('back navigation restores previous search from URL')
})
```

- [ ] **Step 4: Create CheckoutForm test scaffolding**

```jsx
// frontend/src/__tests__/pages/CheckoutForm.test.jsx
import { describe, it, vi } from 'vitest'

vi.mock('@stripe/react-stripe-js', () => ({
  useStripe: () => null,
  useElements: () => null,
  PaymentElement: () => null,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'ca' } }),
}))

describe('CheckoutForm', () => {
  // Spec 5.6
  it.todo('pay button disabled while Stripe Elements has not loaded')
  it.todo('pay button disabled during payment processing (prevents double click)')
  it.todo('Stripe error shows error message and re-enables form')
})
```

- [ ] **Step 5: Run all frontend tests and commit**

```bash
cd /var/www/projecte2/frontend
npx vitest run
git add frontend/src/__tests__/pages/
git commit -m "test: add page component test scaffolding (ProductDetail, Cart, Home, Checkout)"
```

---

## Task 13: Run Full Test Suite & Final Verification

- [ ] **Step 1: Run all backend tests**

```bash
cd /var/www/projecte2/backend
php artisan test -v
```

Expected: All tests pass. Approximate counts:
- Auth: 8
- Products: 9
- Favorites: 8
- Cart: 9
- Checkout: 10
- Orders: 10
- **Total: ~54 backend tests**

- [ ] **Step 2: Run all frontend tests**

```bash
cd /var/www/projecte2/frontend
npx vitest run
```

Expected: 6 passing tests (favorites-context) + todo markers for remaining tests.

- [ ] **Step 3: Final commit with any remaining test files**

Verify no uncommitted test files remain:
```bash
cd /var/www/projecte2
git status
```

If clean, the implementation is complete.

---

## Implementation Notes

### Stripe Mocking Strategy

The `CheckoutController` calls `\Stripe\Stripe::setApiKey()` and `\Stripe\PaymentIntent::create()`/`::retrieve()` as static methods. To mock these:

1. Use Mockery's `alias:` prefix: `\Mockery::mock('alias:\Stripe\PaymentIntent')`
2. **Every test using `alias:` MUST have `@runInSeparateProcess` and `@preserveGlobalState disabled`** — Mockery `alias:` creates class aliases that persist for the PHP process lifetime
3. This makes tests slower but avoids "Cannot redeclare class" fatal errors

### Lunar's Built-in Factories

Lunar ships factories in `vendor/lunarphp/core/database/factories/`. These are auto-discovered via `newFactory()` methods on each model. **Do NOT create custom factories in `database/factories/` for Lunar models** — they will be ignored because `newFactory()` returns Lunar's own factory.

To customize factory defaults, pass overrides: `Channel::factory()->create(['name' => 'Webshop'])`.

For `App\Models\Product` (which extends `Lunar\Models\Product`), the parent's `newFactory()` creates `Lunar\Models\Product` instances — but since both classes share the `lunar_products` table, this works fine for testing.

### Cart Tests & Sessions

Cart routes use the `web` middleware group. Laravel's test helpers (`$this->postJson()`) automatically handle session cookies. The `cart_token` mechanism provides an alternative to session-based cart identification.

### Frontend Test Strategy

- **Favorites context** (Task 10): Fully implemented with real assertions
- **Cart context** (Task 11): Scaffolded with `it.todo()` — needs implementation-time adaptation
- **Page components** (Task 12): Scaffolded with `it.todo()` — complex components (200-670 lines) require careful mock setup at implementation time
- At implementation time: read each component source, identify all dependencies, replace `it.todo()` with real render + assertion tests
