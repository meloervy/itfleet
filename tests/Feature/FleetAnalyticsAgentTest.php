<?php

namespace Tests\Feature;

use App\Ai\Agents\FleetAnalyticsAgent;
use App\Ai\Tools\EmployeeCustodyTool;
use App\Ai\Tools\FleetFinancialsTool;
use App\Ai\Tools\MaintenanceAndWarrantyTool;
use App\Ai\Tools\MismatchAndCapacityTool;
use App\Ai\Tools\SearchDevicesTool;
use App\Ai\Tools\SoftwareLicensesTool;
use App\Models\Device;
use App\Models\SoftwareLicense;
use App\Models\User;
use App\Services\DemoPresetService;
use App\Services\FleetAiAssistantService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Laravel\Ai\Responses\Data\ToolCall;
use Laravel\Ai\Tools\Request as ToolRequest;
use Tests\TestCase;

class FleetAnalyticsAgentTest extends TestCase
{
    use RefreshDatabase;

    public function test_agent_configures_gemini_4_hydrogen_with_thinking_level(): void
    {
        $this->assertEquals('gemini-4-hydrogen', config('ai.providers.gemini.models.text.default'));
        $this->assertEquals('Gemini 4 Hydrogen', app(FleetAiAssistantService::class)->formatModelDisplayName());

        $admin = User::factory()->admin()->create();
        $agent = FleetAnalyticsAgent::make(
            user: $admin,
            pageContext: ['component' => 'Devices/Show', 'entity_type' => 'device', 'entity_id' => 7, 'entity_label' => 'LAP-007'],
            activePresetLabel: 'Small — Manila Digital Studio'
        );

        $this->assertEquals([
            'thinkingConfig' => [
                'thinkingLevel' => 'low',
            ],
        ], $agent->providerOptions('gemini'));

        $this->assertEquals([], $agent->providerOptions('openai'));
        $this->assertStringContainsString('strictly **read-only**', (string) $agent->instructions());
        $this->assertStringContainsString('device ID 7 (LAP-007)', (string) $agent->instructions());
    }

