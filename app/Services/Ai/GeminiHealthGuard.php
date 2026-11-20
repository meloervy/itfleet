<?php

namespace App\Services\Ai;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Laravel\Ai\Exceptions\InsufficientCreditsException;
use Laravel\Ai\Exceptions\ProviderOverloadedException;
use Laravel\Ai\Exceptions\RateLimitedException;
use Throwable;

class GeminiHealthGuard
{
    public const CACHE_QUOTA_EXCEEDED = 'gemini_quota_exceeded';

    public const CACHE_AUTH_INVALID = 'gemini_auth_invalid';

    public const CACHE_TEMPORARY_OVERLOAD = 'gemini_temporary_overload';

    public const CACHE_SERVICE_ERROR = 'gemini_service_error';

    /**
     * @var list<string>
     */
    private const ALLOWED_THINKING_LEVELS = ['low', 'medium', 'high', 'xhigh'];

    /**
     * Get the configured Gemini text model identifier.
     */
    public function model(): string
    {
        return (string) config(
            'ai.providers.gemini.models.text.default',
            config('services.gemini.model', 'gemini-4-hydrogen')
        );
    }

    /**
     * Format a Gemini model identifier into a human-friendly display label.
     */
    public function modelLabel(?string $model = null): string
    {
        $raw = trim((string) ($model ?: $this->model()));

        if ($raw === 'gemini-4-hydrogen') {
            return 'Gemini 4 Hydrogen';
        }

        return ucwords(str_replace(['-', '_'], ' ', $raw));
    }

    /**
     * Get the configured Gemini API key, or null when missing.
     */
    public function apiKey(): ?string
    {
        $key = config('ai.providers.gemini.key', config('services.gemini.api_key'));

        return is_string($key) && trim($key) !== '' ? trim($key) : null;
    }

    /**
     * Get the configured Gemini API base URL without a trailing slash.
     */
    public function baseUrl(): string
    {
        return rtrim((string) config('ai.providers.gemini.url', 'https://generativelanguage.googleapis.com/v1beta/'), '/');
    }

    /**
     * Get the validated Gemini thinking level for free-tier token efficiency.
     */
    public function thinkingLevel(): string
    {
        $level = strtolower(trim((string) config('ai.providers.gemini.thinking_level', 'low')));

        return in_array($level, self::ALLOWED_THINKING_LEVELS, true) ? $level : 'low';
    }

    /**
     * Determine whether Gemini offline demo mode is explicitly forced.
     */
    public function isOfflineForced(): bool
    {
        return (bool) config('services.gemini.demo_offline', false);
    }

    /**
     * Determine whether any circuit breaker is currently open.
     */
    public function isCircuitOpen(): bool
    {
        return Cache::has(self::CACHE_QUOTA_EXCEEDED)
            || Cache::has(self::CACHE_AUTH_INVALID)
            || Cache::has(self::CACHE_TEMPORARY_OVERLOAD)
            || Cache::has(self::CACHE_SERVICE_ERROR);
    }

    /**
     * Inspect the active circuit-breaker state, if any.
     */
    public function activeFailureState(): ?string
    {
        if (Cache::has(self::CACHE_QUOTA_EXCEEDED)) {
            return 'quota_exceeded';
        }

        if (Cache::has(self::CACHE_TEMPORARY_OVERLOAD) || Cache::has(self::CACHE_SERVICE_ERROR)) {
            return 'service_unavailable';
        }

        if (Cache::has(self::CACHE_AUTH_INVALID)) {
            return 'auth_invalid';
        }

        return null;
    }

    /**
     * Determine whether live Gemini API calls (or Laravel AI fakes) are allowed.
     */
    public function canCallLiveApi(bool $isFaked = false): bool
    {
        return $isFaked || ($this->apiKey() !== null && ! $this->isOfflineForced() && ! $this->isCircuitOpen());
    }

