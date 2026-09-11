<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_starts_an_authenticated_session(): void
    {
        $user = User::factory()->create(['email' => 'admin@example.test', 'password' => Hash::make('secret-password')]);

        $this->withSession(['_token' => 'test-token'])
            ->postJson('/api/auth/login', ['email' => 'admin@example.test', 'password' => 'secret-password'], ['X-CSRF-TOKEN' => 'test-token'])
            ->assertOk()
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonMissingPath('token');

        $this->assertAuthenticatedAs($user);
    }
}
