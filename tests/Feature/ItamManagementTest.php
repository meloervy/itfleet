<?php

namespace Tests\Feature;

use App\Models\Device;
use App\Models\MaintenanceLog;
use App\Models\User;
use App\Services\ItamTrackingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ItamManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_can_register_device_with_full_itam_attributes(): void
    {
        $response = $this->actingAs($this->user)->post('/devices', [
            'asset_tag' => 'LAP-ITAM-01',
            'serial_number' => 'SN-12345678',
            'barcode' => 'BAR-998877',
            'techspecs_id' => 'apple-macbook-pro-16',
            'device_type' => 'laptop',
            'brand' => 'Apple',
            'model' => 'MacBook Pro 16',
            'location' => 'HQ - Level 3 Room 302',
            'cpu' => 'Apple M3 Pro',
            'cpu_tier' => 'high',
            'ram_gb' => 36,
            'storage_type' => 'SSD',
            'storage_gb' => 1024,
            'gpu' => 'Apple 18-core GPU',
            'gpu_tier' => 'dedicated-high',
            'year_acquired' => 2024,
            'purchase_cost' => 2899.00,
            'purchase_date' => '2024-03-01',
            'depreciation_rate_percent' => 20.0,
            'vendor' => 'Apple Direct',
            'warranty_start' => '2024-03-01',
            'warranty_expiry' => '2027-03-01',
            'contract_sla' => 'AppleCare+ 3-Year Enterprise',
            'condition' => 'excellent',
            'status' => 'available',
            'lifecycle_stage' => 'deployment',
        ]);

        $response->assertRedirect('/devices');
        $this->assertDatabaseHas('devices', [
            'asset_tag' => 'LAP-ITAM-01',
            'serial_number' => 'SN-12345678',
            'vendor' => 'Apple Direct',
            'location' => 'HQ - Level 3 Room 302',
            'lifecycle_stage' => 'deployment',
        ]);
        $this->assertDatabaseHas('lifecycle_events', [
            'to_stage' => 'deployment',
        ]);
    }

    public function test_can_transition_asset_lifecycle_stage(): void
    {
        $device = Device::create([
            'asset_tag' => 'LAP-STAGE-01',
            'device_type' => 'laptop',
            'brand' => 'Dell',
            'model' => 'Latitude 5540',
            'cpu' => 'Intel Core i7-1365U',
            'cpu_tier' => 'high',
            'ram_gb' => 16,
            'storage_type' => 'SSD',
            'storage_gb' => 512,
            'gpu_tier' => 'integrated',
            'year_acquired' => 2024,
            'condition' => 'good',
            'status' => 'available',
            'lifecycle_stage' => 'deployment',
        ]);

        $response = $this->actingAs($this->user)->post("/devices/{$device->id}/lifecycle", [
            'to_stage' => 'maintenance',
            'notes' => 'Sent to hardware lab for diagnostic inspection.',
        ]);

        $response->assertRedirect();
        $device->refresh();
        $this->assertEquals('maintenance', $device->lifecycle_stage);
        $this->assertEquals('in_repair', $device->status);

        $this->assertDatabaseHas('lifecycle_events', [
            'device_id' => $device->id,
            'from_stage' => 'deployment',
            'to_stage' => 'maintenance',
            'notes' => 'Sent to hardware lab for diagnostic inspection.',
        ]);
    }

    public function test_can_log_and_update_maintenance_activity(): void
    {
        $device = Device::create([
            'asset_tag' => 'LAP-MAINT-01',
            'device_type' => 'laptop',
            'brand' => 'Lenovo',
            'model' => 'ThinkPad T14',
            'cpu' => 'AMD Ryzen 5 PRO',
            'cpu_tier' => 'mid',
            'ram_gb' => 16,
            'storage_type' => 'SSD',
            'storage_gb' => 512,
            'gpu_tier' => 'integrated',
            'year_acquired' => 2023,
            'condition' => 'good',
            'status' => 'available',
            'lifecycle_stage' => 'deployment',
        ]);

        // 1. Log maintenance
        $response = $this->actingAs($this->user)->post("/devices/{$device->id}/maintenance", [
            'type' => 'repair',
            'title' => 'Keyboard Key Replacement',
            'description' => 'Replace broken Enter keycap and lubricate mechanism.',
            'cost' => 45.00,
            'performed_by' => 'Internal IT Desk',
            'started_at' => now()->toDateString(),
            'status' => 'in_progress',
            'send_to_maintenance_stage' => true,
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('maintenance_logs', [
            'device_id' => $device->id,
            'title' => 'Keyboard Key Replacement',
            'cost' => 45.00,
            'status' => 'in_progress',
        ]);

        $device->refresh();
        $this->assertEquals('maintenance', $device->lifecycle_stage);
        $this->assertEquals('in_repair', $device->status);

        $log = MaintenanceLog::where('device_id', $device->id)->first();

        // 2. Complete maintenance with performance assessment
        $updateResponse = $this->actingAs($this->user)->put("/maintenance/{$log->id}", [
            'cost' => 45.00,
            'completed_at' => now()->toDateString(),
            'performance_assessment' => 'Keycap replaced, keystroke latency normal, all diagnostics passed.',
            'status' => 'completed',
            'restore_to_available' => true,
        ]);

        $updateResponse->assertRedirect();
        $log->refresh();
        $device->refresh();

        $this->assertEquals('completed', $log->status);
        $this->assertEquals('Keycap replaced, keystroke latency normal, all diagnostics passed.', $log->performance_assessment);
        $this->assertEquals('deployment', $device->lifecycle_stage);
        $this->assertEquals('available', $device->status);
    }

    public function test_itam_tracking_service_financials_and_depreciation(): void
    {
        $depreciatingDevice = Device::create([
            'asset_tag' => 'LAP-DEP-01',
            'device_type' => 'laptop',
            'brand' => 'Dell',
            'model' => 'XPS 15',
            'cpu' => 'Intel Core i7',
            'cpu_tier' => 'high',
            'ram_gb' => 32,
            'storage_type' => 'SSD',
            'storage_gb' => 1024,
            'gpu_tier' => 'dedicated-entry',
            'year_acquired' => now()->subYears(2)->year,
            'purchase_cost' => 2000.00,
            'purchase_date' => now()->subYears(2)->toDateString(),
            'depreciation_rate_percent' => 20.0,
            'warranty_expiry' => now()->addDays(20)->toDateString(),
            'condition' => 'good',
            'status' => 'available',
            'lifecycle_stage' => 'deployment',
        ]);

        $activeWarrantyOldDevice = Device::create([
            'asset_tag' => 'DSK-OLD-01',
            'device_type' => 'desktop',
            'brand' => 'HP',
            'model' => 'EliteDesk',
            'cpu' => 'Intel Core i5',
            'cpu_tier' => 'mid',
            'ram_gb' => 16,
            'storage_type' => 'SSD',
            'storage_gb' => 512,
            'gpu_tier' => 'integrated',
            'year_acquired' => now()->subYears(10)->year,
            'purchase_cost' => 1000.00,
            'purchase_date' => now()->subYears(10)->toDateString(),
            'depreciation_rate_percent' => 25.0,
            'warranty_expiry' => now()->addYear()->toDateString(),
            'condition' => 'fair',
            'status' => 'assigned',
            'lifecycle_stage' => 'deployment',
        ]);

        $service = new ItamTrackingService;
        $financials = $service->getFinancialSummary();
        $warranties = $service->getWarrantyAlerts();
        $redundancy = $service->detectRedundantAssets();

        $this->assertEquals(3000.00, $financials['total_acquisition_cost']);
        $this->assertEqualsWithDelta(1200.00, $depreciatingDevice->current_book_value, 15.0);
        $this->assertEquals(100.00, $activeWarrantyOldDevice->current_book_value);
        $this->assertLessThan($financials['total_acquisition_cost'], $financials['current_book_value']);
        $this->assertGreaterThan(0, $financials['total_depreciation']);

        $this->assertEquals('expiring_soon', $depreciatingDevice->warranty_status);
        $this->assertEquals('active', $activeWarrantyOldDevice->warranty_status);
        $this->assertEquals(1, $warranties['expiring_soon_count']);
        $this->assertEquals(0, $warranties['expired_count']);
        $this->assertEquals(1, $redundancy['idle_high_spec_count']);
    }

    public function test_maintenance_index_view_is_accessible(): void
    {
        $response = $this->actingAs($this->user)->get('/maintenance');
        $response->assertOk();
    }

    public function test_inventory_index_provides_category_counts_and_warranty_filter_and_show_redacts_financials_for_technician(): void
    {
        $laptop = Device::create([
            'asset_tag' => 'LAP-WRN-01',
            'device_type' => 'laptop',
            'brand' => 'Lenovo',
            'model' => 'ThinkPad T14',
            'cpu' => 'AMD Ryzen 7',
            'cpu_tier' => 'high',
            'ram_gb' => 32,
            'storage_type' => 'SSD',
            'storage_gb' => 512,
            'gpu_tier' => 'integrated',
            'year_acquired' => now()->year,
            'purchase_cost' => 75000.00,
            'warranty_expiry' => now()->addDays(20)->toDateString(),
            'condition' => 'good',
            'status' => 'available',
            'lifecycle_stage' => 'deployment',
        ]);

        MaintenanceLog::create([
            'device_id' => $laptop->id,
            'type' => 'repair',
            'title' => 'Fan Replacement',
            'description' => 'Replaced noisy cooling fan.',
            'cost' => 4500.00,
            'started_at' => now()->toDateString(),
            'status' => 'completed',
        ]);

        Device::create([
            'asset_tag' => 'MON-WRN-01',
            'device_type' => 'monitor',
            'brand' => 'Dell',
            'model' => 'UltraSharp U2723QE',
            'year_acquired' => now()->year,
            'purchase_cost' => 28000.00,
            'warranty_expiry' => now()->addYear()->toDateString(),
            'condition' => 'excellent',
            'status' => 'available',
            'lifecycle_stage' => 'deployment',
        ]);

        $indexRes = $this->actingAs($this->user)->get(route('devices.index'));
        $indexRes->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Devices/Index')
                ->where('category_counts.all', 2)
                ->where('category_counts.laptop', 1)
                ->where('category_counts.monitor', 1)
            );

        $filteredRes = $this->actingAs($this->user)->get(route('devices.index', ['warranty' => 'expiring_soon']));
        $filteredRes->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('devices.data', 1)
                ->where('devices.data.0.asset_tag', 'LAP-WRN-01')
            );

        $auditor = User::factory()->viewer()->create();
        $technician = User::factory()->technician()->create();

        foreach ([$this->user, $auditor] as $authorizedUser) {
            $this->actingAs($authorizedUser)
                ->get(route('devices.show', $laptop->id))
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->where('can_view_financials', true)
                    ->where('device.purchase_cost', 75000)
                    ->whereNot('device.current_book_value', null)
                    ->where('device.maintenance_logs.0.cost', 4500)
                );
        }

        $this->actingAs($technician)
            ->get(route('devices.show', $laptop->id))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('can_view_financials', false)
                ->where('device.purchase_cost', null)
                ->where('device.current_book_value', null)
                ->where('device.depreciation_rate_percent', null)
                ->where('device.maintenance_logs.0.cost', null)
            );
    }

    public function test_maintenance_index_filters_active_queue_and_sorts_by_device_without_ambiguity(): void
    {
        $deviceA = Device::create([
            'asset_tag' => 'DSK-ALPHA-01',
            'device_type' => 'desktop',
            'brand' => 'Dell',
            'model' => 'Precision 7960',
            'cpu' => 'Intel Xeon w9',
            'cpu_tier' => 'workstation',
            'ram_gb' => 128,
            'storage_type' => 'SSD',
            'storage_gb' => 2048,
            'gpu_tier' => 'dedicated-high',
            'year_acquired' => now()->year,
            'condition' => 'good',
            'status' => 'in_repair',
            'lifecycle_stage' => 'maintenance',
        ]);

        $deviceB = Device::create([
            'asset_tag' => 'LAP-BETA-01',
            'device_type' => 'laptop',
            'brand' => 'Apple',
            'model' => 'MacBook Pro 14',
            'cpu' => 'Apple M3 Pro',
            'cpu_tier' => 'high',
            'ram_gb' => 18,
            'storage_type' => 'SSD',
            'storage_gb' => 512,
            'gpu_tier' => 'dedicated-mid',
            'year_acquired' => now()->year,
            'condition' => 'good',
            'status' => 'available',
            'lifecycle_stage' => 'deployment',
        ]);

        MaintenanceLog::create([
            'device_id' => $deviceB->id,
            'type' => 'inspection',
            'title' => 'Quarterly Battery Health Check',
            'description' => 'Scheduled diagnostic pass.',
            'cost' => 1200.00,
            'started_at' => now()->addDays(2)->toDateString(),
            'status' => 'scheduled',
        ]);

        MaintenanceLog::create([
            'device_id' => $deviceA->id,
            'type' => 'repair',
            'title' => 'Coolant Loop Seal Replacement',
            'description' => 'Active service bay work.',
            'cost' => 6500.00,
            'started_at' => now()->toDateString(),
            'status' => 'in_progress',
        ]);

        MaintenanceLog::create([
            'device_id' => $deviceA->id,
            'type' => 'preventive',
            'title' => 'Completed Fan Cleaning',
            'description' => 'Air filter purged.',
            'cost' => 2500.00,
            'started_at' => now()->subDays(10)->toDateString(),
            'completed_at' => now()->subDays(9)->toDateString(),
            'status' => 'completed',
        ]);

        MaintenanceLog::create([
            'device_id' => $deviceB->id,
            'type' => 'upgrade',
            'title' => 'Cancelled Dock Order',
            'description' => 'No longer needed.',
            'cost' => 900.00,
            'started_at' => now()->subDays(5)->toDateString(),
            'status' => 'cancelled',
        ]);

        $this->actingAs($this->user)
            ->get(route('maintenance.index', [
                'status' => 'active',
                'sort' => 'device',
                'direction' => 'asc',
            ]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Maintenance/Index')
                ->has('logs.data', 2)
                ->where('logs.data.0.device.asset_tag', 'DSK-ALPHA-01')
                ->where('logs.data.0.status', 'in_progress')
                ->where('logs.data.1.device.asset_tag', 'LAP-BETA-01')
                ->where('logs.data.1.status', 'scheduled')
                ->where('stats.active_count', 2)
                ->where('stats.scheduled_count', 1)
                ->where('stats.in_progress_count', 1)
                ->where('stats.completed_count', 1)
                ->where('stats.cancelled_count', 1)
                ->where('stats.total_count', 4)
                ->where('stats.in_service_bay_count', 1)
            );
    }

    public function test_maintenance_hub_redacts_financials_and_preserves_cost_for_technician(): void
    {
        $activeDevice = Device::create([
            'asset_tag' => 'LAP-MNT-10',
            'device_type' => 'laptop',
            'brand' => 'Lenovo',
            'model' => 'ThinkPad T14',
            'cpu' => 'AMD Ryzen 7 PRO',
            'cpu_tier' => 'high',
            'ram_gb' => 32,
            'storage_type' => 'SSD',
            'storage_gb' => 1024,
            'gpu_tier' => 'integrated',
            'year_acquired' => now()->year,
            'purchase_cost' => 82000.00,
            'condition' => 'good',
            'status' => 'in_repair',
            'lifecycle_stage' => 'maintenance',
        ]);

        Device::create([
            'asset_tag' => 'LAP-RET-99',
            'device_type' => 'laptop',
            'brand' => 'HP',
            'model' => 'EliteBook 840',
            'cpu' => 'Intel Core i5',
            'cpu_tier' => 'mid',
            'ram_gb' => 16,
            'storage_type' => 'SSD',
            'storage_gb' => 256,
            'gpu_tier' => 'integrated',
            'year_acquired' => now()->subYears(5)->year,
            'purchase_cost' => 45000.00,
            'condition' => 'retired',
            'status' => 'retired',
            'lifecycle_stage' => 'retirement',
        ]);

        $log = MaintenanceLog::create([
            'device_id' => $activeDevice->id,
            'type' => 'repair',
            'title' => 'Display Hinges & Cable Replacement',
            'description' => 'Replacing loose hinges and eDP display cable.',
            'cost' => 5400.00,
            'performed_by' => 'Internal Hardware Bench',
            'started_at' => now()->toDateString(),
            'status' => 'in_progress',
        ]);

        MaintenanceLog::create([
            'device_id' => $activeDevice->id,
            'type' => 'preventive',
            'title' => 'Thermal Repaste',
            'description' => 'Completed thermal service.',
            'cost' => 1500.00,
            'started_at' => now()->subDays(12)->toDateString(),
            'completed_at' => now()->subDays(11)->toDateString(),
            'status' => 'completed',
        ]);

        $auditor = User::factory()->viewer()->create();
        $technician = User::factory()->technician()->create();

        // Admin sees financials and selectable non-retired devices
        $this->actingAs($this->user)
            ->get(route('maintenance.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('can_view_financials', true)
                ->where('financials_restricted', false)
                ->where('stats.total_spend', 1500)
                ->where('logs.data.0.cost', 5400)
                ->has('devices', 1)
                ->where('devices.0.asset_tag', 'LAP-MNT-10')
            );

        // Auditor sees financials, but gets empty selectable devices (read-only)
        $this->actingAs($auditor)
            ->get(route('maintenance.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('can_view_financials', true)
                ->where('stats.total_spend', 1500)
                ->where('logs.data.0.cost', 5400)
                ->has('devices', 0)
            );

        // Technician gets redacted financials, yet receives selectable non-retired devices
        $this->actingAs($technician)
            ->get(route('maintenance.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('can_view_financials', false)
                ->where('financials_restricted', true)
                ->where('stats.total_spend', null)
                ->where('logs.data.0.cost', null)
                ->missing('logs.data.0.device.purchase_cost')
                ->missing('logs.data.0.device.current_book_value')
                ->has('devices', 1)
                ->where('devices.0.asset_tag', 'LAP-MNT-10')
            );

        // Technician can complete servicing without cost (even if cost=0 is spoofed), preserving original cost
        $this->actingAs($technician)
            ->put(route('maintenance.update', $log->id), [
                'cost' => 0,
                'status' => 'completed',
                'completed_at' => now()->toDateString(),
                'performance_assessment' => 'Display backlight and hinge torque verified across 50 cycles.',
                'restore_to_available' => true,
            ])
            ->assertRedirect();

        $log->refresh();
        $activeDevice->refresh();

        $this->assertEquals(5400.00, $log->cost);
        $this->assertEquals('completed', $log->status);
        $this->assertEquals('deployment', $activeDevice->lifecycle_stage);
        $this->assertEquals('available', $activeDevice->status);

        // Technician can log new maintenance from the Hub without sending cost (defaults to 0.00)
        $this->actingAs($technician)
            ->post(route('devices.maintenance.store', $activeDevice->id), [
                'type' => 'inspection',
                'title' => 'Chassis Integrity Inspection',
                'description' => 'Routine post-hinge repair verification.',
                'performed_by' => 'Tech Bench',
                'started_at' => now()->toDateString(),
                'status' => 'scheduled',
                'send_to_maintenance_stage' => false,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('maintenance_logs', [
            'device_id' => $activeDevice->id,
            'title' => 'Chassis Integrity Inspection',
            'cost' => 0.00,
            'status' => 'scheduled',
        ]);

        // Auditor cannot mutate maintenance logs
        $this->actingAs($auditor)
            ->post(route('devices.maintenance.store', $activeDevice->id), [
                'type' => 'repair',
                'title' => 'Unauthorized Log',
                'description' => 'Should be forbidden.',
                'cost' => 100,
                'started_at' => now()->toDateString(),
                'status' => 'scheduled',
            ])
            ->assertForbidden();

        $this->actingAs($auditor)
            ->put(route('maintenance.update', $log->id), [
                'cost' => 9999,
                'status' => 'cancelled',
            ])
            ->assertForbidden();
    }
}
