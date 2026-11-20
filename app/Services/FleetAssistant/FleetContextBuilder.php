<?php

namespace App\Services\FleetAssistant;

use App\Models\Device;
use App\Models\Employee;
use App\Models\MaintenanceLog;
use App\Services\MatchingService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

class FleetContextBuilder
{
    public function __construct(
        protected MatchingService $matchingService,
    ) {}

    /**
     * Retrieve a comprehensive, cached JSON fleet catalog from the database.
     */
    public function getCachedFleetCatalog(bool $fresh = false): array
    {
        if ($fresh) {
            Cache::forget('fleet_catalog_json');
        }

        return Cache::remember('fleet_catalog_json', 30, function () {
            $devices = Device::with(['activeAssignment.employee.roleProfile'])->get();
            $employees = Employee::with(['activeAssignment.device'])->get();

            $totalDevices = $devices->count();
            $availableDevices = $devices->where('status', 'available');
            $assignedDevices = $devices->where('status', 'assigned');
            $inRepairDevices = $devices->filter(fn ($d) => in_array($d->status, ['in_repair', 'maintenance']));
            $retiredDevices = $devices->where('status', 'retired');

            $laptops = $devices->filter(fn ($d) => strtolower($d->device_type) === 'laptop');
            $desktops = $devices->filter(fn ($d) => in_array(strtolower($d->device_type), ['desktop', 'tower']));
            $workstations = $devices->filter(fn ($d) => strtolower($d->device_type) === 'workstation');
            $monitors = $devices->filter(fn ($d) => strtolower($d->device_type) === 'monitor');
            $mobiles = $devices->filter(fn ($d) => strtolower($d->device_type) === 'mobile');
            $peripherals = $devices->filter(fn ($d) => strtolower($d->device_type) === 'peripheral');

            $ramDistribution = [];
            foreach ($devices as $d) {
                $ram = (int) ($d->ram_gb ?? 0);
                if ($ram > 0) {
                    $ramDistribution[$ram] = ($ramDistribution[$ram] ?? 0) + 1;
                }
            }
            ksort($ramDistribution);

            $storageDistribution = [];
            foreach ($devices as $d) {
                $storageGb = (int) ($d->storage_gb ?? 0);
                if ($storageGb > 0) {
                    $key = trim("{$storageGb}GB ".($d->storage_type ?? ''));
                    $storageDistribution[$key] = ($storageDistribution[$key] ?? 0) + 1;
                }
            }

            $allDevices = $devices->map(function ($d) {
                $assignedEmp = $d->activeAssignment?->employee;

                return [
                    'id' => $d->id,
                    'asset_tag' => $d->asset_tag,
                    'brand' => $d->brand,
                    'model' => $d->model,
                    'full_name' => "{$d->brand} {$d->model}",
                    'device_type' => $d->device_type,
                    'status' => $d->status,
                    'condition' => $d->condition,
                    'location' => $d->location,
                    'cpu' => $d->cpu,
                    'cpu_tier' => $d->cpu_tier,
                    'ram_gb' => (int) ($d->ram_gb ?? 0),
                    'storage_gb' => (int) ($d->storage_gb ?? 0),
                    'storage_type' => $d->storage_type,
                    'gpu' => $d->gpu,
                    'gpu_tier' => $d->gpu_tier,
                    'specifications' => $d->specifications,
                    'spec_summary' => $d->spec_summary,
                    'purchase_cost' => (float) $d->purchase_cost,
                    'current_book_value' => (float) $d->current_book_value,
                    'warranty_status' => $d->warranty_status,
                    'image_url' => $d->image_clip_url,
                    'assigned_employee' => $assignedEmp ? [
                        'id' => $assignedEmp->id,
                        'name' => $assignedEmp->name,
                        'department' => $assignedEmp->department,
                        'role' => $assignedEmp->roleProfile?->name ?? 'Standard Role',
                    ] : null,
                ];
            })->values()->all();

            $allEmployees = $employees->map(function ($e) {
                $dev = $e->activeAssignment?->device;

                return [
                    'id' => $e->id,
                    'name' => $e->name,
                    'department' => $e->department,
                    'role' => $e->roleProfile?->name ?? 'Standard Role',
                    'has_device' => $dev !== null,
                    'assigned_device' => $dev ? [
                        'id' => $dev->id,
                        'asset_tag' => $dev->asset_tag,
                        'name' => "{$dev->brand} {$dev->model}",
                        'device_type' => $dev->device_type,
                        'cpu' => $dev->cpu,
                        'ram_gb' => (int) ($dev->ram_gb ?? 0),
                        'storage_gb' => (int) ($dev->storage_gb ?? 0),
                        'storage_type' => $dev->storage_type,
                        'spec_summary' => $dev->spec_summary,
                        'status' => $dev->status,
                    ] : null,
                ];
            })->values()->all();

            return [
                'company_summary' => [
                    'total_devices' => $totalDevices,
                    'available_count' => $availableDevices->count(),
                    'assigned_count' => $assignedDevices->count(),
                    'in_repair_count' => $inRepairDevices->count(),
                    'retired_count' => $retiredDevices->count(),
                    'total_laptops' => $laptops->count(),
                    'total_desktops' => $desktops->count(),
                    'total_workstations' => $workstations->count(),
                    'total_monitors' => $monitors->count(),
                    'total_mobiles' => $mobiles->count(),
                    'total_peripherals' => $peripherals->count(),
                    'total_employees' => $employees->count(),
                    'employees_assigned_count' => $employees->filter(fn ($e) => $e->activeAssignment !== null)->count(),
                    'employees_unassigned_count' => $employees->filter(fn ($e) => $e->activeAssignment === null)->count(),
                ],
                'ram_distribution' => $ramDistribution,
                'storage_distribution' => $storageDistribution,
                'all_devices' => $allDevices,
                'all_employees' => $allEmployees,
            ];
        });
    }

