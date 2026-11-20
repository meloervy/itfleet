<?php

namespace App\Services\Matching;

use App\Models\Assignment;
use App\Models\Device;
use App\Models\Employee;
use App\Models\LifecycleEvent;
use Illuminate\Support\Facades\DB;

class BridgeSwapEngine
{
    public function __construct(private readonly DeviceScoringEngine $scorer) {}

    /**
     * Find dynamic bridge swap opportunities when direct matching cannot fulfill high-end requirements
     * or to optimize overprovisioned active fleet units.
     */
    public function findBridgeSwaps(array $requirements, ?int $requesterEmployeeId = null): array
    {
        $requester = $requesterEmployeeId ? Employee::with('roleProfile')->find($requesterEmployeeId) : null;

        $availableDevices = Device::available()
            ->compute()
            ->where('condition', '!=', 'poor')
            ->where('condition', '!=', 'needs_repair')
            ->get();

        if ($availableDevices->isEmpty()) {
            return [];
        }

        $activeAssignments = Assignment::with(['device', 'employee.roleProfile'])
            ->whereNull('unassigned_at')
            ->when($requesterEmployeeId, fn ($q) => $q->where('employee_id', '!=', $requesterEmployeeId))
            ->get();

        $candidates = [];

        foreach ($activeAssignments as $assignment) {
            $donor = $assignment->employee;
            $donorDevice = $assignment->device;

            if (! $donor || ! $donor->roleProfile || ! $donorDevice || ! $donorDevice->isComputeDevice()) {
                continue;
            }

            $requesterEval = $this->scorer->evaluateDevice($donorDevice, $requirements, false);
            if ($requesterEval['disqualified'] || $requesterEval['score'] < DeviceScoringEngine::MATCH_THRESHOLD) {
                continue;
            }

            $donorProfile = $donor->roleProfile;
            $donorRequirements = [
                'min_cpu_tier' => $donorProfile->min_cpu_tier,
                'min_ram_gb' => $donorProfile->min_ram_gb,
                'min_storage_gb' => $donorProfile->min_storage_gb,
                'requires_gpu' => $donorProfile->requires_gpu,
                'min_gpu_tier' => $donorProfile->min_gpu_tier ?? 'none',
                'portability_required' => $donorProfile->portability_required,
            ];

            $donorCpuDiff = (DeviceScoringEngine::CPU_TIERS[$donorDevice->cpu_tier] ?? 1)
                - (DeviceScoringEngine::CPU_TIERS[$donorProfile->min_cpu_tier] ?? 1);
            $donorRamDiff = $donorDevice->ram_gb - $donorProfile->min_ram_gb;

            $isOverprovisioned = $donorCpuDiff > 0
                || $donorRamDiff >= 8
                || ($donorDevice->gpu_tier !== 'none' && ! $donorProfile->requires_gpu);

            if (! $isOverprovisioned) {
                continue;
            }

            $bestBridgeDevice = null;
            $bestBridgeScore = 0.0;

            foreach ($availableDevices as $bridgeDevice) {
                $bridgeEval = $this->scorer->evaluateDevice($bridgeDevice, $donorRequirements, true);
                if (! $bridgeEval['disqualified']
                    && $bridgeEval['score'] >= DeviceScoringEngine::MATCH_THRESHOLD
                    && $bridgeEval['score'] > $bestBridgeScore
                ) {
                    $bestBridgeScore = $bridgeEval['score'];
                    $bestBridgeDevice = $bridgeDevice;
                }
            }

            if (! $bestBridgeDevice) {
                continue;
            }

            $isSameLocation = $donorDevice->location
                && $bestBridgeDevice->location
                && strtolower($donorDevice->location) === strtolower($bestBridgeDevice->location);
            $locationBonus = $isSameLocation ? 0.08 : 0.0;
            $conditionBonus = $donorDevice->condition === 'excellent' ? 0.05 : ($donorDevice->condition === 'good' ? 0.02 : 0.0);

            $compositeScore = round(
                (($requesterEval['score'] * 0.55) + ($bestBridgeScore * 0.45) + $locationBonus + $conditionBonus),
                3
            );
            $compositeScore = min(0.99, max(0.65, $compositeScore));

            $capexSavedPhp = $this->scorer->estimateDeviceValuePhp($donorDevice);

            $rationale = sprintf(
                'Dynamic Bridge Swap: %s (%s) is currently overprovisioned with a %dGB %s %s. Deploying stockroom unit %s (%dGB %s) to %s fulfills their baseline workflow (Score: %d%%), immediately freeing up %s for %s without purchasing new hardware (CapEx Avoided: ₱%s).',
                $donor->name,
                $donorProfile->name,
                $donorDevice->ram_gb,
                $donorDevice->brand,
                $donorDevice->model,
                $bestBridgeDevice->asset_tag,
                $bestBridgeDevice->ram_gb,
                $bestBridgeDevice->model,
                $donor->name,
                round($bestBridgeScore * 100),
                $donorDevice->asset_tag,
                $requester ? $requester->name : 'the requesting role',
                number_format($capexSavedPhp, 2)
            );

            $candidates[] = [
                'donor_employee' => [
                    'id' => $donor->id,
                    'name' => $donor->name,
                    'department' => $donor->department,
                    'location' => $donor->location,
                    'role_profile' => [
                        'name' => $donorProfile->name,
                        'min_ram_gb' => $donorProfile->min_ram_gb,
                        'min_cpu_tier' => $donorProfile->min_cpu_tier,
                    ],
                ],
                'donor_device' => [
                    'id' => $donorDevice->id,
                    'asset_tag' => $donorDevice->asset_tag,
                    'brand' => $donorDevice->brand,
                    'model' => $donorDevice->model,
                    'device_type' => $donorDevice->device_type,
                    'ram_gb' => $donorDevice->ram_gb,
                    'cpu' => $donorDevice->cpu,
                    'cpu_tier' => $donorDevice->cpu_tier,
                    'gpu' => $donorDevice->gpu,
                    'condition' => $donorDevice->condition,
                    'image_clip_url' => $donorDevice->image_clip_url,
                    'image_url' => $donorDevice->image_url,
                ],
                'bridge_device' => [
                    'id' => $bestBridgeDevice->id,
                    'asset_tag' => $bestBridgeDevice->asset_tag,
                    'brand' => $bestBridgeDevice->brand,
                    'model' => $bestBridgeDevice->model,
                    'device_type' => $bestBridgeDevice->device_type,
                    'ram_gb' => $bestBridgeDevice->ram_gb,
                    'cpu' => $bestBridgeDevice->cpu,
                    'cpu_tier' => $bestBridgeDevice->cpu_tier,
                    'condition' => $bestBridgeDevice->condition,
                    'image_clip_url' => $bestBridgeDevice->image_clip_url,
                    'image_url' => $bestBridgeDevice->image_url,
                ],
                'requester_score_on_donor_device' => round($requesterEval['score'], 3),
                'donor_score_on_bridge_device' => round($bestBridgeScore, 3),
                'feasibility_score' => $compositeScore,
                'capex_saved_php' => $capexSavedPhp,
                'same_location' => $isSameLocation,
                'plan_steps' => [
                    "Step 1: Deploy Stockroom Unit {$bestBridgeDevice->asset_tag} ({$bestBridgeDevice->brand} {$bestBridgeDevice->model}) to {$donor->name}",
                    "Step 2: Retrieve and reassign {$donorDevice->asset_tag} ({$donorDevice->brand} {$donorDevice->model}) to Requester",
                ],
                'rationale' => $rationale,
            ];
        }

        usort($candidates, fn ($a, $b) => $b['feasibility_score'] <=> $a['feasibility_score']);

        return $candidates;
    }

