<?php

namespace App\Ai\Tools;

use App\Models\SoftwareLicense;
use App\Services\ItamTrackingService;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class SoftwareLicensesTool implements Tool
{
    public function __construct(
        private readonly bool $canViewFinancials = true,
    ) {}

    public function name(): string
    {
        return 'inspect_software_licenses';
    }

    /**
     * Get the description of the tool's purpose.
     */
    public function description(): Stringable|string
    {
        return 'Inspect software licenses and SaaS subscriptions: total and available seats, seat utilization, assigned staff, and upcoming renewals.';
    }

    /**
     * Execute the read-only software license query.
     */
    public function handle(Request $request): Stringable|string
    {
        $limit = max(1, min(25, (int) ($request['limit'] ?? 12)));
        $search = trim((string) ($request['query'] ?? ''));

        $baseQuery = SoftwareLicense::withCount('activeAssignments')
            ->with(['activeAssignments.employee']);

        if (! empty($request['license_id'])) {
            $baseQuery->where('id', (int) $request['license_id']);
        }
        if ($search !== '') {
            $baseQuery->where(function ($q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('vendor', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%");
            });
        }
        if (! empty($request['category'])) {
            $baseQuery->where('category', strtolower((string) $request['category']));
        }
        if (! empty($request['status'])) {
            $baseQuery->where('status', strtolower((string) $request['status']));
        }
        if (! empty($request['expiring_within_days'])) {
            $days = max(1, (int) $request['expiring_within_days']);
            $baseQuery->whereNotNull('renewal_date')
                ->whereDate('renewal_date', '<=', now()->addDays($days)->toDateString())
                ->whereDate('renewal_date', '>=', now()->toDateString());
        }

        $matchedCount = (clone $baseQuery)->count();
        $licenses = (clone $baseQuery)->orderBy('name')->limit($limit)->get();

        $summary = app(ItamTrackingService::class)->getSoftwareLicenseSummary();
        if (! $this->canViewFinancials) {
            unset($summary['annual_software_spend']);
            $summary['financials_redacted'] = true;
        }

        $records = [];
        $cards = [];

        foreach ($licenses as $license) {
            $assignedSeats = (int) $license->active_assignments_count;
            $availableSeats = max(0, (int) $license->total_seats - $assignedSeats);
            $utilPct = $license->total_seats > 0
                ? round(($assignedSeats / $license->total_seats) * 100, 1)
                : 0.0;

            $assignedStaff = $license->activeAssignments
                ->take(8)
                ->map(fn ($a) => $a->employee?->name)
                ->filter()
                ->values()
                ->all();

            $row = [
                'id' => $license->id,
                'name' => $license->name,
                'vendor' => $license->vendor,
                'category' => $license->category,
                'license_type' => $license->license_type,
                'billing_cycle' => $license->billing_cycle,
                'total_seats' => $license->total_seats,
                'assigned_seats' => $assignedSeats,
                'available_seats' => $availableSeats,
                'utilization_pct' => $utilPct,
                'status' => $license->status,
                'renewal_date' => $license->renewal_date?->toDateString(),
                'renewal_status' => $license->renewal_status,
                'days_until_renewal' => $license->days_until_renewal,
                'sample_assigned_staff' => $assignedStaff,
            ];

            if ($this->canViewFinancials) {
                $row['cost_per_seat_php'] = (float) $license->cost_per_seat;
                $row['annualized_cost_php'] = (float) $license->annualized_cost;
            }

            $records[] = $row;

            if (count($cards) < 6) {
                $cards[] = [
                    'type' => 'license',
                    'id' => $license->id,
                    'asset_tag' => strtoupper((string) $license->license_type),
                    'name' => $license->name,
                    'specs' => "{$assignedSeats}/{$license->total_seats} seats used ({$availableSeats} free) · {$license->vendor}",
                    'location' => ucfirst((string) $license->category),
                    'status' => $license->status,
                    'action_url' => '/licenses?search='.urlencode($license->name),
                    'meta' => $license->renewal_date
                        ? "Renewal: {$license->renewal_date->toDateString()} ({$license->renewal_status})"
                        : 'Perpetual License',
                ];
            }
        }

        return (string) json_encode([
            'tool' => $this->name(),
            'summary_label' => "{$matchedCount} licenses",
            'overview' => $summary,
            'matched_count' => $matchedCount,
            'returned_count' => count($records),
            'records' => $records,
            'cards' => $cards,
        ]);
    }

    /**
     * Get the tool's schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'query' => $schema->string()->description('Search software name, vendor, or category.'),
            'category' => $schema->string()->description('Filter by license category (productivity, design, development, security, collaboration, analytics, infrastructure).'),
            'status' => $schema->string()->enum(['active', 'suspended', 'cancelled'])->description('Filter by license status.'),
            'expiring_within_days' => $schema->integer()->description('Find licenses renewing within N days from today (e.g., 30, 60).'),
            'license_id' => $schema->integer()->description('Exact software license ID when inspecting one record.'),
            'limit' => $schema->integer()->description('Maximum licenses to return (1-25, default 12).'),
        ];
    }
}
