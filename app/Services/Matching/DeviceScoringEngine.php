<?php

namespace App\Services\Matching;

use App\Models\Device;

class DeviceScoringEngine
{
    public const MATCH_THRESHOLD = 0.65;

    public const CPU_TIERS = [
        'entry' => 1,
        'mid' => 2,
        'high' => 3,
        'workstation' => 4,
    ];

    public const GPU_TIERS = [
        'none' => 0,
        'integrated' => 1,
        'dedicated-entry' => 2,
        'dedicated-high' => 3,
    ];

    public const WEIGHT_PROFILES = [
        'balanced' => [
            'cpu' => 0.30,
            'ram' => 0.25,
            'storage' => 0.15,
            'gpu' => 0.20,
            'portability' => 0.10,
        ],
        'creative' => [
            'gpu' => 0.35,
            'cpu' => 0.25,
            'ram' => 0.20,
            'storage' => 0.10,
            'portability' => 0.10,
        ],
        'developer' => [
            'cpu' => 0.35,
            'ram' => 0.30,
            'storage' => 0.15,
            'gpu' => 0.10,
            'portability' => 0.10,
        ],
        'mobile_sales' => [
            'portability' => 0.30,
            'cpu' => 0.25,
            'ram' => 0.25,
            'storage' => 0.10,
            'gpu' => 0.10,
        ],
        'data_analyst' => [
            'cpu' => 0.30,
            'ram' => 0.35,
            'storage' => 0.15,
            'gpu' => 0.10,
            'portability' => 0.10,
        ],
    ];

    /**
     * Check whether a requirements payload contains at least one constraint field.
     */
    public function hasRequirements(array $requirements): bool
    {
        return ! empty($requirements) && (
            isset($requirements['min_cpu_tier']) ||
            isset($requirements['min_ram_gb']) ||
            isset($requirements['min_storage_gb']) ||
            isset($requirements['requires_gpu']) ||
            isset($requirements['portability_required'])
        );
    }

    /**
     * Compute deterministic final weighted match score from sub-scores and weights.
     *
     * Supports both full benchmark keys and shorthand keys.
     */
    public function computeFinalScore(array $subScores, ?array $weights = null): float
    {
        $weights = $weights ?? self::WEIGHT_PROFILES['balanced'];

        $cpu = (float) ($subScores['cpu_tier_match_score'] ?? $subScores['cpu'] ?? 0.0);
        $ram = (float) ($subScores['ram_sufficiency_score'] ?? $subScores['ram'] ?? 0.0);
        $storage = (float) ($subScores['storage_sufficiency_score'] ?? $subScores['storage'] ?? $subScores['disk'] ?? 0.0);
        $gpu = (float) ($subScores['gpu_match_score'] ?? $subScores['gpu'] ?? 0.0);
        $portability = (float) ($subScores['portability_match_score'] ?? $subScores['portability'] ?? $subScores['port'] ?? 0.0);

        $wCpu = (float) ($weights['cpu'] ?? self::WEIGHT_PROFILES['balanced']['cpu']);
        $wRam = (float) ($weights['ram'] ?? self::WEIGHT_PROFILES['balanced']['ram']);
        $wStorage = (float) ($weights['storage'] ?? self::WEIGHT_PROFILES['balanced']['storage']);
        $wGpu = (float) ($weights['gpu'] ?? self::WEIGHT_PROFILES['balanced']['gpu']);
        $wPort = (float) ($weights['portability'] ?? self::WEIGHT_PROFILES['balanced']['portability']);

        $score = ($cpu * $wCpu)
               + ($ram * $wRam)
               + ($storage * $wStorage)
               + ($gpu * $wGpu)
               + ($portability * $wPort);

        return round(max(0.0, min(1.0, $score)), 3);
    }

    /**
     * Estimate commercial replacement benchmark price by CPU tier and mobility form factor.
     */
    public function estimateBenchmarkValue(string $cpuTier, bool $isLaptop): float
    {
        return match ($cpuTier) {
            'workstation' => 185000.00,
            'high' => $isLaptop ? 120000.00 : 95000.00,
            'mid' => $isLaptop ? 65000.00 : 45000.00,
            default => $isLaptop ? 32000.00 : 25000.00,
        };
    }

