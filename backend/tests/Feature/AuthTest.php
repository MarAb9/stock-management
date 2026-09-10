<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_a_sanctum_token(): void
    {
        User::factory()->create(['email' => 'admin@example.test', 'password' => Hash::make('secret-password')]);
        $this->postJson('/api/auth/login', ['email' => 'admin@example.test', 'password' => 'secret-password'])->assertOk()->assertJsonStructure(['token', 'user' => ['id', 'email']]);
    }
}
