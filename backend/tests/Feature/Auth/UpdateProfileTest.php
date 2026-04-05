<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class UpdateProfileTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function changing_email_nulls_verification_and_sends_new_link(): void
    {
        Notification::fake();

        $user = User::factory()->create([
            'email' => 'old@example.com',
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user)
            ->putJson('/api/user/profile', [
                'name' => $user->name,
                'email' => 'new@example.com',
            ])
            ->assertOk();

        $user->refresh();
        $this->assertSame('new@example.com', $user->email);
        $this->assertNull($user->email_verified_at);

        Notification::assertSentTo($user, VerifyEmail::class);
    }

    /** @test */
    public function updating_profile_without_changing_email_keeps_verification(): void
    {
        Notification::fake();

        $verifiedAt = now()->subDay();
        $user = User::factory()->create([
            'email' => 'same@example.com',
            'email_verified_at' => $verifiedAt,
        ]);

        $this->actingAs($user)
            ->putJson('/api/user/profile', [
                'name' => 'New Name',
                'email' => 'same@example.com',
            ])
            ->assertOk();

        $user->refresh();
        $this->assertNotNull($user->email_verified_at);
        Notification::assertNothingSent();
    }
}