    /**
     * Estimate new replacement procurement value of a device in Philippine Peso (₱).
     */
    public function estimateDeviceValuePhp(Device $device): float
    {
        if ($device->purchase_cost && $device->purchase_cost > 0) {
            return (float) $device->purchase_cost;
        }

        return $this->estimateBenchmarkValue((string) $device->cpu_tier, $device->device_type === 'laptop');
    }

    /**
     * Score every eligible device against requirements and return ranked list.
     *
     * @return array{results: array, procurement_recommended: bool, total_capex_savings_php: float, threshold: float}
     */
    public function rankDevices(array $requirements, ?int $excludeDeviceId = null, bool $availableOnly = true): array
    {
        if (! $this->hasRequirements($requirements)) {
            return [
                'results' => [],
                'top_candidate' => null,
                'alternative_comparisons' => [],
                'procurement_recommended' => false,
                'total_capex_savings_php' => 0.0,
                'threshold' => self::MATCH_THRESHOLD,
                'procurement_advisory' => [
                    'action' => 'awaiting_specifications',
                    'inventory_status' => 'Pending Specification',
                    'existing_inventory_prioritized' => true,
                    'recommendation_summary' => 'No hardware specification requirements were provided. Please specify employee role requirements before matching.',
                ],
            ];
        }

        $query = Device::query()->compute();
        if ($excludeDeviceId) {
            $query->where('id', '!=', $excludeDeviceId);
        }

        $ranked = [];
        $hasEligibleAboveThreshold = false;
        $totalCapexSavings = 0.0;

        foreach ($query->get() as $device) {
            $evaluation = $this->evaluateDevice($device, $requirements, $availableOnly);
            $ranked[] = $evaluation;

            if (! $evaluation['disqualified'] && $evaluation['score'] >= self::MATCH_THRESHOLD) {
                $hasEligibleAboveThreshold = true;
                $totalCapexSavings = max($totalCapexSavings, $evaluation['capex_saved_php']);
            }
        }

        $this->sortRankedCandidates($ranked);

        $topCandidate = null;
        foreach ($ranked as $candidate) {
            if (! $candidate['disqualified'] && $candidate['score'] >= self::MATCH_THRESHOLD) {
                $topCandidate = $candidate;
                break;
            }
        }

        $alternativeComparisons = $topCandidate
            ? $this->annotateAlternatives($ranked, $topCandidate, $requirements)
            : [];

        $procurementAdvisory = [
            'action' => $hasEligibleAboveThreshold ? 'deploy_internal_asset' : 'evaluate_bridge_swap_or_procurement',
            'inventory_status' => $hasEligibleAboveThreshold ? 'Inventory Sufficient' : 'Inventory Depleted for Specification',
            'existing_inventory_prioritized' => true,
            'recommendation_summary' => $hasEligibleAboveThreshold
                ? "Immediate internal deployment recommended: Stockroom unit {$topCandidate['device']->asset_tag} satisfies operational criteria and saves ₱".number_format($totalCapexSavings, 2).' in avoided CapEx.'
                : 'No existing idle device directly satisfies the operational threshold (0.65). ITAM policy requires reviewing internal Bridge Swaps before requesting external CapEx purchase authorization.',
        ];

        return [
            'results' => $ranked,
            'top_candidate' => $topCandidate,
            'alternative_comparisons' => $alternativeComparisons,
            'procurement_recommended' => ! $hasEligibleAboveThreshold,
            'total_capex_savings_php' => $totalCapexSavings,
            'threshold' => self::MATCH_THRESHOLD,
            'procurement_advisory' => $procurementAdvisory,
        ];
    }

