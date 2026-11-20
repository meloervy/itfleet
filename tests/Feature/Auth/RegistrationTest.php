<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_screen_can_be_rendered(): void
    {
        $response = $this->get('/register');

        $response->assertStatus(200);
    }

    public function test_new_users_can_register(): void
    {
        $response = $this->post('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_new_users_cannot_self_assign_privileged_role_and_always_receive_viewer_role(): void
    {
        $response = $this->post('/register', [
            'name' => 'IT Specialist',
            'email' => 'specialist@itfleet.local',
            'role' => 'admin',
            'department' => 'Hardware Asset Lifecycle',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', [
            'email' => 'specialist@itfleet.local',
            'role' => 'viewer',
            'department' => 'Hardware Asset Lifecycle',
        ]);
        $response->assertRedirect(route('dashboard', absolute: false));
    }
}
