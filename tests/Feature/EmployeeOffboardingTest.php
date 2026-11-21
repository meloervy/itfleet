<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\Device;
use App\Models\Employee;
use App\Models\RoleProfile;
use App\Models\SoftwareLicense;
use App\Models\SoftwareLicenseAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeOffboardingTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_offboarding_atomically_reclaims_all_compute_and_non_compute_assets_and_revokes_licenses(): void
    {
        $admin = User::factory()->admin()->create();

        $engineerRole = RoleProfile::create([
            'name' => 'Software Engineer',
            'min_cpu_tier' => 'mid',
            'min_ram_gb' => 16,
            'min_storage_gb' => 512,
            'requires_gpu' => false,
            'portability_required' => true,
        ]);

        $departing = Employee::create([
            'name' => 'Elena Departing',
            'department' => 'Engineering',
            'role_profile_id' => $engineerRole->id,
        ]);

        $waiting = Employee::create([
            'name' => 'Carlos Waiting',
            'department' => 'Engineering',
            'role_profile_id' => $engineerRole->id,
        ]);

        $laptop = Device::create([
            'asset_tag' => 'OFF-LAP-01',
            'device_type' => 'laptop',
            'brand' => 'Lenovo',
            'model' => 'ThinkPad T14',
            'cpu' => 'Intel Core i7',
            'cpu_tier' => 'mid',
            'ram_gb' => 16,
            'storage_type' => 'SSD',
            'storage_gb' => 512,
            'gpu_tier' => 'integrated',
            'year_acquired' => 2024,
            'condition' => 'excellent',
            'status' => 'assigned',
            'lifecycle_stage' => 'deployment',
        ]);

        $monitor = Device::create([
            'asset_tag' => 'OFF-MON-01',
            'device_type' => 'monitor',
            'brand' => 'Dell',
            'model' => 'UltraSharp U2723QE',
            'year_acquired' => 2024,
            'condition' => 'excellent',
            'status' => 'assigned',
            'lifecycle_stage' => 'deployment',
        ]);

        $peripheral = Device::create([
            'asset_tag' => 'OFF-PER-01',
            'device_type' => 'peripheral',
            'brand' => 'CalDigit',
            'model' => 'TS4 Dock',
            'year_acquired' => 2024,
            'condition' => 'good',
            'status' => 'assigned',
            'lifecycle_stage' => 'deployment',
        ]);

        foreach ([$laptop, $monitor, $peripheral] as $dev) {
            Assignment::create([
                'device_id' => $dev->id,
                'employee_id' => $departing->id,
                'assigned_at' => now()->subMonths(2),
                'assignment_source' => 'manual_override',
            ]);
        }

        $jetbrains = SoftwareLicense::create([
            'name' => 'JetBrains All Products',
            'vendor' => 'JetBrains',
            'category' => 'development',
            'license_type' => 'saas',
            'billing_cycle' => 'annual',
            'total_seats' => 10,
            'cost_per_seat' => 16800.00,
            'status' => 'active',
        ]);

        $github = SoftwareLicense::create([
            'name' => 'GitHub Enterprise Cloud',
            'vendor' => 'GitHub',
            'category' => 'development',
            'license_type' => 'saas',
            'billing_cycle' => 'annual',
            'total_seats' => 10,
            'cost_per_seat' => 14200.00,
            'status' => 'active',
        ]);

        $seat1 = SoftwareLicenseAssignment::create([
            'software_license_id' => $jetbrains->id,
            'employee_id' => $departing->id,
            'assigned_at' => now()->subMonths(2),
            'assigned_by_user_id' => $admin->id,
        ]);

        $seat2 = SoftwareLicenseAssignment::create([
            'software_license_id' => $github->id,
            'employee_id' => $departing->id,
            'assigned_at' => now()->subMonths(2),
            'assigned_by_user_id' => $admin->id,
        ]);

        $response = $this->actingAs($admin)->postJson(route('employees.offboard', $departing->id), [
            'reason' => 'resignation',
            'condition' => 'good',
            'wipe_confirmed' => true,
            'revoke_licenses' => true,
            'notes' => 'Full exit kit returned and sanitized.',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('reclaimed_count', 3)
            ->assertJsonPath('revoked_licenses_count', 2)
            ->assertJsonPath('device.asset_tag', 'OFF-LAP-01')
            ->assertJsonPath('device.lifecycle_stage', 'reclaimed')
            ->assertJsonPath('device.status', 'available');

        foreach ([$laptop, $monitor, $peripheral] as $dev) {
            $fresh = $dev->fresh();
            $this->assertEquals('available', $fresh->status);
            $this->assertEquals('reclaimed', $fresh->lifecycle_stage);
            $this->assertDatabaseHas('lifecycle_events', [
                'device_id' => $dev->id,
                'from_stage' => 'deployment',
                'to_stage' => 'reclaimed',
            ]);
        }

        $this->assertEquals(0, $departing->activeAssignments()->count());
        $this->assertNotNull($seat1->fresh()->revoked_at);
        $this->assertNotNull($seat2->fresh()->revoked_at);

        $matches = $response->json('circulation_matches');
        $this->assertNotEmpty($matches);
        $this->assertEquals($waiting->id, $matches[0]['employee_id']);
    }

    public function test_employee_offboarding_can_preserve_licenses_when_revoke_licenses_is_false(): void
    {
        $admin = User::factory()->admin()->create();

        $employee = Employee::create([
            'name' => 'Role Transition Staff',
            'department' => 'Design',
        ]);

        $laptop = Device::create([
            'asset_tag' => 'OFF-KEEP-01',
            'device_type' => 'laptop',
            'brand' => 'Apple',
            'model' => 'MacBook Air M3',
            'cpu' => 'Apple M3',
            'cpu_tier' => 'mid',
            'ram_gb' => 16,
            'storage_type' => 'SSD',
            'storage_gb' => 512,
            'gpu_tier' => 'integrated',
            'year_acquired' => 2024,
            'condition' => 'excellent',
            'status' => 'assigned',
            'lifecycle_stage' => 'deployment',
        ]);

        Assignment::create([
            'device_id' => $laptop->id,
            'employee_id' => $employee->id,
            'assigned_at' => now()->subMonth(),
            'assignment_source' => 'manual_override',
        ]);

        $figma = SoftwareLicense::create([
            'name' => 'Figma Organization',
            'vendor' => 'Figma',
            'category' => 'design',
            'license_type' => 'saas',
            'billing_cycle' => 'annual',
            'total_seats' => 5,
            'cost_per_seat' => 29500.00,
            'status' => 'active',
        ]);

        $seat = SoftwareLicenseAssignment::create([
            'software_license_id' => $figma->id,
            'employee_id' => $employee->id,
            'assigned_at' => now()->subMonth(),
            'assigned_by_user_id' => $admin->id,
        ]);

        $response = $this->actingAs($admin)->postJson(route('employees.offboard', $employee->id), [
            'reason' => 'hardware_upgrade',
            'condition' => 'excellent',
            'wipe_confirmed' => true,
            'revoke_licenses' => false,
        ]);

        $response->assertOk()
            ->assertJsonPath('reclaimed_count', 1)
            ->assertJsonPath('revoked_licenses_count', 0);

        $this->assertEquals('available', $laptop->fresh()->status);
        $this->assertNull($seat->fresh()->revoked_at);
    }

    public function test_employee_offboarding_returns_422_when_employee_has_no_assets_or_licenses_and_enforces_rbac(): void
    {
        $admin = User::factory()->admin()->create();
        $technician = User::factory()->technician()->create();
        $viewer = User::factory()->viewer()->create();

        $emptyEmployee = Employee::create([
            'name' => 'Empty Custodian',
            'department' => 'Operations',
        ]);

        $payload = [
            'reason' => 'resignation',
            'condition' => 'good',
            'wipe_confirmed' => true,
        ];

        $this->actingAs($technician)
            ->postJson(route('employees.offboard', $emptyEmployee->id), $payload)
            ->assertForbidden();

        $this->actingAs($viewer)
            ->postJson(route('employees.offboard', $emptyEmployee->id), $payload)
            ->assertForbidden();

        $this->actingAs($admin)
            ->postJson(route('employees.offboard', $emptyEmployee->id), $payload)
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_direct_device_reclaim_targets_specific_secondary_asset_without_touching_primary_laptop(): void
    {
        $admin = User::factory()->admin()->create();

        $employee = Employee::create([
            'name' => 'Multi Asset Custodian',
            'department' => 'Engineering',
        ]);

        $laptop = Device::create([
            'asset_tag' => 'CUST-LAP-01',
            'device_type' => 'laptop',
            'brand' => 'Apple',
            'model' => 'MacBook Pro 14',
            'cpu' => 'Apple M3 Pro',
            'cpu_tier' => 'high',
            'ram_gb' => 18,
            'storage_type' => 'SSD',
            'storage_gb' => 512,
            'gpu_tier' => 'integrated',
            'year_acquired' => 2024,
            'condition' => 'excellent',
            'status' => 'assigned',
            'lifecycle_stage' => 'deployment',
        ]);

        $monitor = Device::create([
            'asset_tag' => 'CUST-MON-01',
            'device_type' => 'monitor',
            'brand' => 'Dell',
            'model' => 'UltraSharp U2723QE',
            'year_acquired' => 2024,
            'condition' => 'excellent',
            'status' => 'assigned',
            'lifecycle_stage' => 'deployment',
        ]);

        Assignment::create([
            'device_id' => $laptop->id,
            'employee_id' => $employee->id,
            'assigned_at' => now()->subMonth(),
            'assignment_source' => 'manual_override',
        ]);

        Assignment::create([
            'device_id' => $monitor->id,
            'employee_id' => $employee->id,
            'assigned_at' => now()->subMonth(),
            'assignment_source' => 'manual_override',
        ]);

        $response = $this->actingAs($admin)->postJson(route('devices.reclaim', $monitor->id), [
            'reason' => 'hardware_upgrade',
            'condition' => 'good',
            'wipe_confirmed' => true,
            'notes' => 'Monitor returned to depot.',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('device.asset_tag', 'CUST-MON-01')
            ->assertJsonPath('device.lifecycle_stage', 'reclaimed')
            ->assertJsonPath('device.status', 'available');

        $this->assertEquals('available', $monitor->fresh()->status);
        $this->assertEquals('reclaimed', $monitor->fresh()->lifecycle_stage);

        $this->assertEquals('assigned', $laptop->fresh()->status);
        $this->assertEquals('deployment', $laptop->fresh()->lifecycle_stage);
        $this->assertEquals(1, $employee->activeAssignments()->count());
        $this->assertEquals($laptop->id, $employee->activeAssignment->device_id);
    }
}
