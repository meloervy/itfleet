<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\Device;
use App\Models\Employee;
use App\Models\RoleProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleProfileManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_role_profiles_index_computes_live_compliance_and_stockroom_readiness(): void
    {
        $admin = User::factory()->create();

        $mlProfile = RoleProfile::create([
            'name' => 'AI/ML Researcher',
            'min_cpu_tier' => 'workstation',
            'min_ram_gb' => 64,
            'min_storage_gb' => 2048,
            'requires_gpu' => true,
            'min_gpu_tier' => 'dedicated-high',
            'portability_required' => false,
            'description' => 'Local LLM fine-tuning and CUDA workloads.',
        ]);

        $adminProfile = RoleProfile::create([
            'name' => 'Administrative Staff',
            'min_cpu_tier' => 'entry',
            'min_ram_gb' => 8,
            'min_storage_gb' => 256,
            'requires_gpu' => false,
            'min_gpu_tier' => 'none',
            'portability_required' => false,
            'description' => 'Office productivity.',
        ]);

        $mlCompliantEmp = Employee::create([
            'name' => 'Dr. Ada Lovelace',
            'department' => 'Research',
            'role_profile_id' => $mlProfile->id,
        ]);

        $mlMismatchEmp = Employee::create([
            'name' => 'Ken Underprovisioned',
            'department' => 'Research',
            'role_profile_id' => $mlProfile->id,
        ]);

        $unmappedEmp = Employee::create([
            'name' => 'Sam Unmapped',
            'department' => 'Operations',
            'role_profile_id' => null,
        ]);

        $assignedCompliantRig = Device::create([
            'asset_tag' => 'DSK-ML-01',
            'brand' => 'Dell',
            'model' => 'Precision 7960',
            'device_type' => 'desktop',
            'cpu' => 'Intel Xeon w9',
            'cpu_tier' => 'workstation',
            'ram_gb' => 128,
            'storage_type' => 'SSD',
            'storage_gb' => 4096,
            'gpu' => 'NVIDIA RTX 6000 Ada',
            'gpu_tier' => 'dedicated-high',
            'year_acquired' => now()->year,
            'purchase_cost' => 420000.00,
            'condition' => 'excellent',
            'status' => 'assigned',
            'lifecycle_stage' => 'deployment',
        ]);

        $assignedWeakLaptop = Device::create([
            'asset_tag' => 'LAP-WEAK-01',
            'brand' => 'Lenovo',
            'model' => 'IdeaPad 1',
            'device_type' => 'laptop',
            'cpu' => 'Intel Celeron N4020',
            'cpu_tier' => 'entry',
            'ram_gb' => 4,
            'storage_type' => 'SSD',
            'storage_gb' => 128,
            'gpu_tier' => 'integrated',
            'year_acquired' => now()->year,
            'condition' => 'fair',
            'status' => 'assigned',
            'lifecycle_stage' => 'deployment',
        ]);

        Assignment::create([
            'employee_id' => $mlCompliantEmp->id,
            'device_id' => $assignedCompliantRig->id,
            'assigned_at' => now()->subDays(5),
            'assignment_source' => 'ai_recommended',
            'match_score' => 0.99,
        ]);

        Assignment::create([
            'employee_id' => $mlMismatchEmp->id,
            'device_id' => $assignedWeakLaptop->id,
            'assigned_at' => now()->subDays(2),
            'assignment_source' => 'manual_override',
            'match_score' => 0.25,
        ]);

        // Available stockroom devices: 1 high-spec workstation (qualifies for ML & Admin), 1 low-spec laptop (qualifies only for Admin)
        Device::create([
            'asset_tag' => 'DSK-STK-01',
            'brand' => 'HP',
            'model' => 'Z8 G5 Workstation',
            'device_type' => 'desktop',
            'cpu' => 'Intel Xeon w7',
            'cpu_tier' => 'workstation',
            'ram_gb' => 64,
            'storage_type' => 'SSD',
            'storage_gb' => 2048,
            'gpu' => 'NVIDIA RTX 4080',
            'gpu_tier' => 'dedicated-high',
            'year_acquired' => now()->year,
            'purchase_cost' => 260000.00,
            'condition' => 'excellent',
            'status' => 'available',
            'lifecycle_stage' => 'deployment',
            'location' => 'Main Stockroom',
        ]);

        Device::create([
            'asset_tag' => 'LAP-STK-02',
            'brand' => 'HP',
            'model' => '250 G8',
            'device_type' => 'laptop',
            'cpu' => 'Intel Core i3-1115G4',
            'cpu_tier' => 'entry',
            'ram_gb' => 8,
            'storage_type' => 'SSD',
            'storage_gb' => 256,
            'gpu_tier' => 'integrated',
            'year_acquired' => now()->year,
            'condition' => 'good',
            'status' => 'available',
            'lifecycle_stage' => 'deployment',
        ]);

        // Add a Portable Workstation GPU profile with 0 stockroom units to test stock gap detection
        RoleProfile::create([
            'name' => 'Mobile 3D Director',
            'min_cpu_tier' => 'workstation',
            'min_ram_gb' => 64,
            'min_storage_gb' => 2048,
            'requires_gpu' => true,
            'min_gpu_tier' => 'dedicated-high',
            'portability_required' => true,
        ]);

        $response = $this->actingAs($admin)->get(route('role-profiles.index'));

        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('RoleProfiles/Index')
                ->where('summary.total_profiles', 3)
                ->where('summary.gpu_required_count', 2)
                ->where('summary.portable_count', 1)
                ->where('summary.total_employees', 3)
                ->where('summary.covered_employees', 2)
                ->where('summary.uncovered_employees', 1)
                ->where('summary.total_evaluated_assignments', 2)
                ->where('summary.total_compliant_assignments', 1)
                ->where('summary.total_mismatches', 1)
                ->where('summary.compliance_pct', 50)
                ->where('summary.stock_gap_profiles_count', 1)
                // Profiles ordered alphabetically: AI/ML Researcher [0], Administrative Staff [1], Mobile 3D Director [2]
                ->where('profiles.0.name', 'AI/ML Researcher')
                ->where('profiles.0.employees_count', 2)
                ->where('profiles.0.compliant_count', 1)
                ->where('profiles.0.mismatch_count', 1)
                ->where('profiles.0.compliance_rate', 50)
                ->where('profiles.0.eligible_stock_count', 1)
                ->where('profiles.0.eligible_stock_preview.0.asset_tag', 'DSK-STK-01')
                ->missing('profiles.0.eligible_stock_preview.0.purchase_cost')
                ->has('profiles.0.roster', 2)
                ->where('profiles.1.name', 'Administrative Staff')
                ->where('profiles.1.eligible_stock_count', 1)
                ->where('profiles.1.eligible_stock_preview.0.asset_tag', 'LAP-STK-02')
                ->where('profiles.2.name', 'Mobile 3D Director')
                ->where('profiles.2.eligible_stock_count', 0)
            );
    }

    public function test_role_profile_crud_validates_gpu_tier_and_blocks_deleting_assigned_profile(): void
    {
        $admin = User::factory()->create();

        // Requiring GPU with 'none' tier fails validation
        $this->actingAs($admin)
            ->post(route('role-profiles.store'), [
                'name' => 'Creative Video Editor',
                'min_cpu_tier' => 'high',
                'min_ram_gb' => 32,
                'min_storage_gb' => 1024,
                'requires_gpu' => true,
                'min_gpu_tier' => 'none',
                'portability_required' => false,
            ])
            ->assertSessionHasErrors('min_gpu_tier');

        // Creating without GPU normalizes min_gpu_tier to 'none'
        $this->actingAs($admin)
            ->post(route('role-profiles.store'), [
                'name' => 'Finance Analyst',
                'min_cpu_tier' => 'mid',
                'min_ram_gb' => 16,
                'min_storage_gb' => 512,
                'requires_gpu' => false,
                'min_gpu_tier' => 'dedicated-high',
                'portability_required' => true,
                'description' => 'Financial modeling workbooks.',
            ])
            ->assertRedirect(route('role-profiles.index'));

        $profile = RoleProfile::where('name', 'Finance Analyst')->firstOrFail();
        $this->assertEquals('none', $profile->min_gpu_tier);

        // Update profile with valid GPU requirement
        $this->actingAs($admin)
            ->put(route('role-profiles.update', $profile->id), [
                'name' => 'Quantitative Analyst',
                'min_cpu_tier' => 'high',
                'min_ram_gb' => 32,
                'min_storage_gb' => 1024,
                'requires_gpu' => true,
                'min_gpu_tier' => 'dedicated-entry',
                'portability_required' => false,
                'description' => 'GPU accelerated simulations.',
            ])
            ->assertRedirect();

        $profile->refresh();
        $this->assertEquals('Quantitative Analyst', $profile->name);
        $this->assertEquals('dedicated-entry', $profile->min_gpu_tier);

        // Assign an employee and verify deletion is blocked
        $employee = Employee::create([
            'name' => 'Quant Staff',
            'department' => 'Finance',
            'role_profile_id' => $profile->id,
        ]);

        $this->actingAs($admin)
            ->delete(route('role-profiles.destroy', $profile->id))
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertDatabaseHas('role_profiles', ['id' => $profile->id]);

        // Unassign profile from employee, then deletion succeeds
        $employee->update(['role_profile_id' => null]);

        $this->actingAs($admin)
            ->delete(route('role-profiles.destroy', $profile->id))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('role_profiles', ['id' => $profile->id]);
    }

    public function test_non_manager_roles_cannot_mutate_role_profiles(): void
    {
        $profile = RoleProfile::create([
            'name' => 'Support Specialist',
            'min_cpu_tier' => 'entry',
            'min_ram_gb' => 8,
            'min_storage_gb' => 256,
            'requires_gpu' => false,
            'min_gpu_tier' => 'none',
            'portability_required' => true,
        ]);

        $technician = User::factory()->technician()->create();
        $auditor = User::factory()->viewer()->create();

        foreach ([$technician, $auditor] as $restrictedUser) {
            $this->actingAs($restrictedUser)
                ->get(route('role-profiles.index'))
                ->assertOk();

            $this->actingAs($restrictedUser)
                ->post(route('role-profiles.store'), [
                    'name' => 'Unauthorized Profile',
                    'min_cpu_tier' => 'mid',
                    'min_ram_gb' => 16,
                    'min_storage_gb' => 512,
                    'requires_gpu' => false,
                    'portability_required' => false,
                ])
                ->assertForbidden();

            $this->actingAs($restrictedUser)
                ->put(route('role-profiles.update', $profile->id), [
                    'name' => 'Modified Name',
                    'min_cpu_tier' => 'high',
                    'min_ram_gb' => 16,
                    'min_storage_gb' => 512,
                    'requires_gpu' => false,
                    'portability_required' => false,
                ])
                ->assertForbidden();

            $this->actingAs($restrictedUser)
                ->delete(route('role-profiles.destroy', $profile->id))
                ->assertForbidden();
        }
    }
}
