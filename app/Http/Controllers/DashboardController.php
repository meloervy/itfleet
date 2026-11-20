<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\Assignment;
use App\Models\Device;
use App\Models\Employee;
use App\Services\ItamTrackingService;
use App\Services\MatchingService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request, MatchingService $matchingService, ItamTrackingService $itamService): Response
    {
        $canViewFinancials = $request->user()?->role !== UserRole::Technician;

        $totalDevices = Device::where('status', '!=', 'retired')->count();
        $idleDevices = Device::where('status', 'available')->count();
        $assignedDevices = Device::where('status', 'assigned')->count();
        $inRepairDevices = Device::where('status', 'in_repair')->count();
        $retiredDevices = Device::where('status', 'retired')->count();

        $utilizationRate = $totalDevices > 0 ? round(($assignedDevices / $totalDevices) * 100, 1) : 0;

        $mismatches = $matchingService->detectMismatches();
        $mismatchCount = count($mismatches);

        $properlyAssignedCount = max(0, $assignedDevices - count(array_filter($mismatches, fn (array $m): bool => $m['classification'] === 'under-provisioned')));
        $procurementSavings = $canViewFinancials ? ($properlyAssignedCount * 65000) : null;

        $recentAssignments = Assignment::with(['device', 'employee.roleProfile'])
            ->latest('assigned_at')
            ->take(5)
            ->get();

        $availableFleet = Device::available()
            ->latest()
            ->take(6)
            ->get();

        $itamFinancials = $itamService->getFinancialSummary();
        $itamWarranties = $itamService->getWarrantyAlerts();
        $itamMaintenance = $itamService->getMaintenanceSummary();
        $itamRedundancy = $itamService->detectRedundantAssets();
        $itamFleetRisk = $itamService->getFleetRiskScore();
        $itamCategories = $itamService->getCategoryBreakdown();
        $itamLicenses = $itamService->getSoftwareLicenseSummary();

        if (! $canViewFinancials) {
            $itamFinancials['total_acquisition_cost'] = null;
            $itamFinancials['current_book_value'] = null;
            $itamFinancials['total_depreciation'] = null;
            $itamMaintenance['total_maintenance_spend'] = null;
            $itamLicenses['annual_software_spend'] = null;
        }

        return Inertia::render('Dashboard/Index', [
            'metrics' => [
                'financials_restricted' => ! $canViewFinancials,
                'total_devices' => $totalDevices,
                'idle_devices' => $idleDevices,
                'assigned_devices' => $assignedDevices,
                'in_repair_devices' => $inRepairDevices,
                'retired_devices' => $retiredDevices,
                'utilization_rate' => $utilizationRate,
                'mismatch_count' => $mismatchCount,
                'procurement_savings' => $procurementSavings,
                'total_employees' => Employee::count(),
                'total_acquisition_cost' => $itamFinancials['total_acquisition_cost'],
                'current_book_value' => $itamFinancials['current_book_value'],
                'total_depreciation' => $itamFinancials['total_depreciation'],
                'expiring_warranties_count' => $itamWarranties['expiring_soon_count'],
                'expired_warranties_count' => $itamWarranties['expired_count'],
                'active_maintenance_count' => $itamMaintenance['active_maintenance_count'],
                'total_maintenance_spend' => $itamMaintenance['total_maintenance_spend'],
                'idle_high_spec_count' => $itamRedundancy['idle_high_spec_count'],
                'stage_breakdown' => $itamFinancials['stage_breakdown'],
                'category_breakdown' => $itamCategories,
                'software_licenses' => $itamLicenses,
                'fleet_risk' => $itamFleetRisk,
            ],
            'mismatches' => array_slice($mismatches, 0, 3),
            'recent_assignments' => $recentAssignments,
            'available_fleet' => $availableFleet,
            'itam' => [
                'financials' => $itamFinancials,
                'warranties' => $itamWarranties,
                'maintenance' => $itamMaintenance,
                'redundancy' => $itamRedundancy,
                'fleet_risk' => $itamFleetRisk,
                'categories' => $itamCategories,
                'software_licenses' => $itamLicenses,
            ],
        ]);
    }
}
