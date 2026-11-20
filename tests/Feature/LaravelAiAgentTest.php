<?php

namespace Tests\Feature;

use App\Ai\Agents\DeviceSpecIdentificationAgent;
use App\Ai\Agents\ITFleetExtractionAgent;
use App\Services\Ai\GeminiHealthGuard;
use App\Services\GeminiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasProviderOptions;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Exceptions\ProviderOverloadedException;
use Tests\TestCase;

class LaravelAiAgentTest extends TestCase
{
    use RefreshDatabase;

    public function test_itfleet_extraction_agent_implements_required_contracts(): void
    {
        $agent = new ITFleetExtractionAgent;

        $this->assertInstanceOf(Agent::class, $agent);
        $this->assertInstanceOf(HasStructuredOutput::class, $agent);
        $this->assertInstanceOf(HasProviderOptions::class, $agent);
        $this->assertEquals([
            'thinkingConfig' => [
                'thinkingLevel' => 'low',
            ],
        ], $agent->providerOptions('gemini'));
        $this->assertEquals([], $agent->providerOptions('openai'));
        $this->assertStringContainsString('Enterprise IT Asset Management (ITAM)', (string) $agent->instructions());
    }

    public function test_ai_configuration_defaults_to_gemini_4_hydrogen(): void
    {
        $defaultProvider = config('ai.default');
        $geminiConfig = config('ai.providers.gemini');

        $this->assertEquals('gemini', $defaultProvider);
        $this->assertIsArray($geminiConfig);
        $this->assertEquals('gemini', $geminiConfig['driver']);
        $this->assertEquals('gemini-4-hydrogen', $geminiConfig['models']['text']['default']);
        $this->assertEquals('gemini-4-hydrogen', $geminiConfig['models']['text']['cheapest']);
    }

    public function test_gemini_service_uses_cached_demo_template_instantly(): void
    {
        $service = app(GeminiService::class);
        $result = $service->extractRequirements(
            'New senior video editor joining marketing. Needs to edit 4K footage in Premiere/After Effects and travels frequently between shoots.'
        );

        $this->assertEquals('cached_demo', $result['source']);
        $this->assertEquals('high', $result['min_cpu_tier']);
        $this->assertEquals(32, $result['min_ram_gb']);
        $this->assertTrue($result['requires_gpu']);
        $this->assertTrue($result['portability_required']);
    }

    public function test_gemini_service_heuristic_fallback_when_offline(): void
    {
        config()->set('services.gemini.demo_offline', true);

        $service = app(GeminiService::class);
        $result = $service->extractRequirements(
            'We need a powerful desktop workstation for deep learning training with 64GB RAM and CUDA GPU'
        );

        $this->assertEquals('offline_heuristic', $result['source']);
        $this->assertEquals('workstation', $result['min_cpu_tier']);
        $this->assertEquals(64, $result['min_ram_gb']);
        $this->assertTrue($result['requires_gpu']);
        $this->assertFalse($result['portability_required']);
    }

    public function test_gemini_service_extract_requirements_uses_itfleet_extraction_agent(): void
    {
        Cache::flush();

        ITFleetExtractionAgent::fake([[
            'min_cpu_tier' => 'high',
            'min_ram_gb' => 32,
            'min_storage_gb' => 1024,
            'requires_gpu' => true,
            'min_gpu_tier' => 'dedicated-high',
            'portability_required' => false,
            'reasoning' => 'GPU acceleration and 32GB memory required for local CAD rendering.',
        ]]);

        $result = app(GeminiService::class)->extractRequirements(
            'Senior architectural CAD designer running Unreal Engine and Rhino 3D at a fixed desk'
        );

        $this->assertEquals('laravel_ai_gemini', $result['source']);
        $this->assertEquals('gemini-4-hydrogen', $result['model_used']);
        $this->assertEquals('high', $result['min_cpu_tier']);
        $this->assertEquals(32, $result['min_ram_gb']);
        $this->assertEquals('dedicated-high', $result['min_gpu_tier']);
        $this->assertDatabaseHas('match_requests', [
            'extraction_failed' => false,
        ]);

        ITFleetExtractionAgent::assertPrompted(fn ($prompt): bool => $prompt->contains('Unreal Engine'));
    }

