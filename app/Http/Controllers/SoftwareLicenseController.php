<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\Employee;
use App\Models\SoftwareLicense;
use App\Models\SoftwareLicenseAssignment;
use App\Services\ItamTrackingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SoftwareLicenseController extends Controller
{
    public function index(Request $request, ItamTrackingService $itamService): Response
    {
        $canViewFinancials = $request->user()?->role !== UserRole::Technician;

        $query = SoftwareLicense::with(['activeAssignments.employee'])
            ->withCount('activeAssignments');

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('vendor', 'like', "%{$s}%")
                    ->orWhere('category', 'like', "%{$s}%");
            });
        }

        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }

        if ($request->filled('license_type')) {
            $query->where('license_type', $request->input('license_type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('renewal_filter')) {
            $warningDays = (int) config('itam.warranty_warning_days', 60);
            $today = now()->toDateString();
            $warningCutoff = now()->addDays($warningDays)->toDateString();

            match ($request->input('renewal_filter')) {
                'needs_attention' => $query->where('status', '!=', 'cancelled')
                    ->whereNotNull('renewal_date')
                    ->whereDate('renewal_date', '<=', $warningCutoff),
                'expiring_soon' => $query->where('status', '!=', 'cancelled')
                    ->whereNotNull('renewal_date')
                    ->whereDate('renewal_date', '>=', $today)
                    ->whereDate('renewal_date', '<=', $warningCutoff),
                'expired' => $query->where('status', '!=', 'cancelled')
                    ->whereNotNull('renewal_date')
                    ->whereDate('renewal_date', '<', $today),
                'perpetual' => $query->where('status', '!=', 'cancelled')
                    ->whereNull('renewal_date'),
                default => null,
            };
        }

        $allowedSorts = ['name', 'renewal_date', 'utilization', 'annualized_cost'];
        $sort = (string) $request->input('sort', 'name');
        if (! in_array($sort, $allowedSorts, true) || (! $canViewFinancials && $sort === 'annualized_cost')) {
            $sort = 'name';
        }
        $direction = strtolower((string) $request->input('direction', 'asc')) === 'desc' ? 'desc' : 'asc';

        if ($sort === 'renewal_date') {
            $query->orderByRaw('CASE WHEN renewal_date IS NULL THEN 1 ELSE 0 END ASC')
                ->orderBy('renewal_date', $direction);
        } elseif ($sort === 'annualized_cost') {
            $query->orderByRaw("(total_seats * cost_per_seat * CASE WHEN billing_cycle = 'monthly' THEN 12 ELSE 1 END) {$direction}");
        } elseif ($sort === 'utilization') {
            $activeSeatsSubquery = '(SELECT COUNT(*) FROM software_license_assignments WHERE software_license_assignments.software_license_id = software_licenses.id AND software_license_assignments.revoked_at IS NULL)';
            $query->orderByRaw("(1.0 * {$activeSeatsSubquery} / CASE WHEN total_seats > 0 THEN total_seats ELSE 1 END) {$direction}");
        } else {
            $query->orderBy('name', $direction);
        }

        $licenses = $query->paginate(15)->withQueryString();

        $employees = Employee::select(['id', 'name', 'department'])->orderBy('name')->get();
        $summary = $itamService->getSoftwareLicenseSummary();

        if (! $canViewFinancials) {
            $summary['annual_software_spend'] = null;
            $licenses->through(function (SoftwareLicense $lic): array {
                $arr = $lic->toArray();
                $arr['cost_per_seat'] = null;
                $arr['annualized_cost'] = null;

                return $arr;
            });
        }

        return Inertia::render('Licenses/Index', [
            'licenses' => $licenses,
            'employees' => $employees,
            'summary' => $summary,
            'financials_restricted' => ! $canViewFinancials,
            'filters' => array_merge(
                $request->only(['search', 'category', 'license_type', 'status', 'renewal_filter']),
                ['sort' => $sort, 'direction' => $direction]
            ),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('create', SoftwareLicense::class);

        $validated = $this->validateLicensePayload($request);
        $license = SoftwareLicense::create($validated);

        return back()->with('success', "Software license '{$license->name}' registered successfully.");
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $license = SoftwareLicense::withCount('activeAssignments')->findOrFail($id);
        Gate::authorize('update', $license);

        $validated = $this->validateLicensePayload($request);

        if ($validated['total_seats'] < $license->active_assignments_count) {
            return back()->withErrors([
                'total_seats' => "Cannot reduce total seats below currently assigned seats ({$license->active_assignments_count}).",
            ]);
        }

        $license->update($validated);

        return back()->with('success', "Software license '{$license->name}' updated successfully.");
    }

    public function destroy(int $id): RedirectResponse
    {
        $license = SoftwareLicense::withCount('activeAssignments')->findOrFail($id);
        Gate::authorize('delete', $license);

        if ($license->active_assignments_count > 0) {
            return back()->with('error', "Cannot delete '{$license->name}': {$license->active_assignments_count} seats are still assigned.");
        }

        $name = $license->name;
        $license->delete();

        return back()->with('success', "Software license '{$name}' deleted.");
    }

    public function assignSeat(Request $request, int $id): RedirectResponse
    {
        $license = SoftwareLicense::withCount('activeAssignments')->findOrFail($id);
        Gate::authorize('assignSeat', $license);

        $validated = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        if ($license->status !== 'active') {
            return back()->with('error', "Cannot assign seats for '{$license->name}' because its status is '{$license->status}'.");
        }

        if ($license->active_assignments_count >= $license->total_seats) {
            return back()->with('error', "All {$license->total_seats} seats for '{$license->name}' are already allocated.");
        }

        $employee = Employee::findOrFail((int) $validated['employee_id']);

        $alreadyAssigned = SoftwareLicenseAssignment::where('software_license_id', $license->id)
            ->where('employee_id', $employee->id)
            ->whereNull('revoked_at')
            ->exists();

        if ($alreadyAssigned) {
            return back()->with('error', "{$employee->name} already holds an active seat for '{$license->name}'.");
        }

        SoftwareLicenseAssignment::create([
            'software_license_id' => $license->id,
            'employee_id' => $employee->id,
            'assigned_at' => now(),
            'assigned_by_user_id' => auth()->id(),
            'notes' => $validated['notes'] ?? null,
        ]);

        return back()->with('success', "Assigned '{$license->name}' seat to {$employee->name}.");
    }

    public function revokeSeat(int $id): RedirectResponse
    {
        $assignment = SoftwareLicenseAssignment::with(['license', 'employee'])->findOrFail($id);
        Gate::authorize('revokeSeat', $assignment->license);

        if ($assignment->revoked_at !== null) {
            return back()->with('error', 'This license seat has already been revoked.');
        }

        $assignment->update(['revoked_at' => now()]);

        $empName = $assignment->employee?->name ?? 'employee';
        $licName = $assignment->license?->name ?? 'license';

        return back()->with('success', "Revoked '{$licName}' seat from {$empName}.");
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        Gate::authorize('exportCsv', SoftwareLicense::class);

        $licenses = SoftwareLicense::withCount('activeAssignments')->orderBy('name')->get();
        $filename = 'itfleet-software-licenses-'.date('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($licenses) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'name',
                'vendor',
                'category',
                'license_type',
                'billing_cycle',
                'total_seats',
                'assigned_seats',
                'available_seats',
                'cost_per_seat',
                'annualized_cost',
                'renewal_date',
                'renewal_status',
                'status',
            ]);

            foreach ($licenses as $license) {
                $assigned = (int) $license->active_assignments_count;
                $available = max(0, $license->total_seats - $assigned);

                fputcsv($handle, [
                    $this->sanitizeCsvCell($license->name),
                    $this->sanitizeCsvCell($license->vendor),
                    $this->sanitizeCsvCell($license->category),
                    $this->sanitizeCsvCell($license->license_type),
                    $this->sanitizeCsvCell($license->billing_cycle),
                    $license->total_seats,
                    $assigned,
                    $available,
                    $license->cost_per_seat,
                    $license->annualized_cost,
                    $license->renewal_date ? $license->renewal_date->toDateString() : '',
                    $this->sanitizeCsvCell($license->renewal_status),
                    $this->sanitizeCsvCell($license->status),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateLicensePayload(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'vendor' => ['required', 'string', 'max:120'],
            'license_key' => ['nullable', 'string', 'max:255'],
            'category' => ['required', Rule::in(SoftwareLicense::CATEGORIES)],
            'license_type' => ['required', Rule::in(SoftwareLicense::LICENSE_TYPES)],
            'billing_cycle' => ['required', Rule::in(SoftwareLicense::BILLING_CYCLES)],
            'total_seats' => ['required', 'integer', 'min:1', 'max:100000'],
            'cost_per_seat' => ['required', 'numeric', 'min:0'],
            'purchase_date' => ['nullable', 'date'],
            'renewal_date' => ['nullable', 'date'],
            'status' => ['required', Rule::in(SoftwareLicense::STATUSES)],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    private function sanitizeCsvCell(?string $value): string
    {
        $text = (string) ($value ?? '');
        if ($text !== '' && preg_match('/^[=+\-@\t\r]/', $text)) {
            return "'".$text;
        }

        return $text;
    }
}
