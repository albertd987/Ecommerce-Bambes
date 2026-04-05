<?php

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

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function test_create_intent_succeeds_with_stripe_mock(): void
    {
        $user = User::factory()->create();
        $data = $this->createProductWithVariantAndPrice(5000, 10); // 50€, stock=10

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

        // 5000 (product) + 499 (shipping) = 5499 cents
        $this->assertEquals(5499, $response->json('amount'));
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function test_confirm_succeeds_with_stripe_mock(): void
    {
        $user = User::factory()->create();
        $data = $this->createProductWithVariantAndPrice(5000, 10); // 50€, stock=10

        $expectedTotal = 5000 + 499; // product + shipping

        $fakePI = (object) [
            'id'              => 'pi_test_456',
            'status'          => 'succeeded',
            'amount_received' => $expectedTotal,
            'currency'        => 'eur',
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

        $this->assertDatabaseHas('lunar_orders', [
            'reference' => 'pi_test_456',
            'status'    => 'paid',
            'user_id'   => $user->id,
        ]);

        // Stock decremented from 10 to 9
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
            'currency'        => 'eur',
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
            'currency'        => 'eur',
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
            'currency'        => 'eur',
        ];

        $mock = \Mockery::mock('alias:\Stripe\PaymentIntent');
        $mock->shouldReceive('retrieve')->andReturn($fakePI);

        $stripeMock = \Mockery::mock('alias:\Stripe\Stripe');
        $stripeMock->shouldReceive('setApiKey');

        $payload = array_merge($this->checkoutPayload($data['variant']->id), [
            'payment_intent_id' => 'pi_test_dupe',
        ]);

        // First confirm → creates order
        $this->actingAs($user)->postJson('/api/checkout/confirm', $payload)
             ->assertStatus(201);

        // Second confirm → returns existing order, no duplicate
        $this->actingAs($user)->postJson('/api/checkout/confirm', $payload)
             ->assertStatus(200);

        $this->assertEquals(1, DB::table('lunar_orders')->where('reference', 'pi_test_dupe')->count());
    }

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

    public function test_checkout_without_auth_returns_401(): void
    {
        $response = $this->postJson('/api/checkout/intent', []);

        $response->assertStatus(401);
    }
}