    public function test_device_spec_identification_agent_identifies_specs_and_caches(): void
    {
        Cache::flush();

        DeviceSpecIdentificationAgent::fake([[
            'brand' => 'Apple',
            'model' => 'MacBook Pro 16 M4 Max',
            'device_type' => 'laptop',
            'cpu' => 'Apple M4 Max',
            'cpu_tier' => 'high',
            'ram_gb' => 36,
            'storage_type' => 'SSD',
            'storage_gb' => 1024,
            'gpu' => 'Apple 40-core GPU',
            'gpu_tier' => 'dedicated-high',
            'year_acquired' => 2024,
        ]]);

        $service = app(GeminiService::class);
        $first = $service->identifyDeviceSpecs('Apple MacBook Pro 16 M4 Max');

        $this->assertTrue($first['success']);
        $this->assertEquals('gemini_ai', $first['source']);
        $this->assertEquals('Apple', $first['specs']['brand']);
        $this->assertEquals('Apple M4 Max', $first['specs']['cpu']);
        $this->assertEquals(36, $first['specs']['ram_gb']);

        $second = $service->identifyDeviceSpecs('Apple MacBook Pro 16 M4 Max');
        $this->assertEquals('cache', $second['source']);
        $this->assertEquals('Apple M4 Max', $second['specs']['cpu']);

        DeviceSpecIdentificationAgent::assertPrompted(fn ($prompt): bool => $prompt->contains('MacBook Pro 16 M4 Max'));
    }

    public function test_gemini_health_guard_retries_transient_503_and_tracks_circuit_breakers(): void
    {
        Cache::flush();
        $guard = new GeminiHealthGuard;

        $attempts = 0;
        $recovered = $guard->runWithTransientRetry(function () use (&$attempts): string {
            $attempts++;
            if ($attempts === 1) {
                throw new ProviderOverloadedException('HTTP 503 high demand');
            }

            return 'ok';
        }, retryDelayMs: 0);

        $this->assertEquals('ok', $recovered);
        $this->assertEquals(2, $attempts);
        $this->assertFalse($guard->isCircuitOpen());

        $this->assertEquals('quota_exceeded', $guard->recordFailure(429, 'Free tier limit exceeded'));
        $this->assertEquals('quota_exceeded', $guard->activeFailureState());
        $this->assertTrue($guard->isCircuitOpen());

        $guard->clearFailures();
        $this->assertEquals('auth_invalid', $guard->recordFailure(401, 'Invalid API key'));
        $this->assertEquals('auth_invalid', $guard->activeFailureState());

        $guard->clearFailures();
        $this->assertFalse($guard->isCircuitOpen());
    }

    public function test_connectivity_check_uses_gemini_4_hydrogen_and_header_auth(): void
    {
        Cache::flush();
        config()->set('ai.providers.gemini.key', 'test-dummy-key');
        config()->set('services.gemini.api_key', 'test-dummy-key');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:generateContent' => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => 'OK']]]],
                ],
            ], 200),
        ]);

        $result = app(GeminiService::class)->testConnectivity();

        $this->assertTrue($result['success']);
        $this->assertEquals('online', $result['status']);
        $this->assertEquals('gemini-4-hydrogen', $result['model']);
        $this->assertEquals('Gemini 4 Hydrogen', $result['model_label']);
        $this->assertFalse($result['fallback_active']);

        Http::assertSent(function (HttpRequest $request): bool {
            return $request->url() === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:generateContent'
                && $request->header('x-goog-api-key') === ['test-dummy-key']
                && ! str_contains($request->url(), 'key=')
                && ($request['generationConfig']['thinkingConfig']['thinkingLevel'] ?? null) === 'low';
        });
    }
}
