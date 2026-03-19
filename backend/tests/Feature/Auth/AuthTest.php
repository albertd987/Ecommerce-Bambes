<?php

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
