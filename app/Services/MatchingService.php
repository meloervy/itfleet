<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\Device;
use App\Models\Employee;
use App\Models\LifecycleEvent;
use App\Services\Matching\BridgeSwapEngine;
use App\Services\Matching\DeviceScoringEngine;
use Illuminate\Support\Facades\DB;

class MatchingService
{
    public const MATCH_THRESHOLD = DeviceScoringEngine::MATCH_THRESHOLD;

    public const CPU_TIERS = DeviceScoringEngine::CPU_TIERS;

    public const GPU_TIERS = DeviceScoringEngine::GPU_TIERS;

    public const WEIGHT_PROFILES = DeviceScoringEngine::WEIGHT_PROFILES;

    private readonly DeviceScoringEngine $scorer;

    private readonly BridgeSwapEngine $bridgeSwapEngine;

    public function __construct(?DeviceScoringEngine $scorer = null, ?BridgeSwapEngine $bridgeSwapEngine = null)
    {
        $this->scorer = $scorer ?? new DeviceScoringEngine;
        $this->bridgeSwapEngine = $bridgeSwapEngine ?? new BridgeSwapEngine($this->scorer);
    }

    public function computeFinalScore(array $subScores, ?array $weights = null): float
    {
        return $this->scorer->computeFinalScore($subScores, $weights);
    }

    public function estimateDeviceValuePhp(Device $device): float
    {
        return $this->scorer->estimateDeviceValuePhp($device);
    }

    public function rankDevices(array $requirements, ?int $excludeDeviceId = null, bool $availableOnly = true): array
    {
        return $this->scorer->rankDevices($requirements, $excludeDeviceId, $availableOnly);
    }

    public function evaluateDevice(Device $device, array $requirements, bool $availableOnly = false): array
    {
        return $this->scorer->evaluateDevice($device, $requirements, $availableOnly);
    }

    public function resolveWeights(array $requirements): array
    {
        return $this->scorer->resolveWeights($requirements);
    }

    /**
     * Scan active assignments for mismatches against employee role profiles.
     */
    public function detectMismatches(): array
    {
        $assignments = Assignment::with(['device', 'employee.roleProfile'])
            ->whereNull('unassigned_at')
            ->get();

        $mismatches = [];

        foreach ($assignments as $assignment) {
            $employee = $assignment->employee;
            $device = $assignment->device;

            if (! $employee || ! $employee->roleProfile || ! $device || ! $device->isComputeDevice()) {
                continue;
            }

            $profile = $employee->roleProfile;
            $requirements = [
                'min_cpu_tier' => $profile->min_cpu_tier,
                'min_ram_gb' => $profile->min_ram_gb,
                'min_storage_gb' => $profile->min_storage_gb,
                'requires_gpu' => $profile->requires_gpu,
                'min_gpu_tier' => $profile->min_gpu_tier ?? 'none',
                'portability_required' => $profile->portability_required,
            ];

            $eval = $this->scorer->evaluateDevice($device, $requirements, false);

            if ($eval['disqualified'] || $eval['score'] < self::MATCH_THRESHOLD) {
                $isUnder = $eval['subscores']['cpu'] == 0.0
                    || $eval['subscores']['ram'] < 0.6
                    || $eval['subscores']['storage'] < 0.6
                    || ($profile->requires_gpu && $eval['subscores']['gpu'] < 0.5)
                    || ($profile->portability_required && $eval['subscores']['portability'] == 0.0);

                $mismatches[] = [
                    'assignment' => $assignment,
                    'device' => $device,
                    'employee' => $employee,
                    'role_profile' => $profile,
                    'score' => $eval['score'],
                    'subscores' => $eval['subscores'],
                    'classification' => $isUnder ? 'under-provisioned' : 'over-provisioned',
                    'rationale' => $eval['rationale'],
                    'disqualified' => $eval['disqualified'],
                    'disqualification_reason' => $eval['disqualification_reason'],
                ];
            }
        }

        return $mismatches;
    }

