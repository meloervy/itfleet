<?php

namespace App\Services;

use App\Ai\Agents\FleetAnalyticsAgent;
use App\Enums\UserRole;
use App\Models\Assignment;
use App\Models\Device;
use App\Models\Employee;
use App\Models\MaintenanceLog;
use App\Models\SoftwareLicense;
use App\Models\User;
use App\Services\Ai\GeminiHealthGuard;
use App\Services\FleetAssistant\DeterministicFleetQueryResolver;
use App\Services\FleetAssistant\FleetContextBuilder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Ai\Contracts\ConversationStore;
use Laravel\Ai\Models\Conversation;
use Laravel\Ai\Models\ConversationMessage;
use Laravel\Ai\Responses\AgentResponse;
use Throwable;

class FleetAiAssistantService
{
    private const TOOL_LABELS = [
        'search_devices' => 'Search Devices',
        'inspect_employee_custody' => 'Employee Custody',
        'inspect_software_licenses' => 'Software Licenses',
        'inspect_maintenance_and_warranties' => 'Maintenance & Warranties',
        'inspect_mismatches_and_capacity' => 'Mismatches & Stock',
        'inspect_fleet_financials' => 'Fleet Financials',
    ];

    private readonly FleetContextBuilder $contextBuilder;

    private readonly DeterministicFleetQueryResolver $queryResolver;

    private readonly GeminiHealthGuard $healthGuard;

    public function __construct(
        protected MatchingService $matchingService,
        ?FleetContextBuilder $contextBuilder = null,
        ?DeterministicFleetQueryResolver $queryResolver = null,
        ?GeminiHealthGuard $healthGuard = null,
    ) {
        $this->contextBuilder = $contextBuilder ?? new FleetContextBuilder($matchingService);
        $this->queryResolver = $queryResolver ?? new DeterministicFleetQueryResolver($this->contextBuilder);
        $this->healthGuard = $healthGuard ?? new GeminiHealthGuard;
    }

    /**
     * Format a Gemini model identifier into a concise display label.
     */
    public function formatModelDisplayName(?string $model = null): string
    {
        return $this->healthGuard->modelLabel($model);
    }

    /**
     * Get the passive runtime status of the AI Fleet Assistant without external HTTP probing.
     *
     * @return array<string, mixed>
     */
    public function getAiStatus(?User $user = null): array
    {
        return $this->healthGuard->getStatus($user, FleetAnalyticsAgent::isFaked());
    }

    /**
     * @return array<string, mixed>
     */
    public function getCachedFleetCatalog(bool $fresh = false): array
    {
        return $this->contextBuilder->getCachedFleetCatalog($fresh);
    }

    /**
     * @return array<string, mixed>
     */
    public function aggregateContextSnapshot(): array
    {
        return $this->contextBuilder->aggregateContextSnapshot();
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @param  array<string, mixed>  $catalog
     * @return array<string, mixed>
     */
    public function buildLiveContextPayload(array $snapshot, array $catalog): array
    {
        return $this->contextBuilder->buildLiveContextPayload($snapshot, $catalog);
    }

    /**
     * Sanitize user prompt to prevent delimiter breaking and control character injection.
     */
    public function sanitizePrompt(string $input): string
    {
        $truncated = mb_substr(trim($input), 0, 1500);
        $clean = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $truncated);

        return str_replace(['```', '`'], ["'''", "'"], $clean);
    }