    /**
     * Evaluate a single device against a set of requirements.
     */
    public function evaluateDevice(Device $device, array $requirements, bool $availableOnly = false): array
    {
        if (! $this->hasRequirements($requirements)) {
            return $this->emptyRequirementsEvaluation($device);
        }

        $requiresGpu = ! empty($requirements['requires_gpu']);
        $reqGpuTier = $requirements['min_gpu_tier'] ?? 'none';
        $portabilityRequired = ! empty($requirements['portability_required']);

        [$disqualified, $disqualificationReason] = $this->checkHardEligibility($device, $requiresGpu, $availableOnly);

        $weights = $this->resolveWeights($requirements);

        $cpuScore = $this->scoreCpuTier((string) ($device->cpu_tier ?? 'entry'), $requirements['min_cpu_tier'] ?? 'entry', $device);
        $ramScore = $this->scoreRam((int) ($device->ram_gb ?? 0), (int) ($requirements['min_ram_gb'] ?? 8));
        $storageScore = $this->scoreStorage((int) ($device->storage_gb ?? 0), (int) ($requirements['min_storage_gb'] ?? 256));
        $gpuScore = $this->scoreGpu((string) ($device->gpu_tier ?? 'none'), $requiresGpu, $reqGpuTier);
        $portabilityScore = $this->scorePortability((string) $device->device_type, $portabilityRequired);

        $subscores = [
            'cpu' => round($cpuScore, 3),
            'ram' => round($ramScore, 3),
            'storage' => round($storageScore, 3),
            'gpu' => round($gpuScore, 3),
            'portability' => round($portabilityScore, 3),
        ];

        $finalScore = $this->computeFinalScore($subscores, $weights);
        $baseScore = $finalScore;

        $conditionMod = match (strtolower($device->condition ?? 'good')) {
            'new', 'excellent' => 0.02,
            'good' => 0.01,
            'fair' => -0.04,
            'poor', 'degraded' => -0.15,
            default => 0.0,
        };

        $lifecycleMod = match (strtolower($device->lifecycle_stage ?? 'deployment')) {
            'operational', 'deployment', 'reclaimed' => 0.02,
            'acquisition' => 0.01,
            'maintenance' => -0.15,
            'retired', 'disposed', 'retirement' => -0.30,
            default => 0.0,
        };

        $componentMeters = [
            'cpu' => (int) round($cpuScore * 100),
            'ram' => (int) round($ramScore * 100),
            'storage' => (int) round($storageScore * 100),
            'gpu' => (int) round($gpuScore * 100),
            'portability' => (int) round($portabilityScore * 100),
            'condition' => match (strtolower($device->condition ?? 'good')) {
                'new', 'excellent' => 100,
                'good' => 90,
                'fair' => 65,
                default => 40,
            },
        ];

        $deviceMarketValue = $this->estimateDeviceValuePhp($device);
        $capexSavedPhp = ! $disqualified ? $deviceMarketValue : 0.0;

        $procurementAvoidanceAudit = [
            'avoided_capex_php' => $capexSavedPhp,
            'market_replacement_benchmark_php' => $deviceMarketValue,
            'benchmark_source' => $device->purchase_cost ? 'Procurement Invoice Record' : "Commercial Hardware Benchmark ({$device->device_type} • ".ucfirst((string) ($device->cpu_tier ?? 'standard')).' tier)',
            'redeployment_cost_php' => 0.00,
            'formula' => 'Net CapEx Avoided = Benchmark Replacement (₱'.number_format($deviceMarketValue, 2).') - Redeployment Cost (₱0.00)',
            'audit_note' => "Reallocating existing asset {$device->asset_tag} directly displaces a new ₱".number_format($deviceMarketValue, 0).' commercial procurement expenditure from the IT capital budget.',
        ];

        $fitGrade = match (true) {
            $disqualified => 'Disqualified',
            $finalScore >= 0.88 => 'Optimal Fit',
            $finalScore >= 0.72 => 'Capable Match',
            $finalScore >= self::MATCH_THRESHOLD => 'Marginal Fit',
            default => 'Under-Provisioned',
        };

        $overprovisioningRisk = ! $disqualified
            && $device->ram_gb >= ($requirements['min_ram_gb'] ?? 8) * 2
            && $device->ram_gb > 16;

        $subscoreAudit = $this->buildSubscoreAudit(
            $device,
            $requirements,
            $subscores,
            $weights,
            $requiresGpu,
            $reqGpuTier,
            $portabilityRequired,
            $conditionMod,
            $lifecycleMod
        );

        [$confidenceScore, $confidenceLevel, $confidenceExplanation] = $this->computeConfidence(
            $device,
            $cpuScore,
            $ramScore,
            $storageScore,
            $disqualified
        );

        $rationale = $this->generateRationale($device, $requirements, $subscores, $disqualified, $disqualificationReason);

        return [
            'device' => $device,
            'score' => $finalScore,
            'base_score' => round($baseScore, 3),
            'weights' => [
                'cpu' => $weights['cpu'],
                'ram' => $weights['ram'],
                'storage' => $weights['storage'],
                'gpu' => $weights['gpu'],
                'portability' => $weights['portability'],
            ],
            'subscores' => $subscores,
            'subscore_audit' => $subscoreAudit,
            'component_meters' => $componentMeters,
            'capex_saved_php' => $capexSavedPhp,
            'procurement_avoidance_audit' => $procurementAvoidanceAudit,
            'confidence_score' => $confidenceScore,
            'confidence_level' => $confidenceLevel,
            'confidence_explanation' => $confidenceExplanation,
            'fit_grade' => $fitGrade,
            'overprovisioning_risk' => $overprovisioningRisk,
            'rationale' => $rationale,
            'disqualified' => $disqualified,
            'disqualification_reason' => $disqualificationReason,
            'passes_threshold' => ! $disqualified && ($finalScore >= self::MATCH_THRESHOLD),
            'is_available_for_deployment' => ($device->status === 'available'),
            'deployment_readiness' => ($device->status === 'available' ? 'Stockroom Ready (Immediate Dispatch)' : 'Currently Assigned'),
        ];
    }