    /**
     * Atomically assign a device to an employee.
     * Enforces single active compute workstation per employee while permitting concurrent peripheral/monitor/mobile custody.
     */
    public function assignDevice(int $deviceId, int $employeeId, string $source = 'manual_override', ?float $score = null): Assignment
    {
        return DB::transaction(function () use ($deviceId, $employeeId, $source, $score) {
            $now = now();
            $device = Device::findOrFail($deviceId);

            Assignment::where('device_id', $deviceId)
                ->whereNull('unassigned_at')
                ->update(['unassigned_at' => $now]);

            if ($device->isComputeDevice()) {
                $previousComputeAssignments = Assignment::with('device')
                    ->where('employee_id', $employeeId)
                    ->where('device_id', '!=', $deviceId)
                    ->whereNull('unassigned_at')
                    ->whereHas('device', fn ($q) => $q->compute())
                    ->get();

                foreach ($previousComputeAssignments as $prevAssignment) {
                    $prevAssignment->update(['unassigned_at' => $now]);
                    if ($prevAssignment->device && $prevAssignment->device->status === 'assigned') {
                        $prevAssignment->device->update(['status' => 'available']);
                    }
                }
            }

            $device->update(['status' => 'assigned']);

            return Assignment::create([
                'device_id' => $deviceId,
                'employee_id' => $employeeId,
                'assigned_at' => $now,
                'unassigned_at' => null,
                'match_score' => $score,
                'assignment_source' => $source,
            ]);
        });
    }

    /**
     * Unassign a device from an active assignment.
     */
    public function unassignDevice(int $assignmentId): void
    {
        DB::transaction(function () use ($assignmentId) {
            $assignment = Assignment::findOrFail($assignmentId);
            $assignment->update(['unassigned_at' => now()]);

            $device = $assignment->device;
            if ($device && $device->status === 'assigned') {
                $device->update(['status' => 'available']);
            }
        });
    }

    public function findBridgeSwaps(array $requirements, ?int $requesterEmployeeId = null): array
    {
        return $this->bridgeSwapEngine->findBridgeSwaps($requirements, $requesterEmployeeId);
    }

    public function executeBridgeSwap(
        int $bridgeDeviceId,
        int $donorEmployeeId,
        int $requesterEmployeeId,
        int $donorDeviceId,
        ?int $userId = null
    ): array {
        return $this->bridgeSwapEngine->executeBridgeSwap(
            $bridgeDeviceId,
            $donorEmployeeId,
            $requesterEmployeeId,
            $donorDeviceId,
            $userId
        );
    }

    /**
     * Atomically reclaim an assigned device back into the inventory pool during employee offboarding or role change.
     */
    public function reclaimDevice(int $employeeId, array $details, ?int $userId = null): array
    {
        return DB::transaction(function () use ($employeeId, $details, $userId) {
            $now = now();
            $employee = Employee::with(['activeAssignment.device', 'roleProfile'])->findOrFail($employeeId);

            $assignment = ! empty($details['device_id'])
                ? Assignment::with('device')
                    ->where('employee_id', $employeeId)
                    ->where('device_id', (int) $details['device_id'])
                    ->whereNull('unassigned_at')
                    ->first()
                : $employee->activeAssignment;

            if (! $assignment || ! $assignment->device) {
                throw new \InvalidArgumentException("Employee {$employee->name} does not have an active device assignment to reclaim.");
            }

            $device = $assignment->device;
            $fromStage = $device->lifecycle_stage;

            $assignment->update(['unassigned_at' => $now]);

            $newCondition = $details['condition'] ?? $device->condition;
            $targetStage = ($newCondition === 'needs_repair') ? 'maintenance' : 'reclaimed';
            $targetStatus = ($newCondition === 'needs_repair') ? 'in_repair' : 'available';

            $device->update([
                'condition' => $newCondition,
                'status' => $targetStatus,
                'lifecycle_stage' => $targetStage,
            ]);

            $wipeStatus = (! empty($details['wipe_confirmed'])) ? 'Data Wipe Verified & Sanitized' : 'Wipe Pending';
            $reasonLabel = ucfirst(str_replace('_', ' ', $details['reason'] ?? 'Offboarding'));
            $eventNotes = sprintf(
                'Asset reclaimed from %s via %s. Condition: %s. %s. %s',
                $employee->name,
                $reasonLabel,
                ucfirst($newCondition),
                $wipeStatus,
                $details['notes'] ?? ''
            );

            LifecycleEvent::create([
                'device_id' => $device->id,
                'from_stage' => $fromStage,
                'to_stage' => $targetStage,
                'changed_by_user_id' => $userId ?? auth()->id(),
                'notes' => trim($eventNotes),
            ]);

            $recirculationMatches = $this->bridgeSwapEngine->findRecirculationMatches($device, $employeeId);

            return [
                'success' => true,
                'message' => "Device {$device->asset_tag} ({$device->brand} {$device->model}) reclaimed from {$employee->name} and returned to pool.",
                'device' => $device->fresh(),
                'employee' => $employee,
                'circulation_matches' => $recirculationMatches,
            ];
        });
    }

