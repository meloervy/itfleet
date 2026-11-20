<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\Device;
use App\Models\LifecycleEvent;
use App\Models\MaintenanceLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceController extends Controller
{
    /**
     * Determine whether the authenticated user may view or mutate maintenance financials.
     */
    private function canViewFinancials(Request $request): bool
    {
        return $request->user()?->role !== UserRole::Technician;
    }

    /**
     * Display central maintenance & servicing log.
     */
    public function index(Request $request): Response
    {
        $canViewFinancials = $this->canViewFinancials($request);
        $canPerformMaintenance = $request->user()?->role?->canPerformMaintenance() ?? false;

        $query = MaintenanceLog::with('device');

        if ($request->filled('type')) {
            $query->where('maintenance_logs.type', $request->input('type'));
        }

        if ($request->filled('status')) {
            $statusFilter = (string) $request->input('status');
            if ($statusFilter === 'active') {
                $query->whereIn('maintenance_logs.status', ['scheduled', 'in_progress']);
            } else {
                $query->where('maintenance_logs.status', $statusFilter);
            }
        }

        if ($request->filled('search')) {
            $s = (string) $request->input('search');
            $query->where(function ($q) use ($s): void {
                $q->where('maintenance_logs.title', 'like', "%{$s}%")
                    ->orWhere('maintenance_logs.description', 'like', "%{$s}%")
                    ->orWhere('maintenance_logs.performed_by', 'like', "%{$s}%")
                    ->orWhereHas('device', function ($dq) use ($s): void {
                        $dq->where('asset_tag', 'like', "%{$s}%")
                            ->orWhere('model', 'like', "%{$s}%")
                            ->orWhere('brand', 'like', "%{$s}%");
                    });
            });
        }

        $allowedSorts = [
            'device' => 'devices.asset_tag',
            'asset_tag' => 'devices.asset_tag',
            'activity' => 'maintenance_logs.title',
            'title' => 'maintenance_logs.title',
            'type' => 'maintenance_logs.type',
            'scope' => 'maintenance_logs.description',
            'description' => 'maintenance_logs.description',
            'technician' => 'maintenance_logs.performed_by',
            'performed_by' => 'maintenance_logs.performed_by',
            'cost' => 'maintenance_logs.cost',
            'timeline' => 'maintenance_logs.started_at',
            'started_at' => 'maintenance_logs.started_at',
            'completed_at' => 'maintenance_logs.completed_at',
            'status' => 'maintenance_logs.status',
            'created_at' => 'maintenance_logs.created_at',
        ];

        $sort = (string) $request->input('sort', 'started_at');
        if (! $canViewFinancials && $sort === 'cost') {
            $sort = 'started_at';
        }

        $direction = strtolower((string) $request->input('direction', 'desc')) === 'asc' ? 'asc' : 'desc';

        if ($sort === 'device' || $sort === 'asset_tag') {
            $query->join('devices', 'maintenance_logs.device_id', '=', 'devices.id')
                ->orderBy('devices.asset_tag', $direction)
                ->select('maintenance_logs.*');
        } else {
            $sortColumn = $allowedSorts[$sort] ?? 'maintenance_logs.started_at';
            $query->orderBy($sortColumn, $direction);
        }

        $logs = $query->paginate(15)->withQueryString();

        if (! $canViewFinancials) {
            $logs->through(function (MaintenanceLog $log): MaintenanceLog {
                $log->setAttribute('cost', null);

                if ($log->relationLoaded('device') && $log->device) {
                    $log->device->setAttribute('purchase_cost', null);
                    $log->device->setAttribute('depreciation_rate_percent', null);
                    $log->device->makeHidden(['purchase_cost', 'depreciation_rate_percent', 'current_book_value']);
                }

                return $log;
            });
        }

        $scheduledCount = MaintenanceLog::where('status', 'scheduled')->count();
        $inProgressCount = MaintenanceLog::where('status', 'in_progress')->count();
        $activeCount = $scheduledCount + $inProgressCount;

        $stats = [
            'total_spend' => $canViewFinancials
                ? (float) MaintenanceLog::where('status', 'completed')->sum('cost')
                : null,
            'scheduled_count' => $scheduledCount,
            'in_progress_count' => $inProgressCount,
            'active_count' => $activeCount,
            'active_repairs' => $activeCount,
            'completed_count' => MaintenanceLog::where('status', 'completed')->count(),
            'cancelled_count' => MaintenanceLog::where('status', 'cancelled')->count(),
            'total_count' => MaintenanceLog::count(),
            'in_service_bay_count' => Device::where('lifecycle_stage', 'maintenance')->count(),
        ];

        $selectableDevices = $canPerformMaintenance
            ? Device::query()
                ->where('lifecycle_stage', '!=', 'retirement')
                ->where('status', '!=', 'retired')
                ->orderBy('asset_tag')
                ->get(['id', 'asset_tag', 'brand', 'model', 'device_type', 'status', 'lifecycle_stage'])
                ->map(fn (Device $device): array => [
                    'id' => $device->id,
                    'asset_tag' => $device->asset_tag,
                    'brand' => $device->brand,
                    'model' => $device->model,
                    'device_type' => $device->device_type,
                    'status' => $device->status,
                    'lifecycle_stage' => $device->lifecycle_stage,
                ])
                ->values()
                ->all()
            : [];

        return Inertia::render('Maintenance/Index', [
            'logs' => $logs,
            'stats' => $stats,
            'devices' => $selectableDevices,
            'can_view_financials' => $canViewFinancials,
            'financials_restricted' => ! $canViewFinancials,
            'filters' => [
                'type' => (string) $request->input('type', ''),
                'status' => (string) $request->input('status', ''),
                'search' => (string) $request->input('search', ''),
                'sort' => $sort,
                'direction' => $direction,
            ],
        ]);
    }

    /**
     * Store a maintenance record for a specific device.
     */
    public function store(Request $request, int $deviceId): RedirectResponse
    {
        $device = Device::findOrFail($deviceId);
        $canViewFinancials = $this->canViewFinancials($request);

        $validated = $request->validate([
            'type' => ['required', 'in:repair,upgrade,preventive,inspection,replacement'],
            'title' => ['required', 'string', 'max:150'],
            'description' => ['required', 'string'],
            'cost' => $canViewFinancials ? ['required', 'numeric', 'min:0'] : ['nullable', 'numeric', 'min:0'],
            'performed_by' => ['nullable', 'string', 'max:150'],
            'started_at' => ['required', 'date'],
            'completed_at' => ['nullable', 'date', 'after_or_equal:started_at'],
            'performance_assessment' => ['nullable', 'string'],
            'status' => ['required', 'in:scheduled,in_progress,completed,cancelled'],
            'send_to_maintenance_stage' => ['nullable', 'boolean'],
        ]);

        $completedAt = null;
        if ($validated['status'] === 'completed') {
            $completedAt = ! empty($validated['completed_at'])
                ? $validated['completed_at']
                : now()->toDateString();
        }

        $device->maintenanceLogs()->create([
            'type' => $validated['type'],
            'title' => $validated['title'],
            'description' => $validated['description'],
            'cost' => $canViewFinancials ? (float) $validated['cost'] : 0.0,
            'performed_by' => $validated['performed_by'] ?? null,
            'started_at' => $validated['started_at'],
            'completed_at' => $completedAt,
            'performance_assessment' => $validated['performance_assessment'] ?? null,
            'status' => $validated['status'],
        ]);

        if (! empty($validated['send_to_maintenance_stage']) || in_array($validated['status'], ['scheduled', 'in_progress'], true)) {
            if ($device->lifecycle_stage !== 'maintenance') {
                $oldStage = $device->lifecycle_stage;
                $device->update([
                    'lifecycle_stage' => 'maintenance',
                    'status' => 'in_repair',
                ]);

                LifecycleEvent::create([
                    'device_id' => $device->id,
                    'from_stage' => $oldStage,
                    'to_stage' => 'maintenance',
                    'changed_by_user_id' => auth()->id(),
                    'notes' => "Initiated {$validated['type']}: {$validated['title']}",
                ]);
            }
        }

        return back()->with('success', "Maintenance log recorded for {$device->asset_tag}.");
    }

    /**
     * Update maintenance log status and post-repair assessment.
     */
    public function update(Request $request, int $id): RedirectResponse
    {
        $log = MaintenanceLog::with('device')->findOrFail($id);
        $canViewFinancials = $this->canViewFinancials($request);

        $validated = $request->validate([
            'cost' => $canViewFinancials ? ['required', 'numeric', 'min:0'] : ['nullable', 'numeric', 'min:0'],
            'completed_at' => ['nullable', 'date'],
            'performance_assessment' => ['nullable', 'string'],
            'status' => ['required', 'in:scheduled,in_progress,completed,cancelled'],
            'restore_to_available' => ['nullable', 'boolean'],
        ]);

        $updateData = [
            'status' => $validated['status'],
            'performance_assessment' => $validated['performance_assessment'] ?? null,
            'completed_at' => $validated['status'] === 'completed'
                ? (! empty($validated['completed_at']) ? $validated['completed_at'] : now()->toDateString())
                : null,
        ];

        if ($canViewFinancials) {
            $updateData['cost'] = (float) $validated['cost'];
        }

        $log->update($updateData);

        if ($validated['status'] === 'completed' && ! empty($validated['restore_to_available'])) {
            $device = $log->device;
            if ($device && $device->lifecycle_stage === 'maintenance') {
                $device->update([
                    'lifecycle_stage' => 'deployment',
                    'status' => $device->activeAssignment ? 'assigned' : 'available',
                ]);

                $assessmentNote = ! empty($validated['performance_assessment'])
                    ? " Performance: {$validated['performance_assessment']}"
                    : '';

                LifecycleEvent::create([
                    'device_id' => $device->id,
                    'from_stage' => 'maintenance',
                    'to_stage' => 'deployment',
                    'changed_by_user_id' => auth()->id(),
                    'notes' => "Completed {$log->type}: {$log->title}.{$assessmentNote}",
                ]);
            }
        }

        return back()->with('success', 'Maintenance log updated successfully.');
    }
}
