<?php

namespace App\Ai\Tools;

use App\Models\Device;
use App\Services\ItamTrackingService;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class FleetFinancialsTool implements Tool
{
    public function name(): string
    {
        return 'inspect_fleet_financials';
    }

    /**
     * Get the description of the tool's purpose.
     */
    public function description(): Stringable|string
    {
        return 'Compute fleet financial valuation in Philippine Pesos (PHP): total acquisition CapEx, straight-line depreciated book value, accumulated depreciation, maintenance spend, and annualized SaaS/license spend.';
    }

    /**
     * Execute the read-only financial analytics query.
     */
    public function handle(Request $request): Stringable|string
    {
        $breakdownBy = (string) ($request['breakdown_by'] ?? 'overview');
        $tracking = app(ItamTrackingService::class);

        $financials = $tracking->getFinancialSummary();
        $maintenance = $tracking->getMaintenanceSummary();
        $licenses = $tracking->getSoftwareLicenseSummary();
        $categories = $tracking->getCategoryBreakdown();

        $devices = Device::all(['id', 'asset_tag', 'device_type', 'brand', 'model', 'location', 'purchase_cost', 'purchase_date', 'year_acquired', 'depreciation_rate_percent', 'lifecycle_stage']);

        $locationBreakdown = [];
        $categoryValuation = [];

        foreach ($devices as $device) {
            $loc = $device->location ?: 'Unassigned Location';
            $locKey = trim(explode('-', $loc)[0]);
            $cost = (float) ($device->purchase_cost ?? config('itam.default_purchase_cost', 65000.00));
            $book = (float) $device->current_book_value;

            if (! isset($locationBreakdown[$locKey])) {
                $locationBreakdown[$locKey] = ['location' => $locKey, 'units' => 0, 'acquisition_php' => 0.0, 'book_value_php' => 0.0];
            }
            $locationBreakdown[$locKey]['units']++;
            $locationBreakdown[$locKey]['acquisition_php'] = round($locationBreakdown[$locKey]['acquisition_php'] + $cost, 2);
            $locationBreakdown[$locKey]['book_value_php'] = round($locationBreakdown[$locKey]['book_value_php'] + $book, 2);

            $type = $device->device_type;
            if (! isset($categoryValuation[$type])) {
                $categoryValuation[$type] = ['category' => $type, 'units' => 0, 'acquisition_php' => 0.0, 'book_value_php' => 0.0];
            }
            $categoryValuation[$type]['units']++;
            $categoryValuation[$type]['acquisition_php'] = round($categoryValuation[$type]['acquisition_php'] + $cost, 2);
            $categoryValuation[$type]['book_value_php'] = round($categoryValuation[$type]['book_value_php'] + $book, 2);
        }

        usort($locationBreakdown, static fn (array $a, array $b): int => $b['book_value_php'] <=> $a['book_value_php']);

        $cards = [
            [
                'type' => 'financial',
                'id' => null,
                'asset_tag' => 'PHP CAPEX',
                'name' => 'Total Acquisition Value: ₱'.number_format($financials['total_acquisition_cost'], 2),
                'specs' => 'Depreciated Book Value: ₱'.number_format($financials['current_book_value'], 2),
                'location' => 'All Philippine Hubs',
                'status' => 'valuation',
                'action_url' => '/dashboard',
                'meta' => 'Depreciation: ₱'.number_format($financials['total_depreciation'], 2),
            ],
        ];

        return (string) json_encode([
            'tool' => $this->name(),
            'summary_label' => '₱'.number_format($financials['current_book_value'], 0).' book value',
            'currency' => 'PHP',
            'requested_breakdown' => $breakdownBy,
            'hardware_financials' => $financials,
            'category_counts' => $categories,
            'valuation_by_category' => array_values($categoryValuation),
            'valuation_by_location' => array_slice($locationBreakdown, 0, 10),
            'maintenance_spend' => [
                'completed_spend_php' => $maintenance['total_maintenance_spend'],
                'active_tickets_count' => $maintenance['active_maintenance_count'],
            ],
            'software_spend' => [
                'annual_software_spend_php' => $licenses['annual_software_spend'],
                'active_licenses' => $licenses['active_licenses'],
                'assigned_seats' => $licenses['assigned_seats'],
                'total_seats' => $licenses['total_seats'],
            ],
            'cards' => $cards,
        ]);
    }

    /**
     * Get the tool's schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'breakdown_by' => $schema->string()->enum(['overview', 'category', 'lifecycle_stage', 'location', 'software_spend'])->description('Dimension to highlight in the financial breakdown.'),
        ];
    }
}