    /**
     * Atomically execute a 2-step bridge swap transaction with full lifecycle audit logs.
     */
    public function executeBridgeSwap(
        int $bridgeDeviceId,
        int $donorEmployeeId,
        int $requesterEmployeeId,
        int $donorDeviceId,
        ?int $userId = null
    ): array {
        return DB::transaction(function () use ($bridgeDeviceId, $donorEmployeeId, $requesterEmployeeId, $donorDeviceId, $userId) {
            $now = now();
            $donor = Employee::findOrFail($donorEmployeeId);
            $requester = Employee::findOrFail($requesterEmployeeId);
            $bridgeDevice = Device::findOrFail($bridgeDeviceId);
            $donorDevice = Device::findOrFail($donorDeviceId);

            Assignment::where('device_id', $donorDeviceId)
                ->where('employee_id', $donorEmployeeId)
                ->whereNull('unassigned_at')
                ->update(['unassigned_at' => $now]);

            Assignment::where('employee_id', $requesterEmployeeId)
                ->whereNull('unassigned_at')
                ->whereHas('device', fn ($q) => $q->compute())
                ->update(['unassigned_at' => $now]);

            $bridgeDevice->update([
                'status' => 'assigned',
                'lifecycle_stage' => 'deployment',
            ]);
            $donorAssignment = Assignment::create([
                'device_id' => $bridgeDeviceId,
                'employee_id' => $donorEmployeeId,
                'assigned_at' => $now,
                'unassigned_at' => null,
                'match_score' => 0.85,
                'assignment_source' => 'ai_recommended',
            ]);

            $donorDevice->update([
                'status' => 'assigned',
                'lifecycle_stage' => 'deployment',
            ]);
            $requesterAssignment = Assignment::create([
                'device_id' => $donorDeviceId,
                'employee_id' => $requesterEmployeeId,
                'assigned_at' => $now,
                'unassigned_at' => null,
                'match_score' => 0.95,
                'assignment_source' => 'ai_recommended',
            ]);

            LifecycleEvent::create([
                'device_id' => $bridgeDeviceId,
                'from_stage' => 'acquisition',
                'to_stage' => 'deployment',
                'changed_by_user_id' => $userId ?? auth()->id(),
                'notes' => "Deployed as Bridge Unit to {$donor->name} in 2-step cascade swap with {$donorDevice->asset_tag}.",
            ]);

            LifecycleEvent::create([
                'device_id' => $donorDeviceId,
                'from_stage' => 'deployment',
                'to_stage' => 'deployment',
                'changed_by_user_id' => $userId ?? auth()->id(),
                'notes' => "Cascade reallocated from {$donor->name} to {$requester->name} via Dynamic Inventory Bridge Swap (CapEx Avoided: ₱".number_format($this->scorer->estimateDeviceValuePhp($donorDevice), 2).').',
            ]);

            return [
                'success' => true,
                'donor_assignment' => $donorAssignment,
                'requester_assignment' => $requesterAssignment,
                'donor' => $donor,
                'requester' => $requester,
                'bridge_device' => $bridgeDevice,
                'donor_device' => $donorDevice,
            ];
        });
    }