    /**
     * Resolve dynamic workload-tailored scoring weights.
     */
    public function resolveWeights(array $requirements): array
    {
        if (! empty($requirements['weights']) && is_array($requirements['weights'])) {
            $w = $requirements['weights'];
            $cpu = (float) ($w['cpu'] ?? 0.30);
            $ram = (float) ($w['ram'] ?? 0.25);
            $storage = (float) ($w['storage'] ?? 0.15);
            $gpu = (float) ($w['gpu'] ?? 0.20);
            $portability = (float) ($w['portability'] ?? 0.10);
            $total = $cpu + $ram + $storage + $gpu + $portability;
            if ($total > 0) {
                return [
                    'cpu' => round($cpu / $total, 3),
                    'ram' => round($ram / $total, 3),
                    'storage' => round($storage / $total, 3),
                    'gpu' => round($gpu / $total, 3),
                    'portability' => round($portability / $total, 3),
                    'profile_name' => 'custom',
                ];
            }
        }

        $profileName = $requirements['weight_profile'] ?? $requirements['workload_type'] ?? null;
        if ($profileName && isset(self::WEIGHT_PROFILES[$profileName])) {
            $profile = self::WEIGHT_PROFILES[$profileName];
            $profile['profile_name'] = $profileName;

            return $profile;
        }

        $default = self::WEIGHT_PROFILES['balanced'];
        $default['profile_name'] = 'balanced';

        return $default;
    }

    private function sortRankedCandidates(array &$ranked): void
    {
        usort($ranked, function ($a, $b) {
            if ($a['disqualified'] !== $b['disqualified']) {
                return $a['disqualified'] ? 1 : -1;
            }
            if (abs($b['score'] - $a['score']) >= 0.001) {
                return $b['score'] <=> $a['score'];
            }

            $devA = $a['device'];
            $devB = $b['device'];

            $availA = $devA->status === 'available' ? 1 : 0;
            $availB = $devB->status === 'available' ? 1 : 0;
            if ($availA !== $availB) {
                return $availB <=> $availA;
            }

            $condRanks = ['new' => 4, 'excellent' => 3, 'good' => 2, 'fair' => 1];
            $condA = $condRanks[strtolower($devA->condition ?? '')] ?? 0;
            $condB = $condRanks[strtolower($devB->condition ?? '')] ?? 0;
            if ($condA !== $condB) {
                return $condB <=> $condA;
            }

            $agingA = $devA->isAging() ? 1 : 0;
            $agingB = $devB->isAging() ? 1 : 0;
            if ($agingA !== $agingB) {
                return $agingA <=> $agingB;
            }

            $warrRanks = ['active' => 3, 'expiring_soon' => 2, 'expired' => 1, 'none' => 0];
            $warrA = $warrRanks[$devA->warranty_status] ?? 0;
            $warrB = $warrRanks[$devB->warranty_status] ?? 0;
            if ($warrA !== $warrB) {
                return $warrB <=> $warrA;
            }

            $costA = $devA->purchase_cost ?? $this->estimateDeviceValuePhp($devA);
            $costB = $devB->purchase_cost ?? $this->estimateDeviceValuePhp($devB);
            if ($costA != $costB) {
                return $costA <=> $costB;
            }

            return strcmp($devA->asset_tag, $devB->asset_tag);
        });
    }