    /**
     * Handle a read-only analytical query through Laravel AI tool calling with deterministic fallback.
     *
     * @param  array<int, array<string, mixed>>  $history
     * @param  array<string, mixed>  $pageContext
     * @return array<string, mixed>
     */
    public function handleQuery(
        string $userPrompt,
        User|int $userOrId,
        array $history = [],
        ?string $conversationId = null,
        array $pageContext = [],
    ): array {
        $user = $userOrId instanceof User ? $userOrId : User::find($userOrId);
        $prompt = $this->sanitizePrompt($userPrompt);

        if ($prompt === '') {
            return [
                'success' => false,
                'answer' => 'Please provide a question or search query regarding hardware inventory, employee custody, software licenses, maintenance, or mismatches.',
                'category' => 'general_itam',
                'data_cards' => [],
                'tool_trace' => [],
                'conversation_id' => $conversationId,
                'suggested_followups' => $this->getDefaultFollowups($user),
                'ai_status' => $this->getAiStatus($user),
            ];
        }

        $verifiedConversationId = ($user && $conversationId)
            ? $this->verifyOwnedConversationId($user, $conversationId)
            : null;

        $isFaked = FleetAnalyticsAgent::isFaked();
        $canUseLiveAi = $user !== null && $this->healthGuard->canCallLiveApi($isFaked);

        $isFirstTurnStateless = $canUseLiveAi
            && $verifiedConversationId === null
            && empty($history);

        $responseCacheKey = $isFirstTurnStateless
            ? $this->buildQueryCacheKey($prompt, $user, $pageContext)
            : null;

        if ($responseCacheKey !== null && is_array($cachedReply = Cache::get($responseCacheKey))) {
            $cachedReply['conversation_id'] = Schema::hasTable($this->conversationsTable())
                ? $this->persistConversationTurn($user, null, $prompt, $cachedReply)
                : null;
            $cachedReply['cache_hit'] = true;
            $cachedReply['ai_status'] = $this->getAiStatus($user);

            return $cachedReply;
        }

        if ($canUseLiveAi) {
            try {
                $liveResult = $this->runLiveAnalyticsAgent($prompt, $user, $verifiedConversationId, $pageContext);
                if ($liveResult !== null) {
                    if ($responseCacheKey !== null && ! empty($liveResult['success'])) {
                        Cache::put($responseCacheKey, [
                            'success' => true,
                            'answer' => $liveResult['answer'],
                            'category' => $liveResult['category'],
                            'source' => $liveResult['source'],
                            'model_label' => $liveResult['model_label'] ?? $this->formatModelDisplayName(),
                            'tool_trace' => $liveResult['tool_trace'] ?? [],
                            'data_cards' => $liveResult['data_cards'] ?? [],
                            'suggested_followups' => $liveResult['suggested_followups'] ?? [],
                        ], now()->addMinutes(10));
                    }

                    return $liveResult;
                }
            } catch (Throwable $e) {
                Log::warning('FleetAiAssistantService: Laravel AI agent invocation failed, falling back to Local DB Engine: '.$e->getMessage());
            }
        }

        $effectiveHistory = $history;
        if (empty($effectiveHistory) && $verifiedConversationId !== null) {
            $effectiveHistory = $this->loadConversationHistoryArray($verifiedConversationId);
        }

        $snapshot = $this->aggregateContextSnapshot();
        $catalog = $this->getCachedFleetCatalog(true);

        $fallback = $this->executeDeterministicFallback($prompt, $snapshot, $catalog, $effectiveHistory, $user, $pageContext);
        $fallback['source'] = 'local_db_engine';
        $fallback['tool_trace'] = $fallback['tool_trace'] ?? [[
            'tool' => 'local_db_engine',
            'label' => 'Local DB Engine',
            'summary' => 'Direct live DB query',
            'mode' => 'local_db',
        ]];

        if ($user && Schema::hasTable($this->conversationsTable())) {
            $savedConvId = $this->persistConversationTurn($user, $verifiedConversationId, $prompt, $fallback);
            $fallback['conversation_id'] = $savedConvId;
        } else {
            $fallback['conversation_id'] = $verifiedConversationId;
        }

        $fallback['ai_status'] = $this->getAiStatus($user);

        return $fallback;
    }