    /**
     * Clear all recorded Gemini circuit-breaker flags after a successful call.
     */
    public function clearFailures(): void
    {
        Cache::forget(self::CACHE_QUOTA_EXCEEDED);
        Cache::forget(self::CACHE_AUTH_INVALID);
        Cache::forget(self::CACHE_TEMPORARY_OVERLOAD);
        Cache::forget(self::CACHE_SERVICE_ERROR);
    }

    /**
     * Determine whether an exception represents a transient HTTP 503 overload spike.
     */
    public function isTransientOverload(Throwable $e): bool
    {
        if ($e instanceof ProviderOverloadedException) {
            return true;
        }

        $msg = strtolower($e->getMessage());

        return str_contains($msg, '503')
            || str_contains($msg, 'high demand')
            || str_contains($msg, 'unavailable')
            || str_contains($msg, 'overloaded')
            || str_contains($msg, 'overload');
    }

    /**
     * Record a Gemini API failure and engage an appropriately scoped free-tier cooldown.
     */
    public function recordFailure(Throwable|int $failure, ?string $message = null): string
    {
        $statusCode = is_int($failure) ? $failure : null;
        $msg = strtolower(is_int($failure) ? (string) $message : $failure->getMessage());

        if (
            $statusCode === 429
            || $failure instanceof RateLimitedException
            || str_contains($msg, '429')
            || str_contains($msg, 'quota')
            || str_contains($msg, 'resource_exhausted')
        ) {
            $isDailyQuota = str_contains($msg, 'per day')
                || str_contains($msg, 'daily')
                || str_contains($msg, 'rpd')
                || str_contains($msg, 'limit: 20')
                || str_contains($msg, 'quota exceeded');

            $ttl = $isDailyQuota ? now()->addMinutes(15) : now()->addSeconds(90);
            Cache::put(self::CACHE_QUOTA_EXCEEDED, true, $ttl);

            return 'quota_exceeded';
        }

        if (
            $statusCode === 401
            || $statusCode === 403
            || $failure instanceof InsufficientCreditsException
            || str_contains($msg, '401')
            || str_contains($msg, '403')
            || str_contains($msg, 'api key')
            || str_contains($msg, 'permission_denied')
        ) {
            Cache::put(self::CACHE_AUTH_INVALID, true, now()->addMinutes(10));

            return 'auth_invalid';
        }

        if (
            $statusCode === 503
            || $failure instanceof ProviderOverloadedException
            || str_contains($msg, '503')
            || str_contains($msg, 'high demand')
            || str_contains($msg, 'unavailable')
            || str_contains($msg, 'overload')
        ) {
            Cache::put(self::CACHE_TEMPORARY_OVERLOAD, true, now()->addSeconds(20));

            return 'service_unavailable';
        }

        Cache::put(self::CACHE_SERVICE_ERROR, true, now()->addSeconds(20));

        return 'error';
    }

    /**
     * Execute a live Gemini call with a single short retry on transient HTTP 503 overloads.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     */
    public function runWithTransientRetry(callable $callback, int $maxRetries = 1, int $retryDelayMs = 450): mixed
    {
        $attempt = 0;

        while (true) {
            try {
                $result = $callback();
                $this->clearFailures();

                return $result;
            } catch (Throwable $e) {
                if ($attempt < $maxRetries && $this->isTransientOverload($e)) {
                    $attempt++;
                    if ($retryDelayMs > 0) {
                        usleep($retryDelayMs * 1000);
                    }

                    continue;
                }

                $this->recordFailure($e);

                throw $e;
            }
        }
    }

