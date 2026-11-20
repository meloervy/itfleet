<?php

namespace App\Ai\Tools;

use App\Models\Device;
use App\Services\ItamTrackingService;
use App\Services\MatchingService;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class MismatchAndCapacityTool implements Tool
{
    public function name(): string
    {
        return 'inspect_mismatches_and_capacity';
    }

    /**
     * Get the description of the tool's purpose.
     */
    public function description(): Stringable|string
    {
        return 'Audit active compute role-to-hardware mismatches (under-provisioned or over-provisioned workstation waste) and find idle high-spec stockroom units available for upgrades.';
    }

    /**
     * Execute the read-only mismatch and capacity audit.
     */
    public function handle(Request $request): Stringable|string
    {
        $limit = max(1, min(25, (int) ($request['limit'] ?? 12)));
        $filterClass = (string) ($request['classification'] ?? 'all');
        $includeIdle = filter_var($request['include_idle_high_spec'] ?? true, FILTER_VALIDATE_BOOLEAN);

        $matching = app(MatchingService::class);
        $tracking = app(ItamTrackingService::class);

        $allMismatches = $matching->detectMismatches();
        $filteredMismatches = array_values(array_filter(
            $allMismatches,
            static fn (array $m): bool => $filterClass === 'all' || ($m['classification'] ?? '') === $filterClass
        ));

        $mismatchRows = [];
        $cards = [];

        foreach (array_slice($filteredMismatches, 0, $limit) as $m) {
            $device = $m['device'];
            $employee = $m['employee'];
            $roleProfile = $m['role_profile'];

            $mismatchRows[] = [
                'employee_id' => $employee->id,
                'employee_name' => $employee->name,
                'department' => $employee->department,
                'role_profile' => $roleProfile->name,
                'device_id' => $device->id,
                'asset_tag' => $device->asset_tag,
                'device_name' => "{$device->brand} {$device->model}",
                'device_specs' => $device->spec_summary,
                'classification' => $m['classification'],
                'match_score_pct' => (int) round(((float) $m['score']) * 100),
                'rationale' => $m['rationale'],
            ];

            if (count($cards) < 6) {
                $scorePct = (int) round(((float) $m['score']) * 100);
                $cards[] = [
                    'type' => 'mismatch',
                    'id' => $device->id,
                    'asset_tag' => $device->asset_tag,
                    'name' => "{$employee->name} ({$roleProfile->name})",
                    'specs' => "{$device->asset_tag} {$device->brand} {$device->model} · {$device->spec_summary}",
                    'location' => $employee->department,
                    'status' => $m['classification'],
                    'action_url' => "/devices/{$device->id}",
                    'image_url' => $device->image_clip_url,
                    'meta' => ucfirst((string) $m['classification'])." ({$scorePct}%)",
                ];
            }
        }

        $idleHighSpecRows = [];
        if ($includeIdle) {
            $redundancy = $tracking->detectRedundantAssets();
            foreach ($redundancy['idle_high_spec_devices']->take(8) as $idle) {
                $idleHighSpecRows[] = [
                    'id' => $idle->id,
                    'asset_tag' => $idle->asset_tag,
                    'name' => "{$idle->brand} {$idle->model}",
                    'device_type' => $idle->device_type,
                    'specs' => $idle->spec_summary,
                    'location' => $idle->location,
                ];
            }
        }

        return (string) json_encode([
            'tool' => $this->name(),
            'summary_label' => count($filteredMismatches).' mismatches',
            'total_mismatches' => count($allMismatches),
            'filtered_mismatches_count' => count($filteredMismatches),
            'under_provisioned_count' => count(array_filter($allMismatches, static fn ($m): bool => ($m['classification'] ?? '') === 'under-provisioned')),
            'over_provisioned_count' => count(array_filter($allMismatches, static fn ($m): bool => ($m['classification'] ?? '') === 'over-provisioned')),
            'mismatches' => $mismatchRows,
            'idle_high_spec_available' => $idleHighSpecRows,
            'total_available_compute' => Device::available()->compute()->count(),
            'cards' => $cards,
        ]);
    }

    /**
     * Get the tool's schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'classification' => $schema->string()->enum(['all', 'under-provisioned', 'over-provisioned'])->description('Filter mismatches by classification type.'),
            'include_idle_high_spec' => $schema->boolean()->description('Include idle high-spec stockroom compute units suitable for upgrades.'),
            'limit' => $schema->integer()->description('Maximum mismatches to return (1-25, default 12).'),
        ];
    }
}
