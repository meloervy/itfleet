<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\DemoPresetService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class DemoController extends Controller
{
    private const ROLE_EMAIL_MAP = [
        'admin' => 'admin@itfleet.local',
        'manager' => 'manager@itfleet.local',
        'technician' => 'tech@itfleet.local',
        'viewer' => 'auditor@itfleet.local',
    ];

    /**
     * Switch the active demo user role without manual re-authentication.
     */
    public function switchRole(Request $request, DemoPresetService $demoPresetService): RedirectResponse
    {
        $this->ensureDemoModeEnabled();

        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in(array_keys(self::ROLE_EMAIL_MAP))],
        ]);

        $demoPresetService->ensureDemoUsers();

        $targetEmail = self::ROLE_EMAIL_MAP[$validated['role']];
        $targetUser = User::where('email', $targetEmail)->firstOrFail();

        Auth::login($targetUser, true);
        $request->session()->regenerate();

        $roleTitle = $targetUser->role?->title() ?? ucfirst($validated['role']);
        $flashMessage = "Switched demo role to {$roleTitle} ({$targetUser->email}).";

        $previousPath = (string) parse_url((string) url()->previous(), PHP_URL_PATH);
        $isRestrictedToManagers = str_starts_with($previousPath, '/match')
            || str_starts_with($previousPath, '/devices/create');

        if (in_array($validated['role'], ['technician', 'viewer'], true) && $isRestrictedToManagers) {
            return redirect()->route('dashboard')->with('success', $flashMessage);
        }

        return redirect()->back(fallback: route('dashboard'))->with('success', $flashMessage);
    }

    /**
     * Replace the shared demo database with the selected company scale preset.
     */
    public function switchPreset(Request $request, DemoPresetService $demoPresetService): RedirectResponse
    {
        $this->ensureDemoModeEnabled();

        $validated = $request->validate([
            'preset' => ['required', 'string', Rule::in(array_keys(DemoPresetService::presets()))],
        ]);

        $summary = $demoPresetService->applyPreset($validated['preset']);

        return redirect()
            ->route('dashboard')
            ->with(
                'success',
                "Loaded {$summary['label']} preset — {$summary['company_name']} ({$summary['devices_count']} assets, {$summary['employees_count']} employees, {$summary['licenses_count']} licenses)."
            );
    }

    /**
     * Reset the currently active demo preset back to its clean seeded state.
     */
    public function reset(DemoPresetService $demoPresetService): RedirectResponse
    {
        $this->ensureDemoModeEnabled();

        $activePreset = $demoPresetService->getActivePreset();
        $summary = $demoPresetService->applyPreset($activePreset);

        return redirect()
            ->route('dashboard')
            ->with(
                'success',
                "Reset {$summary['label']} demo workspace to clean seeded state ({$summary['devices_count']} assets, {$summary['employees_count']} employees)."
            );
    }

    private function ensureDemoModeEnabled(): void
    {
        abort_unless((bool) config('itam.demo_mode'), 403, 'Demo mode is disabled.');
    }
}
