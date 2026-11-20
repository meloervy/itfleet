<?php

namespace App\Ai\Concerns;

use Laravel\Ai\Enums\Lab;

trait UsesGeminiThinkingConfig
{
    private const ALLOWED_GEMINI_THINKING_LEVELS = ['low', 'medium', 'high', 'xhigh'];

    /**
     * Supply Gemini 4 Hydrogen thinking configuration when running on Gemini.
     *
     * @return array<string, mixed>
     */
    public function providerOptions(Lab|string $provider): array
    {
        $isGemini = $provider === Lab::Gemini || $provider === 'gemini';
        if (! $isGemini) {
            return [];
        }

        $level = strtolower(trim((string) config('ai.providers.gemini.thinking_level', 'low')));
        if (! in_array($level, self::ALLOWED_GEMINI_THINKING_LEVELS, true)) {
            return [];
        }

        return [
            'thinkingConfig' => [
                'thinkingLevel' => $level,
            ],
        ];
    }
}
