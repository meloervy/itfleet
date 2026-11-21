<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\SoftwareLicense;
use App\Models\SoftwareLicenseAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SoftwareLicenseManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_authenticated_roles_can_view_licenses_but_only_admin_and_manager_can_mutate(): void
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->manager()->create();
        $technician = User::factory()->technician()->create();
        $viewer = User::factory()->viewer()->create();

        $license = SoftwareLicense::create([
            'name' => 'JetBrains All Products',
            'vendor' => 'JetBrains',
            'category' => 'development',
            'license_type' => 'saas',
            'billing_cycle' => 'annual',
            'total_seats' => 5,
            'cost_per_seat' => 14500.00,
            'renewal_date' => now()->addMonths(6)->toDateString(),
            'status' => 'active',
        ]);

        $employee = Employee::create([
            'name' => 'Dev Lead',
            'department' => 'Engineering',
        ]);

        foreach ([$admin, $manager, $technician, $viewer] as $actor) {
            $this->actingAs($actor)
                ->get(route('licenses.index'))
                ->assertOk()
                ->assertInertia(fn ($page) => $page->component('Licenses/Index'));
        }

        $payload = [
            'name' => 'Figma Organization',
            'vendor' => 'Figma',
            'category' => 'design',
            'license_type' => 'saas',
            'billing_cycle' => 'annual',
            'total_seats' => 10,
            'cost_per_seat' => 28000.00,
            'status' => 'active',
        ];

        foreach ([$technician, $viewer] as $restricted) {
            $this->actingAs($restricted)->post(route('licenses.store'), $payload)->assertForbidden();
            $this->actingAs($restricted)->put(route('licenses.update', $license->id), $payload)->assertForbidden();
            $this->actingAs($restricted)->delete(route('licenses.destroy', $license->id))->assertForbidden();
            $this->actingAs($restricted)->post(route('licenses.assign', $license->id), ['employee_id' => $employee->id])->assertForbidden();
            $this->actingAs($restricted)->get(route('licenses.export.csv'))->assertForbidden();
        }

        $this->actingAs($manager)->post(route('licenses.store'), $payload)->assertRedirect();
        $this->assertDatabaseHas('software_licenses', ['name' => 'Figma Organization']);
    }

    public function test_seat_allocation_enforces_capacity_duplicates_and_revocation(): void
    {
        $admin = User::factory()->admin()->create();

        $license = SoftwareLicense::create([
            'name' => 'Adobe Creative Cloud',
            'vendor' => 'Adobe',
            'category' => 'design',
            'license_type' => 'saas',
            'billing_cycle' => 'monthly',
            'total_seats' => 1,
            'cost_per_seat' => 3200.00,
            'renewal_date' => now()->addDays(20)->toDateString(),
            'status' => 'active',
        ]);

        $emp1 = Employee::create(['name' => 'Designer One', 'department' => 'Creative']);
        $emp2 = Employee::create(['name' => 'Designer Two', 'department' => 'Creative']);

        // Assign seat 1 -> succeeds
        $this->actingAs($admin)
            ->post(route('licenses.assign', $license->id), ['employee_id' => $emp1->id])
            ->assertRedirect()
            ->assertSessionHas('success');

        // Duplicate seat to same employee or second employee when full -> blocked
        $this->actingAs($admin)
            ->post(route('licenses.assign', $license->id), ['employee_id' => $emp1->id])
            ->assertSessionHas('error');

        $this->actingAs($admin)
            ->post(route('licenses.assign', $license->id), ['employee_id' => $emp2->id])
            ->assertSessionHas('error');

        // Deleting license with active seat -> blocked
        $this->actingAs($admin)
            ->delete(route('licenses.destroy', $license->id))
            ->assertSessionHas('error');

        // Reducing seats below active count -> validation error
        $this->actingAs($admin)
            ->put(route('licenses.update', $license->id), [
                'name' => 'Adobe Creative Cloud',
                'vendor' => 'Adobe',
                'category' => 'design',
                'license_type' => 'saas',
                'billing_cycle' => 'monthly',
                'total_seats' => 0,
                'cost_per_seat' => 3200.00,
                'status' => 'active',
            ])
            ->assertSessionHasErrors('total_seats');

        // Revoke seat -> frees capacity for emp2
        $assignment = SoftwareLicenseAssignment::where('software_license_id', $license->id)->firstOrFail();
        $this->actingAs($admin)
            ->post(route('licenses.revoke', $assignment->id))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertNotNull($assignment->fresh()->revoked_at);

        $this->actingAs($admin)
            ->post(route('licenses.assign', $license->id), ['employee_id' => $emp2->id])
            ->assertRedirect()
            ->assertSessionHas('success');
    }

    public function test_renewal_status_annualized_cost_and_csv_export(): void
    {
        $admin = User::factory()->admin()->create();

        $activeMonthly = SoftwareLicense::create([
            'name' => '=FormulaLicense',
            'vendor' => 'Microsoft',
            'category' => 'productivity',
            'license_type' => 'saas',
            'billing_cycle' => 'monthly',
            'total_seats' => 10,
            'cost_per_seat' => 500.00,
            'renewal_date' => now()->addDays(180)->toDateString(),
            'status' => 'active',
        ]);

        $expiringSoon = SoftwareLicense::create([
            'name' => 'CrowdStrike Falcon',
            'vendor' => 'CrowdStrike',
            'category' => 'security',
            'license_type' => 'saas',
            'billing_cycle' => 'annual',
            'total_seats' => 25,
            'cost_per_seat' => 2400.00,
            'renewal_date' => now()->addDays(15)->toDateString(),
            'status' => 'active',
        ]);

        $expired = SoftwareLicense::create([
            'name' => 'Legacy CAD',
            'vendor' => 'Autodesk',
            'category' => 'design',
            'license_type' => 'volume',
            'billing_cycle' => 'annual',
            'total_seats' => 2,
            'cost_per_seat' => 50000.00,
            'renewal_date' => now()->subDays(10)->toDateString(),
            'status' => 'active',
        ]);

        $perpetual = SoftwareLicense::create([
            'name' => 'Windows Server LTSC',
            'vendor' => 'Microsoft',
            'category' => 'infrastructure',
            'license_type' => 'perpetual',
            'billing_cycle' => 'one_time',
            'total_seats' => 4,
            'cost_per_seat' => 30000.00,
            'renewal_date' => null,
            'status' => 'active',
        ]);

        $this->assertEquals('active', $activeMonthly->renewal_status);
        $this->assertEquals(60000.00, $activeMonthly->annualized_cost);
        $this->assertEquals('expiring_soon', $expiringSoon->renewal_status);
        $this->assertEquals('expired', $expired->renewal_status);
        $this->assertEquals('perpetual', $perpetual->renewal_status);

        $csvRes = $this->actingAs($admin)->get(route('licenses.export.csv'));
        $csvRes->assertOk();
        $content = $csvRes->streamedContent();
        $this->assertStringContainsString("'=FormulaLicense", $content);
        $this->assertStringContainsString('CrowdStrike Falcon', $content);
    }

    public function test_licenses_index_supports_renewal_filter_sorting_and_technician_financial_redaction(): void
    {
        $admin = User::factory()->admin()->create();
        $auditor = User::factory()->viewer()->create();
        $technician = User::factory()->technician()->create();

        SoftwareLicense::create([
            'name' => 'Microsoft 365 Business',
            'vendor' => 'Microsoft',
            'category' => 'productivity',
            'license_type' => 'saas',
            'billing_cycle' => 'annual',
            'total_seats' => 10,
            'cost_per_seat' => 12000.00,
            'renewal_date' => now()->addDays(200)->toDateString(),
            'status' => 'active',
        ]);

        SoftwareLicense::create([
            'name' => 'Figma Organization',
            'vendor' => 'Figma',
            'category' => 'design',
            'license_type' => 'saas',
            'billing_cycle' => 'annual',
            'total_seats' => 5,
            'cost_per_seat' => 25000.00,
            'renewal_date' => now()->addDays(15)->toDateString(),
            'status' => 'active',
        ]);

        SoftwareLicense::create([
            'name' => 'Adobe XD Legacy',
            'vendor' => 'Adobe',
            'category' => 'design',
            'license_type' => 'saas',
            'billing_cycle' => 'annual',
            'total_seats' => 3,
            'cost_per_seat' => 8000.00,
            'renewal_date' => now()->subDays(5)->toDateString(),
            'status' => 'active',
        ]);

        $filteredRes = $this->actingAs($admin)->get(route('licenses.index', [
            'renewal_filter' => 'needs_attention',
            'sort' => 'renewal_date',
            'direction' => 'asc',
        ]));

        $filteredRes->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('licenses.data', 2)
                ->where('licenses.data.0.name', 'Adobe XD Legacy')
                ->where('licenses.data.1.name', 'Figma Organization')
            );

        // Verify utilization sort executes cleanly across DB engines
        $this->actingAs($admin)
            ->get(route('licenses.index', ['sort' => 'utilization', 'direction' => 'desc']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('licenses.data', 3));

        foreach ([$admin, $auditor] as $authorizedUser) {
            $this->actingAs($authorizedUser)
                ->get(route('licenses.index'))
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->where('financials_restricted', false)
                    ->whereNot('summary.annual_software_spend', null)
                    ->whereNot('licenses.data.0.cost_per_seat', null)
                    ->whereNot('licenses.data.0.annualized_cost', null)
                );
        }

        $this->actingAs($technician)
            ->get(route('licenses.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('financials_restricted', true)
                ->where('summary.annual_software_spend', null)
                ->where('licenses.data.0.cost_per_seat', null)
                ->where('licenses.data.0.annualized_cost', null)
            );
    }

    public function test_software_licenses_pdf_export_respects_rbac(): void
    {
        $admin = User::factory()->admin()->create();
        $manager = User::factory()->manager()->create();
        $technician = User::factory()->technician()->create();
        $viewer = User::factory()->viewer()->create();

        SoftwareLicense::create([
            'name' => 'Figma Organization',
            'vendor' => 'Figma Inc.',
            'category' => 'design',
            'license_type' => 'saas',
            'billing_cycle' => 'annual',
            'total_seats' => 10,
            'cost_per_seat' => 29500.00,
            'renewal_date' => now()->addMonths(4)->toDateString(),
            'status' => 'active',
        ]);

        $this->get(route('licenses.export.pdf'))->assertRedirect('/login');
        $this->actingAs($technician)->get(route('licenses.export.pdf'))->assertForbidden();
        $this->actingAs($viewer)->get(route('licenses.export.pdf'))->assertForbidden();

        foreach ([$admin, $manager] as $authorized) {
            $res = $this->actingAs($authorized)->get(route('licenses.export.pdf'));
            $res->assertOk();
            $res->assertHeader('content-type', 'application/pdf');
            $this->assertStringContainsString(
                'itfleet-software-licenses-',
                (string) $res->headers->get('content-disposition')
            );
        }
    }
}
