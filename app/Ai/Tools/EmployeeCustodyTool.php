<?php

namespace App\Ai\Tools;

use App\Models\Employee;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class EmployeeCustodyTool implements Tool
{
    public function __construct(
        private readonly bool $canViewFinancials = true,
    ) {}

    public function name(): string
    {
        return 'inspect_employee_custody';
    }

    /**
     * Get the description of the tool's purpose.
     */
    public function description(): Stringable|string
    {
        return 'Inspect employees, departments, role profiles, primary compute workstations, secondary hardware custody (monitors, mobile devices, peripherals), and assigned software licenses.';
    }

    /**
     * Execute the read-only employee custody query.
     */
    public function handle(Request $request): Stringable|string
    {
        $limit = max(1, min(25, (int) ($request['limit'] ?? 12)));
        $search = trim((string) ($request['query'] ?? ''));

        $baseQuery = Employee::with([
            'roleProfile',
            'activeAssignment.device',
            'activeAssignments.device',
            'activeLicenseAssignments.license',
        ]);

        if (! empty($request['employee_id'])) {
            $baseQuery->where('id', (int) $request['employee_id']);
        }
        if ($search !== '') {
            $baseQuery->where(function ($q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('department', 'like', "%{$search}%")
                    ->orWhereHas('roleProfile', function ($rq) use ($search): void {
                        $rq->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('activeAssignments.device', function ($dq) use ($search): void {
                        $dq->where('asset_tag', 'like', "%{$search}%")
                            ->orWhere('brand', 'like', "%{$search}%")
                            ->orWhere('model', 'like', "%{$search}%");
                    });
            });
        }
        if (! empty($request['department'])) {
            $dept = trim((string) $request['department']);
            $baseQuery->where('department', 'like', "%{$dept}%");
        }
        if (filter_var($request['unassigned_only'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $baseQuery->doesntHave('activeAssignment');
        }

        $matchedCount = (clone $baseQuery)->count();
        $employees = (clone $baseQuery)
            ->orderBy('name')
            ->limit($limit)
            ->get();

        $totalEmployees = Employee::count();
        $withHardware = Employee::has('activeAssignment')->count();

        $records = [];
        $cards = [];

        foreach ($employees as $employee) {
            $primaryDevice = $employee->activeAssignment?->device;
            $secondaryHardware = $employee->activeAssignments
                ->filter(fn ($a) => $a->device && (! $primaryDevice || $a->device->id !== $primaryDevice->id))
                ->map(fn ($a): array => [
                    'id' => $a->device->id,
                    'asset_tag' => $a->device->asset_tag,
                    'device_type' => $a->device->device_type,
                    'name' => trim("{$a->device->brand} {$a->device->model}"),
                    'specs' => $a->device->spec_summary,
                ])
                ->values()
                ->all();

            $activeLicenses = $employee->activeLicenseAssignments
                ->filter(fn ($la) => $la->license !== null)
                ->map(fn ($la): array => [
                    'id' => $la->license->id,
                    'name' => $la->license->name,
                    'vendor' => $la->license->vendor,
                    'category' => $la->license->category,
                    'status' => $la->license->status,
                ])
                ->values()
                ->all();

            $records[] = [
                'id' => $employee->id,
                'name' => $employee->name,
                'department' => $employee->department,
                'role_profile' => $employee->roleProfile ? [
                    'name' => $employee->roleProfile->name,
                    'min_cpu_tier' => $employee->roleProfile->min_cpu_tier,
                    'min_ram_gb' => $employee->roleProfile->min_ram_gb,
                    'min_storage_gb' => $employee->roleProfile->min_storage_gb,
                    'requires_gpu' => (bool) $employee->roleProfile->requires_gpu,
                    'portability_required' => (bool) $employee->roleProfile->portability_required,
                ] : null,
                'primary_compute_device' => $primaryDevice ? [
                    'id' => $primaryDevice->id,
                    'asset_tag' => $primaryDevice->asset_tag,
                    'name' => trim("{$primaryDevice->brand} {$primaryDevice->model}"),
                    'device_type' => $primaryDevice->device_type,
                    'cpu' => $primaryDevice->cpu,
                    'cpu_tier' => $primaryDevice->cpu_tier,
                    'ram_gb' => $primaryDevice->ram_gb,
                    'storage_gb' => $primaryDevice->storage_gb,
                    'storage_type' => $primaryDevice->storage_type,
                    'spec_summary' => $primaryDevice->spec_summary,
                ] : null,
                'secondary_hardware' => $secondaryHardware,
                'assigned_licenses' => $activeLicenses,
                'financials_hidden' => ! $this->canViewFinancials,
            ];

            if (count($cards) < 6) {
                $totalGear = ($primaryDevice ? 1 : 0) + count($secondaryHardware);
                $cards[] = [
                    'type' => 'employee',
                    'id' => $employee->id,
                    'asset_tag' => $primaryDevice?->asset_tag ?? 'No Hardware',
                    'name' => $employee->name,
                    'specs' => $primaryDevice
                        ? "{$primaryDevice->brand} {$primaryDevice->model} · {$primaryDevice->spec_summary}"
                        : 'Unassigned compute custody',
                    'location' => trim(($employee->department ?? 'General').($employee->roleProfile ? " · {$employee->roleProfile->name}" : '')),
                    'status' => $primaryDevice ? 'assigned' : 'unassigned',
                    'action_url' => '/employees?search='.urlencode($employee->name),
                    'meta' => "{$totalGear} hardware · ".count($activeLicenses).' licenses',
                ];
            }
        }

        return (string) json_encode([
            'tool' => $this->name(),
            'summary_label' => "{$matchedCount} staff",
            'totals' => [
                'total_employees' => $totalEmployees,
                'with_hardware_count' => $withHardware,
                'without_hardware_count' => max(0, $totalEmployees - $withHardware),
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
            'query' => $schema->string()->description('Search text matching employee name, department, role profile, or assigned asset tag.'),
            'department' => $schema->string()->description('Filter by department name (e.g., Engineering, Sales, Operations).'),
            'unassigned_only' => $schema->boolean()->description('Set true to list only employees without assigned hardware.'),
            'employee_id' => $schema->integer()->description('Exact employee ID when inspecting one person.'),
            'limit' => $schema->integer()->description('Maximum staff records to return (1-25, default 12).'),
        ];
    }
}
