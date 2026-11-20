<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Services\FleetAiAssistantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FleetAssistantController extends Controller
{
    public function __construct(
        protected FleetAiAssistantService $assistantService,
    ) {}

    /**
     * Process a natural language read-only analytics query for the Fleet Assistant.
     */
    public function query(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string', 'max:1000'],
            'conversation_id' => ['nullable', 'string', 'max:64'],
            'page_context' => ['nullable', 'array'],
            'page_context.path' => ['nullable', 'string', 'max:255'],
            'page_context.component' => ['nullable', 'string', 'max:120'],
            'page_context.active_preset' => ['nullable', 'string', 'max:40'],
            'page_context.entity_type' => ['nullable', 'string', 'max:40'],
            'page_context.entity_id' => ['nullable', 'integer'],
            'page_context.entity_label' => ['nullable', 'string', 'max:200'],
            'page_context.filters' => ['nullable', 'array'],
            'history' => ['nullable', 'array', 'max:12'],
            'history.*.role' => ['required', 'string', 'in:user,assistant,model'],
            'history.*.content' => ['required', 'string', 'max:50000'],
        ]);

        $user = $request->user();
        $history = $validated['history'] ?? [];
        $conversationId = $validated['conversation_id'] ?? null;
        $pageContext = $validated['page_context'] ?? [];

        $result = $this->assistantService->handleQuery(
            $validated['prompt'],
            $user,
            $history,
            $conversationId,
            $pageContext,
        );

        return response()->json($result);
    }

    /**
     * Provide initial context, role-appropriate follow-ups, AI model status, and recent threads.
     */
    public function context(Request $request): JsonResponse
    {
        $user = $request->user();
        $snapshot = $this->assistantService->aggregateContextSnapshot();
        $metrics = $snapshot['metrics'];

        if ($user && $user->role === UserRole::Technician) {
            unset(
                $metrics['total_acquisition_cost'],
                $metrics['current_book_value'],
                $metrics['accumulated_depreciation']
            );
            $metrics['financials_restricted'] = true;
        } else {
            $metrics['financials_restricted'] = false;
        }

        return response()->json([
            'metrics' => $metrics,
            'starter_followups' => $this->assistantService->getDefaultFollowups($user),
            'ai_status' => $this->assistantService->getAiStatus($user),
            'conversations' => $user ? $this->assistantService->listConversations($user) : [],
        ]);
    }

    /**
     * List persisted conversations owned by the authenticated user.
     */
    public function conversations(Request $request): JsonResponse
    {
        return response()->json([
            'conversations' => $this->assistantService->listConversations($request->user()),
        ]);
    }

    /**
     * Fetch messages for a single persisted conversation belonging to the authenticated user.
     */
    public function showConversation(Request $request, string $conversationId): JsonResponse
    {
        $payload = $this->assistantService->getConversationMessages($request->user(), $conversationId);
        if ($payload === null) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        }

        return response()->json($payload);
    }

    /**
     * Delete a persisted conversation belonging to the authenticated user.
     */
    public function destroyConversation(Request $request, string $conversationId): JsonResponse
    {
        $deleted = $this->assistantService->deleteConversation($request->user(), $conversationId);
        if (! $deleted) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        }

        return response()->json(['deleted' => true]);
    }
}
