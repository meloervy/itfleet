<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\Employee;
use App\Models\RoleProfile;
use App\Services\MatchingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RoleProfileController extends Controller
{
    /**
     * Display organizational hardware role baselines with live workforce compliance and stockroom readiness.
     */
    public function index(MatchingService $matchingService): Response
    {
        $profiles = RoleProfile::query()
            ->with([
                'employees' => fn ($query) => $query
                    ->orderBy('name')
                    ->with('activeAssignment.device'),
            ])
            ->withCount('employees')
            ->orderBy('name')
            ->get();

        $availableComputeDevices = Device::available()
            ->compute()
            ->orderByDesc('ram_gb')
            ->orderBy('asset_tag')
            ->get();

        $totalEmployeesCount = Employee::count();
        $unassignedProfileEmployeesCount = Employee::whereNull('role_profile_id')->count();

        $gpuRequiredCount = 0;
        $portableCount = 0;
        $totalEvaluatedAssignments = 0;
        $totalCompliantAssignments = 0;
        $totalMismatches = 0;
        $stockGapProfilesCount = 0;

        $enrichedProfiles = $profiles->map(function (RoleProfile $profile) use (
            $matchingService,
            $availableComputeDevices,
            &$gpuRequiredCount,
            &$portableCount,
            &$totalEvaluatedAssignments,
            &$totalCompliantAssignments,
            &$totalMismatches,
            &$stockGapProfilesCount
        ): array {
            if ($profile->requires_gpu) {
                $gpuRequiredCount++;
            }

            if ($profile->portability_required) {
                $portableCount++;
            }

            $requirements = [
                'min_cpu_tier' => $profile->min_cpu_tier,
                'min_ram_gb' => $profile->min_ram_gb,
                'min_storage_gb' => $profile->min_storage_gb,
                'requires_gpu' => (bool) $profile->requires_gpu,
                'min_gpu_tier' => $profile->requires_gpu ? ($profile->min_gpu_tier ?? 'integrated') : 'none',
                'portability_required' => (bool) $profile->portability_required,
            ];

            $assignedComputeCount = 0;
            $compliantCount = 0;
            $mismatchCount = 0;
            $unassignedDeviceCount = 0;
            $roster = [];

            foreach ($profile->employees as $employee) {
                $device = $employee->activeAssignment?->device;
                $isCompute = $device !== null && $device->isComputeDevice();

                if ($isCompute) {
                    $assignedComputeCount++;
                    $eval = $matchingService->evaluateDevice($device, $requirements, false);
                    $isMismatch = $eval['disqualified'] || $eval['score'] < MatchingService::MATCH_THRESHOLD;

                    if ($isMismatch) {
                        $mismatchCount++;
                        $isUnder = $eval['subscores']['cpu'] == 0.0
                            || $eval['subscores']['ram'] < 0.6
                            || $eval['subscores']['storage'] < 0.6
                            || ($profile->requires_gpu && $eval['subscores']['gpu'] < 0.5)
                            || ($profile->portability_required && $eval['subscores']['portability'] == 0.0);

                        $fitStatus = $isUnder ? 'under-provisioned' : 'over-provisioned';
                    } else {
                        $compliantCount++;
                        $fitStatus = 'compliant';
                    }

                    $fitScorePct = (int) round(((float) $eval['score']) * 100);
                } else {
                    $unassignedDeviceCount++;
                    $fitStatus = 'unassigned';
                    $fitScorePct = null;
                }

                $roster[] = [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'department' => $employee->department,
                    'device_id' => $isCompute ? $device->id : null,
                    'asset_tag' => $isCompute ? $device->asset_tag : null,
                    'device_name' => $isCompute ? trim("{$device->brand} {$device->model}") : null,
                    'fit_status' => $fitStatus,
                    'fit_score_pct' => $fitScorePct,
                ];
            }

            $totalEvaluatedAssignments += $assignedComputeCount;
            $totalCompliantAssignments += $compliantCount;
            $totalMismatches += $mismatchCount;

            $eligibleMatches = [];
            foreach ($availableComputeDevices as $stockDevice) {
                if ($profile->portability_required && $stockDevice->device_type !== 'laptop') {
                    continue;
                }

                if ($profile->requires_gpu) {
                    $deviceGpuRank = MatchingService::GPU_TIERS[$stockDevice->gpu_tier ?? 'none'] ?? 0;
                    $requiredGpuRank = MatchingService::GPU_TIERS[$profile->min_gpu_tier ?? 'integrated'] ?? 1;

                    if ($deviceGpuRank < $requiredGpuRank) {
                        continue;
                    }
                }

                $stockEval = $matchingService->evaluateDevice($stockDevice, $requirements, true);
                if (! $stockEval['disqualified'] && $stockEval['score'] >= MatchingService::MATCH_THRESHOLD) {
                    $eligibleMatches[] = [
                        'score' => (float) $stockEval['score'],
                        'device' => $stockDevice,
                    ];
                }
            }

            usort($eligibleMatches, function (array $a, array $b): int {
                if (abs($b['score'] - $a['score']) >= 0.001) {
                    return $b['score'] <=> $a['score'];
                }

                if ($a['device']->ram_gb !== $b['device']->ram_gb) {
                    return $b['device']->ram_gb <=> $a['device']->ram_gb;
                }

                return strcmp((string) $a['device']->asset_tag, (string) $b['device']->asset_tag);
            });

            $eligibleStockCount = count($eligibleMatches);
            if ($eligibleStockCount === 0) {
                $stockGapProfilesCount++;
            }

            $eligibleStockPreview = array_map(
                fn (array $match): array => [
                    'id' => $match['device']->id,
                    'asset_tag' => $match['device']->asset_tag,
                    'brand' => $match['device']->brand,
                    'model' => $match['device']->model,
                    'device_type' => $match['device']->device_type,
                    'cpu_tier' => $match['device']->cpu_tier,
                    'ram_gb' => $match['device']->ram_gb,
                    'storage_gb' => $match['device']->storage_gb,
                    'gpu_tier' => $match['device']->gpu_tier,
                    'score_pct' => (int) round($match['score'] * 100),
                    'location' => $match['device']->location,
                ],
                array_slice($eligibleMatches, 0, 5)
            );

            return [
                'id' => $profile->id,
                'name' => $profile->name,
                'min_cpu_tier' => $profile->min_cpu_tier,
                'min_ram_gb' => $profile->min_ram_gb,
                'min_storage_gb' => $profile->min_storage_gb,
                'requires_gpu' => (bool) $profile->requires_gpu,
                'min_gpu_tier' => $profile->min_gpu_tier ?? 'none',
                'portability_required' => (bool) $profile->portability_required,
                'description' => $profile->description,
                'employees_count' => (int) $profile->employees_count,
                'assigned_compute_count' => $assignedComputeCount,
                'compliant_count' => $compliantCount,
                'mismatch_count' => $mismatchCount,
                'unassigned_device_count' => $unassignedDeviceCount,
                'compliance_rate' => $assignedComputeCount > 0
                    ? (int) round(($compliantCount / $assignedComputeCount) * 100)
                    : null,
                'roster' => $roster,
                'eligible_stock_count' => $eligibleStockCount,
                'eligible_stock_preview' => $eligibleStockPreview,
            ];
        })->values()->all();

        $coveredEmployeesCount = max(0, $totalEmployeesCount - $unassignedProfileEmployeesCount);

        $summary = [
            'total_profiles' => count($enrichedProfiles),
            'gpu_required_count' => $gpuRequiredCount,
            'portable_count' => $portableCount,
            'total_employees' => $totalEmployeesCount,
            'covered_employees' => $coveredEmployeesCount,
            'uncovered_employees' => $unassignedProfileEmployeesCount,
            'coverage_pct' => $totalEmployeesCount > 0
                ? (int) round(($coveredEmployeesCount / $totalEmployeesCount) * 100)
                : 100,
            'total_evaluated_assignments' => $totalEvaluatedAssignments,
            'total_compliant_assignments' => $totalCompliantAssignments,
            'total_mismatches' => $totalMismatches,
            'compliance_pct' => $totalEvaluatedAssignments > 0
                ? (int) round(($totalCompliantAssignments / $totalEvaluatedAssignments) * 100)
                : 100,
            'stock_gap_profiles_count' => $stockGapProfilesCount,
        ];

        return Inertia::render('RoleProfiles/Index', [
            'profiles' => $enrichedProfiles,
            'summary' => $summary,
            'match_threshold_pct' => (int) round(MatchingService::MATCH_THRESHOLD * 100),
        ]);
    }

    /**
     * Store a new organizational role profile baseline.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateProfile($request);

        RoleProfile::create($validated);

        return redirect()
            ->route('role-profiles.index')
            ->with('success', "Role profile '{$validated['name']}' created successfully.");
    }

    /**
     * Update an existing role profile baseline.
     */
    public function update(Request $request, int $id): RedirectResponse
    {
        $profile = RoleProfile::findOrFail($id);
        $validated = $this->validateProfile($request, $profile->id);

        $profile->update($validated);

        return back()->with('success', "Role profile '{$profile->name}' updated successfully.");
    }

    /**
     * Safely delete an unused role profile baseline.
     */
    public function destroy(int $id): RedirectResponse
    {
        $profile = RoleProfile::withCount('employees')->findOrFail($id);

        if ($profile->employees_count > 0) {
            return back()->with(
                'error',
                "Cannot delete '{$profile->name}' while {$profile->employees_count} employee(s) are assigned to this baseline. Reassign those staff first."
            );
        }

        $name = $profile->name;
        $profile->delete();

        return back()->with('success', "Role profile '{$name}' deleted.");
    }

    /**
     * Validate and normalize role profile input payload.
     *
     * @return array<string, mixed>
     */
    private function validateProfile(Request $request, ?int $ignoreProfileId = null): array
    {
        $nameUniqueRule = Rule::unique('role_profiles', 'name');
        if ($ignoreProfileId !== null) {
            $nameUniqueRule = $nameUniqueRule->ignore($ignoreProfileId);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', $nameUniqueRule],
            'min_cpu_tier' => ['required', 'in:entry,mid,high,workstation'],
            'min_ram_gb' => ['required', 'integer', 'min:4'],
            'min_storage_gb' => ['required', 'integer', 'min:64'],
            'requires_gpu' => ['required', 'boolean'],
            'min_gpu_tier' => [
                Rule::when(
                    $request->boolean('requires_gpu'),
                    ['required', 'in:integrated,dedicated-entry,dedicated-high'],
                    ['nullable', 'in:none,integrated,dedicated-entry,dedicated-high']
                ),
            ],
            'portability_required' => ['required', 'boolean'],
            'description' => ['nullable', 'string'],
        ]);

        if (! $request->boolean('requires_gpu')) {
            $validated['min_gpu_tier'] = 'none';
        }

        return $validated;
    }
}