    /**
     * Find employees who can immediately receive a newly reclaimed device.
     */
    public function findRecirculationMatches(Device $device, ?int $excludeEmployeeId = null): array
    {
        if (! $device->isComputeDevice()) {
            return [];
        }

        $query = Employee::with(['roleProfile', 'activeAssignment.device'])
            ->whereNotNull('role_profile_id');

        if ($excludeEmployeeId) {
            $query->where('id', '!=', $excludeEmployeeId);
        }

        $matches = [];

        foreach ($query->get() as $candidate) {
            $profile = $candidate->roleProfile;
            if (! $profile) {
                continue;
            }

            $requirements = [
                'min_cpu_tier' => $profile->min_cpu_tier,
                'min_ram_gb' => $profile->min_ram_gb,
                'min_storage_gb' => $profile->min_storage_gb,
                'requires_gpu' => (bool) $profile->requires_gpu,
                'min_gpu_tier' => $profile->min_gpu_tier ?? 'none',
                'portability_required' => (bool) $profile->portability_required,
            ];

            $eval = $this->scorer->evaluateDevice($device, $requirements, false);
            if ($eval['disqualified'] || $eval['score'] < DeviceScoringEngine::MATCH_THRESHOLD) {
                continue;
            }

            $priority = 'standard';
            $priorityReason = 'Eligible for assignment';

            $currentAssignment = $candidate->activeAssignment;
            if (! $currentAssignment) {
                $priority = 'high';
                $priorityReason = 'Awaiting hardware assignment';
            } elseif ($currentAssignment->device) {
                $currentEval = $this->scorer->evaluateDevice($currentAssignment->device, $requirements, false);
                if ($eval['score'] > $currentEval['score'] + 0.15) {
                    $priority = 'urgent_upgrade';
                    $priorityReason = sprintf(
                        'Upgrades under-provisioned specs (+%d%% match gain)',
                        round(($eval['score'] - $currentEval['score']) * 100)
                    );
                }
            }

            $matches[] = [
                'employee_id' => $candidate->id,
                'name' => $candidate->name,
                'department' => $candidate->department,
                'role_name' => $profile->name,
                'match_score' => $eval['score'],
                'fit_grade' => $eval['fit_grade'],
                'priority' => $priority,
                'priority_reason' => $priorityReason,
                'current_device_tag' => $currentAssignment?->device?->asset_tag ?? 'None (Unassigned)',
            ];
        }

        usort($matches, function ($a, $b) {
            $pOrder = ['urgent_upgrade' => 3, 'high' => 2, 'standard' => 1];
            $pA = $pOrder[$a['priority']] ?? 0;
            $pB = $pOrder[$b['priority']] ?? 0;

            if ($pA !== $pB) {
                return $pB <=> $pA;
            }

            return $b['match_score'] <=> $a['match_score'];
        });

        return array_slice($matches, 0, 5);
    }
}
