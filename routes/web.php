<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DemoController;
use App\Http\Controllers\DeviceController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\FleetAssistantController;
use App\Http\Controllers\HardwareImageController;
use App\Http\Controllers\MaintenanceController;
use App\Http\Controllers\MatchingController;
use App\Http\Controllers\MismatchController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RoleProfileController;
use App\Http\Controllers\SoftwareLicenseController;
use App\Models\RoleProfile;
use App\Models\User;
use App\Services\DemoPresetService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::get('/', function (Request $request, DemoPresetService $demoPresetService) {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }

    if (config('itam.demo_mode')) {
        $demoPresetService->ensureDemoUsers();

        if (RoleProfile::count() === 0) {
            $preset = (string) config('itam.default_demo_preset', DemoPresetService::PRESET_SMALL);
            $demoPresetService->applyPreset($preset);
        }

        $admin = User::where('email', 'admin@itfleet.local')->first();
        if ($admin) {
            Auth::login($admin, true);
            $request->session()->regenerate();

            return redirect()->route('dashboard');
        }
    }

    return redirect()->route('login');
});

// Session Keep-Alive & Auth Health Heartbeat
Route::get('/session-keepalive', function () {
    return response()->json([
        'authenticated' => auth()->check(),
        'user' => auth()->user() ? [
            'id' => auth()->id(),
            'name' => auth()->user()->name,
            'role' => auth()->user()->role?->value ?? auth()->user()->role,
        ] : null,
        'csrf_token' => csrf_token(),
    ]);
})->name('session.keepalive');

