<?php

namespace App\Ai\Tools;

use App\Models\Device;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class SearchDevicesTool implements Tool
{
    public function __construct(
        private readonly bool $canViewFinancials = true,
    ) {}

    public function name(): string
    {
        return 'search_devices';
    }

    /**
     * Get the description of the tool's purpose.
     */
    public function description(): Stringable|string
    {
        return 'Search and count hardware inventory across all asset categories (laptops, desktops, monitors, mobile devices, peripherals), statuses, CPU tiers, RAM sizes, hubs/locations, or a specific device ID.';
    }

    /**
     * Execute the read-only device inventory search.
     */
    public function handle(Request $request): Stringable|string
    {
        $limit = max(1, min(25, (int) ($request['limit'] ?? 12)));
        $search = trim((string) ($request['query'] ?? ''));

        $baseQuery = Device::with(['activeAssignment.employee.roleProfile']);

        if (! empty($request['device_id'])) {
            $baseQuery->where('id', (int) $request['device_id']);
        }
        if ($search !== '') {
            $baseQuery->where(function ($q) use ($search): void {
                $q->where('asset_tag', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%")
                    ->orWhere('brand', 'like', "%{$search}%")
                    ->orWhere('model', 'like', "%{$search}%")
                    ->orWhere('cpu', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%");
            });
        }
        if (! empty($request['device_type'])) {
            $baseQuery->where('device_type', strtolower((string) $request['device_type']));
        }
        if (! empty($request['status'])) {
            $baseQuery->where('status', strtolower((string) $request['status']));
        }
        if (! empty($request['cpu_tier'])) {
            $baseQuery->where('cpu_tier', strtolower((string) $request['cpu_tier']));
        }
        if (! empty($request['min_ram_gb'])) {
            $baseQuery->where('ram_gb', '>=', (int) $request['min_ram_gb']);
        }
        if (! empty($request['location'])) {
            $loc = trim((string) $request['location']);
            $baseQuery->where('location', 'like', "%{$loc}%");
        }

        $matchedCount = (clone $baseQuery)->count();
        $devices = (clone $baseQuery)
            ->orderByDesc('ram_gb')
            ->orderBy('asset_tag')
            ->limit($limit)
            ->get();

        $statusTotals = Device::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->all();

        $categoryTotals = Device::query()
            ->selectRaw('device_type, COUNT(*) as total')
            ->groupBy('device_type')
            ->pluck('total', 'device_type')
            ->all();

        $records = [];
        $cards = [];

        foreach ($devices as $device) {
            $emp = $device->activeAssignment?->employee;

            $item = [
                'id' => $device->id,
                'asset_tag' => $device->asset_tag,
                'brand' => $device->brand,
                'model' => $device->model,
                'device_type' => $device->device_type,
                'status' => $device->status,
                'condition' => $device->condition,
                'lifecycle_stage' => $device->lifecycle_stage,
                'location' => $device->location,
                'cpu' => $device->cpu,
                'cpu_tier' => $device->cpu_tier,
                'ram_gb' => $device->ram_gb,
                'storage_gb' => $device->storage_gb,
                'storage_type' => $device->storage_type,
                'gpu' => $device->gpu,
                'gpu_tier' => $device->gpu_tier,
                'spec_summary' => $device->spec_summary,
                'warranty_status' => $device->warranty_status,
                'days_until_warranty' => $device->days_until_warranty_expiry,
                'assigned_employee' => $emp ? [
                    'id' => $emp->id,
                    'name' => $emp->name,
                    'department' => $emp->department,
                    'role_profile' => $emp->roleProfile?->name,
                ] : null,
            ];

            if ($this->canViewFinancials) {
                $item['purchase_cost_php'] = (float) ($device->purchase_cost ?? 0);
                $item['current_book_value_php'] = (float) $device->current_book_value;
            }

            $records[] = $item;

            if (count($cards) < 6) {
                $metaParts = [ucfirst(str_replace('_', ' ', (string) $device->status))];
                if ($emp) {
                    $metaParts[] = "Assigned to {$emp->name}";
                }
                $cards[] = [
                    'type' => 'device',
                    'id' => $device->id,
                    'asset_tag' => $device->asset_tag,
                    'name' => trim("{$device->brand} {$device->model}"),
                    'specs' => $device->spec_summary,
                    'location' => $device->location,
                    'status' => $device->status,
                    'action_url' => "/devices/{$device->id}",
                    'image_url' => $device->image_clip_url,
                    'meta' => implode(' · ', $metaParts),
                ];
            }
        }

        return (string) json_encode([
            'tool' => $this->name(),
            'summary_label' => "{$matchedCount} matched",
            'fleet_totals' => [
                'total_devices' => (int) array_sum($statusTotals),
                'by_status' => [
                    'available' => (int) ($statusTotals['available'] ?? 0),
                    'assigned' => (int) ($statusTotals['assigned'] ?? 0),
                    'in_repair' => (int) ($statusTotals['in_repair'] ?? 0),
                    'retired' => (int) ($statusTotals['retired'] ?? 0),
                ],
                'by_category' => [
                    'laptop' => (int) ($categoryTotals['laptop'] ?? 0),
                    'desktop' => (int) ($categoryTotals['desktop'] ?? 0),
                    'monitor' => (int) ($categoryTotals['monitor'] ?? 0),
                    'mobile' => (int) ($categoryTotals['mobile'] ?? 0),
                    'peripheral' => (int) ($categoryTotals['peripheral'] ?? 0),
                ],
            ],
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
            'query' => $schema->string()->description('Search text matching asset tag, serial number, brand, model, CPU, or location.'),
            'device_type' => $schema->string()->enum(['laptop', 'desktop', 'monitor', 'mobile', 'peripheral'])->description('Filter by hardware category.'),
            'status' => $schema->string()->enum(['available', 'assigned', 'in_repair', 'retired'])->description('Filter by deployment status.'),
            'cpu_tier' => $schema->string()->enum(['entry', 'mid', 'high', 'workstation'])->description('Filter compute hardware by CPU tier.'),
            'min_ram_gb' => $schema->integer()->description('Minimum RAM in GB (e.g., 16, 32, 64).'),
            'location' => $schema->string()->description('Filter by hub or city name (e.g., BGC, Makati, Ortigas, Cebu).'),
            'device_id' => $schema->integer()->description('Exact database device ID when inspecting a single asset.'),
            'limit' => $schema->integer()->description('Maximum records to return (1-25, default 12).'),
        ];
    }
}
