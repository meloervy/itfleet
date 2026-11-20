<?php

namespace App\Http\Middleware;

use App\Services\DemoPresetService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'reclaimed_details' => fn () => $request->session()->get('reclaimed_details'),
            ],
            'demo' => fn () => [
                'enabled' => (bool) config('itam.demo_mode'),
                'active_preset' => config('itam.demo_mode')
                    ? app(DemoPresetService::class)->getActivePreset()
                    : null,
                'presets' => config('itam.demo_mode')
                    ? array_values(DemoPresetService::presets())
                    : [],
            ],
        ];
    }
}