    public function findRecirculationMatches(Device $device, ?int $excludeEmployeeId = null): array
    {
        return $this->bridgeSwapEngine->findRecirculationMatches($device, $excludeEmployeeId);
    }

    /**
     * Simulate hypothetical headcount and role requirements against current stockroom inventory.
     */
    public function simulateHeadcount(array $requirements, int $quantity): array
    {
        $quantity = max(1, $quantity);
        $qualifiedDevices = [];

        foreach (Device::available()->compute()->get() as $device) {
            $eval = $this->scorer->evaluateDevice($device, $requirements, true);
            if (! $eval['disqualified'] && $eval['score'] >= self::MATCH_THRESHOLD) {
                $qualifiedDevices[] = [
                    'device' => $device,
                    'evaluation' => $eval,
                ];
            }
        }

        usort($qualifiedDevices, fn ($a, $b) => $b['evaluation']['score'] <=> $a['evaluation']['score']);

        $coveredUnits = array_slice($qualifiedDevices, 0, $quantity);
        $coveredCount = count($coveredUnits);
        $deficitCount = max(0, $quantity - $coveredCount);

        $capexAvoidedPhp = array_sum(array_map(
            fn ($u) => $u['evaluation']['capex_saved_php'],
            $coveredUnits
        ));

        $reqCpu = $requirements['min_cpu_tier'] ?? 'entry';
        $isLaptop = ! empty($requirements['portability_required']);
        $unitProcurementBenchmark = $this->scorer->estimateBenchmarkValue($reqCpu, $isLaptop);

        $capexRequiredPhp = $deficitCount * $unitProcurementBenchmark;
        $coveragePercentage = round(($coveredCount / $quantity) * 100, 1);

        $deployableList = array_map(function ($u) {
            $dev = $u['device'];
            $eval = $u['evaluation'];

            return [
                'id' => $dev->id,
                'asset_tag' => $dev->asset_tag,
                'brand' => $dev->brand,
                'model' => $dev->model,
                'device_type' => $dev->device_type,
                'cpu' => $dev->cpu,
                'cpu_tier' => $dev->cpu_tier,
                'ram_gb' => $dev->ram_gb,
                'storage_gb' => $dev->storage_gb,
                'storage_type' => $dev->storage_type,
                'gpu' => $dev->gpu,
                'location' => $dev->location,
                'condition' => $dev->condition,
                'image_clip_url' => $dev->image_clip_url,
                'match_score' => $eval['score'],
                'fit_grade' => $eval['fit_grade'],
                'confidence_level' => $eval['confidence_level'],
                'capex_saved_php' => $eval['capex_saved_php'],
            ];
        }, $coveredUnits);

        $summary = sprintf(
            'Stockroom inventory covers %d of %d required seats (%g%% coverage), avoiding ₱%s in new procurement. %s',
            $coveredCount,
            $quantity,
            $coveragePercentage,
            number_format($capexAvoidedPhp, 2),
            $deficitCount > 0
                ? 'CapEx of ~₱'.number_format($capexRequiredPhp, 2)." required to purchase {$deficitCount} units."
                : 'Zero CapEx procurement required—all seats satisfied from existing idle stock.'
        );

        return [
            'quantity_requested' => $quantity,
            'covered_count' => $coveredCount,
            'deficit_count' => $deficitCount,
            'coverage_percentage' => $coveragePercentage,
            'capex_avoided_php' => $capexAvoidedPhp,
            'capex_required_php' => $capexRequiredPhp,
            'unit_procurement_benchmark_php' => $unitProcurementBenchmark,
            'procurement_needed' => $deficitCount > 0,
            'requisition_spec' => [
                'cpu_tier' => ucfirst($reqCpu),
                'ram_gb' => $requirements['min_ram_gb'] ?? 8,
                'storage_gb' => $requirements['min_storage_gb'] ?? 256,
                'gpu_required' => ! empty($requirements['requires_gpu']),
                'gpu_tier' => $requirements['min_gpu_tier'] ?? 'none',
                'device_type' => $isLaptop ? 'Laptop' : 'Desktop',
            ],
            'deployable_units' => $deployableList,
            'summary' => $summary,
        ];
    }
}