    /**
     * Build the passive runtime status payload exposed to UI components.
     *
     * @return array{
     *     state: string,
     *     provider: string,
     *     model: string,
     *     model_label: string,
     *     label: string,
     *     sublabel: string,
     *     tooltip: string,
     *     is_fallback: bool,
     *     needs_api_key: bool
     * }
     */
    public function getStatus(?User $user = null, bool $isFaked = false): array
    {
        $provider = (string) config('ai.default', 'gemini');
        $targetModel = $this->model();
        $modelLabel = $this->modelLabel($targetModel);
        $apiKey = $this->apiKey();
        $forceOffline = $this->isOfflineForced();

        if (! $isFaked && ($apiKey === null || $forceOffline)) {
            return [
                'state' => 'offline',
                'provider' => $provider,
                'model' => $targetModel,
                'model_label' => $modelLabel,
                'label' => 'Local DB Engine Active',
                'sublabel' => 'Offline Mode',
                'tooltip' => $apiKey === null
                    ? "{$modelLabel} is ready once GEMINI_API_KEY is configured. Real-time Local DB Engine is currently answering from live SQLite/DB records."
                    : 'Offline mode is enabled (GEMINI_DEMO_OFFLINE=true). Real-time Local DB Engine is active.',
                'is_fallback' => true,
                'needs_api_key' => $apiKey === null,
            ];
        }

        if (Cache::has(self::CACHE_QUOTA_EXCEEDED)) {
            return [
                'state' => 'quota_exceeded',
                'provider' => $provider,
                'model' => $targetModel,
                'model_label' => $modelLabel,
                'label' => "{$modelLabel}: Quota Reached",
                'sublabel' => 'Local DB Engine Active',
                'tooltip' => 'Gemini Free Tier rate or quota limit reached. Local DB Engine is answering queries with 100% accuracy.',
                'is_fallback' => true,
                'needs_api_key' => false,
            ];
        }

        if (Cache::has(self::CACHE_TEMPORARY_OVERLOAD) || Cache::has(self::CACHE_SERVICE_ERROR)) {
            return [
                'state' => 'service_unavailable',
                'provider' => $provider,
                'model' => $targetModel,
                'model_label' => $modelLabel,
                'label' => "{$modelLabel}: Temporary Overload",
                'sublabel' => 'Local DB Engine Active',
                'tooltip' => 'Gemini API returned a temporary high-demand spike (503). Local DB Engine is handling queries seamlessly.',
                'is_fallback' => true,
                'needs_api_key' => false,
            ];
        }

        if (Cache::has(self::CACHE_AUTH_INVALID)) {
            return [
                'state' => 'auth_invalid',
                'provider' => $provider,
                'model' => $targetModel,
                'model_label' => $modelLabel,
                'label' => 'Gemini Auth Invalid',
                'sublabel' => 'Local DB Engine Active',
                'tooltip' => 'Gemini API rejected the configured GEMINI_API_KEY (401/403). Local DB Engine is active.',
                'is_fallback' => true,
                'needs_api_key' => true,
            ];
        }

        return [
            'state' => 'online',
            'provider' => $provider,
            'model' => $targetModel,
            'model_label' => $modelLabel,
            'label' => "{$modelLabel} Active",
            'sublabel' => 'Tool-Calling Online',
            'tooltip' => "{$modelLabel} via Laravel AI SDK is online with read-only database tools".($user?->role === UserRole::Technician ? ' (financial metrics redacted for Technician)' : '.'),
            'is_fallback' => false,
            'needs_api_key' => false,
        ];
    }

    /**
     * Produce a concise human-readable reason explaining why fallback heuristics engaged.
     */
    public function describeFallbackReason(): string
    {
        if ($this->isOfflineForced()) {
            return 'Offline mode active. Deterministic heuristic engine engaged.';
        }

        if ($this->apiKey() === null) {
            return 'GEMINI_API_KEY is not configured. Deterministic heuristic engine engaged.';
        }

        return match ($this->activeFailureState()) {
            'quota_exceeded' => 'Google Gemini API free-tier rate or quota limit active (cooldown). Intelligent deterministic heuristic engine engaged.',
            'auth_invalid' => 'Google Gemini API authentication rejected (401/403). Intelligent deterministic heuristic engine engaged.',
            'service_unavailable' => 'Google Gemini API is temporarily experiencing high demand (HTTP 503). Intelligent deterministic heuristic engine engaged.',
            default => 'Google Gemini API unavailable or rate limited. Intelligent deterministic heuristic engine engaged.',
        };
    }
}
