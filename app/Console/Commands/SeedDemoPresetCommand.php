<?php

namespace App\Console\Commands;

use App\Services\DemoPresetService;
use Illuminate\Console\Command;
use InvalidArgumentException;

class SeedDemoPresetCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'itfleet:demo-preset
                            {preset=small : The company preset to load (small, medium, large)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reset and seed the database with a deterministic ITFleet company scale preset';

    /**
     * Execute the console command.
     */
    public function handle(DemoPresetService $demoPresetService): int
    {
        $preset = strtolower((string) $this->argument('preset'));

        try {
            $summary = $demoPresetService->applyPreset($preset);
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("Loaded {$summary['label']} preset — {$summary['company_name']}");
        $this->table(
            ['Preset', 'Company', 'Total Assets', 'Compute', 'Employees', 'Licenses'],
            [[
                $summary['preset'],
                $summary['company_name'],
                $summary['devices_count'],
                $summary['compute_count'],
                $summary['employees_count'],
                $summary['licenses_count'],
            ]]
        );

        return self::SUCCESS;
    }
}
