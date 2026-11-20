<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\RoleProfile;
use App\Services\MatchingService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EmployeeController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Employee::with([
            'roleProfile',
            'activeAssignment.device',
            'activeAssignments.device',
            'activeLicenseAssignments.license',
        ]);

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('department', 'like', "%{$s}%")
                    ->orWhereHas('roleProfile', function ($rq) use ($s) {
                        $rq->where('name', 'like', "%{$s}%");
                    })
                    ->orWhereHas('activeAssignment.device', function ($dq) use ($s) {
                        $dq->where('brand', 'like', "%{$s}%")
                            ->orWhere('model', 'like', "%{$s}%")
                            ->orWhere('asset_tag', 'like', "%{$s}%");
                    });
            });
        }

        if ($request->filled('department')) {
            $query->where('department', $request->input('department'));
        }

        if ($request->filled('role_profile_id')) {
            $query->where('role_profile_id', $request->input('role_profile_id'));
        }

        if ($request->filled('hardware_status')) {
            $status = $request->input('hardware_status');
            if ($status === 'assigned') {
                $query->has('activeAssignment');
            } elseif ($status === 'unassigned') {
                $query->doesntHave('activeAssignment');
            }
        }

        $allowedSorts = [
            'name' => 'name',
            'employee' => 'name',
            'department' => 'department',
            'created_at' => 'created_at',
            'date' => 'created_at',
        ];

        $sort = $request->input('sort', 'name');
        $direction = strtolower($request->input('direction', 'asc')) === 'desc' ? 'desc' : 'asc';
        $sortColumn = $allowedSorts[$sort] ?? 'name';

        $employees = $query->orderBy($sortColumn, $direction)->paginate(15)->withQueryString();

        $profiles = RoleProfile::orderBy('name')->get();
        $departments = Employee::whereNotNull('department')
            ->where('department', '!=', '')
            ->distinct()
            ->orderBy('department')
            ->pluck('department');

        $totalEmployees = Employee::count();
        $assignedEmployees = Employee::has('activeAssignment')->count();
        $unassignedEmployees = Employee::doesntHave('activeAssignment')->count();
        $withProfileEmployees = Employee::whereNotNull('role_profile_id')->count();

        $stats = [
            'total' => $totalEmployees,
            'assigned' => $assignedEmployees,
            'unassigned' => $unassignedEmployees,
            'with_profile' => $withProfileEmployees,
            'assigned_percentage' => $totalEmployees > 0 ? (int) round(($assignedEmployees / $totalEmployees) * 100) : 0,
        ];

        return Inertia::render('Employees/Index', [
            'employees' => $employees,
            'role_profiles' => $profiles,
            'departments' => $departments,
            'stats' => $stats,
            'filters' => array_merge(
                $request->only(['search', 'department', 'role_profile_id', 'hardware_status']),
                ['sort' => $sort, 'direction' => $direction]
            ),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'department' => ['required', 'string', 'max:100'],
            'role_profile_id' => ['nullable', 'exists:role_profiles,id'],
            'profile_picture' => ['nullable'],
            'profile_picture_file' => ['nullable', 'file', 'mimes:png,jpg,jpeg,webp,gif', 'max:5120'],
            'notes' => ['nullable', 'string'],
        ]);

        $this->handleProfilePicture($request, $validated, false);

        Employee::create($validated);

        return back()->with('success', "Employee {$validated['name']} registered successfully.");
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $employee = Employee::findOrFail($id);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'department' => ['required', 'string', 'max:100'],
            'role_profile_id' => ['nullable', 'exists:role_profiles,id'],
            'profile_picture' => ['nullable'],
            'profile_picture_file' => ['nullable', 'file', 'mimes:png,jpg,jpeg,webp,gif', 'max:5120'],
            'notes' => ['nullable', 'string'],
        ]);

        $this->handleProfilePicture($request, $validated, true);

        $employee->update($validated);

        return back()->with('success', "Employee {$employee->name} updated successfully.");
    }

    public function unassign(Request $request, int $id, MatchingService $matchingService): RedirectResponse
    {
        $employee = Employee::with('activeAssignment')->findOrFail($id);

        $assignmentId = $request->integer('assignment_id');
        if ($assignmentId > 0) {
            $targetAssignment = $employee->activeAssignments()->where('id', $assignmentId)->first();
            if ($targetAssignment) {
                $matchingService->unassignDevice($targetAssignment->id);

                return back()->with('success', "Asset successfully unassigned from {$employee->name}.");
            }
        }

        if ($employee->activeAssignment) {
            $matchingService->unassignDevice($employee->activeAssignment->id);

            return back()->with('success', "Device successfully unassigned from {$employee->name}.");
        }

        return back()->with('error', 'Employee has no active device assignment.');
    }

    /**
     * Offboard an employee, reclaim and sanitize their hardware asset, and return recirculation opportunities.
     */
    public function offboard(Request $request, int $id, MatchingService $matchingService): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'in:resignation,role_transition,hardware_upgrade,contract_end,other'],
            'condition' => ['required', 'string', 'in:excellent,good,fair,needs_repair'],
            'wipe_confirmed' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $result = $matchingService->reclaimDevice($id, $validated, auth()->id());

        if ($request->wantsJson()) {
            return response()->json($result);
        }

        return back()->with('success', $result['message'])
            ->with('reclaimed_details', $result);
    }

    /**
     * Export complete company staff directory and hardware allocation audit as PDF report.
     */
    public function exportPdf(Request $request)
    {
        Gate::authorize('exportPdf', Employee::class);

        $employees = Employee::with(['roleProfile', 'activeAssignment.device', 'activeAssignments.device'])
            ->orderBy('name')
            ->get();

        $pdf = Pdf::loadView('reports.employees_directory', [
            'employees' => $employees,
            'generated_at' => now()->format('F j, Y, g:i A'),
            'total_employees' => $employees->count(),
            'assigned_count' => $employees->filter(fn ($e) => $e->activeAssignment !== null)->count(),
        ])->setPaper('a4', 'landscape');

        return $pdf->download('itfleet-staff-directory-'.date('Ymd-His').'.pdf');
    }

    /**
     * Export employee directory and hardware custody mappings as CSV.
     */
    public function exportCsv(Request $request): StreamedResponse
    {
        Gate::authorize('exportCsv', Employee::class);

        $employees = Employee::with(['roleProfile', 'activeAssignment.device', 'activeAssignments.device'])
            ->orderBy('name')
            ->get();

        $filename = 'itfleet-employees-'.date('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($employees) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['name', 'department', 'role_profile', 'assigned_asset_tag', 'assigned_device', 'notes']);

            foreach ($employees as $employee) {
                $device = $employee->activeAssignment?->device;
                $additional = $employee->activeAssignments
                    ->filter(fn ($a) => $a->device && (! $device || $a->device->id !== $device->id))
                    ->map(fn ($a) => "{$a->device->asset_tag} ({$a->device->brand} {$a->device->model})")
                    ->implode('; ');

                $deviceSummary = $device ? "{$device->brand} {$device->model}" : '';
                if ($additional !== '') {
                    $deviceSummary = $deviceSummary !== '' ? "{$deviceSummary}; {$additional}" : $additional;
                }

                fputcsv($handle, [
                    $this->sanitizeCsvCell($employee->name),
                    $this->sanitizeCsvCell($employee->department),
                    $this->sanitizeCsvCell($employee->roleProfile?->name ?? ''),
                    $this->sanitizeCsvCell($device?->asset_tag ?? ''),
                    $this->sanitizeCsvCell($deviceSummary),
                    $this->sanitizeCsvCell($employee->notes ?? ''),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * Import or update employees from an uploaded CSV roster.
     */
    public function importCsv(Request $request): RedirectResponse
    {
        Gate::authorize('importCsv', Employee::class);

        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        if ($handle === false) {
            return back()->with('error', 'Unable to read the uploaded CSV file.');
        }

        $rawHeaders = fgetcsv($handle);
        if (! is_array($rawHeaders) || empty($rawHeaders)) {
            fclose($handle);

            return back()->with('error', 'The uploaded CSV file is empty.');
        }

        $rawHeaders[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $rawHeaders[0]);
        $headers = array_map(fn ($h) => strtolower(trim((string) $h)), $rawHeaders);

        if (! in_array('name', $headers, true) || ! in_array('department', $headers, true)) {
            fclose($handle);

            return back()->with('error', 'CSV must include "name" and "department" columns.');
        }

        $headerIndex = array_flip($headers);
        $roleProfiles = RoleProfile::all()->keyBy(fn (RoleProfile $rp) => strtolower(trim($rp->name)));

        $created = 0;
        $updated = 0;
        $skipped = 0;

        while (($row = fgetcsv($handle)) !== false) {
            if (count(array_filter($row, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }

            $name = trim((string) ($row[$headerIndex['name']] ?? ''));
            $department = trim((string) ($row[$headerIndex['department']] ?? ''));

            if ($name === '' || $department === '') {
                $skipped++;

                continue;
            }

            $attributes = [];

            if (isset($headerIndex['role_profile'])) {
                $roleName = strtolower(trim((string) ($row[$headerIndex['role_profile']] ?? '')));
                $attributes['role_profile_id'] = $roleName !== '' ? ($roleProfiles[$roleName]->id ?? null) : null;
            }

            if (isset($headerIndex['notes'])) {
                $notes = trim((string) ($row[$headerIndex['notes']] ?? ''));
                $attributes['notes'] = $notes !== '' ? $notes : null;
            }

            $employee = Employee::updateOrCreate(
                ['name' => $name, 'department' => $department],
                $attributes
            );

            if ($employee->wasRecentlyCreated) {
                $created++;
            } else {
                $updated++;
            }
        }

        fclose($handle);

        return back()->with('success', "CSV import complete: {$created} added, {$updated} updated, {$skipped} skipped.");
    }

    /**
     * Validate and store employee profile picture uploads or safe image paths/URLs.
     *
     * @param  array<string, mixed>  $validated
     */
    private function handleProfilePicture(Request $request, array &$validated, bool $isUpdate): void
    {
        $allowedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

        $file = null;
        $fileErrorKey = 'profile_picture_file';

        if ($request->hasFile('profile_picture_file')) {
            $file = $request->file('profile_picture_file');
        } elseif ($request->hasFile('profile_picture')) {
            $request->validate([
                'profile_picture' => ['file', 'mimes:png,jpg,jpeg,webp,gif', 'max:5120'],
            ]);
            $file = $request->file('profile_picture');
            $fileErrorKey = 'profile_picture';
        }

        if ($file !== null) {
            $clientExt = strtolower((string) $file->getClientOriginalExtension());
            $guessedExt = strtolower((string) $file->extension());
            $ext = in_array($clientExt, $allowedExtensions, true)
                ? $clientExt
                : (in_array($guessedExt, $allowedExtensions, true) ? $guessedExt : null);

            if ($ext === null) {
                throw ValidationException::withMessages([
                    $fileErrorKey => 'Only PNG, JPG, JPEG, WebP, or GIF image files are allowed.',
                ]);
            }

            $filename = 'emp_'.time().'_'.Str::random(8).'.'.$ext;
            $destination = public_path('user/uploads');
            if (! file_exists($destination)) {
                mkdir($destination, 0755, true);
            }
            $file->move($destination, $filename);
            $validated['profile_picture'] = 'public/user/uploads/'.$filename;
        } elseif (isset($validated['profile_picture']) && is_string($validated['profile_picture']) && trim($validated['profile_picture']) !== '') {
            $validated['profile_picture'] = $this->validateProfilePictureString(trim($validated['profile_picture']));
        } elseif ($isUpdate && $request->has('profile_picture') && empty($request->input('profile_picture'))) {
            $validated['profile_picture'] = 'public/user/default-profile-picture.png';
        } else {
            unset($validated['profile_picture']);
        }

        unset($validated['profile_picture_file']);
    }

    /**
     * Ensure string profile picture references are safe HTTP(S) URLs or local raster paths.
     */
    private function validateProfilePictureString(string $path): string
    {
        if (preg_match('/[\x00-\x1F\x7F]/', $path) || preg_match('/\.svg(?:[?#].*)?$/i', $path)) {
            throw ValidationException::withMessages([
                'profile_picture' => 'Profile picture must be a valid raster image URL or local path (SVG is not permitted).',
            ]);
        }

        if (preg_match('#^https?://#i', $path)) {
            if (! filter_var($path, FILTER_VALIDATE_URL)) {
                throw ValidationException::withMessages([
                    'profile_picture' => 'Invalid profile picture URL.',
                ]);
            }

            return $path;
        }

        if ((str_starts_with($path, 'public/') || str_starts_with($path, '/'))
            && ! str_contains($path, '..')
            && ! str_contains($path, '\\')
            && preg_match('#^(?:public/|/)[a-zA-Z0-9/_\.\-]+$#', $path)) {
            return $path;
        }

        throw ValidationException::withMessages([
            'profile_picture' => 'Profile picture must be a valid HTTP(S) image URL or safe local image path.',
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