    /**
     * Gather a comprehensive, token-efficient summary snapshot of the live database with spec tier classifications.
     */
    public function aggregateContextSnapshot(): array
    {
        $devices = Device::with(['activeAssignment.employee.roleProfile'])->get();
        $totalDevices = $devices->count();

        $availableDevices = $devices->where('status', 'available');
        $assignedDevices = $devices->where('status', 'assigned');
        $maintenanceDevices = $devices->filter(fn ($d) => in_array($d->status, ['in_repair', 'maintenance']));
        $retiredDevices = $devices->where('status', 'retired');

        $idleLaptops = $availableDevices->filter(fn ($d) => strtolower($d->device_type) === 'laptop');
        $idleDesktops = $availableDevices->filter(fn ($d) => in_array(strtolower($d->device_type), ['desktop', 'workstation']));

        $classifyTier = function ($d): string {
            $cpuTier = strtolower($d->cpu_tier ?? '');
            $ram = (int) ($d->ram_gb ?? 0);

            if ($cpuTier === 'workstation' || $ram >= 64) {
                return 'workstation';
            }
            if ($cpuTier === 'high' || $ram >= 18) {
                return 'high';
            }
            if ($cpuTier === 'mid' || ($ram === 16 && $cpuTier !== 'entry')) {
                return 'mid';
            }

            return 'low';
        };

        $mismatches = $this->matchingService->detectMismatches();
        $mismatchLookup = [];
        foreach ($mismatches as $m) {
            if (isset($m['device']->id)) {
                $mismatchLookup[$m['device']->id] = $m;
            }
        }

        $underProvisioned = array_values(array_filter($mismatches, fn ($m) => ($m['classification'] ?? '') === 'under-provisioned'));
        $overProvisioned = array_values(array_filter($mismatches, fn ($m) => ($m['classification'] ?? '') === 'over-provisioned'));

        $totalAcquisitionCost = (float) $devices->sum('purchase_cost');
        $currentBookValue = (float) $devices->sum(fn ($d) => $d->current_book_value);
        $accumulatedDepreciation = max(0.0, $totalAcquisitionCost - $currentBookValue);

        $expiringWarranties = $devices->filter(fn ($d) => $d->warranty_status === 'expiring_soon');
        $expiredWarranties = $devices->filter(fn ($d) => $d->warranty_status === 'expired');

        $activeMaintenance = MaintenanceLog::with('device')
            ->whereIn('status', ['in_progress', 'scheduled'])
            ->get();

        return [
            'metrics' => [
                'total_devices' => $totalDevices,
                'available_count' => $availableDevices->count(),
                'idle_count' => $availableDevices->count(),
                'idle_laptops_count' => $idleLaptops->count(),
                'idle_desktops_count' => $idleDesktops->count(),
                'assigned_count' => $assignedDevices->count(),
                'maintenance_count' => $maintenanceDevices->count(),
                'retired_count' => $retiredDevices->count(),
                'total_acquisition_cost' => $totalAcquisitionCost,
                'current_book_value' => $currentBookValue,
                'accumulated_depreciation' => $accumulatedDepreciation,
                'expiring_warranties_count' => $expiringWarranties->count(),
                'expired_warranties_count' => $expiredWarranties->count(),
                'mismatches_count' => count($mismatches),
                'under_provisioned_count' => count($underProvisioned),
                'over_provisioned_count' => count($overProvisioned),
            ],
            'available_devices' => $availableDevices->map(fn ($d) => [
                'id' => $d->id,
                'asset_tag' => $d->asset_tag,
                'name' => "{$d->brand} {$d->model}",
                'device_type' => $d->device_type,
                'brand' => $d->brand,
                'model' => $d->model,
                'location' => $d->location,
                'cpu' => $d->cpu,
                'cpu_tier' => $d->cpu_tier,
                'ram_gb' => $d->ram_gb,
                'storage_gb' => $d->storage_gb,
                'gpu' => $d->gpu,
                'gpu_tier' => $d->gpu_tier,
                'spec_tier' => $classifyTier($d),
                'purchase_cost' => $d->purchase_cost,
                'current_book_value' => $d->current_book_value,
                'image_url' => $d->image_clip_url,
                'warranty_status' => $d->warranty_status,
                'days_until_warranty' => $d->days_until_warranty_expiry,
            ])->values()->all(),
            'assigned_devices' => $assignedDevices->map(function ($d) use ($classifyTier, $mismatchLookup) {
                $mismatch = $mismatchLookup[$d->id] ?? null;

                return [
                    'id' => $d->id,
                    'asset_tag' => $d->asset_tag,
                    'name' => "{$d->brand} {$d->model}",
                    'device_type' => $d->device_type,
                    'brand' => $d->brand,
                    'model' => $d->model,
                    'cpu' => $d->cpu,
                    'cpu_tier' => $d->cpu_tier,
                    'ram_gb' => $d->ram_gb,
                    'storage_gb' => $d->storage_gb,
                    'gpu' => $d->gpu,
                    'gpu_tier' => $d->gpu_tier,
                    'spec_tier' => $classifyTier($d),
                    'location' => $d->location,
                    'image_url' => $d->image_clip_url,
                    'is_mismatch' => $mismatch !== null,
                    'mismatch_classification' => $mismatch['classification'] ?? null,
                    'mismatch_rationale' => $mismatch['rationale'] ?? null,
                    'employee' => [
                        'id' => $d->activeAssignment?->employee?->id,
                        'name' => $d->activeAssignment?->employee?->name ?? 'Unknown',
                        'department' => $d->activeAssignment?->employee?->department ?? 'General',
                        'role_profile' => $d->activeAssignment?->employee?->roleProfile?->name ?? 'Standard Role',
                        'assigned_at' => $d->activeAssignment?->assigned_at ? Carbon::parse($d->activeAssignment->assigned_at)->toDateString() : null,
                        'match_score' => $d->activeAssignment?->match_score ? round($d->activeAssignment->match_score * 100) : null,
                    ],
                ];
            })->values()->all(),
            'expiring_devices' => $expiringWarranties->map(fn ($d) => [
                'id' => $d->id,
                'asset_tag' => $d->asset_tag,
                'name' => "{$d->brand} {$d->model}",
                'vendor' => $d->vendor,
                'location' => $d->location,
                'warranty_expiry' => $d->warranty_expiry ? Carbon::parse($d->warranty_expiry)->toDateString() : null,
                'days_left' => $d->days_until_warranty_expiry,
                'image_url' => $d->image_clip_url,
            ])->values()->all(),
            'mismatches' => array_map(fn ($m) => [
                'assignment_id' => $m['assignment']->id ?? null,
                'employee_name' => $m['employee']->name ?? 'Unknown',
                'department' => $m['employee']->department ?? 'General',
                'role_profile' => $m['role_profile']->name ?? 'Role',
                'device_id' => $m['device']->id ?? null,
                'device_tag' => $m['device']->asset_tag ?? '',
                'device_name' => ($m['device']->brand ?? '').' '.($m['device']->model ?? ''),
                'classification' => $m['classification'] ?? 'mismatch',
                'score' => round(($m['score'] ?? 0) * 100),
                'rationale' => $m['rationale'] ?? '',
                'disqualification_reason' => $m['disqualification_reason'] ?? null,
                'image_url' => isset($m['device']) ? $m['device']->image_clip_url : null,
            ], $mismatches),
            'active_maintenance' => $activeMaintenance->map(fn ($l) => [
                'id' => $l->id,
                'device_id' => $l->device_id,
                'device_tag' => $l->device?->asset_tag,
                'device_name' => $l->device ? "{$l->device->brand} {$l->device->model}" : 'Asset',
                'type' => $l->type,
                'title' => $l->title,
                'technician' => $l->performed_by ?? 'Authorized Service Tech',
                'status' => $l->status,
                'cost' => $l->cost,
                'started_at' => $l->started_at ? Carbon::parse($l->started_at)->toDateString() : null,
                'image_url' => $l->device?->image_clip_url,
            ])->values()->all(),
        ];
    }

