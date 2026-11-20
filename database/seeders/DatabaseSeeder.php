<?php

namespace Database\Seeders;

use App\Models\RoleProfile;
use App\Services\DemoPresetService;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with Philippine enterprise ITAM data.
     */
    public function run(): void
    {
        // 1. Seed Enterprise ITAM Staff Users (Admin, Asset Manager, Technician, Auditor)
        $this->call(UserSeeder::class);

        // Guard against duplicate seeding if database already contains records
        if (RoleProfile::count() > 0) {
            return;
        }

        // 2. Load default company scale preset (Small by default for test compatibility)
        $preset = (string) config('itam.default_demo_preset', DemoPresetService::PRESET_SMALL);
        app(DemoPresetService::class)->applyPreset($preset);
    }
}
