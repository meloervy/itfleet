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
class DeviceSpecIdentificationAgent implements Agent, HasProviderOptions, HasStructuredOutput
{
    use Promptable;
    use UsesGeminiThinkingConfig;

    /**
     * Get the instructions that the agent should follow.
     */
    public function instructions(): Stringable|string
    {
        return <<<'INSTRUCTIONS'
You are an enterprise hardware specification expert. Given a device model name or description, return accurate technical specifications for IT asset management.

Rules:
- `brand`: manufacturer name (Dell, Apple, Lenovo, HP, ASUS, Acer, Microsoft, Samsung, Google, Framework, MSI, Minisforum, Beelink, etc.).
- `model`: full model name without the brand prefix.
- `device_type`: "laptop" or "desktop". Mac mini, Mac Studio, Mac Pro, iMac, Intel/ASUS NUC, ThinkCentre Tiny, OptiPlex Micro, HP Pro Mini, Minisforum, and Beelink MUST be "desktop".
- `cpu_tier`:
  - "entry": Celeron, Pentium, Core i3, Ryzen 3, Intel Processor N100/N200/N300, MediaTek Kompanio, entry Chromebook chips.
  - "mid": Core i5, Core Ultra 5, Ryzen 5, Apple M1/M2/M3 base, Qualcomm Snapdragon X Plus.
  - "high": Core i7/i9, Core Ultra 7/9, Ryzen 7/9, AMD Ryzen AI 9, Apple M3/M4/M5 base, M-series Pro/Max, Qualcomm Snapdragon X Elite.
  - "workstation": Xeon, Threadripper, EPYC, Apple M-series Ultra.
- Apple hardware MUST use Apple Silicon (M1–M5 or Pro/Max/Ultra) and Apple integrated GPU (e.g. "Apple 10-core GPU"), never Intel or AMD. Standard RAM is 16 GB (or 18/24/32/36/64 GB as configured); storage is SSD (512 GB default).
- Qualcomm Snapdragon / Copilot+ PCs (Surface Laptop 7, Surface Pro 11, XPS 13 9345, ThinkPad T14s Gen 6 Snapdragon, HP OmniBook X, etc.): exact Qualcomm processor (X Elite X1E-80-100 or X Plus X1P-64-100), "Qualcomm Adreno X1-85 GPU" or "Qualcomm Adreno GPU" (integrated), 16 GB+ RAM, 512 GB+ SSD, 2024+.
- Intel Core Ultra (Meteor/Lunar Lake) & AMD Ryzen AI 300: exact chip (e.g. Intel Core Ultra 7 155H / 258V, AMD Ryzen AI 9 HX 370), "Intel Arc Graphics" / "Intel Arc 140V GPU" / "AMD Radeon 890M" (integrated).
- Chromebooks: actual chip (e.g. Intel Core i3-N305, Processor N100, MediaTek Kompanio), "entry" or "mid", typically 8 GB RAM (16 GB for Plus), 128–512 GB SSD, integrated GPU.
- Use the most common standard configuration when a specific variant is not specified.
INSTRUCTIONS;
    }

    /**
     * Get the agent's structured output schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'brand' => $schema->string()->required(),
            'model' => $schema->string()->required(),
            'device_type' => $schema->string()->enum(['laptop', 'desktop'])->required(),
            'cpu' => $schema->string()->required(),
            'cpu_tier' => $schema->string()->enum(['entry', 'mid', 'high', 'workstation'])->required(),
            'ram_gb' => $schema->integer()->required(),
            'storage_type' => $schema->string()->enum(['SSD', 'HDD'])->required(),
            'storage_gb' => $schema->integer()->required(),
            'gpu' => $schema->string()->required(),
            'gpu_tier' => $schema->string()->enum(['none', 'integrated', 'dedicated-entry', 'dedicated-high'])->required(),
            'year_acquired' => $schema->integer()->required(),
        ];
    }
}