    /**
     * Execute deterministic fallback resolver for offline / degraded environments.
     *
     * @param  array<string, mixed>  $snapshot
     * @param  array<string, mixed>|null  $catalog
     * @param  array<int, array<string, mixed>>  $history
     * @param  array<string, mixed>  $pageContext
     * @return array<string, mixed>
     */
    public function executeDeterministicFallback(
        string $prompt,
        array $snapshot,
        ?array $catalog = null,
        array $history = [],
        ?User $user = null,
        array $pageContext = [],
    ): array {
        return $this->queryResolver->resolve($prompt, $snapshot, $catalog, $history, $user, $pageContext);
    }

    /**
     * @return list<string>
     */
    public function getDefaultFollowups(?User $user = null): array
    {
        return $this->queryResolver->getDefaultFollowups($user);
    }

    /**
     * List persisted conversations belonging exclusively to the given user.
     *
     * @return list<array<string, mixed>>
     */
    public function listConversations(User $user, int $limit = 20): array
    {
        if (! Schema::hasTable($this->conversationsTable())) {
            return [];
        }

        $participantType = Conversation::participantType($user);
        $participantId = Conversation::participantKey($user);

        return Conversation::query()
            ->where('participant_type', $participantType)
            ->where('participant_id', $participantId)
            ->withCount('messages')
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get()
            ->map(fn (Conversation $c): array => [
                'id' => $c->id,
                'title' => $c->title,
                'messages_count' => (int) ($c->messages_count ?? 0),
                'updated_at' => $c->updated_at?->toIso8601String(),
                'updated_label' => $c->updated_at?->diffForHumans(),
            ])
            ->values()
            ->all();
    }

    /**
     * Load a single conversation and its messages strictly owned by the participant.
     *
     * @return array<string, mixed>|null
     */
    public function getConversationMessages(User $user, string $conversationId): ?array
    {
        if (! Schema::hasTable($this->conversationsTable())) {
            return null;
        }

        $conversation = Conversation::query()
            ->where('id', $conversationId)
            ->where('participant_type', Conversation::participantType($user))
            ->where('participant_id', Conversation::participantKey($user))
            ->first();

        if (! $conversation) {
            return null;
        }

        $rows = ConversationMessage::query()
            ->where('conversation_id', $conversation->id)
            ->whereIn('role', ['user', 'assistant'])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $messages = $rows->map(function (ConversationMessage $row): array {
            $meta = is_array($row->meta) ? $row->meta : [];
            $isUser = $row->role === 'user';

            return [
                'id' => $row->id,
                'sender' => $isUser ? 'user' : 'assistant',
                'text' => $isUser ? $row->content : null,
                'answer' => $isUser ? null : $row->content,
                'category' => $meta['category'] ?? 'general_itam',
                'source' => $meta['source'] ?? $this->healthGuard->model(),
                'tool_trace' => $meta['tool_trace'] ?? [],
                'data_cards' => $meta['data_cards'] ?? [],
                'suggested_followups' => $meta['suggested_followups'] ?? [],
                'timestamp' => $row->created_at?->format('H:i') ?? '',
            ];
        })->values()->all();

        return [
            'conversation' => [
                'id' => $conversation->id,
                'title' => $conversation->title,
                'updated_at' => $conversation->updated_at?->toIso8601String(),
            ],
            'messages' => $messages,
        ];
    }

    /**
     * Delete a persisted conversation owned by the participant.
     */
    public function deleteConversation(User $user, string $conversationId): bool
    {
        if (! Schema::hasTable($this->conversationsTable())) {
            return false;
        }

        $conversation = Conversation::query()
            ->where('id', $conversationId)
            ->where('participant_type', Conversation::participantType($user))
            ->where('participant_id', Conversation::participantKey($user))
            ->first();

        if (! $conversation) {
            return false;
        }

        DB::table($this->messagesTable())
            ->where('conversation_id', $conversation->id)
            ->delete();

        $conversation->delete();

        return true;
    }

