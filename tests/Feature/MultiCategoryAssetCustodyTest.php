<?php

namespace Tests\Feature;

use App\Models\Device;
use App\Models\Employee;
use App\Models\RoleProfile;
use App\Models\User;
use App\Services\MatchingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MultiCategoryAssetCustodyTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    public function test_non_compute_categories_can_be_registered_without_compute_specs(): void
    {
        $monitorRes = $this->actingAs($this->admin)->post('/devices', [
            'asset_tag' => 'MON-001',
            'device_type' => 'monitor',
            'brand' => 'Dell',
            'model' => 'UltraSharp U2723QE',
            'year_acquired' => 2025,
            'purchase_cost' => 32000.00,
            'condition' => 'excellent',
            'status' => 'available',
            'specifications' => [
                'screen_size' => '27"',
                'resolution' => '3840x2160 4K',
                'panel_type' => 'IPS Black',
            ],
        ]);
        $monitorRes->assertRedirect('/devices');

        $mobileRes = $this->actingAs($this->admin)->post('/devices', [
            'asset_tag' => 'MOB-001',
            'device_type' => 'mobile',
            'brand' => 'Apple',
            'model' => 'iPhone 16 Pro',
            'year_acquired' => 2025,
            'purchase_cost' => 68000.00,
            'condition' => 'excellent',
            'status' => 'available',
            'specifications' => [
                'os' => 'iOS 18',
                'storage' => '256GB',
                'carrier' => 'Globe Enterprise',
            ],
        ]);
        $mobileRes->assertRedirect('/devices');

        $peripheralRes = $this->actingAs($this->admin)->post('/devices', [
            'asset_tag' => 'PER-001',
            'device_type' => 'peripheral',
            'brand' => 'CalDigit',
            'model' => 'TS4 Dock',
            'year_acquired' => 2025,
            'purchase_cost' => 19500.00,
            'condition' => 'good',
            'status' => 'available',
            'specifications' => [
                'subtype' => 'Thunderbolt 4 Dock',
                'connectivity' => 'Thunderbolt 4 / USB-C',
            ],
        ]);
        $peripheralRes->assertRedirect('/devices');

        $monitor = Device::where('asset_tag', 'MON-001')->firstOrFail();
        $this->assertNull($monitor->cpu);
        $this->assertNull($monitor->ram_gb);
        $this->assertEquals('27"', $monitor->specifications['screen_size']);
        $this->assertStringContainsString('3840x2160 4K', $monitor->spec_summary);
        $this->assertEquals('/images/devices/default-monitor.svg', $monitor->image_clip_url);

        $mobile = Device::where('asset_tag', 'MOB-001')->firstOrFail();
        $this->assertEquals('/images/devices/default-mobile.svg', $mobile->image_clip_url);

        $peripheral = Device::where('asset_tag', 'PER-001')->firstOrFail();
        $this->assertEquals('/images/devices/default-peripheral.svg', $peripheral->image_clip_url);
    }

    public function test_compute_devices_still_require_cpu_and_ram(): void
    {
        $response = $this->actingAs($this->admin)->post('/devices', [
            'asset_tag' => 'LAP-REQ-01',
            'device_type' => 'laptop',
            'brand' => 'Lenovo',
            'model' => 'ThinkPad T14',
            'year_acquired' => 2025,
            'condition' => 'excellent',
            'status' => 'available',
        ]);

        $response->assertSessionHasErrors(['cpu', 'cpu_tier', 'ram_gb', 'storage_type', 'storage_gb']);
        $this->assertDatabaseMissing('devices', ['asset_tag' => 'LAP-REQ-01']);
    }

    public function test_employee_can_hold_primary_compute_plus_multiple_secondary_assets_and_swap_compute_without_losing_peripherals(): void
    {
        $matchingService = app(MatchingService::class);
        $employee = Employee::create([
            'name' => 'Avery Lim',
            'department' => 'Engineering',
        ]);

        $laptop1 = Device::create([
            'asset_tag' => 'LAP-CUST-01',
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
            'status' => 'available',
        ]);

        $laptop2 = Device::create([
            'asset_tag' => 'LAP-CUST-02',
            'device_type' => 'laptop',
            'brand' => 'Lenovo',
            'model' => 'ThinkPad X1 Carbon',
            'cpu' => 'Intel Core Ultra 7',
            'cpu_tier' => 'high',
            'ram_gb' => 32,
            'storage_type' => 'SSD',
            'storage_gb' => 1024,
            'gpu_tier' => 'integrated',
            'year_acquired' => 2025,
            'condition' => 'excellent',
            'status' => 'available',
        ]);

        $monitor = Device::create([
            'asset_tag' => 'MON-CUST-01',
            'device_type' => 'monitor',
            'brand' => 'LG',
            'model' => 'UltraFine 27',
            'year_acquired' => 2024,
            'condition' => 'excellent',
            'status' => 'available',
            'specifications' => ['screen_size' => '27"', 'resolution' => '4K'],
        ]);

        $peripheral = Device::create([
            'asset_tag' => 'PER-CUST-01',
            'device_type' => 'peripheral',
            'brand' => 'Logitech',
            'model' => 'MX Keys Combo',
            'year_acquired' => 2024,
            'condition' => 'good',
            'status' => 'available',
            'specifications' => ['subtype' => 'Keyboard & Mouse'],
        ]);

        $matchingService->assignDevice($laptop1->id, $employee->id);
        $matchingService->assignDevice($monitor->id, $employee->id);
        $matchingService->assignDevice($peripheral->id, $employee->id);

        $employee->refresh();
        $this->assertEquals(3, $employee->activeAssignments()->count());
        $this->assertEquals($laptop1->id, $employee->activeAssignment->device_id);

        // Assigning a second laptop replaces only the first laptop; monitor & peripheral remain assigned
        $matchingService->assignDevice($laptop2->id, $employee->id);

        $employee->refresh();
        $this->assertEquals(3, $employee->activeAssignments()->count());
        $this->assertEquals($laptop2->id, $employee->activeAssignment->device_id);
        $this->assertEquals('available', $laptop1->fresh()->status);
        $this->assertEquals('assigned', $laptop2->fresh()->status);
        $this->assertEquals('assigned', $monitor->fresh()->status);
        $this->assertEquals('assigned', $peripheral->fresh()->status);
    }

    public function test_matching_mismatch_and_simulation_ignore_non_compute_assets(): void
    {
        $matchingService = app(MatchingService::class);

        $profile = RoleProfile::create([
            'name' => 'Software Engineer',
            'min_cpu_tier' => 'high',
            'min_ram_gb' => 16,
            'min_storage_gb' => 512,
            'requires_gpu' => false,
            'portability_required' => true,
        ]);

        $employee = Employee::create([
            'name' => 'Dev User',
            'department' => 'Engineering',
            'role_profile_id' => $profile->id,
        ]);

        $monitor = Device::create([
            'asset_tag' => 'MON-IGN-01',
            'device_type' => 'monitor',
            'brand' => 'Dell',
            'model' => 'P2723DE',
            'year_acquired' => 2024,
            'condition' => 'excellent',
            'status' => 'available',
        ]);

        $requirements = [
            'min_cpu_tier' => 'mid',
            'min_ram_gb' => 16,
            'min_storage_gb' => 512,
            'requires_gpu' => false,
            'min_gpu_tier' => 'none',
            'portability_required' => true,
        ];

        $ranked = $matchingService->rankDevices($requirements, null, true);
        $this->assertEmpty($ranked['results']);

        $eval = $matchingService->evaluateDevice($monitor, $requirements, false);
        $this->assertTrue($eval['disqualified']);

        $sim = $matchingService->simulateHeadcount($requirements, 1);
        $this->assertEquals(0, $sim['covered_count']);

        $matchingService->assignDevice($monitor->id, $employee->id);
        $this->assertEmpty($matchingService->detectMismatches());
        $this->assertEmpty($matchingService->findRecirculationMatches($monitor));
    }

    public function test_direct_device_assign_and_unassign_endpoints_respect_rbac(): void
    {
        $technician = User::factory()->technician()->create();
        $viewer = User::factory()->viewer()->create();

        $employee = Employee::create([
            'name' => 'Custodian Staff',
            'department' => 'Design',
        ]);

        $monitor = Device::create([
            'asset_tag' => 'MON-RBAC-01',
            'device_type' => 'monitor',
            'brand' => 'ASUS',
            'model' => 'ProArt PA279CV',
            'year_acquired' => 2024,
            'condition' => 'excellent',
            'status' => 'available',
            'lifecycle_stage' => 'acquisition',
        ]);

        $this->actingAs($technician)
            ->post(route('devices.assign', $monitor->id), ['employee_id' => $employee->id])
            ->assertForbidden();

        $this->actingAs($viewer)
            ->post(route('devices.unassign', $monitor->id))
            ->assertForbidden();

        $assignRes = $this->actingAs($this->admin)
            ->post(route('devices.assign', $monitor->id), ['employee_id' => $employee->id]);

        $assignRes->assertRedirect();
        $assignRes->assertSessionHas('success');
        $this->assertEquals('assigned', $monitor->fresh()->status);
        $this->assertEquals('deployment', $monitor->fresh()->lifecycle_stage);

        $unassignRes = $this->actingAs($this->admin)
            ->post(route('devices.unassign', $monitor->id));

        $unassignRes->assertRedirect();
        $unassignRes->assertSessionHas('success');
        $this->assertEquals('available', $monitor->fresh()->status);
    }
}
