<?php

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
     * Insert an order directly into DB (no Stripe dependency).
     */
    private function insertOrder(int $userId, array $overrides = []): int
    {
        $now = now();

        return DB::table('lunar_orders')->insertGetId(array_merge([
            'user_id'               => $userId,
            'channel_id'            => $this->channel->id,
            'status'                => 'paid',
            'reference'             => 'pi_test_' . uniqid(),
            'sub_total'             => 5000,
            'discount_total'        => 0,
            'shipping_total'        => 499,
            'tax_total'             => 953,
            'total'                 => 5499,
            'currency_code'         => 'EUR',
            'compare_currency_code' => 'EUR',
            'exchange_rate'         => 1,
            'tax_breakdown'         => json_encode([]),
            'shipping_breakdown'    => json_encode([]),
            'discount_breakdown'    => json_encode([]),
            'placed_at'             => $now,
            'meta'                  => json_encode([]),
            'created_at'            => $now,
            'updated_at'            => $now,
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

        // ID 99999 assumed not to exist (auto-increment starts at 1)
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
        // Controller generates PDF regardless of order status
        $orderId = $this->insertOrder($user->id, ['status' => 'pending']);
        $this->insertOrderAddress($orderId, 'billing');
        $this->insertOrderAddress($orderId, 'shipping');

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

        // 'xx' is invalid, controller defaults to 'ca'
        $response = $this->actingAs($user)->get("/api/orders/{$orderId}/invoice?lang=xx");

        $response->assertStatus(200);
    }

    // ── Auth Guard ──

    public function test_orders_without_auth_returns_401(): void
    {
        $response = $this->getJson('/api/orders');

        $response->assertStatus(401);
    }
}