    private function annotateAlternatives(array &$ranked, array $topCandidate, array $requirements): array
    {
        $topDev = $topCandidate['device'];
        $rankCounter = 1;
        $alternativeComparisons = [];

        for ($i = 0; $i < count($ranked); $i++) {
            if ($ranked[$i]['device']->id === $topDev->id) {
                continue;
            }

            $cand = &$ranked[$i];
            $candDev = $cand['device'];
            $rankCounter++;

            $reasons = $this->buildWhyNotReasons($cand, $candDev, $topCandidate, $topDev, $requirements);
            $cand['why_not_reasons'] = $reasons;

            if (count($alternativeComparisons) < 3) {
                $alternativeComparisons[] = [
                    'rank' => $rankCounter,
                    'device_id' => $candDev->id,
                    'asset_tag' => $candDev->asset_tag,
                    'brand' => $candDev->brand,
                    'model' => $candDev->model,
                    'image_clip_url' => $candDev->image_clip_url,
                    'score' => $cand['score'],
                    'score_delta_pct' => (int) round(($topCandidate['score'] - $cand['score']) * 100),
                    'fit_grade' => $cand['fit_grade'],
                    'why_not_reasons' => $reasons,
                    'verdict' => $cand['disqualified']
                        ? 'Ineligible for this role'
                        : 'Viable secondary option with tighter operational margins',
                ];
            }
        }
        unset($cand);

        return $alternativeComparisons;
    }

    private function buildWhyNotReasons(array $cand, Device $candDev, array $topCandidate, Device $topDev, array $requirements): array
    {
        if ($cand['disqualified']) {
            return [$cand['disqualification_reason'] ?? 'Disqualified by hard eligibility filter.'];
        }

        $reasons = [];

        if ($candDev->ram_gb < $topDev->ram_gb) {
            $diff = $topDev->ram_gb - $candDev->ram_gb;
            $reasons[] = "{$diff}GB less RAM ({$candDev->ram_gb}GB vs Top Pick's {$topDev->ram_gb}GB)";
        }

        $cpuDiff = (self::CPU_TIERS[$topDev->cpu_tier] ?? 1) - (self::CPU_TIERS[$candDev->cpu_tier] ?? 1);
        if ($cpuDiff > 0) {
            $reasons[] = "Lower CPU tier ({$candDev->cpu_tier} vs Top Pick's {$topDev->cpu_tier})";
        }

        $gpuDiff = (self::GPU_TIERS[$topDev->gpu_tier] ?? 0) - (self::GPU_TIERS[$candDev->gpu_tier] ?? 0);
        if ($gpuDiff > 0) {
            $reasons[] = "Inferior GPU tier ({$candDev->gpu_tier} vs {$topDev->gpu_tier})";
        }

        if (! empty($requirements['portability_required']) && $candDev->device_type !== 'laptop') {
            $reasons[] = 'Desktop form factor lacks required mobility';
        }

        if ($candDev->isAging() && ! $topDev->isAging()) {
            $reasons[] = 'Older hardware generation (≥3 years in service)';
        }

        if (in_array(strtolower($candDev->condition ?? ''), ['fair', 'poor']) && in_array(strtolower($topDev->condition ?? ''), ['excellent', 'good'])) {
            $reasons[] = "Suboptimal physical condition ({$candDev->condition})";
        }

        if (empty($reasons)) {
            $scoreDelta = (int) round(($topCandidate['score'] - $cand['score']) * 100);
            $reasons[] = "Lower composite alignment score (-{$scoreDelta}%)";
        }

        return $reasons;
    }

    private function emptyRequirementsEvaluation(Device $device): array
    {
        return [
            'device' => $device,
            'score' => 0.0,
            'base_score' => 0.0,
            'subscores' => ['cpu' => 0.0, 'ram' => 0.0, 'storage' => 0.0, 'gpu' => 0.0, 'portability' => 0.0],
            'subscore_audit' => [],
            'component_meters' => ['cpu' => 0, 'ram' => 0, 'storage' => 0, 'gpu' => 0, 'portability' => 0, 'condition' => 0],
            'capex_saved_php' => 0.0,
            'procurement_avoidance_audit' => [],
            'confidence_score' => 0,
            'confidence_level' => 'Unconstrained Request',
            'confidence_explanation' => 'No hardware specification requirements were provided in match request.',
            'fit_grade' => 'Unspecified',
            'overprovisioning_risk' => false,
            'rationale' => 'No hardware requirements provided to evaluate this device against.',
            'disqualified' => true,
            'disqualification_reason' => 'Empty or unspecified hardware requirements.',
            'passes_threshold' => false,
            'is_available_for_deployment' => ($device->status === 'available'),
            'deployment_readiness' => 'Pending Specification',
        ];
    }

