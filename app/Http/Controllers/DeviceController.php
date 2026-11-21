<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\Device;
use App\Models\Employee;
use App\Models\LifecycleEvent;
use App\Services\GeminiService;
use App\Services\MatchingService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DeviceController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Device::with(['activeAssignment.employee.roleProfile', 'maintenanceLogs']);

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->where('asset_tag', 'like', "%{$s}%")
                    ->orWhere('serial_number', 'like', "%{$s}%")
                    ->orWhere('brand', 'like', "%{$s}%")
                    ->orWhere('model', 'like', "%{$s}%")
                    ->orWhere('cpu', 'like', "%{$s}%")
                    ->orWhere('location', 'like', "%{$s}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('lifecycle_stage')) {
            $query->where('lifecycle_stage', $request->input('lifecycle_stage'));
        }

        if ($request->filled('device_type')) {
            $query->where('device_type', $request->input('device_type'));
        }

        if ($request->filled('cpu_tier')) {
            $query->where('cpu_tier', $request->input('cpu_tier'));
        }

        if ($request->filled('condition')) {
            $query->where('condition', $request->input('condition'));
        }

        if ($request->filled('warranty')) {
            $warningDays = (int) config('itam.warranty_warning_days', 60);
            $today = now()->toDateString();
            $warningCutoff = now()->addDays($warningDays)->toDateString();

            match ($request->input('warranty')) {
                'expired' => $query->whereNotNull('warranty_expiry')->whereDate('warranty_expiry', '<', $today),
                'expiring_soon' => $query->whereNotNull('warranty_expiry')
                    ->whereDate('warranty_expiry', '>=', $today)
                    ->whereDate('warranty_expiry', '<=', $warningCutoff),
                'active' => $query->whereNotNull('warranty_expiry')->whereDate('warranty_expiry', '>', $warningCutoff),
                'none' => $query->whereNull('warranty_expiry'),
                default => null,
            };
        }

        $allowedSorts = [
            'created_at' => 'created_at',
            'date' => 'created_at',
            'tag' => 'asset_tag',
            'asset_tag' => 'asset_tag',
            'model' => 'model',
            'brand' => 'brand',
            'specs' => 'ram_gb',
            'ram_gb' => 'ram_gb',
            'storage_gb' => 'storage_gb',
            'location' => 'location',
            'lifecycle' => 'lifecycle_stage',
            'lifecycle_stage' => 'lifecycle_stage',
            'status' => 'status',
            'warranty' => 'warranty_expiry',
            'warranty_expiry' => 'warranty_expiry',
            'year_acquired' => 'year_acquired',
            'purchase_date' => 'purchase_date',
        ];

        $sort = $request->input('sort', 'asset_tag');
        $direction = strtolower($request->input('direction', 'asc')) === 'desc' ? 'desc' : 'asc';
        $sortColumn = $allowedSorts[$sort] ?? 'asset_tag';

        $devices = $query->orderBy($sortColumn, $direction)->paginate(15)->withQueryString();

        $rawCounts = Device::query()
            ->selectRaw('device_type, COUNT(*) as total')
            ->groupBy('device_type')
            ->pluck('total', 'device_type');

        $categoryCounts = [
            'all' => (int) $rawCounts->sum(),
            'laptop' => (int) ($rawCounts['laptop'] ?? 0),
            'desktop' => (int) ($rawCounts['desktop'] ?? 0),
            'monitor' => (int) ($rawCounts['monitor'] ?? 0),
            'mobile' => (int) ($rawCounts['mobile'] ?? 0),
            'peripheral' => (int) ($rawCounts['peripheral'] ?? 0),
        ];

        return Inertia::render('Devices/Index', [
            'devices' => $devices,
            'category_counts' => $categoryCounts,
            'filters' => array_merge(
                $request->only(['search', 'status', 'lifecycle_stage', 'device_type', 'cpu_tier', 'condition', 'warranty']),
                ['sort' => $sort, 'direction' => $direction]
            ),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Devices/Create');
    }

    /**
     * Identify hardware specifications using Gemini AI.
     */
    public function identifySpecs(Request $request, GeminiService $geminiService): JsonResponse
    {
        $validated = $request->validate([
            'query' => ['required', 'string', 'min:2', 'max:200'],
        ]);

        $result = $geminiService->identifyDeviceSpecs($validated['query']);

        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateDevicePayload($request);
        $validated['lifecycle_stage'] = $validated['lifecycle_stage'] ?? 'deployment';

        $device = Device::create($validated);

        // Record initial lifecycle event
        LifecycleEvent::create([
            'device_id' => $device->id,
            'from_stage' => 'new',
            'to_stage' => $device->lifecycle_stage,
            'changed_by_user_id' => auth()->id(),
            'notes' => 'Asset registered into ITAM inventory.',
        ]);

        return redirect()->route('devices.index')->with('success', "Device {$validated['asset_tag']} successfully registered.");
    }

    public function show(Request $request, int $id): Response
    {
        $device = Device::with([
            'assignments.employee',
            'activeAssignment.employee',
            'maintenanceLogs',
            'lifecycleEvents.user',
        ])->findOrFail($id);

        $canViewFinancials = $request->user()?->role !== UserRole::Technician;
        $devicePayload = $device->toArray();

        if (! $canViewFinancials) {
            $devicePayload['purchase_cost'] = null;
            $devicePayload['current_book_value'] = null;
            $devicePayload['depreciation_rate_percent'] = null;

            if (! empty($devicePayload['maintenance_logs']) && is_array($devicePayload['maintenance_logs'])) {
                $devicePayload['maintenance_logs'] = array_map(
                    function (array $log): array {
                        $log['cost'] = null;

                        return $log;
                    },
                    $devicePayload['maintenance_logs']
                );
            }
        }

        return Inertia::render('Devices/Show', [
            'device' => $devicePayload,
            'employees' => Employee::select(['id', 'name', 'department'])->orderBy('name')->get(),
            'can_view_financials' => $canViewFinancials,
        ]);
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $device = Device::findOrFail($id);
        $validated = $this->validateDevicePayload($request, $device);

        $oldStage = $device->lifecycle_stage;
        $device->update($validated);

        if ($oldStage !== $validated['lifecycle_stage']) {
            LifecycleEvent::create([
                'device_id' => $device->id,
                'from_stage' => $oldStage,
                'to_stage' => $validated['lifecycle_stage'],
                'changed_by_user_id' => auth()->id(),
                'notes' => 'Lifecycle stage updated via asset edit.',
            ]);
        }

        return back()->with('success', "Device {$device->asset_tag} updated successfully.");
    }

    /**
     * Validate and normalize hardware asset payloads across compute and non-compute categories.
     *
     * @return array<string, mixed>
     */
    private function validateDevicePayload(Request $request, ?Device $device = null): array
    {
        $deviceId = $device?->id;
        $lifecycleRule = $device ? ['required'] : ['nullable'];

        $validated = $request->validate([
            'asset_tag' => ['required', 'string', 'max:50', 'unique:devices,asset_tag'.($deviceId ? ','.$deviceId : '')],
            'serial_number' => ['nullable', 'string', 'max:100', 'unique:devices,serial_number'.($deviceId ? ','.$deviceId : '')],
            'barcode' => ['nullable', 'string', 'max:100'],
            'techspecs_id' => ['nullable', 'string', 'max:100'],
            'image_url' => ['nullable', 'string', 'max:500'],
            'device_type' => ['required', 'in:laptop,desktop,monitor,mobile,peripheral'],
            'brand' => ['required', 'string', 'max:100'],
            'model' => ['required', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:150'],
            'cpu' => ['nullable', 'required_if:device_type,laptop,desktop', 'string', 'max:150'],
            'cpu_tier' => ['nullable', 'required_if:device_type,laptop,desktop', 'in:entry,mid,high,workstation'],
            'ram_gb' => ['nullable', 'required_if:device_type,laptop,desktop', 'integer', 'min:1'],
            'storage_type' => ['nullable', 'required_if:device_type,laptop,desktop', 'in:HDD,SSD'],
            'storage_gb' => ['nullable', 'required_if:device_type,laptop,desktop', 'integer', 'min:1'],
            'gpu' => ['nullable', 'string', 'max:150'],
            'gpu_tier' => ['nullable', 'required_if:device_type,laptop,desktop', 'in:none,integrated,dedicated-entry,dedicated-high'],
            'specifications' => ['nullable', 'array'],
            'specifications.*' => ['nullable', 'string', 'max:255'],
            'year_acquired' => ['required', 'integer', 'min:2000', 'max:'.(date('Y') + 1)],
            'purchase_cost' => ['nullable', 'numeric', 'min:0'],
            'purchase_date' => ['nullable', 'date'],
            'depreciation_rate_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'vendor' => ['nullable', 'string', 'max:100'],
            'warranty_start' => ['nullable', 'date'],
            'warranty_expiry' => ['nullable', 'date', 'after_or_equal:warranty_start'],
            'contract_sla' => ['nullable', 'string', 'max:100'],
            'condition' => ['required', 'in:excellent,good,fair,needs_repair,retired'],
            'status' => ['required', 'in:available,assigned,in_repair,retired'],
            'lifecycle_stage' => [...$lifecycleRule, 'in:acquisition,deployment,reclaimed,maintenance,retirement'],
            'notes' => ['nullable', 'string'],
        ]);

        if (isset($validated['specifications']) && is_array($validated['specifications'])) {
            $cleanedSpecs = array_filter(
                array_map(fn ($v) => trim((string) $v), $validated['specifications']),
                fn ($v) => $v !== ''
            );
            $validated['specifications'] = ! empty($cleanedSpecs) ? $cleanedSpecs : null;
        }

        if (! in_array($validated['device_type'], Device::COMPUTE_TYPES, true)) {
            $validated['gpu_tier'] = $validated['gpu_tier'] ?? 'none';
        }

        return $validated;
    }

    /**
     * Transition asset lifecycle stage with audit notes.
     */
    public function updateLifecycle(Request $request, int $id): RedirectResponse
    {
        $device = Device::findOrFail($id);

        $validated = $request->validate([
            'to_stage' => ['required', 'in:acquisition,deployment,reclaimed,maintenance,retirement'],
            'notes' => ['nullable', 'string'],
        ]);

        $fromStage = $device->lifecycle_stage;
        $toStage = $validated['to_stage'];

        // Synchronize device status
        $newStatus = $device->status;
        if ($toStage === 'maintenance') {
            $newStatus = 'in_repair';
        } elseif ($toStage === 'retirement') {
            $newStatus = 'retired';
            if ($device->activeAssignment) {
                $device->activeAssignment->update(['unassigned_at' => now()]);
            }
        } elseif ($toStage === 'reclaimed') {
            $newStatus = 'available';
            if ($device->activeAssignment) {
                $device->activeAssignment->update(['unassigned_at' => now()]);
            }
        } elseif ($toStage === 'deployment' && $device->status === 'in_repair') {
            $newStatus = $device->activeAssignment ? 'assigned' : 'available';
        }

        $device->update([
            'lifecycle_stage' => $toStage,
            'status' => $newStatus,
            'condition' => ($toStage === 'retirement') ? 'retired' : $device->condition,
        ]);

        LifecycleEvent::create([
            'device_id' => $device->id,
            'from_stage' => $fromStage,
            'to_stage' => $toStage,
            'changed_by_user_id' => auth()->id(),
            'notes' => $validated['notes'] ?? 'Stage transitioned by IT Staff.',
        ]);

        return back()->with('success', "Asset {$device->asset_tag} transitioned to {$toStage} stage.");
    }

    /**
     * Directly reclaim a device back into the pool and discover recirculation opportunities.
     */
    public function reclaim(Request $request, int $id, MatchingService $matchingService): JsonResponse|RedirectResponse
    {
        $device = Device::with('activeAssignment.employee')->findOrFail($id);

        if ($device->activeAssignment && $device->activeAssignment->employee) {
            $validated = $request->validate([
                'reason' => ['nullable', 'string', 'in:resignation,role_transition,hardware_upgrade,contract_end,other'],
                'condition' => ['nullable', 'string', 'in:excellent,good,fair,needs_repair'],
                'wipe_confirmed' => ['nullable', 'boolean'],
                'notes' => ['nullable', 'string', 'max:1000'],
            ]);

            $result = $matchingService->reclaimDevice($device->activeAssignment->employee->id, [
                'device_id' => $device->id,
                'reason' => $validated['reason'] ?? 'hardware_upgrade',
                'condition' => $validated['condition'] ?? $device->condition,
                'wipe_confirmed' => $validated['wipe_confirmed'] ?? true,
                'notes' => $validated['notes'] ?? 'Direct asset reclamation to stockroom.',
            ], auth()->id());

            if ($request->wantsJson()) {
                return response()->json($result);
            }

            return back()->with('success', $result['message'])->with('reclaimed_details', $result);
        }

        $fromStage = $device->lifecycle_stage;
        $device->update([
            'status' => 'available',
            'lifecycle_stage' => 'reclaimed',
        ]);

        LifecycleEvent::create([
            'device_id' => $device->id,
            'from_stage' => $fromStage,
            'to_stage' => 'reclaimed',
            'changed_by_user_id' => auth()->id(),
            'notes' => 'Asset returned to pool in reclaimed stage.',
        ]);

        $circulation = $matchingService->findRecirculationMatches($device);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Device {$device->asset_tag} returned to pool in reclaimed stage.",
                'device' => $device->fresh(),
                'circulation_matches' => $circulation,
            ]);
        }

        return back()->with('success', "Device {$device->asset_tag} returned to pool in reclaimed stage.");
    }

    public function retire(int $id): RedirectResponse
    {
        $device = Device::findOrFail($id);

        if ($device->activeAssignment) {
            $device->activeAssignment->update(['unassigned_at' => now()]);
        }

        $oldStage = $device->lifecycle_stage;
        $device->update([
            'status' => 'retired',
            'condition' => 'retired',
            'lifecycle_stage' => 'retirement',
        ]);

        LifecycleEvent::create([
            'device_id' => $device->id,
            'from_stage' => $oldStage,
            'to_stage' => 'retirement',
            'changed_by_user_id' => auth()->id(),
            'notes' => 'Asset decommissioned and retired from active fleet.',
        ]);

        return back()->with('success', "Device {$device->asset_tag} has been retired.");
    }

    /**
     * Permanently delete a device from inventory.
     * Prevents deletion of devices with active assignments or assigned status.
     */
    public function destroy(int $id): RedirectResponse
    {
        $device = Device::with('activeAssignment')->findOrFail($id);

        if ($device->activeAssignment) {
            return back()->with('error', "Cannot delete device {$device->asset_tag}: it has an active assignment. Unassign the device first.");
        }

        if ($device->status === 'assigned') {
            return back()->with('error', "Cannot delete device {$device->asset_tag}: status is 'assigned'. Return the device first.");
        }

        $assetTag = $device->asset_tag;
        $device->delete();

        return redirect()->route('devices.index')->with('success', "Device {$assetTag} permanently removed from inventory.");
    }

    /**
     * Export complete hardware asset inventory as a compliance PDF report.
     */
    /**
     * Directly assign a hardware asset to an employee.
     */
    public function assign(Request $request, int $id, MatchingService $matchingService): RedirectResponse
    {
        $device = Device::findOrFail($id);

        $validated = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
        ]);

        if (in_array($device->status, ['retired', 'in_repair'], true)) {
            return back()->with('error', "Cannot assign device {$device->asset_tag}: current status is '{$device->status}'.");
        }

        $employee = Employee::findOrFail((int) $validated['employee_id']);
        $matchingService->assignDevice($device->id, $employee->id, 'manual_override');

        if (in_array($device->lifecycle_stage, ['acquisition', 'reclaimed'], true)) {
            $oldStage = $device->lifecycle_stage;
            $device->update(['lifecycle_stage' => 'deployment']);

            LifecycleEvent::create([
                'device_id' => $device->id,
                'from_stage' => $oldStage,
                'to_stage' => 'deployment',
                'changed_by_user_id' => auth()->id(),
                'notes' => "Assigned to {$employee->name}.",
            ]);
        }

        return back()->with('success', "Asset {$device->asset_tag} assigned to {$employee->name}.");
    }

    /**
     * Unassign a device from its active custodian and return it to stockroom pool.
     */
    public function unassign(int $id, MatchingService $matchingService): RedirectResponse
    {
        $device = Device::with('activeAssignment.employee')->findOrFail($id);

        if (! $device->activeAssignment) {
            return back()->with('error', "Device {$device->asset_tag} is not currently assigned.");
        }

        $employeeName = $device->activeAssignment->employee?->name ?? 'employee';
        $matchingService->unassignDevice($device->activeAssignment->id);

        return back()->with('success', "Device {$device->asset_tag} unassigned from {$employeeName} and returned to stockroom pool.");
    }

    public function exportPdf(Request $request)
    {
        Gate::authorize('exportPdf', Device::class);

        $devices = Device::with('activeAssignment.employee')
            ->orderBy('asset_tag')
            ->get();

        $pdf = Pdf::loadView('reports.devices_inventory', [
            'devices' => $devices,
            'generated_at' => now()->format('F j, Y, g:i A'),
            'total_assets' => $devices->count(),
            'total_value' => $devices->sum(fn ($d) => $d->current_book_value),
        ])->setPaper('a4', 'landscape');

        return $pdf->download('itfleet-itam-inventory-'.date('Ymd-His').'.pdf');
    }

    /**
     * Export complete hardware asset inventory as a CSV file.
     */
    public function exportCsv(Request $request): StreamedResponse
    {
        Gate::authorize('exportCsv', Device::class);

        $devices = Device::with('activeAssignment.employee')
            ->orderBy('asset_tag')
            ->get();

        $filename = 'itfleet-devices-'.date('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($devices) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'asset_tag',
                'serial_number',
                'device_type',
                'brand',
                'model',
                'cpu',
                'cpu_tier',
                'ram_gb',
                'storage_type',
                'storage_gb',
                'gpu',
                'gpu_tier',
                'spec_summary',
                'location',
                'status',
                'lifecycle_stage',
                'condition',
                'purchase_cost',
                'current_book_value',
                'purchase_date',
                'vendor',
                'warranty_expiry',
                'warranty_status',
                'assigned_to',
            ]);

            foreach ($devices as $device) {
                $assignedEmployee = $device->activeAssignment?->employee;
                fputcsv($handle, [
                    $this->sanitizeCsvCell($device->asset_tag),
                    $this->sanitizeCsvCell($device->serial_number ?? ''),
                    $this->sanitizeCsvCell($device->device_type),
                    $this->sanitizeCsvCell($device->brand),
                    $this->sanitizeCsvCell($device->model),
                    $this->sanitizeCsvCell($device->cpu ?? ''),
                    $this->sanitizeCsvCell($device->cpu_tier ?? ''),
                    $device->ram_gb ?? '',
                    $this->sanitizeCsvCell($device->storage_type ?? ''),
                    $device->storage_gb ?? '',
                    $this->sanitizeCsvCell($device->gpu ?? ''),
                    $this->sanitizeCsvCell($device->gpu_tier ?? ''),
                    $this->sanitizeCsvCell($device->spec_summary),
                    $this->sanitizeCsvCell($device->location ?? ''),
                    $this->sanitizeCsvCell($device->status),
                    $this->sanitizeCsvCell($device->lifecycle_stage),
                    $this->sanitizeCsvCell($device->condition),
                    $device->purchase_cost ?? '',
                    $device->current_book_value,
                    $device->purchase_date ? $device->purchase_date->toDateString() : '',
                    $this->sanitizeCsvCell($device->vendor ?? ''),
                    $device->warranty_expiry ? $device->warranty_expiry->toDateString() : '',
                    $this->sanitizeCsvCell($device->warranty_status),
                    $this->sanitizeCsvCell($assignedEmployee?->name ?? ''),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * Neutralize spreadsheet formula prefixes in exported CSV cells.
     */
    private function sanitizeCsvCell(?string $value): string
    {
        $text = (string) ($value ?? '');
        if ($text !== '' && preg_match('/^[=+\-@\t\r]/', $text)) {
            return "'".$text;
        }

        return $text;
    }
}
