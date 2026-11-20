<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardMetricsTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_renders_metrics_and_detects_mismatches_with_seeded_data(): void
    {
        $this->seed(DatabaseSeeder::class);
        $user = User::where('email', 'admin@itfleet.local')->first();

        $response = $this->actingAs($user)->get('/dashboard');
        $response->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard/Index')
            ->has('metrics')
            ->where('metrics.mismatch_count', 3)
            ->has('mismatches')
            ->has('recent_assignments')
            ->has('available_fleet')
        );
    }

    public function test_mismatches_index_renders_all_flagged_assignments(): void
    {
        $this->seed(DatabaseSeeder::class);
        $user = User::where('email', 'admin@itfleet.local')->first();

        $response = $this->actingAs($user)->get('/mismatches');
        $response->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->component('Mismatches/Index')
            ->has('mismatches', 3)
            ->where('threshold', 0.65)
        );
    }

    public function test_dashboard_redacts_financial_metrics_for_technician_and_exposes_them_for_admin_and_auditor(): void
    {
        $this->seed(DatabaseSeeder::class);

        $admin = User::where('email', 'admin@itfleet.local')->firstOrFail();
        $auditor = User::where('email', 'auditor@itfleet.local')->firstOrFail();
        $technician = User::where('email', 'tech@itfleet.local')->firstOrFail();

        foreach ([$admin, $auditor] as $authorizedUser) {
            $response = $this->actingAs($authorizedUser)->get('/dashboard');
            $response->assertOk();
            $response->assertInertia(fn ($page) => $page
                ->component('Dashboard/Index')
                ->where('metrics.financials_restricted', false)
                ->whereNot('metrics.current_book_value', null)
                ->whereNot('metrics.total_acquisition_cost', null)
                ->whereNot('metrics.software_licenses.annual_software_spend', null)
            );
        }

        $techResponse = $this->actingAs($technician)->get('/dashboard');
        $techResponse->assertOk();
        $techResponse->assertInertia(fn ($page) => $page
            ->component('Dashboard/Index')
            ->where('metrics.financials_restricted', true)
            ->where('metrics.current_book_value', null)
            ->where('metrics.total_acquisition_cost', null)
            ->where('metrics.total_maintenance_spend', null)
            ->where('metrics.software_licenses.annual_software_spend', null)
        );
    }
}