    /**
     * @return array{0: bool, 1: string|null}
     */
    private function checkHardEligibility(Device $device, bool $requiresGpu, bool $availableOnly): array
    {
        if (! $device->isComputeDevice()) {
            return [true, "Device category '{$device->device_type}' is not a compute workstation eligible for workload matching."];
        }
        if ($availableOnly && $device->status !== 'available') {
            return [true, "Device status is '{$device->status}' (requires available)."];
        }
        if ($requiresGpu && ($device->gpu_tier ?? 'none') === 'none') {
            return [true, 'Workload requires dedicated or integrated GPU, but device has no GPU.'];
        }
        if (in_array(strtolower($device->condition ?? ''), ['poor', 'needs_repair', 'retired', 'degraded'], true)) {
            return [true, "Device physical condition is '{$device->condition}' (requires fair, good, or excellent for deployment)."];
        }

        return [false, null];
    }

    private function buildSubscoreAudit(
        Device $device,
        array $requirements,
        array $subscores,
        array $weights,
        bool $requiresGpu,
        string $reqGpuTier,
        bool $portabilityRequired,
        float $conditionMod,
        float $lifecycleMod
    ): array {
        $cpuScore = $subscores['cpu'];
        $ramScore = $subscores['ram'];
        $storageScore = $subscores['storage'];
        $gpuScore = $subscores['gpu'];
        $portabilityScore = $subscores['portability'];
        $cpuDelta = (self::CPU_TIERS[$device->cpu_tier ?? 'entry'] ?? 1) - (self::CPU_TIERS[$requirements['min_cpu_tier'] ?? 'entry'] ?? 1);

        return [
            'cpu' => [
                'score' => $cpuScore,
                'weight' => $weights['cpu'],
                'weighted_score' => round($cpuScore * $weights['cpu'], 3),
                'provided' => ($device->cpu ?? 'N/A').' ('.ucfirst((string) ($device->cpu_tier ?? 'entry')).' Tier)',
                'required' => ucfirst($requirements['min_cpu_tier'] ?? 'entry').' Tier',
                'status' => $cpuDelta === 0 ? 'Met' : ($cpuDelta > 0 ? 'Exceeded' : 'Deficit'),
                'delta' => $cpuDelta,
            ],
            'ram' => [
                'score' => $ramScore,
                'weight' => $weights['ram'],
                'weighted_score' => round($ramScore * $weights['ram'], 3),
                'provided' => ($device->ram_gb ?? 0).' GB',
                'required' => ($requirements['min_ram_gb'] ?? 8).' GB',
                'status' => $ramScore >= 1.0 ? 'Met' : ($ramScore >= 0.85 ? 'Headroom' : 'Deficit'),
                'delta_gb' => ($device->ram_gb ?? 0) - ($requirements['min_ram_gb'] ?? 8),
            ],
            'storage' => [
                'score' => $storageScore,
                'weight' => $weights['storage'],
                'weighted_score' => round($storageScore * $weights['storage'], 3),
                'provided' => trim(($device->storage_gb ?? 0).' GB '.($device->storage_type ?? '')),
                'required' => ($requirements['min_storage_gb'] ?? 256).' GB',
                'status' => $storageScore >= 1.0 ? 'Met' : ($storageScore >= 0.85 ? 'Headroom' : 'Deficit'),
                'delta_gb' => ($device->storage_gb ?? 0) - ($requirements['min_storage_gb'] ?? 256),
            ],
            'gpu' => [
                'score' => $gpuScore,
                'weight' => $weights['gpu'],
                'weighted_score' => round($gpuScore * $weights['gpu'], 3),
                'provided' => $device->gpu ? "{$device->gpu} ({$device->gpu_tier})" : (($device->gpu_tier ?? 'none') !== 'none' ? ucfirst((string) $device->gpu_tier) : 'Integrated/None'),
                'required' => $requiresGpu ? ucfirst($reqGpuTier) : 'None / Optional',
                'status' => $gpuScore >= 1.0 ? 'Met' : ($gpuScore >= 0.7 ? 'Exceeded' : ($gpuScore == 0.3 ? 'Overkill' : 'Deficit')),
            ],
            'portability' => [
                'score' => $portabilityScore,
                'weight' => $weights['portability'],
                'weighted_score' => round($portabilityScore * $weights['portability'], 3),
                'provided' => ucfirst($device->device_type),
                'required' => $portabilityRequired ? 'Laptop (Mobile)' : 'Any / Desktop Preferred',
                'status' => $portabilityScore >= 1.0 ? 'Met' : 'Suboptimal',
            ],
            'weight_profile' => $weights['profile_name'] ?? 'balanced',
            'weights' => [
                'cpu' => $weights['cpu'],
                'ram' => $weights['ram'],
                'storage' => $weights['storage'],
                'gpu' => $weights['gpu'],
                'portability' => $weights['portability'],
            ],
            'modifiers' => [
                'condition' => [
                    'adjustment' => $conditionMod,
                    'label' => ucfirst($device->condition ?? 'Good'),
                ],
                'lifecycle' => [
                    'adjustment' => $lifecycleMod,
                    'label' => ucfirst($device->lifecycle_stage ?? 'Deployment'),
                ],
            ],
        ];
    }

