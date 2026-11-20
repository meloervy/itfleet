<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\Device;
use App\Models\Employee;
use App\Models\RoleProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class CsvImportExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_and_manager_can_export_employees_csv_with_formula_neutralization(): void
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->manager()->create();

        $profile = RoleProfile::create([
            'name' => 'Software Engineer',
            'min_cpu_tier' => 'high',
            'min_ram_gb' => 16,
            'min_storage_gb' => 512,
        ]);

        $employee = Employee::create([
            'name' => 'Elena Rostova',
            'department' => 'Engineering',
            'role_profile_id' => $profile->id,
            'notes' => '=SUM(A1:A2)',
        ]);

        $device = Device::create([
            'asset_tag' => 'LAP-CSV-01',
            'device_type' => 'laptop',
            'brand' => 'Lenovo',
            'model' => 'ThinkPad T14s',
            'cpu' => 'AMD Ryzen 7',
            'cpu_tier' => 'high',
            'ram_gb' => 32,
            'storage_type' => 'SSD',
            'storage_gb' => 512,
            'gpu_tier' => 'integrated',
            'year_acquired' => 2024,
            'condition' => 'excellent',
            'status' => 'assigned',
        ]);

        Assignment::create([
            'device_id' => $device->id,
            'employee_id' => $employee->id,
            'assigned_at' => now(),
            'assignment_source' => 'manual_override',
        ]);

        foreach ([$admin, $manager] as $actor) {
            $response = $this->actingAs($actor)->get(route('employees.export.csv'));

            $response->assertOk();
            $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));
            $content = $response->streamedContent();
            $this->assertStringContainsString('name,department,role_profile,assigned_asset_tag,assigned_device,notes', $content);
            $this->assertStringContainsString('Elena Rostova', $content);
            $this->assertStringContainsString('LAP-CSV-01', $content);
            $this->assertStringContainsString("'=SUM(A1:A2)", $content);
        }
    }

    public function test_technician_and_viewer_cannot_export_or_import_csv(): void
    {
        $technician = User::factory()->technician()->create();
        $viewer = User::factory()->viewer()->create();
        $csv = UploadedFile::fake()->createWithContent('roster.csv', "name,department\nJane,Ops\n");

        foreach ([$technician, $viewer] as $actor) {
            $this->actingAs($actor)->get(route('employees.export.csv'))->assertForbidden();
            $this->actingAs($actor)->get(route('devices.export.csv'))->assertForbidden();
            $this->actingAs($actor)->post(route('employees.import.csv'), ['file' => $csv])->assertForbidden();
        }
    }

    public function test_admin_can_import_and_update_employees_from_csv_and_receives_inertia_flash(): void
    {
        $admin = User::factory()->admin()->create();

        $profile = RoleProfile::create([
            'name' => 'Data Analyst',
            'min_cpu_tier' => 'mid',
            'min_ram_gb' => 16,
            'min_storage_gb' => 512,
        ]);

        Employee::create([
            'name' => 'Marco Reyes',
            'department' => 'Analytics',
            'notes' => 'Old note',
        ]);

        $csvContent = "\xEF\xBB\xBFname,department,role_profile,notes\n"
            ."Marco Reyes,Analytics,Data Analyst,Updated note\n"
            ."Carla Lim,Engineering,Unknown Role,New hire\n"
            .",Operations,,Missing name skipped\n"
            .",,\n";

        $file = UploadedFile::fake()->createWithContent('employees.csv', $csvContent);

        $response = $this->actingAs($admin)
            ->from('/employees')
            ->post(route('employees.import.csv'), ['file' => $file]);

        $response->assertRedirect('/employees');
        $response->assertSessionHas('success', 'CSV import complete: 1 added, 1 updated, 1 skipped.');

        $this->assertDatabaseHas('employees', [
            'name' => 'Marco Reyes',
            'department' => 'Analytics',
            'role_profile_id' => $profile->id,
            'notes' => 'Updated note',
        ]);

        $this->assertDatabaseHas('employees', [
            'name' => 'Carla Lim',
            'department' => 'Engineering',
            'role_profile_id' => null,
            'notes' => 'New hire',
        ]);

        // Verify HandleInertiaRequests shares flash.success on the redirected Inertia render
        $page = $this->actingAs($admin)->get('/employees');
        $page->assertInertia(fn ($inertia) => $inertia
            ->component('Employees/Index')
            ->where('flash.success', 'CSV import complete: 1 added, 1 updated, 1 skipped.')
        );
    }

    public function test_admin_can_export_devices_csv_with_computed_book_value_and_warranty_status(): void
    {
        $admin = User::factory()->admin()->create();

        Device::create([
            'asset_tag' => 'DSK-CSV-01',
            'serial_number' => 'SN-DSK-CSV-01',
            'device_type' => 'desktop',
            'brand' => 'Dell',
            'model' => 'OptiPlex 7010',
            'cpu' => 'Intel Core i7-13700',
            'cpu_tier' => 'high',
            'ram_gb' => 32,
            'storage_type' => 'SSD',
            'storage_gb' => 1024,
            'gpu' => 'NVIDIA GTX 1650',
            'gpu_tier' => 'dedicated-entry',
            'location' => 'Makati City',
            'year_acquired' => now()->subYears(2)->year,
            'purchase_cost' => 100000.00,
            'purchase_date' => now()->subYears(2)->toDateString(),
            'depreciation_rate_percent' => 20.0,
            'vendor' => 'Dell PH',
            'warranty_expiry' => now()->addYear()->toDateString(),
            'condition' => 'good',
            'status' => 'available',
            'lifecycle_stage' => 'deployment',
        ]);

        $response = $this->actingAs($admin)->get(route('devices.export.csv'));

        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));

        $content = $response->streamedContent();
        $this->assertStringContainsString('asset_tag,serial_number,device_type', $content);
        $this->assertStringContainsString('DSK-CSV-01', $content);
        $this->assertStringContainsString('active', $content);
        $this->assertStringNotContainsString(',100000,100000,', $content);
    }
}