    /**
     * Execute the tool-calling Laravel AI agent and normalize structured traces & cards.
     *
     * @param  array<string, mixed>  $pageContext
     * @return array<string, mixed>|null
     */
    protected function runLiveAnalyticsAgent(string $prompt, User $user, ?string $conversationId, array $pageContext): ?array
    {
        $presetMeta = DemoPresetService::presets()[app(DemoPresetService::class)->getActivePreset()] ?? null;
        $presetLabel = $presetMeta ? "{$presetMeta['label']} — {$presetMeta['company_name']}" : '';

        $agent = FleetAnalyticsAgent::make(
            user: $user,
            pageContext: $pageContext,
            activePresetLabel: $presetLabel,
        );

        if ($conversationId !== null) {
            $agent->continue($conversationId, $user);
        } elseif (Schema::hasTable($this->conversationsTable())) {
            $agent->forUser($user);
        }

        $retryDelayMs = FleetAnalyticsAgent::isFaked() ? 0 : 450;

        /** @var AgentResponse $response */
        $response = $this->healthGuard->runWithTransientRetry(
            fn (): AgentResponse => $agent->prompt($prompt),
            retryDelayMs: $retryDelayMs,
        );

        $answer = trim((string) $response->text);
        if ($answer === '') {
            return null;
        }

        [$toolTrace, $cards, $inferredCategory] = $this->extractToolsAndCardsFromResponse($response);

        $usedModel = $response->meta->model ?: $this->healthGuard->model();
        $followups = $this->followupsForCategory($inferredCategory, $user);
        $resolvedConversationId = $response->conversationId ?? $agent->currentConversation();

        if ($resolvedConversationId && Schema::hasTable($this->messagesTable())) {
            $this->enrichLatestAssistantMessageMeta($resolvedConversationId, [
                'category' => $inferredCategory,
                'source' => $usedModel,
                'tool_trace' => $toolTrace,
                'data_cards' => $cards,
                'suggested_followups' => $followups,
            ]);
        }

        return [
            'success' => true,
            'answer' => $answer,
            'category' => $inferredCategory,
            'source' => $usedModel,
            'model_label' => $this->formatModelDisplayName($usedModel),
            'conversation_id' => $resolvedConversationId,
            'tool_trace' => $toolTrace,
            'data_cards' => $cards,
            'suggested_followups' => $followups,
            'ai_status' => $this->getAiStatus($user),
        ];
    }

    /**
     * Pair tool calls & results from AgentResponse into trace pills + verified UI cards.
     *
     * @return array{0: list<array<string, mixed>>, 1: list<array<string, mixed>>, 2: string}
     */
    protected function extractToolsAndCardsFromResponse(AgentResponse $response): array
    {
        $resultsById = [];
        foreach ($response->toolResults as $res) {
            $resultsById[$res->id] = $res;
        }

        $trace = [];
        $cards = [];
        $seenCardKeys = [];
        $toolNames = [];

        foreach ($response->toolCalls as $call) {
            $toolNames[] = $call->name;
            $label = self::TOOL_LABELS[$call->name] ?? ucwords(str_replace('_', ' ', $call->name));
            $res = $resultsById[$call->id] ?? null;

            $decoded = null;
            if ($res && is_string($res->result)) {
                $decoded = json_decode($res->result, true);
            } elseif ($res && is_array($res->result)) {
                $decoded = $res->result;
            }

            $summary = is_array($decoded) && ! empty($decoded['summary_label'])
                ? (string) $decoded['summary_label']
                : 'Executed';

            $trace[] = [
                'tool' => $call->name,
                'label' => $label,
                'summary' => $summary,
                'mode' => 'agent_tool',
            ];

            if (is_array($decoded) && ! empty($decoded['cards']) && is_array($decoded['cards'])) {
                foreach ($decoded['cards'] as $card) {
                    if (! is_array($card) || count($cards) >= 6) {
                        continue;
                    }
                    $key = ($card['type'] ?? 'item').':'.($card['id'] ?? $card['asset_tag'] ?? $card['name'] ?? uniqid());
                    if (! isset($seenCardKeys[$key])) {
                        $seenCardKeys[$key] = true;
                        $cards[] = $card;
                    }
                }
            }
        }

        $category = match (true) {
            in_array('inspect_fleet_financials', $toolNames, true) => 'financials',
            in_array('inspect_software_licenses', $toolNames, true) => 'software_licenses',
            in_array('inspect_mismatches_and_capacity', $toolNames, true) => 'fleet_mismatches',
            in_array('inspect_maintenance_and_warranties', $toolNames, true) => 'maintenance_health',
            in_array('search_devices', $toolNames, true) || in_array('inspect_employee_custody', $toolNames, true) => 'inventory_availability',
            default => 'general_itam',
        };

        return [$trace, $cards, $category];
    }