    /**
     * @return array{0: int, 1: string, 2: string}
     */
    private function computeConfidence(Device $device, float $cpuScore, float $ramScore, float $storageScore, bool $disqualified): array
    {
        $exactnessRatio = ($cpuScore >= 0.8 && $ramScore >= 0.85 && $storageScore >= 0.85) ? 1.0 : 0.6;
        if ($disqualified) {
            $exactnessRatio = 0.0;
        }

        $conditionWeight = match (strtolower($device->condition ?? 'good')) {
            'new', 'excellent' => 1.0,
            'good' => 0.85,
            'fair' => 0.50,
            default => 0.20,
        };

        $ageWeight = $device->isAging() ? 0.45 : 1.0;

        $warrantyWeight = match ($device->warranty_status) {
            'active' => 1.0,
            'expiring_soon' => 0.65,
            default => 0.35,
        };

        $confidenceScore = (int) round(
            (($exactnessRatio * 0.35) + ($conditionWeight * 0.25) + ($ageWeight * 0.20) + ($warrantyWeight * 0.20)) * 100
        );
        $confidenceScore = max(0, min(100, $confidenceScore));

        $confidenceLevel = match (true) {
            $confidenceScore >= 80 => 'High Confidence',
            $confidenceScore >= 60 => 'Moderate Confidence',
            default => 'Cautious Recommendation',
        };

        $confidenceExplanation = sprintf(
            '%s (%d/100): %s condition, %s, warranty %s.',
            $confidenceLevel,
            $confidenceScore,
            ucfirst($device->condition ?? 'good'),
            $device->isAging() ? 'aging hardware (≥3 yrs)' : 'modern platform',
            $device->warranty_status === 'active' ? 'active' : ($device->warranty_status === 'expiring_soon' ? 'expiring soon' : 'expired/none')
        );

        return [$confidenceScore, $confidenceLevel, $confidenceExplanation];
    }

    private function scoreCpuTier(string $deviceTier, string $requiredTier, ?Device $device = null): float
    {
        $devVal = self::CPU_TIERS[$deviceTier] ?? 1;
        $reqVal = self::CPU_TIERS[$requiredTier] ?? 1;
        $diff = $devVal - $reqVal;

        if ($diff === 0) {
            $rawScore = 1.0;
        } elseif ($diff === 1) {
            $rawScore = 0.8;
        } elseif ($diff === 2) {
            $rawScore = 0.4;
        } elseif ($diff > 2) {
            $rawScore = 0.2;
        } else {
            return 0.0;
        }

        if ($device && $device->isAging()) {
            $currentYear = (int) date('Y');
            $year = $device->year_acquired ?: ($currentYear - 3);
            $ageInYears = max(3, $currentYear - $year);
            $agePenalty = min(0.20, max(0.05, ($ageInYears - 2) * 0.04));
            $rawScore = max(0.1, round($rawScore - $agePenalty, 3));
        }

        return $rawScore;
    }

    private function scoreCapacity(int $deviceValue, int $requiredValue, int $tolerance): float
    {
        if ($requiredValue <= 0) {
            return 1.0;
        }
        if (abs($deviceValue - $requiredValue) <= $tolerance) {
            return 1.0;
        }
        if ($deviceValue > $requiredValue) {
            return 0.85;
        }

        $zeroPoint = $requiredValue * 0.5;
        if ($deviceValue <= $zeroPoint) {
            return 0.0;
        }

        return max(0.0, min(1.0, ($deviceValue - $zeroPoint) / ($requiredValue - $zeroPoint)));
    }