    /**
     * Build a token-efficient, compact live database context payload.
     */
    public function buildLiveContextPayload(array $snapshot, array $catalog): array
    {
        $summary = $catalog['company_summary'] ?? [];
        $summary['current_book_value'] = $snapshot['metrics']['current_book_value'] ?? 0;
        $summary['total_acquisition_cost'] = $snapshot['metrics']['total_acquisition_cost'] ?? 0;
        $summary['accumulated_depreciation'] = $snapshot['metrics']['accumulated_depreciation'] ?? 0;
        $summary['expiring_warranties_count'] = $snapshot['metrics']['expiring_warranties_count'] ?? 0;
        $summary['mismatches_count'] = $snapshot['metrics']['mismatches_count'] ?? 0;
        $summary['under_provisioned_count'] = $snapshot['metrics']['under_provisioned_count'] ?? 0;
        $summary['over_provisioned_count'] = $snapshot['metrics']['over_provisioned_count'] ?? 0;

        $devices = array_map(fn ($d) => [
            'id' => $d['id'],
            'asset_tag' => $d['asset_tag'],
            'brand' => $d['brand'],
            'model' => $d['model'],
            'name' => $d['full_name'],
            'type' => $d['device_type'],
            'status' => $d['status'],
            'location' => $d['location'],
            'cpu' => $d['cpu'],
            'ram_gb' => $d['ram_gb'],
            'storage' => $d['storage_gb'] > 0 ? trim("{$d['storage_gb']}GB ".($d['storage_type'] ?? '')) : null,
            'spec_summary' => $d['spec_summary'] ?? null,
            'gpu' => $d['gpu'],
            'cost' => $d['purchase_cost'],
            'book_value' => $d['current_book_value'],
            'warranty' => $d['warranty_status'],
            'assigned_to' => $d['assigned_employee'] ? "{$d['assigned_employee']['name']} ({$d['assigned_employee']['department']})" : null,
        ], $catalog['all_devices'] ?? []);

        $employees = array_map(fn ($e) => [
            'id' => $e['id'],
            'name' => $e['name'],
            'department' => $e['department'],
            'role' => $e['role'],
            'assigned_device' => $e['assigned_device'] ? [
                'asset_tag' => $e['assigned_device']['asset_tag'],
                'name' => $e['assigned_device']['name'],
                'cpu' => $e['assigned_device']['cpu'],
                'ram_gb' => $e['assigned_device']['ram_gb'],
                'storage' => $e['assigned_device']['storage_gb'] > 0 ? trim("{$e['assigned_device']['storage_gb']}GB ".($e['assigned_device']['storage_type'] ?? '')) : null,
            ] : null,
        ], $catalog['all_employees'] ?? []);

        $mismatches = array_map(fn ($m) => [
            'employee' => $m['employee_name'] ?? 'Unknown',
            'department' => $m['department'] ?? 'General',
            'device_tag' => $m['device_tag'] ?? '',
            'device_name' => $m['device_name'] ?? '',
            'classification' => $m['classification'] ?? '',
            'score' => $m['score'] ?? 0,
            'rationale' => $m['rationale'] ?? '',
        ], $snapshot['mismatches'] ?? []);

        $maintenance = array_map(fn ($m) => [
            'device_tag' => $m['device_tag'] ?? '',
            'device_name' => $m['device_name'] ?? '',
            'type' => $m['type'] ?? '',
            'title' => $m['title'] ?? '',
            'status' => $m['status'] ?? '',
            'technician' => $m['technician'] ?? '',
        ], $snapshot['active_maintenance'] ?? []);

        return [
            'summary' => $summary,
            'devices' => $devices,
            'employees' => $employees,
            'mismatches' => $mismatches,
            'maintenance' => $maintenance,
        ];
    }
}
