<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Assignment;
use App\Models\Device;
use App\Models\Employee;
use App\Models\SoftwareLicense;
use App\Models\User;
use App\Services\DemoPresetService;
use App\Services\MatchingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DemoModeAndPresetsTest extends TestCase
{
    use RefreshDatabase;

    public function test_root_auto_logs_in_as_admin_and_seeds_default_preset_when_demo_mode_enabled(): void
    {
        config()->set('itam.demo_mode', true);
        config()->set('itam.default_demo_preset', DemoPresetService::PRESET_SMALL);

        $response = $this->get('/');

        $response->assertRedirect(route('dashboard'));
        $this->assertAuthenticated();
        $this->assertEquals('admin@itfleet.local', auth()->user()->email);
        $this->assertEquals(UserRole::Admin, auth()->user()->role);

        $this->assertDatabaseHas('users', ['email' => 'auditor@itfleet.local', 'role' => 'viewer']);
        $this->assertEquals(37, Device::count());
        $this->assertEquals(15, Employee::count());
        $this->assertEquals(6, SoftwareLicense::count());
        $this->assertEquals(DemoPresetService::PRESET_SMALL, app(DemoPresetService::class)->getActivePreset());
    }

    public function test_logout_redirects_to_login_page_without_auto_login_loop_in_demo_mode(): void
    {
        config()->set('itam.demo_mode', true);
        $this->get('/');
        $this->assertAuthenticated();

        $logoutResponse = $this->post('/logout');

        $logoutResponse->assertRedirect(route('login'));
        $this->assertGuest();

        $loginPage = $this->get(route('login'));
        $loginPage->assertOk();
        $loginPage->assertInertia(fn ($page) => $page
            ->component('Auth/Login')
            ->where('showDemoLogin', true)
        );
    }

    public function test_demo_role_switcher_swaps_authenticated_role_and_enforces_rbac(): void
    {
        config()->set('itam.demo_mode', true);
        $this->get('/');

        // Switching from /match to viewer should land safely on /dashboard rather than throwing 403
        $switchToAuditor = $this->from('/match')->post(route('demo.switch-role'), ['role' => 'viewer']);
        $switchToAuditor->assertRedirect(route('dashboard'));
        $this->assertEquals('auditor@itfleet.local', auth()->user()->email);
        $this->assertEquals(UserRole::Viewer, auth()->user()->role);
        $this->get('/devices/create')->assertForbidden();

        // Switch to technician: blocked on device creation, allowed on maintenance
        $switchToTech = $this->post(route('demo.switch-role'), ['role' => 'technician']);
        $switchToTech->assertRedirect();
        $this->assertEquals('tech@itfleet.local', auth()->user()->email);
        $this->assertEquals(UserRole::Technician, auth()->user()->role);
        $this->get('/devices/create')->assertForbidden();

        // Switch to manager and back to admin
        $this->post(route('demo.switch-role'), ['role' => 'manager'])->assertRedirect();
        $this->assertEquals('manager@itfleet.local', auth()->user()->email);
        $this->get('/devices/create')->assertOk();

        $this->post(route('demo.switch-role'), ['role' => 'admin'])->assertRedirect();
        $this->assertEquals('admin@itfleet.local', auth()->user()->email);
        $this->get('/devices/create')->assertOk();
    }

    public function test_demo_preset_switcher_populates_small_medium_and_large_scales_deterministically(): void
    {
        config()->set('itam.demo_mode', true);
        app(DemoPresetService::class)->ensureDemoUsers();
        $admin = User::where('email', 'admin@itfleet.local')->firstOrFail();

        $matching = app(MatchingService::class);

        // 1. Small preset
        $this->actingAs($admin)
            ->post(route('demo.switch-preset'), ['preset' => DemoPresetService::PRESET_SMALL])
            ->assertRedirect(route('dashboard'));

        $this->assertEquals(37, Device::count());
        $this->assertEquals(23, Device::compute()->count());
        $this->assertEquals(15, Employee::count());
        $this->assertEquals(6, SoftwareLicense::count());
        $this->assertCount(3, $matching->detectMismatches());
        $this->assertDatabaseHas('app_settings', ['key' => 'active_demo_preset', 'value' => DemoPresetService::PRESET_SMALL]);

        // Verify multi-asset custody in Small (Aaron has compute laptop + monitor + peripheral)
        $aaron = Employee::where('name', 'Aaron Creed Celindro')->firstOrFail();
        $this->assertGreaterThan(1, Assignment::where('employee_id', $aaron->id)->whereNull('unassigned_at')->count());

        // 2. Medium preset
        $this->actingAs($admin)
            ->post(route('demo.switch-preset'), ['preset' => DemoPresetService::PRESET_MEDIUM])
            ->assertRedirect(route('dashboard'));

        $this->assertEquals(150, Device::count());
        $this->assertEquals(85, Device::compute()->count());
        $this->assertEquals(65, Employee::count());
        $this->assertEquals(14, SoftwareLicense::count());
        $this->assertCount(10, $matching->detectMismatches());
        $this->assertDatabaseHas('app_settings', ['key' => 'active_demo_preset', 'value' => DemoPresetService::PRESET_MEDIUM]);

        // 3. Large preset
        $this->actingAs($admin)
            ->post(route('demo.switch-preset'), ['preset' => DemoPresetService::PRESET_LARGE])
            ->assertRedirect(route('dashboard'));

        $this->assertEquals(450, Device::count());
        $this->assertEquals(250, Device::compute()->count());
        $this->assertEquals(200, Employee::count());
        $this->assertEquals(25, SoftwareLicense::count());
        $this->assertCount(22, $matching->detectMismatches());
        $this->assertDatabaseHas('app_settings', ['key' => 'active_demo_preset', 'value' => DemoPresetService::PRESET_LARGE]);

        // Shared Inertia demo prop reflects currently active preset
        $dashboard = $this->actingAs($admin)->get(route('dashboard'));
        $dashboard->assertInertia(fn ($page) => $page
            ->where('demo.enabled', true)
            ->where('demo.active_preset', DemoPresetService::PRESET_LARGE)
            ->has('demo.presets', 3)
        );
    }

    public function test_demo_reset_restores_clean_active_preset_state(): void
    {
        config()->set('itam.demo_mode', true);
        app(DemoPresetService::class)->applyPreset(DemoPresetService::PRESET_SMALL);
        $admin = User::where('email', 'admin@itfleet.local')->firstOrFail();

        Device::create([
            'asset_tag' => 'TEMP-MUTATED-999',
            'device_type' => 'laptop',
            'brand' => 'Dell',
            'model' => 'Latitude 5440',
            'cpu' => 'Intel Core i5',
            'cpu_tier' => 'mid',
            'ram_gb' => 16,
            'storage_type' => 'SSD',
            'storage_gb' => 512,
            'gpu_tier' => 'integrated',
            'year_acquired' => 2024,
            'condition' => 'excellent',
            'status' => 'available',
        ]);

        $this->assertEquals(38, Device::count());

        $response = $this->actingAs($admin)->post(route('demo.reset'));
        $response->assertRedirect(route('dashboard'));

        $this->assertEquals(37, Device::count());
        $this->assertNull(Device::where('asset_tag', 'TEMP-MUTATED-999')->first());
        $this->assertEquals(DemoPresetService::PRESET_SMALL, DB::table('app_settings')->where('key', 'active_demo_preset')->value('value'));
    }

    public function test_demo_endpoints_return_forbidden_when_demo_mode_disabled(): void
    {
        config()->set('itam.demo_mode', false);
        $admin = User::factory()->admin()->create();

        $this->get('/')->assertRedirect(route('login'));

        $this->actingAs($admin)->post(route('demo.switch-role'), ['role' => 'viewer'])->assertForbidden();
        $this->actingAs($admin)->post(route('demo.switch-preset'), ['preset' => 'medium'])->assertForbidden();
        $this->actingAs($admin)->post(route('demo.reset'))->assertForbidden();

        $dashboard = $this->actingAs($admin)->get(route('dashboard'));
        $dashboard->assertInertia(fn ($page) => $page
            ->where('demo.enabled', false)
        );
    }
}