    private function scoreRam(int $deviceRam, int $requiredRam): float
    {
        return $this->scoreCapacity($deviceRam, $requiredRam, 2);
    }

    private function scoreStorage(int $deviceStorage, int $requiredStorage): float
    {
        return $this->scoreCapacity($deviceStorage, $requiredStorage, 64);
    }

    private function scoreGpu(string $deviceGpuTier, bool $requiresGpu, string $minGpuTier): float
    {
        $devVal = self::GPU_TIERS[$deviceGpuTier] ?? 0;
        $reqVal = self::GPU_TIERS[$minGpuTier] ?? 0;

        if (! $requiresGpu) {
            if ($devVal === 0) {
                return 1.0;
            }
            if ($devVal === 1) {
                return 0.9;
            }

            return 0.3;
        }

        if ($devVal === 0) {
            return 0.0;
        }
        if ($devVal === $reqVal) {
            return 1.0;
        }
        if ($devVal > $reqVal) {
            return 0.7;
        }

        return 0.0;
    }

    private function scorePortability(string $deviceType, bool $portabilityRequired): float
    {
        if ($portabilityRequired) {
            return ($deviceType === 'laptop') ? 1.0 : 0.0;
        }

        return ($deviceType === 'desktop') ? 1.0 : 0.6;
    }

    private function generateRationale(Device $device, array $requirements, array $subscores, bool $disqualified, ?string $reason): string
    {
        if ($disqualified) {
            return 'Disqualified: '.($reason ?? 'Hard requirement filter failed.');
        }

        $parts = [];

        if ($subscores['cpu'] >= 1.0) {
            $parts[] = "Matches required CPU tier ({$device->cpu_tier})";
        } elseif ($subscores['cpu'] >= 0.8) {
            $parts[] = "CPU tier ({$device->cpu_tier}) exceeds request";
        } elseif ($subscores['cpu'] > 0.0) {
            $parts[] = "CPU tier ({$device->cpu_tier}) is significantly above requirement";
        } else {
            $parts[] = "CPU tier ({$device->cpu_tier}) falls below requested ({$requirements['min_cpu_tier']})";
        }

        if ($subscores['ram'] >= 1.0) {
            $parts[] = "RAM ({$device->ram_gb}GB) meets target specification";
        } elseif ($subscores['ram'] >= 0.85) {
            $parts[] = "RAM ({$device->ram_gb}GB) exceeds minimum";
        } else {
            $parts[] = "RAM ({$device->ram_gb}GB) is below requested {$requirements['min_ram_gb']}GB";
        }

        if ($subscores['storage'] >= 1.0) {
            $parts[] = "Storage ({$device->storage_gb}GB {$device->storage_type}) matches capacity";
        } elseif ($subscores['storage'] >= 0.85) {
            $parts[] = "Storage ({$device->storage_gb}GB) provides generous headroom";
        } else {
            $parts[] = "Storage ({$device->storage_gb}GB) is below target";
        }

        if ($subscores['gpu'] >= 1.0) {
            $parts[] = 'GPU configuration perfectly aligns with workload';
        } elseif ($subscores['gpu'] >= 0.7) {
            $parts[] = "GPU ({$device->gpu_tier}) exceeds required tier";
        } elseif ($subscores['gpu'] == 0.3) {
            $parts[] = "Dedicated GPU ({$device->gpu_tier}) on non-GPU role represents potential over-provisioning";
        } else {
            $parts[] = "GPU ({$device->gpu_tier}) insufficient for graphical needs";
        }

        if ($subscores['portability'] >= 1.0) {
            $parts[] = "Form factor ({$device->device_type}) matches mobility preference";
        } elseif ($subscores['portability'] == 0.6) {
            $parts[] = 'Laptop assigned to desk role (acceptable but consumes mobile inventory)';
        } else {
            $parts[] = 'Desktop assigned when portability was requested';
        }

        if (in_array(strtolower($device->condition ?? ''), ['good', 'excellent', 'new'])) {
            $parts[] = "Unit in {$device->condition} physical condition";
        }
        $valFormatted = number_format($this->estimateDeviceValuePhp($device), 0);
        $parts[] = "Reallocation avoids ~₱{$valFormatted} CapEx procurement";

        return implode('. ', $parts).'.';
    }
}
