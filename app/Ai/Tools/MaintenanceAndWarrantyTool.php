<?php

namespace App\Ai\Tools;

use App\Models\Device;
use App\Models\MaintenanceLog;
use Carbon\Carbon;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class MaintenanceAndWarrantyTool implements Tool
{
    public function __construct(
        private readonly bool $canViewFinancials = true,
    ) {}

    public function name(): string
    {
        return 'inspect_maintenance_and_warranties';
    }

    /**
     * Get the description of the tool's purpose.
     */
    public function description(): Stringable|string
    {
        return 'Inspect active/scheduled/completed hardware maintenance & repair tickets as well as expiring-soon or expired hardware warranties.';
    }

    /**
     * Execute the read-only maintenance & warranty query.
     */
    public function handle(Request $request): Stringable|string
    {
        $limit = max(1, min(25, (int) ($request['limit'] ?? 12)));
        $focus = (string) ($request['focus'] ?? 'all');
        $warningDays = max(1, (int) ($request['warranty_window_days'] ?? config('itam.warranty_warning_days', 60)));

        $maintenanceRecords = [];
        $expiringWarranties = [];
        $expiredWarranties = [];
        $cards = [];

        if (in_array($focus, ['all', 'maintenance'], true)) {
            $maintQuery = MaintenanceLog::with('device')->orderByDesc('started_at');
            if (! empty($request['maintenance_status'])) {
                $maintQuery->where('status', (string) $request['maintenance_status']);
            }
            if (! empty($request['device_id'])) {
                $maintQuery->where('device_id', (int) $request['device_id']);
            }

            $logs = $maintQuery->limit($limit)->get();

            foreach ($logs as $log) {
                $entry = [
                    'id' => $log->id,
                    'device_id' => $log->device_id,
                    'asset_tag' => $log->device?->asset_tag,
                    'device_name' => $log->device ? "{$log->device->brand} {$log->device->model}" : 'Hardware Asset',
                    'type' => $log->type,
                    'title' => $log->title,
                    'status' => $log->status,
                    'performed_by' => $log->performed_by,
                    'started_at' => $log->started_at?->toDateString(),
                    'completed_at' => $log->completed_at?->toDateString(),
                ];

                if ($this->canViewFinancials) {
                    $entry['cost_php'] = (float) ($log->cost ?? 0);
                }

                $maintenanceRecords[] = $entry;

                if ($log->device && count($cards) < 6) {
                    $cards[] = [
                        'type' => 'maintenance',
                        'id' => $log->device->id,
                        'asset_tag' => $log->device->asset_tag,
                        'name' => "{$log->device->brand} {$log->device->model} ({$log->title})",
                        'specs' => ucfirst((string) $log->type).' · Tech: '.($log->performed_by ?? 'IT Bench'),
                        'location' => $log->device->location,
                        'status' => $log->status,
                        'action_url' => "/devices/{$log->device->id}",
                        'image_url' => $log->device->image_clip_url,
                        'meta' => strtoupper(str_replace('_', ' ', (string) $log->status)),
                    ];
                }
            }
        }

        if (in_array($focus, ['all', 'warranties'], true)) {
            $warrantyQuery = Device::where('status', '!=', 'retired')
                ->whereNotNull('warranty_expiry');
            if (! empty($request['device_id'])) {
                $warrantyQuery->where('id', (int) $request['device_id']);
            }

            $devices = $warrantyQuery->orderBy('warranty_expiry')->get();
            $now = Carbon::now();

            foreach ($devices as $device) {
                $expiry = Carbon::parse($device->warranty_expiry)->endOfDay();
                $daysLeft = (int) floor($now->diffInDays($expiry, false));

                if ($expiry->isPast()) {
                    $expiredWarranties[] = [
                        'id' => $device->id,
                        'asset_tag' => $device->asset_tag,
                        'name' => "{$device->brand} {$device->model}",
                        'vendor' => $device->vendor,
                        'location' => $device->location,
                        'warranty_expiry' => $expiry->toDateString(),
                        'days_overdue' => abs($daysLeft),
                    ];
                } elseif ($daysLeft <= $warningDays) {
                    $expiringWarranties[] = [
                        'id' => $device->id,
                        'asset_tag' => $device->asset_tag,
                        'name' => "{$device->brand} {$device->model}",
                        'vendor' => $device->vendor,
                        'contract_sla' => $device->contract_sla,
                        'location' => $device->location,
                        'warranty_expiry' => $expiry->toDateString(),
                        'days_left' => $daysLeft,
                    ];

                    if (count($cards) < 6) {
                        $cards[] = [
                            'type' => 'device',
                            'id' => $device->id,
                            'asset_tag' => $device->asset_tag,
                            'name' => "{$device->brand} {$device->model}",
                            'specs' => "Vendor: {$device->vendor} · Expires {$expiry->toDateString()}",
                            'location' => $device->location,
                            'status' => $device->status,
                            'action_url' => "/devices/{$device->id}",
                            'image_url' => $device->image_clip_url,
                            'meta' => "{$daysLeft} days left",
                        ];
                    }
                }
            }
        }

        $totalSignals = count($maintenanceRecords) + count($expiringWarranties);

        return (string) json_encode([
            'tool' => $this->name(),
            'summary_label' => count($maintenanceRecords).' tickets · '.count($expiringWarranties).' expiring',
            'active_maintenance_count' => MaintenanceLog::whereIn('status', ['in_progress', 'scheduled'])->count(),
            'maintenance_logs' => array_slice($maintenanceRecords, 0, $limit),
            'expiring_warranties_count' => count($expiringWarranties),
            'expired_warranties_count' => count($expiredWarranties),
            'expiring_warranties' => array_slice($expiringWarranties, 0, $limit),
            'expired_warranties' => array_slice($expiredWarranties, 0, $limit),
            'total_signals' => $totalSignals,
            'cards' => $cards,
        ]);
    }

    /**
     * Get the tool's schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'focus' => $schema->string()->enum(['all', 'maintenance', 'warranties'])->description('Focus on maintenance tickets, warranties, or both.'),
            'warranty_window_days' => $schema->integer()->description('Days ahead to inspect for expiring warranties (default 60).'),
            'maintenance_status' => $schema->string()->enum(['in_progress', 'scheduled', 'completed'])->description('Filter maintenance logs by ticket status.'),
            'device_id' => $schema->integer()->description('Exact device ID to inspect logs/warranty for a specific unit.'),
            'limit' => $schema->integer()->description('Maximum rows per section (1-25, default 12).'),
        ];
    }
}
