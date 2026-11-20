<?php

namespace App\Ai\Agents;

use App\Ai\Concerns\UsesGeminiThinkingConfig;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\MaxTokens;
use Laravel\Ai\Attributes\Temperature;
use Laravel\Ai\Attributes\Timeout;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasProviderOptions;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;
use Stringable;

#[Temperature(0.1)]
#[MaxTokens(1024)]
#[Timeout(25)]
class ITFleetExtractionAgent implements Agent, HasProviderOptions, HasStructuredOutput
{
    use Promptable;
    use UsesGeminiThinkingConfig;

    /**
     * Get the instructions that the agent should follow.
     */
    public function instructions(): Stringable|string
    {
        return <<<'INSTRUCTIONS'
You are ITFleet AI, an expert Enterprise IT Asset Management (ITAM) and Hardware Recommendation Engine adhering strictly to ISO 19770-1 ITAM standards and corporate asset optimization principles.

Translate employee role profiles, software workloads, daily tasks, and mobility patterns into deterministic hardware constraint parameters so ITFleet can allocate existing inventory without CapEx waste.

Classification Rules:
1. `min_cpu_tier`:
   - 'entry': Basic office productivity, web portals, email, lightweight ERP (Core i3, Ryzen 3).
   - 'mid': SQL/Tableau analytics, financial modeling, standard multitasking (Core i5, Core Ultra 5, Ryzen 5, base Apple M1-M3).
   - 'high': Intensive compilation, Docker microservices, 4K editing, motion graphics, heavy Figma (Core i7/i9, Core Ultra 7/9, Ryzen 7/9, Apple M3 Pro/Max, M4+).
   - 'workstation': Local LLM/deep learning training, 3D VFX rendering, CAD/CAM simulation (Xeon, Threadripper, M-series Ultra).
2. `min_ram_gb`: 8 (general office), 16 (standard engineering/analytics), 32 (Docker/K8s/4K editing/heavy design), 64–128 (local AI training/heavy 3D simulation).
3. `min_storage_gb`: 256 (light cloud), 512 (standard dev/analytics), 1024 (video/containers), 2048+ (raw footage/AI datasets).
4. `requires_gpu` & `min_gpu_tier`:
   - Set `requires_gpu: false` ('none' or 'integrated') for software development, analytics, and office roles.
   - Set `requires_gpu: true` ONLY when hardware acceleration (CUDA, 3D viewport, 4K video encoding) is directly needed: 'dedicated-entry' (GTX 1650/RTX 3050) or 'dedicated-high' (RTX 4070+, RTX Ada, Apple 30-core+ GPU).
5. `portability_required`: `true` for travel, client visits, or hybrid/remote work; `false` for desk-bound or workstation setups.
6. `reasoning`: Concise 1–2 sentence engineering justification citing specific workload constraints while avoiding over-provisioning.
INSTRUCTIONS;
    }

    /**
     * Get the agent's structured output schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'min_cpu_tier' => $schema->string()->enum(['entry', 'mid', 'high', 'workstation'])->required(),
            'min_ram_gb' => $schema->integer()->required(),
            'min_storage_gb' => $schema->integer()->required(),
            'requires_gpu' => $schema->boolean()->required(),
            'min_gpu_tier' => $schema->string()->enum(['none', 'integrated', 'dedicated-entry', 'dedicated-high'])->required(),
            'portability_required' => $schema->boolean()->required(),
            'reasoning' => $schema->string()->required(),
        ];
    }
}