    public function test_live_agent_invokes_real_read_only_tools_and_persists_conversation(): void
    {
        app(DemoPresetService::class)->applyPreset(DemoPresetService::PRESET_SMALL);
        $admin = User::where('email', 'admin@itfleet.local')->firstOrFail();

        FleetAnalyticsAgent::fake([
            new ToolCall('tc-devices-1', 'search_devices', ['status' => 'available', 'device_type' => 'laptop', 'limit' => 5]),
            'We currently have idle laptops staged in the BGC and Eastwood stockrooms.',
        ]);

        $response = $this->actingAs($admin)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'Which laptops are currently idle in stock?',
            'page_context' => ['component' => 'Devices/Index', 'path' => '/devices'],
        ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'category' => 'inventory_availability',
                'ai_status' => [
                    'state' => 'online',
                    'model' => 'gemini-4-hydrogen',
                    'model_label' => 'Gemini 4 Hydrogen',
                ],
            ]);

        $data = $response->json();
        $this->assertNotEmpty($data['conversation_id']);
        $this->assertStringContainsString('idle laptops staged', $data['answer']);
        $this->assertNotEmpty($data['tool_trace']);
        $this->assertEquals('search_devices', $data['tool_trace'][0]['tool']);
        $this->assertNotEmpty($data['data_cards']);
        $this->assertEquals('device', $data['data_cards'][0]['type']);
        $this->assertEquals('available', $data['data_cards'][0]['status']);

        $this->assertDatabaseHas('agent_conversations', [
            'id' => $data['conversation_id'],
            'participant_id' => $admin->id,
        ]);

        $this->assertDatabaseHas('agent_conversation_messages', [
            'conversation_id' => $data['conversation_id'],
            'role' => 'user',
            'content' => 'Which laptops are currently idle in stock?',
        ]);

        $this->assertDatabaseHas('agent_conversation_messages', [
            'conversation_id' => $data['conversation_id'],
            'role' => 'assistant',
        ]);

        FleetAnalyticsAgent::assertPrompted('Which laptops are currently idle in stock?');
    }

    public function test_technician_cannot_access_financial_tool_or_offline_financial_metrics(): void
    {
        app(DemoPresetService::class)->applyPreset(DemoPresetService::PRESET_SMALL);

        $admin = User::where('email', 'admin@itfleet.local')->firstOrFail();
        $manager = User::where('email', 'manager@itfleet.local')->firstOrFail();
        $viewer = User::where('email', 'auditor@itfleet.local')->firstOrFail();
        $tech = User::where('email', 'tech@itfleet.local')->firstOrFail();

        $toolNamesFor = static fn (User $u): array => array_map(
            static fn ($tool): string => $tool->name(),
            [...FleetAnalyticsAgent::make(user: $u)->tools()]
        );

        $this->assertContains('inspect_fleet_financials', $toolNamesFor($admin));
        $this->assertContains('inspect_fleet_financials', $toolNamesFor($manager));
        $this->assertContains('inspect_fleet_financials', $toolNamesFor($viewer));
        $this->assertNotContains('inspect_fleet_financials', $toolNamesFor($tech));

        // Direct tool redaction check for Technician
        $devicesPayload = json_decode((string) (new SearchDevicesTool(canViewFinancials: false))->handle(new ToolRequest(['limit' => 3])), true);
        $this->assertNotEmpty($devicesPayload['records']);
        $this->assertArrayNotHasKey('purchase_cost_php', $devicesPayload['records'][0]);
        $this->assertArrayNotHasKey('current_book_value_php', $devicesPayload['records'][0]);

        $licensesPayload = json_decode((string) (new SoftwareLicensesTool(canViewFinancials: false))->handle(new ToolRequest(['limit' => 3])), true);
        $this->assertNotEmpty($licensesPayload['records']);
        $this->assertArrayNotHasKey('cost_per_seat_php', $licensesPayload['records'][0]);
        $this->assertArrayNotHasKey('annualized_cost_php', $licensesPayload['records'][0]);
        $this->assertArrayNotHasKey('annual_software_spend', $licensesPayload['overview']);

        // Controller context redaction check for Technician
        $techCtx = $this->actingAs($tech)->getJson(route('fleet-assistant.context'));
        $techCtx->assertOk()
            ->assertJsonPath('metrics.financials_restricted', true)
            ->assertJsonMissingPath('metrics.total_acquisition_cost')
            ->assertJsonMissingPath('metrics.current_book_value');

        // Financial query blocked for Technician offline
        $techQuery = $this->actingAs($tech)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'What is our total fleet acquisition cost and current book value?',
        ]);
        $techQuery->assertOk()
            ->assertJson([
                'success' => true,
                'category' => 'access_restricted',
            ]);
        $this->assertStringNotContainsString('₱', $techQuery->json('answer'));
        $this->assertEmpty($techQuery->json('data_cards'));

        // Auditor (viewer) CAN view financials
        $auditorQuery = $this->actingAs($viewer)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'What is our total fleet acquisition cost and current book value?',
        ]);
        $auditorQuery->assertOk()
            ->assertJson([
                'success' => true,
                'category' => 'financials',
            ]);
        $this->assertStringContainsString('₱', $auditorQuery->json('answer'));
    }

    public function test_all_read_only_tools_return_live_data_for_small_preset(): void
    {
        app(DemoPresetService::class)->applyPreset(DemoPresetService::PRESET_SMALL);

        $devices = json_decode((string) (new SearchDevicesTool(true))->handle(new ToolRequest(['device_type' => 'monitor'])), true);
        $this->assertEquals(6, $devices['matched_count']);
        $this->assertEquals(37, $devices['fleet_totals']['total_devices']);

        $custody = json_decode((string) (new EmployeeCustodyTool(true))->handle(new ToolRequest(['query' => 'Aaron Creed'])), true);
        $this->assertEquals(1, $custody['matched_count']);
        $this->assertNotNull($custody['records'][0]['primary_compute_device']);
        $this->assertNotEmpty($custody['records'][0]['secondary_hardware']);
        $this->assertNotEmpty($custody['records'][0]['assigned_licenses']);

        $licenses = json_decode((string) (new SoftwareLicensesTool(true))->handle(new ToolRequest([])), true);
        $this->assertEquals(6, $licenses['overview']['total_licenses']);
        $this->assertArrayHasKey('annual_software_spend', $licenses['overview']);

        $maint = json_decode((string) (new MaintenanceAndWarrantyTool(true))->handle(new ToolRequest(['focus' => 'all'])), true);
        $this->assertGreaterThan(0, count($maint['maintenance_logs']));
        $this->assertGreaterThan(0, $maint['expiring_warranties_count']);

        $mismatch = json_decode((string) (new MismatchAndCapacityTool)->handle(new ToolRequest([])), true);
        $this->assertEquals(3, $mismatch['total_mismatches']);

        $financials = json_decode((string) (new FleetFinancialsTool)->handle(new ToolRequest(['breakdown_by' => 'overview'])), true);
        $this->assertGreaterThan(0, $financials['hardware_financials']['total_acquisition_cost']);
        $this->assertGreaterThan(0, $financials['software_spend']['annual_software_spend_php']);
    }

    public function test_page_context_grounds_device_questions_in_offline_mode(): void
    {
        app(DemoPresetService::class)->applyPreset(DemoPresetService::PRESET_SMALL);
        $admin = User::where('email', 'admin@itfleet.local')->firstOrFail();
        $monitor = Device::where('asset_tag', 'MON-001')->firstOrFail();

        $response = $this->actingAs($admin)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'Tell me the status and specs of this device',
            'page_context' => [
                'component' => 'Devices/Show',
                'path' => "/devices/{$monitor->id}",
                'entity_type' => 'device',
                'entity_id' => $monitor->id,
                'entity_label' => "{$monitor->asset_tag} ({$monitor->brand} {$monitor->model})",
            ],
        ]);

        $response->assertOk()
            ->assertJson(['success' => true]);

        $data = $response->json();
        $this->assertStringContainsString('MON-001', $data['answer']);
        $this->assertStringContainsString('UltraSharp U2723QE', $data['answer']);
        $this->assertEquals('MON-001', $data['data_cards'][0]['asset_tag']);
    }

    public function test_software_license_and_non_compute_queries_resolve_dynamically_offline(): void
    {
        app(DemoPresetService::class)->applyPreset(DemoPresetService::PRESET_SMALL);
        $admin = User::where('email', 'admin@itfleet.local')->firstOrFail();

        $licResponse = $this->actingAs($admin)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'Show software license seat utilization and upcoming renewals',
        ]);

        $licResponse->assertOk()
            ->assertJson([
                'success' => true,
                'category' => 'software_licenses',
            ]);

        $licData = $licResponse->json();
        $this->assertStringContainsString('Microsoft 365 Business Premium', $licData['answer']);
        $this->assertStringContainsString('Figma Organization', $licData['answer']);
        $this->assertEquals('license', $licData['data_cards'][0]['type']);
        $this->assertEquals('inspect_software_licenses', $licData['tool_trace'][0]['tool']);

        $expiringLicResponse = $this->actingAs($admin)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'Which software licenses are expiring soon?',
        ]);
        $expiringLicResponse->assertOk();
        $this->assertStringContainsString('Figma Organization', $expiringLicResponse->json('answer'));
        $this->assertStringNotContainsString('Slack Pro Workspace', $expiringLicResponse->json('answer'));

        $monResponse = $this->actingAs($admin)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'How many monitors do we have in inventory?',
        ]);

        $monResponse->assertOk()
            ->assertJson(['success' => true]);
        $this->assertStringContainsString('6 monitor assets', $monResponse->json('answer'));
        $this->assertNotEmpty($monResponse->json('data_cards'));
    }

    public function test_conversation_threads_are_persisted_user_isolated_and_cleared_on_preset_switch(): void
    {
        config()->set('itam.demo_mode', true);
        app(DemoPresetService::class)->applyPreset(DemoPresetService::PRESET_SMALL);

        $admin = User::where('email', 'admin@itfleet.local')->firstOrFail();
        $tech = User::where('email', 'tech@itfleet.local')->firstOrFail();

        // 1. Start a thread offline and continue it
        $turn1 = $this->actingAs($admin)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'How many idle devices do we currently have in inventory?',
        ]);
        $turn1->assertOk();
        $convId = $turn1->json('conversation_id');
        $this->assertNotEmpty($convId);

        $turn2 = $this->actingAs($admin)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'Show software license seat utilization',
            'conversation_id' => $convId,
        ]);
        $turn2->assertOk()->assertJsonPath('conversation_id', $convId);

        // 2. Owner can list & load hydrated thread with tool traces + cards
        $list = $this->actingAs($admin)->getJson(route('fleet-assistant.conversations.index'));
        $list->assertOk()->assertJsonCount(1, 'conversations');

        $show = $this->actingAs($admin)->getJson(route('fleet-assistant.conversations.show', ['conversationId' => $convId]));
        $show->assertOk()->assertJsonCount(4, 'messages');
        $this->assertNotEmpty($show->json('messages.1.tool_trace'));

        // 3. Another user gets 404 on read or delete
        $this->actingAs($tech)->getJson(route('fleet-assistant.conversations.show', ['conversationId' => $convId]))->assertNotFound();
        $this->actingAs($tech)->deleteJson(route('fleet-assistant.conversations.destroy', ['conversationId' => $convId]))->assertNotFound();

        // 4. Owner can delete thread
        $this->actingAs($admin)->deleteJson(route('fleet-assistant.conversations.destroy', ['conversationId' => $convId]))
            ->assertOk()
            ->assertJson(['deleted' => true]);
        $this->assertEquals(0, DB::table('agent_conversations')->count());

        // 5. Preset switch clears stale conversation threads cleanly
        $turn3 = $this->actingAs($admin)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'How many devices are there in a company?',
        ]);
        $this->assertNotEmpty($turn3->json('conversation_id'));
        $this->assertGreaterThan(0, DB::table('agent_conversations')->count());

        app(DemoPresetService::class)->applyPreset(DemoPresetService::PRESET_SMALL);
        $this->assertEquals(0, DB::table('agent_conversations')->count());
        $this->assertEquals(0, DB::table('agent_conversation_messages')->count());
        $this->assertEquals(6, SoftwareLicense::count());
    }

    public function test_free_tier_first_turn_response_cache_avoids_duplicate_gemini_calls_and_invalidates_on_db_change(): void
    {
        Cache::flush();
        app(DemoPresetService::class)->applyPreset(DemoPresetService::PRESET_SMALL);
        $admin = User::where('email', 'admin@itfleet.local')->firstOrFail();

        FleetAnalyticsAgent::fake([
            'First live answer about fleet inventory.',
            'Second live answer after new device added.',
        ]);

        $first = $this->actingAs($admin)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'Summarize current fleet inventory',
        ]);

        $first->assertOk()
            ->assertJson([
                'success' => true,
                'answer' => 'First live answer about fleet inventory.',
            ]);
        $this->assertNull($first->json('cache_hit'));

        // Identical first-turn query hits response cache instead of spending free-tier quota
        $second = $this->actingAs($admin)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'Summarize current fleet inventory',
        ]);

        $second->assertOk()
            ->assertJson([
                'success' => true,
                'answer' => 'First live answer about fleet inventory.',
                'cache_hit' => true,
            ]);
        $this->assertNotEmpty($second->json('conversation_id'));

        // Mutate fleet data so fingerprint invalidates cache cleanly
        Device::create([
            'asset_tag' => 'LAP-CACHE-999',
            'device_type' => 'laptop',
            'brand' => 'Lenovo',
            'model' => 'ThinkPad T14',
            'cpu' => 'AMD Ryzen 7',
            'cpu_tier' => 'high',
            'ram_gb' => 32,
            'storage_type' => 'SSD',
            'storage_gb' => 512,
            'gpu_tier' => 'integrated',
            'year_acquired' => 2025,
            'condition' => 'excellent',
            'status' => 'available',
        ]);

        $third = $this->actingAs($admin)->postJson(route('fleet-assistant.query'), [
            'prompt' => 'Summarize current fleet inventory',
        ]);

        $third->assertOk()
            ->assertJson([
                'success' => true,
                'answer' => 'Second live answer after new device added.',
            ]);
        $this->assertNull($third->json('cache_hit'));
    }
}