    /**
     * Persist user + assistant messages in Laravel AI conversation tables.
     *
     * @param  array<string, mixed>  $result
     */
    protected function persistConversationTurn(User $user, ?string $conversationId, string $prompt, array $result): string
    {
        /** @var ConversationStore $store */
        $store = app(ConversationStore::class);
        $participantType = Conversation::participantType($user);
        $participantId = Conversation::participantKey($user);

        if ($conversationId === null) {
            $title = Str::limit($prompt, 60, preserveWords: true);
            $conversationId = $store->storeConversation($participantType, $participantId, $title);
        }

        $now = now();
        $msgTable = $this->messagesTable();

        DB::table($msgTable)->insert([
            'id' => (string) Str::uuid7(),
            'conversation_id' => $conversationId,
            'participant_type' => $participantType,
            'participant_id' => $participantId,
            'agent' => FleetAnalyticsAgent::class,
            'role' => 'user',
            'content' => $prompt,
            'attachments' => '[]',
            'tool_calls' => '[]',
            'tool_results' => '[]',
            'usage' => '[]',
            'meta' => '[]',
            'approval_state' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table($msgTable)->insert([
            'id' => (string) Str::uuid7(),
            'conversation_id' => $conversationId,
            'participant_type' => $participantType,
            'participant_id' => $participantId,
            'agent' => FleetAnalyticsAgent::class,
            'role' => 'assistant',
            'content' => (string) ($result['answer'] ?? ''),
            'attachments' => '[]',
            'tool_calls' => '[]',
            'tool_results' => '[]',
            'usage' => '[]',
            'meta' => (string) json_encode([
                'category' => $result['category'] ?? 'general_itam',
                'source' => $result['source'] ?? 'local_db_engine',
                'tool_trace' => $result['tool_trace'] ?? [],
                'data_cards' => $result['data_cards'] ?? [],
                'suggested_followups' => $result['suggested_followups'] ?? [],
            ]),
            'approval_state' => null,
            'created_at' => $now->copy()->addMillisecond(),
            'updated_at' => $now->copy()->addMillisecond(),
        ]);

        DB::table($this->conversationsTable())
            ->where('id', $conversationId)
            ->update(['updated_at' => $now]);

        return $conversationId;
    }

    /**
     * Save normalized UI metadata onto the latest stored assistant message for thread reload fidelity.
     *
     * @param  array<string, mixed>  $meta
     */
    protected function enrichLatestAssistantMessageMeta(string $conversationId, array $meta): void
    {
        $latestAssistant = ConversationMessage::query()
            ->where('conversation_id', $conversationId)
            ->where('role', 'assistant')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();

        if ($latestAssistant) {
            $existingMeta = is_array($latestAssistant->meta) ? $latestAssistant->meta : [];
            $latestAssistant->update([
                'meta' => array_merge($existingMeta, $meta),
            ]);
        }
    }

    /**
     * @return list<array<string, string>>
     */
    protected function loadConversationHistoryArray(string $conversationId): array
    {
        if (! Schema::hasTable($this->messagesTable())) {
            return [];
        }

        return ConversationMessage::query()
            ->where('conversation_id', $conversationId)
            ->whereIn('role', ['user', 'assistant'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->reverse()
            ->map(fn (ConversationMessage $m): array => [
                'role' => $m->role,
                'content' => $m->content,
            ])
            ->values()
            ->all();
    }

    protected function verifyOwnedConversationId(User $user, string $conversationId): ?string
    {
        if (! Schema::hasTable($this->conversationsTable())) {
            return null;
        }

        $exists = Conversation::query()
            ->where('id', $conversationId)
            ->where('participant_type', Conversation::participantType($user))
            ->where('participant_id', Conversation::participantKey($user))
            ->exists();

        return $exists ? $conversationId : null;
    }

    /**
     * @return list<string>
     */
    protected function followupsForCategory(string $category, User $user): array
    {
        if ($user->role === UserRole::Technician) {
            return $this->getDefaultFollowups($user);
        }

        return match ($category) {
            'software_licenses' => [
                'Which software licenses are expiring soon?',
                'Which employees are using low end specs?',
                'What is our total fleet acquisition cost and current book value?',
            ],
            'fleet_mismatches' => [
                'Who is using the high end desktop?',
                'How many idle devices do we currently have in inventory?',
                'Show software license seat utilization and upcoming renewals',
            ],
            'financials' => [
                'Show software license seat utilization and upcoming renewals',
                'Which employees are using low end specs?',
                'How many idle devices do we currently have in inventory?',
            ],
            default => $this->getDefaultFollowups($user),
        };
    }

    /**
     * Build a deterministic free-tier cache key scoped by prompt, RBAC role, preset, page context, and DB state.
     *
     * @param  array<string, mixed>  $pageContext
     */
    protected function buildQueryCacheKey(string $prompt, User $user, array $pageContext): string
    {
        $preset = app(DemoPresetService::class)->getActivePreset();
        $role = $user->role?->value ?? 'viewer';
        $normalizedPrompt = preg_replace('/\s+/', ' ', strtolower(trim($prompt))) ?? strtolower(trim($prompt));
        $fingerprint = $this->buildFleetDataFingerprint();

        return 'fleet_ai_reply_'.md5(implode('|', [
            $normalizedPrompt,
            $role,
            $preset,
            (string) json_encode($pageContext),
            $fingerprint,
        ]));
    }

    /**
     * Compute a lightweight database mutation fingerprint so cached analytics replies stay accurate.
     */
    protected function buildFleetDataFingerprint(): string
    {
        $parts = [];
        foreach ([Device::class, Employee::class, SoftwareLicense::class, MaintenanceLog::class] as $modelClass) {
            $stats = $modelClass::query()
                ->selectRaw('COUNT(*) as total_count, MAX(id) as max_id, MAX(updated_at) as last_updated')
                ->first();
            $parts[] = ($stats?->total_count ?? 0).':'.($stats?->max_id ?? 0).':'.($stats?->last_updated ?? '0');
        }

        $parts[] = 'avail:'.Device::where('status', 'available')->count();

        $assignStats = Assignment::query()
            ->selectRaw('COUNT(*) as total_count, MAX(id) as max_id, MAX(updated_at) as last_updated, SUM(CASE WHEN unassigned_at IS NULL THEN 1 ELSE 0 END) as active_count')
            ->first();
        $parts[] = ($assignStats?->total_count ?? 0).':'.($assignStats?->max_id ?? 0).':'.($assignStats?->last_updated ?? '0').':'.($assignStats?->active_count ?? 0);

        return md5(implode('|', $parts));
    }

    protected function conversationsTable(): string
    {
        return (string) config('ai.conversations.tables.conversations', 'agent_conversations');
    }

    protected function messagesTable(): string
    {
        return (string) config('ai.conversations.tables.messages', 'agent_conversation_messages');
    }
}
