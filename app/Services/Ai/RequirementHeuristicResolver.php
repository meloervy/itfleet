<?php

namespace App\Services\Ai;

class RequirementHeuristicResolver
{
    /**
     * Match normalized input against pre-cached demo role templates to conserve API quota.
     *
     * @return array<string, mixed>|null
     */
    public function matchDemoTemplate(string $cleanInput): ?array
    {
        $templates = config('demo_templates.templates', []);

        foreach ($templates as $prompt => $payload) {
            if (str_starts_with($cleanInput, substr((string) $prompt, 0, 50))) {
                $payload['source'] = 'cached_demo';
                $payload['reasoning'] = 'Instantly extracted from pre-cached demo template.';

                return $payload;
            }
        }

        return null;
    }

    /**
     * Infer structured role hardware constraints locally when Gemini is unavailable.
     *
     * @return array{
     *     min_cpu_tier: string,
     *     min_ram_gb: int,
     *     min_storage_gb: int,
     *     requires_gpu: bool,
     *     min_gpu_tier: string,
     *     portability_required: bool,
     *     reasoning: string
     * }
     */
    public function resolve(string $input): array
    {
        $lower = strtolower($input);

        $isWorkstation = str_contains($lower, '3d')
            || str_contains($lower, 'machine learning')
            || str_contains($lower, 'deep learning')
            || str_contains($lower, 'rendering')
            || str_contains($lower, 'simulation')
            || str_contains($lower, 'workstation');
        $isHigh = str_contains($lower, 'video')
            || str_contains($lower, '4k')
            || str_contains($lower, 'developer')
            || str_contains($lower, 'engineer')
            || str_contains($lower, 'design');
        $isMid = str_contains($lower, 'data')
            || str_contains($lower, 'analyst')
            || str_contains($lower, 'multitask')
            || str_contains($lower, 'finance');

        $cpuTier = 'entry';
        if ($isWorkstation) {
            $cpuTier = 'workstation';
        } elseif ($isHigh) {
            $cpuTier = 'high';
        } elseif ($isMid) {
            $cpuTier = 'mid';
        }

        $ram = 8;
        if (preg_match('/(\d+)\s*gb\s*(?:ram|memory)/i', $input, $m)) {
            $ram = (int) $m[1];
        } elseif ($isWorkstation) {
            $ram = 32;
        } elseif ($isHigh || $isMid) {
            $ram = 16;
        }

        $storage = 256;
        if (preg_match('/(\d+)\s*(?:gb|tb)\s*(?:ssd|hdd|storage)/i', $input, $m)) {
            $val = (int) $m[1];
            $storage = str_contains(strtolower($m[0]), 'tb') ? $val * 1024 : $val;
        } elseif ($isWorkstation || $isHigh) {
            $storage = 512;
        }

        $requiresGpu = str_contains($lower, 'video')
            || str_contains($lower, '4k')
            || str_contains($lower, 'gpu')
            || str_contains($lower, 'render')
            || str_contains($lower, '3d')
            || str_contains($lower, 'cad')
            || str_contains($lower, 'gaming')
            || str_contains($lower, 'graphics');

        $gpuTier = 'none';
        if ($requiresGpu) {
            $gpuTier = ($isWorkstation || str_contains($lower, '4k') || str_contains($lower, 'heavy'))
                ? 'dedicated-high'
                : 'dedicated-entry';
        } elseif ($isMid || $isHigh) {
            $gpuTier = 'integrated';
        }

        $portability = str_contains($lower, 'travel')
            || str_contains($lower, 'laptop')
            || str_contains($lower, 'mobile')
            || str_contains($lower, 'portable')
            || str_contains($lower, 'remote')
            || str_contains($lower, 'hybrid')
            || str_contains($lower, 'site');

        return [
            'min_cpu_tier' => $cpuTier,
            'min_ram_gb' => $ram,
            'min_storage_gb' => $storage,
            'requires_gpu' => $requiresGpu,
            'min_gpu_tier' => $gpuTier,
            'portability_required' => $portability,
            'reasoning' => "Inferred based on workload keywords: CPU {$cpuTier}, {$ram}GB RAM, ".($requiresGpu ? "{$gpuTier} GPU" : 'no dedicated GPU').', '.($portability ? 'portable laptop' : 'desktop').'.',
        ];
    }

    /**
     * Validate and bound structured requirement extraction output from Gemini.
     *
     * @param  array<string, mixed>  $data
     * @return array{
     *     min_cpu_tier: string,
     *     min_ram_gb: int,
     *     min_storage_gb: int,
     *     requires_gpu: bool,
     *     min_gpu_tier: string,
     *     portability_required: bool,
     *     reasoning: string
     * }
     */
    public function sanitize(array $data): array
    {
        $validCpu = ['entry', 'mid', 'high', 'workstation'];
        $validGpu = ['none', 'integrated', 'dedicated-entry', 'dedicated-high'];

        return [
            'min_cpu_tier' => in_array($data['min_cpu_tier'] ?? '', $validCpu, true) ? (string) $data['min_cpu_tier'] : 'entry',
            'min_ram_gb' => max(4, (int) ($data['min_ram_gb'] ?? 8)),
            'min_storage_gb' => max(128, (int) ($data['min_storage_gb'] ?? 256)),
            'requires_gpu' => (bool) ($data['requires_gpu'] ?? false),
            'min_gpu_tier' => in_array($data['min_gpu_tier'] ?? '', $validGpu, true) ? (string) $data['min_gpu_tier'] : 'none',
            'portability_required' => (bool) ($data['portability_required'] ?? false),
            'reasoning' => (string) ($data['reasoning'] ?? 'Automated requirement analysis.'),
        ];
    }
}