Route::middleware('auth')->group(function () {
    // ------------------------------------------------------------------------
    // Read-Only & Universal Staff Routes (All Authenticated Roles)
    // ------------------------------------------------------------------------

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Devices (Listing & Detail Read-Only)
    Route::get('/devices', [DeviceController::class, 'index'])->name('devices.index');
    Route::get('/devices/{id}', [DeviceController::class, 'show'])->whereNumber('id')->name('devices.show');

    // Employees (Listing Read-Only)
    Route::get('/employees', [EmployeeController::class, 'index'])->name('employees.index');

    // Central Maintenance Log (Read-Only)
    Route::get('/maintenance', [MaintenanceController::class, 'index'])->name('maintenance.index');

    // Software Licenses & SaaS Directory (Read-Only)
    Route::get('/licenses', [SoftwareLicenseController::class, 'index'])->name('licenses.index');

    // Role Profiles (Read-Only)
    Route::get('/role-profiles', [RoleProfileController::class, 'index'])->name('role-profiles.index');

    // Mismatch Detection & Fleet Audit (Read-Only)
    Route::get('/mismatches', [MismatchController::class, 'index'])->name('mismatches.index');

    // AI Fleet Assistant ("Talk to your Fleet" - Read-Only Analytics & Conversations)
    Route::get('/fleet-assistant/context', [FleetAssistantController::class, 'context'])->name('fleet-assistant.context');
    Route::post('/fleet-assistant/query', [FleetAssistantController::class, 'query'])->name('fleet-assistant.query');
    Route::get('/fleet-assistant/conversations', [FleetAssistantController::class, 'conversations'])->name('fleet-assistant.conversations.index');
    Route::get('/fleet-assistant/conversations/{conversationId}', [FleetAssistantController::class, 'showConversation'])->name('fleet-assistant.conversations.show');
    Route::delete('/fleet-assistant/conversations/{conversationId}', [FleetAssistantController::class, 'destroyConversation'])->name('fleet-assistant.conversations.destroy');

    // Personal Account Profile Management
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::match(['patch', 'post'], '/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Demo Sandbox Switcher (Active only when ITFLEET_DEMO_MODE=true)
    Route::post('/demo/switch-role', [DemoController::class, 'switchRole'])->name('demo.switch-role');
    Route::post('/demo/switch-preset', [DemoController::class, 'switchPreset'])->name('demo.switch-preset');
    Route::post('/demo/reset', [DemoController::class, 'reset'])->name('demo.reset');

    // ------------------------------------------------------------------------
    // IT Asset Management & Administrative Operations (Admin & Manager Only)
    // ------------------------------------------------------------------------
    Route::middleware('role:admin,manager')->group(function () {
        // Devices (Inventory Mutations & Lifecycle Management)
        Route::get('/devices/create', [DeviceController::class, 'create'])->name('devices.create');
        Route::get('/devices/export/pdf', [DeviceController::class, 'exportPdf'])->name('devices.export.pdf');
        Route::get('/devices/export/csv', [DeviceController::class, 'exportCsv'])->name('devices.export.csv');
        Route::post('/devices', [DeviceController::class, 'store'])->name('devices.store');
        Route::put('/devices/{id}', [DeviceController::class, 'update'])->whereNumber('id')->name('devices.update');
        Route::delete('/devices/{id}', [DeviceController::class, 'destroy'])->whereNumber('id')->name('devices.destroy');
        Route::post('/devices/{id}/lifecycle', [DeviceController::class, 'updateLifecycle'])->whereNumber('id')->name('devices.lifecycle.update');
        Route::post('/devices/{id}/assign', [DeviceController::class, 'assign'])->whereNumber('id')->name('devices.assign');
        Route::post('/devices/{id}/unassign', [DeviceController::class, 'unassign'])->whereNumber('id')->name('devices.unassign');
        Route::post('/devices/{id}/reclaim', [DeviceController::class, 'reclaim'])->whereNumber('id')->name('devices.reclaim');
        Route::post('/devices/{id}/retire', [DeviceController::class, 'retire'])->whereNumber('id')->name('devices.retire');

        // Software Licenses & Seat Allocation
        Route::get('/licenses/export/pdf', [SoftwareLicenseController::class, 'exportPdf'])->name('licenses.export.pdf');
        Route::get('/licenses/export/csv', [SoftwareLicenseController::class, 'exportCsv'])->name('licenses.export.csv');
        Route::post('/licenses', [SoftwareLicenseController::class, 'store'])->name('licenses.store');
        Route::put('/licenses/{id}', [SoftwareLicenseController::class, 'update'])->whereNumber('id')->name('licenses.update');
        Route::delete('/licenses/{id}', [SoftwareLicenseController::class, 'destroy'])->whereNumber('id')->name('licenses.destroy');
        Route::post('/licenses/{id}/assign', [SoftwareLicenseController::class, 'assignSeat'])->whereNumber('id')->name('licenses.assign');
        Route::post('/license-assignments/{id}/revoke', [SoftwareLicenseController::class, 'revokeSeat'])->whereNumber('id')->name('licenses.revoke');

        // Hardware Imagery Lookup (Wikimedia & Canonical Registry)
        Route::post('/hardware/image-lookup', [HardwareImageController::class, 'lookup'])->name('hardware.image-lookup');

        // AI-Powered Device Spec Identification (Gemini)
        Route::post('/devices/identify-specs', [DeviceController::class, 'identifySpecs'])->name('devices.identify-specs');

        // Role Profiles (Configuration Mutations)
        Route::post('/role-profiles', [RoleProfileController::class, 'store'])->name('role-profiles.store');
        Route::put('/role-profiles/{id}', [RoleProfileController::class, 'update'])->whereNumber('id')->name('role-profiles.update');
        Route::delete('/role-profiles/{id}', [RoleProfileController::class, 'destroy'])->whereNumber('id')->name('role-profiles.destroy');

        // Employees (Directory Mutations & Allocation Actions)
        Route::get('/employees/export/pdf', [EmployeeController::class, 'exportPdf'])->name('employees.export.pdf');
        Route::get('/employees/export/csv', [EmployeeController::class, 'exportCsv'])->name('employees.export.csv');
        Route::post('/employees/import/csv', [EmployeeController::class, 'importCsv'])->name('employees.import.csv');
        Route::post('/employees', [EmployeeController::class, 'store'])->name('employees.store');
        Route::match(['put', 'post'], '/employees/{id}', [EmployeeController::class, 'update'])->whereNumber('id')->name('employees.update');
        Route::post('/employees/{id}/unassign', [EmployeeController::class, 'unassign'])->whereNumber('id')->name('employees.unassign');
        Route::post('/employees/{id}/offboard', [EmployeeController::class, 'offboard'])->whereNumber('id')->name('employees.offboard');

        // Match & Recommendation Engine
        Route::get('/match', [MatchingController::class, 'index'])->name('match.index');
        Route::post('/match/extract', [MatchingController::class, 'extract'])->name('match.extract');
        Route::post('/match/rank', [MatchingController::class, 'rank'])->name('match.rank');
        Route::post('/match/assign', [MatchingController::class, 'assign'])->name('match.assign');
        Route::post('/match/simulate', [MatchingController::class, 'simulate'])->name('match.simulate');
        Route::post('/match/bridge-swap', [MatchingController::class, 'executeBridgeSwap'])->name('match.bridge-swap');
        Route::post('/match/test-gemini', [MatchingController::class, 'testGemini'])->name('match.test-gemini');
    });

    // ------------------------------------------------------------------------
    // Hardware Maintenance & Servicing Operations (Admin, Manager, Technician)
    // ------------------------------------------------------------------------
    Route::middleware('role:admin,manager,technician')->group(function () {
        Route::post('/devices/{id}/maintenance', [MaintenanceController::class, 'store'])->whereNumber('id')->name('devices.maintenance.store');
        Route::put('/maintenance/{id}', [MaintenanceController::class, 'update'])->whereNumber('id')->name('maintenance.update');
    });
});

require __DIR__.'/auth.php';
