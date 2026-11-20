<?php

namespace App\Services\FleetAssistant;

use App\Enums\UserRole;
use App\Models\Device;
use App\Models\SoftwareLicense;
use App\Models\User;

class DeterministicFleetQueryResolver
{
    public function __construct(
        protected FleetContextBuilder $contextBuilder,
    ) {}

    /**
     * Resolve natural-language fleet queries deterministically against live database state.
     *
     * @param  array<int, array<string, mixed>>  $history
     * @param  array<string, mixed>  $pageContext
     * @return array<string, mixed>
     */
    public function resolve(
        string $prompt,
        array $snapshot,
        ?array $catalog = null,
        array $history = [],
        ?User $user = null,
        array $pageContext = [],
    ): array {
        $canViewFinancials = ! ($user && $user->role === UserRole::Technician);
        $lower = strtolower($prompt);

        if ($catalog === null) {
            $catalog = $this->contextBuilder->getCachedFleetCatalog();
        }

        if (! $canViewFinancials && $this->isFinancialPrompt($lower)) {
            return $this->withToolTrace([
                'success' => true,
                'answer' => "### Restricted Financial Data (Technician Role)\n\n"
                    ."As a **Hardware Technician**, financial analytics—including acquisition costs, depreciated book value, repair spend, and SaaS subscription pricing—are hidden by ITFleet's RBAC policy.\n\n"
                    .'Ask me about **hardware specs, available stockroom units, expiring warranties, active repair tickets, software license seat counts, or role mismatches** instead, or switch to an **Admin, Manager, or Auditor** role.',
                'category' => 'access_restricted',
                'data_cards' => [],
                'suggested_followups' => $this->getDefaultFollowups($user),
            ], 'rbac_policy_guard', 'RBAC Financial Policy', 'Restricted for Technician');
        }

        $historyText = strtolower(implode(' ', array_column($history, 'content')));

        $pageEntityResolution = $this->resolvePageContextQuery($lower, $pageContext, $canViewFinancials, $user);
        if ($pageEntityResolution !== null) {
            return $pageEntityResolution;
        }

        if ($this->matchesKeywords($lower, ['license', 'licenses', 'saas', 'subscription', 'seat', 'seats', 'figma', 'microsoft 365', 'adobe', 'jetbrains', 'slack', 'github', 'crowdstrike', 'okta'])) {
            return $this->resolveSoftwareLicensesQuery($lower, $canViewFinancials, $user);
        }

        $categoryResolution = $this->resolveCategoryQuery($lower, $catalog, $user);
        if ($categoryResolution !== null) {
            return $categoryResolution;
        }

        if (
            ! str_contains($lower, 'book value') && ! str_contains($lower, 'depreciation') && ! str_contains($lower, 'valuation') && ! str_contains($lower, 'cost') && ! str_contains($lower, 'worth') && ! str_contains($lower, 'financial') &&
            (
                (str_contains($lower, 'how many') && (str_contains($lower, 'company') || str_contains($lower, 'total') || str_contains($lower, 'overall') || str_contains($lower, 'organization') || str_contains($lower, 'fleet') || str_contains($lower, 'we have'))) ||
                (str_contains($lower, 'total') && (str_contains($lower, 'device') || str_contains($lower, 'computer') || str_contains($lower, 'laptop') || str_contains($lower, 'fleet'))) ||
                (str_contains($lower, 'all devices') || str_contains($lower, 'list all devices') || str_contains($lower, 'show all devices') || str_contains($lower, 'every device') || str_contains($lower, 'entire fleet') || str_contains($lower, 'whole fleet')) ||
                (str_contains($lower, 'ilan') && (str_contains($lower, 'company') || str_contains($lower, 'lahat') || str_contains($lower, 'kabuoan'))) ||
                $lower === 'how many devices are there' || $lower === 'how many devices do we have' || $lower === 'how many devices are there in a company'
            )
        ) {
            if (! str_contains($lower, 'idle') && ! str_contains($lower, 'available') && ! str_contains($lower, 'unassigned') && ! str_contains($lower, 'stockroom')) {
                return $this->resolveTotalCompanyDevicesQuery($catalog, $user);
            }
        }

        if (
            ! str_contains($lower, 'available') && ! str_contains($lower, 'idle') && ! str_contains($lower, 'stockroom') && ! str_contains($lower, 'bgc') && ! str_contains($lower, 'ortigas') && ! str_contains($lower, 'makati') &&
            preg_match('/\b(4|8|16|18|32|36|64|128)\s*(?:gb|gigabytes?)\b/i', $lower, $ramMatches) &&
            (str_contains($lower, 'ram') || str_contains($lower, 'memory') || str_contains($lower, 'have') || str_contains($lower, 'computer') || str_contains($lower, 'device') || str_contains($lower, 'laptop') || str_contains($lower, 'desktop') || str_contains($lower, 'machine'))
        ) {
            return $this->withToolTrace($this->resolveRamAttributeQuery((int) $ramMatches[1], $catalog), 'search_devices', 'Local DB · Search Devices', "{$ramMatches[1]}GB RAM filter");
        }

        $empSpecResolution = $this->resolveEmployeeStorageOrSpecQuery($lower, $catalog);
        if ($empSpecResolution !== null) {
            return $this->withToolTrace($empSpecResolution, 'inspect_employee_custody', 'Local DB · Employee Custody', 'Staff spec lookup');
        }

        if (
            (str_contains($lower, 'ssd') || str_contains($lower, 'hdd') || str_contains($lower, 'storage') || str_contains($lower, 'hard drive')) &&
            (str_contains($lower, 'how many') || str_contains($lower, 'which') || str_contains($lower, 'ilan') || str_contains($lower, 'who has'))
        ) {
            $storageResolution = $this->resolveStorageAttributeQuery($lower, $catalog);
            if ($storageResolution !== null) {
                return $this->withToolTrace($storageResolution, 'search_devices', 'Local DB · Search Devices', 'Storage capacity query');
            }
        }

        $upgradeResolution = $this->resolveUpgradeOrSwapRecommendationQuery($lower, $snapshot, $historyText, $catalog);
        if ($upgradeResolution !== null) {
            return $this->withToolTrace($upgradeResolution, 'inspect_mismatches_and_capacity', 'Local DB · Mismatches & Stock', 'Upgrade plan candidates');
        }

        if (
            (str_contains($lower, 'low end') || str_contains($lower, 'low-end') || str_contains($lower, 'low spec') || str_contains($lower, 'low-spec') || str_contains($lower, 'entry level') || str_contains($lower, 'entry-level') || str_contains($lower, 'mababang specs') || str_contains($lower, 'entry tier') || str_contains($lower, 'lowest')) &&
            (str_contains($lower, 'employee') || str_contains($lower, 'employees') || str_contains($lower, 'who') || str_contains($lower, 'sino') || str_contains($lower, 'staff') || str_contains($lower, 'user') || str_contains($lower, 'users') || str_contains($lower, 'using') || str_contains($lower, 'assigned'))
        ) {
            return $this->withToolTrace($this->resolveEmployeesUsingLowEndComputersQuery($snapshot), 'inspect_mismatches_and_capacity', 'Local DB · Low-Spec Audit', 'Entry-tier compute scan');
        }

        if (
            (str_contains($lower, 'mid range') || str_contains($lower, 'mid-range') || str_contains($lower, 'medium') || str_contains($lower, 'mid tier') || str_contains($lower, 'mid-tier') || str_contains($lower, 'standard tier')) &&
            (str_contains($lower, 'employee') || str_contains($lower, 'employees') || str_contains($lower, 'who') || str_contains($lower, 'sino') || str_contains($lower, 'staff') || str_contains($lower, 'using') || str_contains($lower, 'assigned'))
        ) {
            return $this->withToolTrace($this->resolveEmployeesUsingMidRangeComputersQuery($snapshot), 'inspect_employee_custody', 'Local DB · Mid-Tier Audit', 'Mid-tier compute scan');
        }

        if (
            (str_contains($lower, 'who') || str_contains($lower, 'sino') || str_contains($lower, 'which employee') || str_contains($lower, 'kanino') || str_contains($lower, 'using')) &&
            (str_contains($lower, 'high end desktop') || str_contains($lower, 'high-end desktop') || (str_contains($lower, 'desktop') && (str_contains($lower, 'high') || str_contains($lower, 'workstation'))) || str_contains($lower, 'precision 7960'))
        ) {
            return $this->withToolTrace($this->resolveWhoUsingHighEndDesktopQuery($snapshot), 'inspect_mismatches_and_capacity', 'Local DB · Workstation Audit', 'High-end desktop lookup');
        }

        if (
            (str_contains($lower, 'which employee') || str_contains($lower, 'who is using') || str_contains($lower, 'who uses') || str_contains($lower, 'who are using') || str_contains($lower, 'sino ang gumagamit') || str_contains($lower, 'sino gumagamit') || str_contains($lower, 'employees using') || str_contains($lower, 'users using') || str_contains($lower, 'using the high end') || str_contains($lower, 'using high end')) &&
            (str_contains($lower, 'high end') || str_contains($lower, 'high-end') || str_contains($lower, 'high performance') || str_contains($lower, 'workstation') || str_contains($lower, 'high spec') || str_contains($lower, 'high-spec'))
        ) {
            return $this->withToolTrace($this->resolveEmployeesUsingHighEndComputersQuery($snapshot), 'search_devices', 'Local DB · High-Spec Scan', 'High-tier assignments');
        }

        if (
            str_contains($lower, 'latest device') || str_contains($lower, 'newest device') ||
            str_contains($lower, 'recently registered') || str_contains($lower, 'recently added') ||
            str_contains($lower, 'latest asset') || str_contains($lower, 'newest asset') ||
            str_contains($lower, 'pinakabagong device') || str_contains($lower, 'bagong device') ||
            (str_contains($lower, 'latest') && (str_contains($lower, 'computer') || str_contains($lower, 'laptop') || str_contains($lower, 'hardware') || str_contains($lower, 'system') || str_contains($lower, 'inventory'))) ||
            (str_contains($lower, 'newest') && (str_contains($lower, 'computer') || str_contains($lower, 'laptop') || str_contains($lower, 'hardware') || str_contains($lower, 'system') || str_contains($lower, 'inventory')))
        ) {
            return $this->withToolTrace($this->resolveLatestDevicesQuery($catalog, $canViewFinancials), 'search_devices', 'Local DB · Latest Assets', 'Newest registered hardware');
        }

        $brandResolution = $this->resolveBrandOrFleetModelQuery($lower, $catalog, $snapshot);
        if ($brandResolution !== null) {
            return $this->withToolTrace($brandResolution, 'search_devices', 'Local DB · Brand Filter', 'Fleet catalog search');
        }

        $assignmentLookup = $this->resolveAssignmentLookupQuery($lower, $snapshot, $catalog);
        if ($assignmentLookup !== null) {
            return $this->withToolTrace($assignmentLookup, 'inspect_employee_custody', 'Local DB · Custody Lookup', 'Tag / assignee match');
        }

        if (
            str_contains($lower, 'idle') ||
            str_contains($lower, 'unassigned') ||
            str_contains($lower, 'standby') ||
            (str_contains($lower, 'available') && (str_contains($lower, 'device') || str_contains($lower, 'inventory') || str_contains($lower, 'stock') || str_contains($lower, 'computer') || str_contains($lower, 'laptop') || str_contains($lower, 'desktop'))) ||
            (str_contains($lower, 'inventory') && (str_contains($lower, 'stock') || str_contains($lower, 'idle') || str_contains($lower, 'available') || str_contains($lower, 'meron')))
        ) {
            return $this->withToolTrace($this->resolveIdleInventoryQuery($snapshot, $catalog), 'search_devices', 'Local DB · Stockroom Inventory', "{$snapshot['metrics']['idle_count']} idle units");
        }

        if ($this->matchesKeywords($lower, ['available', 'vacant', 'stock', 'stockroom', 'macbook', 'thinkpad', 'bgc', 'ortigas', 'makati', 'cebu', 'davao', 'free', 'meron', 'mayroon', 'nasaan'])) {
            return $this->withToolTrace($this->resolveInventoryAvailabilityQuery($lower, $snapshot, $catalog), 'search_devices', 'Local DB · Stockroom Search', 'Availability check');
        }

        if ($this->matchesKeywords($lower, ['warranty', 'warranties', 'expire', 'expiring', 'expired', 'coverage', 'sla', 'contract', 'paso'])) {
            return $this->withToolTrace($this->resolveWarrantyQuery($snapshot, $canViewFinancials), 'inspect_maintenance_and_warranties', 'Local DB · Warranty Audit', "{$snapshot['metrics']['expiring_warranties_count']} expiring");
        }

        if ($this->matchesKeywords($lower, ['mismatch', 'under-provisioned', 'underprovisioned', 'over-provisioned', 'overprovisioned', 'bottleneck', 'waste', 'kulang', 'sobra', 'alanganin'])) {
            return $this->withToolTrace($this->resolveMismatchQuery($lower, $snapshot), 'inspect_mismatches_and_capacity', 'Local DB · Mismatch Scan', "{$snapshot['metrics']['mismatches_count']} mismatches");
        }

        if ($this->matchesKeywords($lower, ['cost', 'book value', 'depreciation', 'acquisition', 'spend', 'valuation', 'financial', 'worth', 'halaga', 'magkano', 'budget', 'procurement'])) {
            return $this->withToolTrace($this->resolveFinancialQuery($snapshot), 'inspect_fleet_financials', 'Local DB · Fleet Valuation', 'PHP financials');
        }

        if ($this->matchesKeywords($lower, ['repair', 'maintenance', 'servicing', 'broken', 'technician', 'sira', 'inaayos', 'ayos', 'diagnostic'])) {
            return $this->withToolTrace($this->resolveMaintenanceQuery($snapshot), 'inspect_maintenance_and_warranties', 'Local DB · Maintenance Logs', count($snapshot['active_maintenance']).' active tickets');
        }

        return $this->withToolTrace($this->resolveGeneralFleetSummary($snapshot, $catalog, $canViewFinancials, $user), 'search_devices', 'Local DB · Fleet Overview', "{$snapshot['metrics']['total_devices']} hardware assets");
    }

    /**
     * @return list<string>
     */
    public function getDefaultFollowups(?User $user = null): array
    {
        if ($user && $user->role === UserRole::Technician) {
            return [
                'Which devices are currently undergoing repairs and maintenance?',
                'Which hardware warranties expire in the next 60 days?',
                'How many idle devices do we currently have in inventory?',
                'Which software licenses are near capacity or expiring soon?',
            ];
        }

        return [
            'Which employees are using low end specs?',
            'How many idle devices do we currently have in inventory?',
            'Show software license seat utilization and upcoming renewals',
            'What is our total fleet acquisition cost and current book value?',
        ];
    }

    protected function formatDeviceCard(array $device, string $status, string $meta, ?string $nameOverride = null): array
    {
        $specs = $device['spec_summary']
            ?? (! empty($device['ram_gb'])
                ? "{$device['ram_gb']}GB RAM • {$device['storage_gb']}GB ".($device['storage_type'] ?? 'SSD')." • {$device['cpu']}"
                : ucfirst((string) ($device['device_type'] ?? 'hardware')));

        return [
            'type' => 'device',
            'id' => $device['id'],
            'asset_tag' => $device['asset_tag'],
            'name' => $nameOverride ?? ($device['full_name'] ?? $device['name']),
            'specs' => $specs,
            'location' => $device['location'] ?? '',
            'status' => $status,
            'action_url' => "/devices/{$device['id']}",
            'image_url' => $device['image_url'] ?? '',
            'meta' => $meta,
        ];
    }

    protected function resolveLatestDevicesQuery(array $catalog, bool $canViewFinancials = true): array
    {
        $sorted = collect($catalog['all_devices'] ?? [])->sortByDesc('id')->values();
        $latest = $sorted->first();

        if (! $latest) {
            return [
                'success' => true,
                'answer' => 'There are currently no devices registered in the IT fleet database.',
                'category' => 'inventory_availability',
                'data_cards' => [],
                'suggested_followups' => $this->getDefaultFollowups(),
            ];
        }

        $statusText = match ($latest['status']) {
            'available' => "Available in Stockroom ({$latest['location']})",
            'assigned' => 'Assigned to '.($latest['assigned_employee']['name'] ?? 'Staff'),
            'in_repair' => 'In Repair / Maintenance',
            'retired' => 'Retired / Decommissioned',
            default => ucfirst($latest['status']),
        };

        $specsLabel = $latest['spec_summary']
            ?? "{$latest['ram_gb']}GB RAM • {$latest['storage_gb']}GB {$latest['storage_type']} • {$latest['cpu']}";

        $answer = "The most recently registered device in the fleet is **{$latest['asset_tag']}** ({$latest['full_name']}):\n\n"
            ."- **Asset Tag**: `{$latest['asset_tag']}`\n"
            ."- **Device Name**: **{$latest['full_name']}** (".ucfirst($latest['device_type']).")\n"
            ."- **Hardware Specifications**: {$specsLabel}\n"
            ."- **Current Status**: **{$statusText}**\n"
            ."- **Campus Location**: {$latest['location']}";

        if ($canViewFinancials) {
            $answer .= "\n- **Fleet Valuation**: ₱".number_format($latest['current_book_value'], 2);
        }

        $recentThree = $sorted->take(3)
            ->map(fn ($d) => $this->formatDeviceCard($d, $d['status'], '✨ Recently Registered'))
            ->values()
            ->all();

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'inventory_availability',
            'data_cards' => $recentThree,
            'suggested_followups' => [
                'How many devices are there in a company?',
                'How many idle devices do we currently have in inventory?',
                'Which employees are using low end specs?',
            ],
        ];
    }

    protected function resolveBrandOrFleetModelQuery(string $lower, array $catalog, array $snapshot): ?array
    {
        $all = collect($catalog['all_devices'] ?? []);
        $brandKeywords = [
            'macbook' => ['macbook', 'apple'],
            'apple' => ['apple', 'macbook'],
            'thinkpad' => ['thinkpad', 'lenovo'],
            'lenovo' => ['lenovo', 'thinkpad'],
            'dell' => ['dell', 'latitude', 'precision', 'xps'],
            'latitude' => ['latitude', 'dell'],
            'precision' => ['precision', 'dell'],
            'acer' => ['acer', 'aspire'],
            'aspire' => ['aspire', 'acer'],
            'hp' => ['hp', 'compaq', 'elitebook', 'probook'],
            'compaq' => ['compaq', 'hp'],
            'asus' => ['asus', 'zenbook'],
        ];

        $matchedTerms = null;
        $label = '';
        foreach ($brandKeywords as $keyword => $terms) {
            if (preg_match('/\b'.preg_quote($keyword, '/').'\b/i', $lower)) {
                $matchedTerms = $terms;
                $label = ucfirst($keyword);
                break;
            }
        }

        if (! $matchedTerms) {
            return null;
        }

        $matching = $all->filter(function ($d) use ($matchedTerms) {
            $brand = strtolower($d['brand'] ?? '');
            $model = strtolower($d['model'] ?? '');
            $fullName = strtolower($d['full_name'] ?? '');

            foreach ($matchedTerms as $term) {
                if (str_contains($brand, $term) || str_contains($model, $term) || str_contains($fullName, $term)) {
                    return true;
                }
            }

            return false;
        })->values();

        if ($matching->isEmpty()) {
            return [
                'success' => true,
                'answer' => "The organization currently has **0 {$label} devices** registered in the fleet inventory.\n\n"
                    ."Our fleet consists of **{$snapshot['metrics']['total_devices']} total devices** across Dell, Lenovo, Apple, HP, and Acer.",
                'category' => 'inventory_availability',
                'data_cards' => [],
                'suggested_followups' => [
                    'How many idle devices do we currently have in inventory?',
                    'How many devices are there in a company?',
                ],
            ];
        }

        $totalCount = $matching->count();
        $assigned = $matching->where('status', 'assigned');
        $available = $matching->where('status', 'available');
        $inRepair = $matching->where('status', 'in_repair');
        $retired = $matching->where('status', 'retired');

        $breakdownItems = [];
        $breakdownItems[] = $available->isNotEmpty()
            ? "- **Available in Stockroom ({$available->count()} ".($available->count() === 1 ? 'unit' : 'units').')**: Ready for immediate deployment.'
            : '- **Available in Stockroom (0 units)**: None currently idle; all are actively deployed or in servicing.';

        if ($assigned->isNotEmpty()) {
            $assignedList = $assigned->map(fn ($d) => "`{$d['asset_tag']}` ({$d['full_name']} → {$d['assigned_employee']['name']})")->implode(', ');
            $breakdownItems[] = "- **Assigned to Staff ({$assigned->count()} ".($assigned->count() === 1 ? 'unit' : 'units').")**: {$assignedList}.";
        }
        if ($inRepair->isNotEmpty()) {
            $repairList = $inRepair->map(fn ($d) => "`{$d['asset_tag']}` ({$d['full_name']})")->implode(', ');
            $breakdownItems[] = "- **In Repair / Maintenance ({$inRepair->count()} ".($inRepair->count() === 1 ? 'unit' : 'units').")**: {$repairList} undergoing hardware diagnostics.";
        }
        if ($retired->isNotEmpty()) {
            $retiredList = $retired->map(fn ($d) => "`{$d['asset_tag']}` ({$d['full_name']})")->implode(', ');
            $breakdownItems[] = "- **Retired / Decommissioned ({$retired->count()} ".($retired->count() === 1 ? 'unit' : 'units').")**: {$retiredList}.";
        }

        $answer = "Yes, ITFleet currently manages **{$totalCount} {$label} ".($totalCount === 1 ? 'device' : 'devices')."** across the enterprise IT fleet:\n\n"
            .implode("\n", $breakdownItems)."\n\n"
            ."| Asset Tag | Model | Specs | Status | Location | Assigned To |\n"
            ."|:---|:---|:---|:---|:---|:---|\n";

        foreach ($matching as $d) {
            $statusLabel = match ($d['status']) {
                'available' => '🟢 Available',
                'assigned' => '🔵 Assigned',
                'in_repair' => '🟡 In Repair',
                'retired' => '⚪ Retired',
                default => ucfirst($d['status']),
            };

            $assignedTo = $d['assigned_employee']
                ? "{$d['assigned_employee']['name']} ({$d['assigned_employee']['department']})"
                : 'In Stockroom';

            $answer .= "| `{$d['asset_tag']}` | **{$d['full_name']}** | {$d['ram_gb']}GB RAM • {$d['storage_gb']}GB {$d['storage_type']} | {$statusLabel} | {$d['location']} | {$assignedTo} |\n";
        }

        $cards = $matching->take(6)->map(fn ($d) => $this->formatDeviceCard(
            $d,
            $d['status'],
            match ($d['status']) {
                'available' => '🟢 Ready for Deployment',
                'assigned' => '🔵 Assigned to '.($d['assigned_employee']['name'] ?? 'Staff'),
                'in_repair' => '🟡 In Repair',
                'retired' => '⚪ Retired',
                default => ucfirst($d['status']),
            }
        ))->values()->all();

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'inventory_availability',
            'data_cards' => $cards,
            'suggested_followups' => [
                'How many devices are there in a company?',
                'How many idle devices do we currently have in inventory?',
                'Which employees are using low end specs?',
            ],
        ];
    }

    protected function resolveTotalCompanyDevicesQuery(array $catalog, ?User $user = null): array
    {
        $summary = $catalog['company_summary'];
        $devices = $catalog['all_devices'];
        $total = $summary['total_devices'];

        $inRepairDevices = collect($devices)->where('status', 'in_repair');
        $retiredDevices = collect($devices)->where('status', 'retired');

        $inRepairDetails = $inRepairDevices->isNotEmpty()
            ? ': '.$inRepairDevices->take(6)->map(fn ($d) => "`{$d['asset_tag']}` ({$d['full_name']})")->implode(', ').' under active hardware servicing.'
            : ' in stockroom/servicing.';

        $retiredDetails = $retiredDevices->isNotEmpty()
            ? ': '.$retiredDevices->take(6)->map(fn ($d) => "`{$d['asset_tag']}` ({$d['full_name']})")->implode(', ').' legacy decommissioned unit(s).'
            : ' legacy decommissioned units.';

        $repairCountLabel = $summary['in_repair_count'].' '.($summary['in_repair_count'] === 1 ? 'unit' : 'units');
        $retiredCountLabel = $summary['retired_count'].' '.($summary['retired_count'] === 1 ? 'unit' : 'units');

        $categorySummary = sprintf(
            '%d laptops, %d desktops, %d monitors, %d mobile units, %d peripherals',
            (int) ($summary['total_laptops'] ?? 0),
            (int) ($summary['total_desktops'] ?? 0) + (int) ($summary['total_workstations'] ?? 0),
            (int) ($summary['total_monitors'] ?? 0),
            (int) ($summary['total_mobiles'] ?? 0),
            (int) ($summary['total_peripherals'] ?? 0)
        );

        $previewDevices = array_slice($devices, 0, 25);
        $tableHeading = $total > 25
            ? "### Fleet Device Catalog Preview (25 of {$total} Devices)"
            : "### Complete Company Fleet Device Catalog ({$total} Devices)";

        $answer = "ITFleet currently manages **{$total} total devices** across the enterprise IT fleet ({$categorySummary}):\n\n"
            ."- **Available in Stockroom ({$summary['available_count']} units)**: Idle and ready for immediate employee deployment.\n"
            ."- **Assigned to Employees ({$summary['assigned_count']} units)**: Active in production across departments.\n"
            ."- **In Repair / Maintenance ({$repairCountLabel})**{$inRepairDetails}\n"
            ."- **Retired / Decommissioned ({$retiredCountLabel})**{$retiredDetails}\n\n"
            ."{$tableHeading}\n\n"
            ."| Asset Tag | Device Name | Category | Core Specs | Status | Location | Assigned To |\n"
            ."|:---|:---|:---|:---|:---|:---|:---|\n";

        foreach ($previewDevices as $d) {
            $statusLabel = match ($d['status']) {
                'available' => 'Available',
                'assigned' => 'Assigned',
                'in_repair' => 'In Repair',
                'retired' => 'Retired',
                default => ucfirst($d['status']),
            };
            $assignedTo = $d['assigned_employee']
                ? "{$d['assigned_employee']['name']} ({$d['assigned_employee']['department']})"
                : '—';
            $specs = $d['spec_summary'] ?: "{$d['ram_gb']}GB RAM • {$d['storage_gb']}GB {$d['storage_type']} • {$d['cpu']}";

            $answer .= "| `{$d['asset_tag']}` | **{$d['full_name']}** | ".ucfirst($d['device_type'])." | {$specs} | {$statusLabel} | {$d['location']} | {$assignedTo} |\n";
        }

        if ($total > 25) {
            $answer .= "\n*Showing first 25 of {$total} hardware records. Narrow down by category (e.g. monitors, laptops) or hub location for targeted lists.*";
        }

        return $this->withToolTrace([
            'success' => true,
            'answer' => $answer,
            'category' => 'inventory_availability',
            'data_cards' => [],
            'suggested_followups' => [
                'How many idle devices do we currently have in inventory?',
                'How many computers have 32GB RAM?',
                'Which employees are using low end specs?',
                'Show software license seat utilization and upcoming renewals',
            ],
        ], 'search_devices', 'Local DB · Total Fleet', "{$total} hardware assets");
    }

    protected function resolveRamAttributeQuery(int $targetRam, array $catalog): array
    {
        $matching = collect($catalog['all_devices'])->filter(fn ($d) => (int) $d['ram_gb'] === $targetRam)->values();
        $count = $matching->count();

        if ($count === 0) {
            return [
                'success' => true,
                'answer' => "There are currently **0 computers** in the company fleet equipped with **{$targetRam}GB RAM**.\n\n"
                    .'Our fleet RAM configurations are: '.collect($catalog['ram_distribution'])->map(fn ($cnt, $r) => "**{$r}GB** ({$cnt} devices)")->implode(', ').'.',
                'category' => 'inventory_availability',
                'data_cards' => [],
                'suggested_followups' => [
                    'How many computers have 32GB RAM?',
                    'How many computers have 16GB RAM?',
                    'How many devices are there in a company?',
                ],
            ];
        }

        $answer = "There are currently **{$count} computers** in the company fleet equipped with **{$targetRam}GB RAM**:\n\n"
            ."| Asset Tag | Device Name | Category | Storage | CPU | Status | Assigned To |\n"
            ."|:---|:---|:---|:---|:---|:---|:---|\n";

        foreach ($matching as $d) {
            $statusLabel = match ($d['status']) {
                'available' => 'Available (Stockroom)',
                'assigned' => 'Assigned',
                'in_repair' => 'In Repair',
                'retired' => 'Retired',
                default => ucfirst($d['status']),
            };
            $assignedTo = $d['assigned_employee']
                ? "{$d['assigned_employee']['name']} ({$d['assigned_employee']['department']})"
                : "In Stockroom ({$d['location']})";

            $answer .= "| `{$d['asset_tag']}` | **{$d['full_name']}** | ".ucfirst($d['device_type'])." | {$d['storage_gb']}GB {$d['storage_type']} | {$d['cpu']} | {$statusLabel} | {$assignedTo} |\n";
        }

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'inventory_availability',
            'data_cards' => [],
            'suggested_followups' => [
                'How many computers have 16GB RAM?',
                'How many computers have 64GB RAM?',
                'How many devices are there in a company?',
                'Which employees are using low end specs?',
            ],
        ];
    }

    protected function resolveEmployeeStorageOrSpecQuery(string $lower, array $catalog): ?array
    {
        $matchedEmp = null;
        foreach (collect($catalog['all_employees']) as $emp) {
            $name = strtolower($emp['name']);
            $parts = explode(' ', $name);
            $firstName = strtolower($parts[0] ?? '');
            $lastName = strtolower(end($parts));

            if (
                str_contains($lower, $name) ||
                (strlen($firstName) > 3 && str_contains($lower, $firstName)) ||
                (strlen($lastName) > 3 && str_contains($lower, $lastName))
            ) {
                $matchedEmp = $emp;
                break;
            }
        }

        if (! $matchedEmp) {
            return null;
        }

        $empName = $matchedEmp['name'];
        $empDept = $matchedEmp['department'];
        $empRole = $matchedEmp['role'];
        $dev = $matchedEmp['assigned_device'];

        if (! $dev) {
            return [
                'success' => true,
                'answer' => "**{$empName}** ({$empDept} — {$empRole}) currently has **no device assigned** in the ITAM system.",
                'category' => 'inventory_availability',
                'data_cards' => [],
                'suggested_followups' => [
                    'How many idle devices do we currently have in inventory?',
                    'Which employees are using low end specs?',
                ],
            ];
        }

        $storageFormatted = "{$dev['storage_gb']}GB {$dev['storage_type']}";
        $isAskingStorage = str_contains($lower, 'ssd') || str_contains($lower, 'storage') || str_contains($lower, 'disk') || str_contains($lower, 'drive') || str_contains($lower, 'capacity') || str_contains($lower, 'size') || str_contains($lower, 'laki');

        if ($isAskingStorage) {
            $answer = "**{$empName}** ({$empDept}) is equipped with a **{$storageFormatted}** on their assigned **{$dev['name']} [`{$dev['asset_tag']}`]**.\n\n"
                ."- **Assigned Machine**: {$dev['name']} (`{$dev['asset_tag']}`)\n"
                ."- **Storage Capacity**: **{$storageFormatted}**\n"
                ."- **Memory (RAM)**: {$dev['ram_gb']}GB RAM\n"
                ."- **Processor (CPU)**: {$dev['cpu']}\n"
                ."- **Role Profile**: {$empRole}";
        } else {
            $answer = "**{$empName}** ({$empDept} — {$empRole}) is currently assigned a **{$dev['name']} [`{$dev['asset_tag']}`]**.\n\n"
                ."- **Hardware Specifications**: {$dev['ram_gb']}GB RAM • **{$storageFormatted}** • {$dev['cpu']}\n"
                .'- **Device Form Factor**: '.ucfirst($dev['device_type'])."\n"
                ."- **Asset Tag**: `{$dev['asset_tag']}`";
        }

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'inventory_availability',
            'data_cards' => [],
            'suggested_followups' => [
                "Can we upgrade {$empName}?",
                'Which employees are using low end specs?',
                'How many computers have 32GB RAM?',
                'How many devices are there in a company?',
            ],
        ];
    }

    protected function resolveStorageAttributeQuery(string $lower, array $catalog): ?array
    {
        $all = collect($catalog['all_devices']);
        $targetGb = null;

        if (str_contains($lower, '1tb') || str_contains($lower, '1 tb') || str_contains($lower, '1024gb') || str_contains($lower, '1024 gb')) {
            $targetGb = 1024;
        } elseif (str_contains($lower, '512gb') || str_contains($lower, '512 gb')) {
            $targetGb = 512;
        } elseif (str_contains($lower, '256gb') || str_contains($lower, '256 gb')) {
            $targetGb = 256;
        } elseif (str_contains($lower, '2tb') || str_contains($lower, '2 tb') || str_contains($lower, '2048gb') || str_contains($lower, '2048 gb')) {
            $targetGb = 2048;
        } elseif (str_contains($lower, '4tb') || str_contains($lower, '4 tb') || str_contains($lower, '4096gb') || str_contains($lower, '4096 gb')) {
            $targetGb = 4096;
        } elseif (str_contains($lower, 'hdd') || str_contains($lower, 'hard drive')) {
            $hddDevices = $all->filter(fn ($d) => strtoupper($d['storage_type']) === 'HDD')->values();
            $count = $hddDevices->count();
            $answer = "There are **{$count} computers** in the company fleet still using traditional mechanical HDDs:\n\n"
                ."| Asset Tag | Device Name | Storage | Status | Assigned To |\n"
                ."|:---|:---|:---|:---|:---|\n";
            foreach ($hddDevices as $d) {
                $assignedTo = $d['assigned_employee'] ? "{$d['assigned_employee']['name']} ({$d['assigned_employee']['department']})" : 'In Stockroom';
                $answer .= "| `{$d['asset_tag']}` | **{$d['full_name']}** | {$d['storage_gb']}GB {$d['storage_type']} | {$d['status']} | {$assignedTo} |\n";
            }
            $answer .= "\n> **Recommendation**: Upgrade legacy HDD systems to high-speed NVMe/SATA SSDs to boost read/write performance.";

            return [
                'success' => true,
                'answer' => $answer,
                'category' => 'inventory_availability',
                'data_cards' => [],
                'suggested_followups' => [
                    'How many computers have 32GB RAM?',
                    'How many devices are there in a company?',
                ],
            ];
        }

        if ($targetGb === null) {
            return null;
        }

        $matching = $all->filter(fn ($d) => (int) $d['storage_gb'] === $targetGb)->values();
        $count = $matching->count();
        $label = $targetGb >= 1024 ? ($targetGb / 1024).'TB' : "{$targetGb}GB";

        $answer = "There are **{$count} computers** in the company fleet equipped with **{$label} storage**:\n\n"
            ."| Asset Tag | Device Name | Category | Storage | RAM | Status | Assigned To |\n"
            ."|:---|:---|:---|:---|:---|:---|:---|\n";

        foreach ($matching as $d) {
            $statusLabel = match ($d['status']) {
                'available' => 'Available',
                'assigned' => 'Assigned',
                'in_repair' => 'In Repair',
                'retired' => 'Retired',
                default => ucfirst($d['status']),
            };
            $assignedTo = $d['assigned_employee']
                ? "{$d['assigned_employee']['name']} ({$d['assigned_employee']['department']})"
                : "In Stockroom ({$d['location']})";

            $answer .= "| `{$d['asset_tag']}` | **{$d['full_name']}** | ".ucfirst($d['device_type'])." | {$d['storage_gb']}GB {$d['storage_type']} | {$d['ram_gb']}GB | {$statusLabel} | {$assignedTo} |\n";
        }

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'inventory_availability',
            'data_cards' => [],
            'suggested_followups' => [
                'How many computers have 32GB RAM?',
                'How many devices are there in a company?',
            ],
        ];
    }

    protected function resolveEmployeesUsingLowEndComputersQuery(array $snapshot): array
    {
        $assigned = collect($snapshot['assigned_devices']);
        $available = collect($snapshot['available_devices'])
            ->filter(fn (array $d): bool => in_array(strtolower((string) ($d['device_type'] ?? '')), ['laptop', 'desktop'], true));

        $lowEndAssigned = $assigned->filter(
            fn (array $d): bool => ($d['spec_tier'] ?? '') === 'low'
                || ($d['cpu_tier'] ?? '') === 'entry'
                || ((int) ($d['ram_gb'] ?? 0) > 0 && (int) ($d['ram_gb'] ?? 0) <= 8)
        )->values();

        $count = $lowEndAssigned->count();
        $answer = "Currently, **{$count} employees** are assigned to low-end / entry-spec machines (<=8GB RAM or entry-tier CPUs):\n\n"
            ."| Employee | Department | Role Profile | Assigned Machine | Tag | Hardware Specs | Match / Fit Status |\n"
            ."|:---|:---|:---|:---|:---|:---|:---|\n";

        $cards = [];
        $flaggedNames = [];

        foreach ($lowEndAssigned->take(20) as $item) {
            $emp = $item['employee'];
            $empName = $emp['name'] ?? 'Employee';
            $empDept = $emp['department'] ?? 'General';
            $empRole = $emp['role_profile'] ?? 'Standard Role';
            $isMismatch = ! empty($item['is_mismatch']);
            $statusText = $isMismatch ? '**Under-provisioned Mismatch**' : '**Acceptable Fit**';

            $answer .= "| **{$empName}** | {$empDept} | {$empRole} | {$item['name']} | `{$item['asset_tag']}` | {$item['ram_gb']}GB RAM • {$item['cpu']} | {$statusText} |\n";

            if (count($cards) < 4) {
                $cards[] = $this->formatDeviceCard(
                    $item,
                    'assigned',
                    $isMismatch ? 'Under-provisioned' : 'Acceptable Fit',
                    "{$item['name']} ({$empName})"
                );
            }

            if ($isMismatch) {
                $flaggedNames[] = "**{$empName}** ({$empRole} on `{$item['asset_tag']}`)";
            }
        }

        $upgradePool = $available->filter(
            fn (array $d): bool => in_array(strtolower((string) ($d['cpu_tier'] ?? '')), ['high', 'mid', 'workstation'], true) || (int) ($d['ram_gb'] ?? 0) >= 16
        )->sortByDesc(fn (array $d): int => (int) ($d['ram_gb'] ?? 0))->values();

        $answer .= "\n### Live ITAM Assessment\n";
        if (! empty($flaggedNames)) {
            $answer .= '- **Mismatches Requiring Action**: '.implode(', ', array_slice($flaggedNames, 0, 5)).".\n";
        } else {
            $answer .= "- All listed entry-spec deployments are aligned with standard administrative/clerical role profiles.\n";
        }

        if ($upgradePool->isNotEmpty()) {
            $topSuggestions = $upgradePool->take(3)
                ->map(fn (array $d): string => "`{$d['asset_tag']}` ({$d['name']}, {$d['ram_gb']}GB RAM)")
                ->implode(', ');
            $answer .= "- **Top Stockroom Upgrade Candidates**: {$topSuggestions}.";
            foreach ($upgradePool->take(3) as $rec) {
                $cards[] = $this->formatDeviceCard($rec, 'available', '🟢 Staged for Reassignment', "{$rec['name']} (Upgrade Candidate)");
            }
        }

        $firstFlaggedName = $lowEndAssigned->first(fn (array $d): bool => ! empty($d['is_mismatch']))['employee']['name'] ?? null;

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'fleet_mismatches',
            'data_cards' => $cards,
            'suggested_followups' => array_values(array_filter([
                $firstFlaggedName ? "Can we upgrade {$firstFlaggedName}?" : null,
                'Who is using the high end desktop?',
                'How many idle devices do we currently have in inventory?',
            ])),
        ];
    }

    protected function resolveEmployeesUsingMidRangeComputersQuery(array $snapshot): array
    {
        $midAssigned = collect($snapshot['assigned_devices'])->filter(fn ($d) => ($d['spec_tier'] ?? '') === 'mid');
        $count = $midAssigned->count();

        $answer = "Currently, **{$count} employees** are assigned to mid-range productivity computers (16GB RAM with mid-tier processors):\n\n"
            ."| Employee | Department | Role Profile | Assigned Machine | Tag | Hardware Specs | Match / Fit Status |\n"
            ."|:---|:---|:---|:---|:---|:---|:---|\n";

        $cards = [];
        foreach ($midAssigned->take(20) as $item) {
            $emp = $item['employee'];
            $empName = $emp['name'] ?? 'Employee';
            $empDept = $emp['department'] ?? 'General';
            $empRole = $emp['role_profile'] ?? 'Standard Role';
            $score = $emp['match_score'] ?? 95;

            $answer .= "| **{$empName}** | {$empDept} | {$empRole} | {$item['name']} | `{$item['asset_tag']}` | {$item['ram_gb']}GB RAM • {$item['cpu']} | 🟢 **Optimal Fit ({$score}%)** |\n";
            if (count($cards) < 6) {
                $cards[] = $this->formatDeviceCard($item, 'assigned', "🟢 Fit Score: {$score}%", "{$item['name']} ({$empName})");
            }
        }

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'inventory_availability',
            'data_cards' => $cards,
            'suggested_followups' => [
                'Which employees are using low end specs?',
                'Which employees is using the high end computers?',
                'How many idle devices do we currently have in inventory?',
            ],
        ];
    }

    protected function resolveWhoUsingHighEndDesktopQuery(array $snapshot): array
    {
        $assignedDevices = collect($snapshot['assigned_devices']);
        $availableDevices = collect($snapshot['available_devices']);

        $highEndDesktop = $assignedDevices->first(function (array $d): bool {
            $isDesktop = in_array(strtolower((string) ($d['device_type'] ?? '')), ['desktop', 'workstation'], true);
            $isWorkstation = ($d['cpu_tier'] ?? '') === 'workstation' || (int) ($d['ram_gb'] ?? 0) >= 64;

            return $isDesktop && $isWorkstation;
        });

        $idleWorkstations = $availableDevices->filter(
            fn (array $d): bool => in_array(strtolower((string) ($d['device_type'] ?? '')), ['desktop', 'workstation'], true)
                && ((int) ($d['ram_gb'] ?? 0) >= 32 || ($d['cpu_tier'] ?? '') === 'workstation')
        )->values();

        if (! $highEndDesktop) {
            $cards = $idleWorkstations->take(4)->map(fn (array $idle): array => $this->formatDeviceCard($idle, 'available', 'Idle in Stockroom'))->all();

            return [
                'success' => true,
                'answer' => 'There is currently **no high-end desktop workstation** assigned to any employee. There are **'.$idleWorkstations->count().' workstation desktop(s)** idle in stockroom.',
                'category' => 'inventory_availability',
                'data_cards' => $cards,
                'suggested_followups' => [
                    'Which employees is using the high end computers?',
                    'How many idle devices do we currently have in inventory?',
                ],
            ];
        }

        $emp = $highEndDesktop['employee'] ?? [];
        $empName = $emp['name'] ?? 'Assigned Staff';
        $empDept = $emp['department'] ?? 'General';
        $empRole = $emp['role_profile'] ?? 'Standard Role';

        $mismatchEntry = collect($snapshot['mismatches'] ?? [])->firstWhere('device_id', $highEndDesktop['id']);
        $matchScorePct = $mismatchEntry['score'] ?? $emp['match_score'] ?? null;
        $isMismatch = $mismatchEntry !== null || ! empty($highEndDesktop['is_mismatch']) || ($matchScorePct !== null && $matchScorePct < 65);

        $answer = "The primary high-end desktop workstation in active use is **{$highEndDesktop['asset_tag']}** ({$highEndDesktop['name']} with {$highEndDesktop['ram_gb']}GB RAM and {$highEndDesktop['cpu']}).\n\n"
            ."### Current Assignment Details\n"
            ."- **Assigned Employee**: **{$empName}**\n"
            ."- **Department**: **{$empDept}**\n"
            ."- **Role Profile**: **{$empRole}**\n"
            ."- **Machine**: **{$highEndDesktop['name']}** (`{$highEndDesktop['asset_tag']}`)\n"
            ."- **Hardware Specs**: **{$highEndDesktop['ram_gb']}GB RAM • {$highEndDesktop['storage_gb']}GB SSD • {$highEndDesktop['cpu']} • {$highEndDesktop['gpu']}**\n";

        if ($isMismatch) {
            $classType = $mismatchEntry['classification'] ?? 'over-provisioned';
            $classTitle = $classType === 'over-provisioned'
                ? 'Over-provisioning Mismatch'
                : 'Hardware-Role Mismatch';
            $scoreDisplay = $matchScorePct !== null ? " (Match Score: **{$matchScorePct}%**)" : '';
            $rationale = $mismatchEntry['rationale'] ?? 'High-capacity workstation hardware exceeds standard role profile requirements.';
            $answer .= "\n> **ITAM Governance Alert (Active Mismatch)**:\n"
                ."> ITFleet's matching engine flagged this assignment as an **{$classTitle}**{$scoreDisplay}. {$rationale}\n";
            $primaryMeta = "Over-provisioned Mismatch ({$matchScorePct}%)";
        } else {
            $primaryMeta = $matchScorePct !== null ? "Optimal Fit ({$matchScorePct}%)" : 'Active Workstation';
        }

        $answer .= "\n### Available High-End Desktops in Stockroom\n";
        if ($idleWorkstations->isEmpty()) {
            $answer .= "- No idle high-end desktops currently in stockroom.\n";
        } else {
            foreach ($idleWorkstations->take(6) as $idle) {
                $answer .= "- **{$idle['asset_tag']}**: {$idle['name']} ({$idle['ram_gb']}GB RAM, {$idle['cpu_tier']} tier) at **{$idle['location']}**\n";
            }
        }

        $cards = [
            $this->formatDeviceCard(
                $highEndDesktop,
                'assigned',
                $primaryMeta,
                "{$highEndDesktop['name']} (Assigned to {$empName})"
            ),
        ];

        foreach ($idleWorkstations->take(3) as $idle) {
            $cards[] = $this->formatDeviceCard($idle, 'available', 'Idle in Stockroom');
        }

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'inventory_availability',
            'data_cards' => $cards,
            'suggested_followups' => [
                'Which employees is using the high end computers?',
                'Which employees are using low end specs?',
                'How many idle devices do we currently have in inventory?',
            ],
        ];
    }

    protected function resolveEmployeesUsingHighEndComputersQuery(array $snapshot): array
    {
        $assigned = collect($snapshot['assigned_devices']);
        $available = collect($snapshot['available_devices']);

        $highEndAssigned = $assigned->filter(
            fn ($d) => in_array(strtolower($d['cpu_tier'] ?? ''), ['workstation', 'high']) || ($d['ram_gb'] ?? 0) >= 18
        )->sortByDesc('ram_gb');

        $count = $highEndAssigned->count();
        $answer = "Currently, **{$count} employees** across the organization are actively provisioned with high-end computers (workstation desktops and high-tier laptops with >=18GB RAM):\n\n"
            ."| Employee | Department | Role Profile | Assigned Machine | Tag | Hardware Specs | Match / Fit Status |\n"
            ."|:---|:---|:---|:---|:---|:---|:---|\n";

        $cards = [];
        foreach ($highEndAssigned->take(20) as $item) {
            $emp = $item['employee'];
            $empName = $emp['name'] ?? 'Employee';
            $empDept = $emp['department'] ?? 'General';
            $empRole = $emp['role_profile'] ?? 'Standard Role';
            $isOverMismatch = ! empty($item['is_mismatch']) && ($item['mismatch_classification'] ?? '') === 'over-provisioned';
            $statusBadge = $isOverMismatch ? '**Over-provisioned Mismatch**' : '**Optimal Fit**';

            $answer .= "| **{$empName}** | {$empDept} | {$empRole} | {$item['name']} | `{$item['asset_tag']}` | {$item['ram_gb']}GB RAM • {$item['cpu']} | {$statusBadge} |\n";
            if (count($cards) < 4) {
                $cards[] = $this->formatDeviceCard(
                    $item,
                    'assigned',
                    $isOverMismatch ? 'Over-provisioned' : 'Active Assignment',
                    "{$item['name']} ({$empName})"
                );
            }
        }

        $idleHighEnd = $available->filter(
            fn ($d) => in_array(strtolower($d['cpu_tier'] ?? ''), ['workstation', 'high']) || ($d['ram_gb'] ?? 0) >= 32
        );

        if ($idleHighEnd->isNotEmpty()) {
            $answer .= "\n### Idle High-End Computers in Stockroom\n"
                ."We also have **{$idleHighEnd->count()} high-performance computers available for deployment**:\n";
            foreach ($idleHighEnd->take(6) as $idle) {
                $answer .= "- **{$idle['asset_tag']}**: {$idle['name']} ({$idle['ram_gb']}GB RAM, {$idle['cpu']}) in **{$idle['location']}**\n";
                if (count($cards) < 6) {
                    $cards[] = $this->formatDeviceCard($idle, 'available', '🟢 Idle in Stockroom');
                }
            }
        }

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'inventory_availability',
            'data_cards' => $cards,
            'suggested_followups' => [
                'Who is using the high end desktop?',
                'Which employees are using low end specs?',
                'How many idle devices do we currently have in inventory?',
            ],
        ];
    }

    protected function resolveUpgradeOrSwapRecommendationQuery(string $lower, array $snapshot, string $historyText, ?array $catalog = null): ?array
    {
        $isUpgrade = str_contains($lower, 'upgrade')
            || str_contains($lower, 'palitan')
            || str_contains($lower, 'swap')
            || str_contains($lower, 'reassign')
            || str_contains($lower, 'what can we give')
            || str_contains($lower, 'how to fix');

        $assigned = collect($snapshot['assigned_devices'] ?? []);
        $targetAssigned = null;

        foreach ($assigned as $dev) {
            $empNameLower = strtolower((string) ($dev['employee']['name'] ?? ''));
            if ($empNameLower === '') {
                continue;
            }
            $parts = explode(' ', $empNameLower);
            $first = $parts[0] ?? '';
            $last = end($parts) ?: '';

            $mentionedInPrompt = str_contains($lower, $empNameLower)
                || (strlen($first) > 3 && str_contains($lower, $first))
                || (strlen($last) > 3 && str_contains($lower, $last));

            $mentionedInHistory = str_contains($historyText, $empNameLower)
                || (strlen($first) > 3 && str_contains($historyText, $first));

            if ($mentionedInPrompt || ($isUpgrade && $mentionedInHistory)) {
                $targetAssigned = $dev;
                if (! empty($dev['is_mismatch'])) {
                    break;
                }
            }
        }

        if (! $isUpgrade && ! $targetAssigned) {
            return null;
        }

        if (! $targetAssigned) {
            $targetAssigned = $assigned->first(fn (array $d): bool => ! empty($d['is_mismatch']));
        }

        if (! $targetAssigned) {
            return null;
        }

        $emp = $targetAssigned['employee'];
        $empName = $emp['name'] ?? 'Employee';
        $roleName = $emp['role_profile'] ?? 'Standard Role';
        $availableCompute = collect($snapshot['available_devices'] ?? [])
            ->filter(fn (array $d): bool => in_array(strtolower((string) ($d['device_type'] ?? '')), ['laptop', 'desktop'], true));

        $prefersLaptop = str_contains(strtolower($roleName), 'sales')
            || str_contains(strtolower($roleName), 'video')
            || str_contains(strtolower($roleName), 'engineer')
            || str_contains(strtolower($roleName), 'designer')
            || str_contains(strtolower($roleName), 'devops');

        $candidates = $availableCompute
            ->sortByDesc(function (array $d) use ($prefersLaptop): int {
                $ramScore = (int) ($d['ram_gb'] ?? 0) * 10;
                $typeBonus = ($prefersLaptop && strtolower((string) ($d['device_type'] ?? '')) === 'laptop') ? 500 : 0;

                return $typeBonus + $ramScore;
            })
            ->take(3)
            ->values();

        if ($candidates->isEmpty()) {
            return [
                'success' => true,
                'answer' => "### Upgrade Plan for {$empName} ({$roleName})\n\n"
                    ."**{$empName}** is currently assigned **{$targetAssigned['name']}** (`{$targetAssigned['asset_tag']}`, {$targetAssigned['ram_gb']}GB RAM), and there are currently **0 idle compute candidates** in stockroom. Consider an **Inventory Bridge Swap** with an over-provisioned peer.",
                'category' => 'fleet_mismatches',
                'data_cards' => [$this->formatDeviceCard($targetAssigned, 'assigned', 'Current Assignment', "{$targetAssigned['name']} ({$empName})")],
                'suggested_followups' => [
                    'Which employees are using low end specs?',
                    'Show active mismatches across the fleet',
                ],
            ];
        }

        $answer = "### Upgrade Plan for {$empName} ({$roleName})\n\n"
            ."**{$empName}** is currently assigned **{$targetAssigned['name']}** (`{$targetAssigned['asset_tag']}`, {$targetAssigned['ram_gb']}GB RAM). Based on live stockroom inventory, here are the top available replacement candidates:\n\n"
            ."| Recommended Machine | Tag | Form Factor | Specifications | Location |\n"
            ."|:---|:---|:---|:---|:---|\n";

        foreach ($candidates as $cand) {
            $answer .= "| **{$cand['name']}** | `{$cand['asset_tag']}` | ".ucfirst((string) $cand['device_type'])." | {$cand['ram_gb']}GB RAM • {$cand['storage_gb']}GB • {$cand['cpu']} | {$cand['location']} |\n";
        }

        $top = $candidates->first();
        $answer .= "\n**Read-Only Recommendation**: Open the Match Engine for **`{$top['asset_tag']}`** ({$top['name']}) to evaluate and confirm reassignment.";

        $cards = $candidates->map(function (array $d) use ($empName): array {
            $card = $this->formatDeviceCard($d, 'available', '🟢 Ready to Assign', "{$d['name']} (Candidate for {$empName})");
            $card['action_url'] = "/match?device_id={$d['id']}";

            return $card;
        })->values()->all();

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'fleet_mismatches',
            'data_cards' => $cards,
            'suggested_followups' => [
                'Which employees are using low end specs?',
                'Who is using the high end desktop?',
                'How many idle devices do we currently have in inventory?',
            ],
        ];
    }

    protected function resolveAssignmentLookupQuery(string $lower, array $snapshot, ?array $catalog = null): ?array
    {
        $assigned = collect($snapshot['assigned_devices']);
        $available = collect($snapshot['available_devices']);

        if (preg_match('/(lap|dsk|mon|mob|per|srv|tab)-\d+/i', $lower, $m)) {
            $tag = strtoupper($m[0]);

            if ($catalog && ! empty($catalog['all_devices'])) {
                $deviceInCatalog = collect($catalog['all_devices'])->firstWhere('asset_tag', $tag);

                if ($deviceInCatalog) {
                    return $this->formatCatalogDeviceLookup($deviceInCatalog);
                }
            }

            $device = $assigned->firstWhere('asset_tag', $tag);
            if ($device) {
                $emp = $device['employee'];
                $answer = "**{$device['asset_tag']}** ({$device['name']}, {$device['ram_gb']}GB RAM) is currently assigned to **{$emp['name']}** in the **{$emp['department']}** department (Role: {$emp['role_profile']}).\n\n"
                    ."- **Location**: {$device['location']}\n"
                    ."- **Hardware Specs**: {$device['ram_gb']}GB RAM • {$device['storage_gb']}GB SSD • {$device['cpu']} • {$device['gpu']}\n"
                    ."- **Assigned Since**: {$emp['assigned_at']}\n"
                    .'- **Match Compatibility**: '.($emp['match_score'] ? "{$emp['match_score']}%" : 'Optimal');

                return [
                    'success' => true,
                    'answer' => $answer,
                    'category' => 'inventory_availability',
                    'data_cards' => [$this->formatDeviceCard($device, 'assigned', '🟢 Assigned', "{$device['name']} ({$emp['name']})")],
                    'suggested_followups' => [
                        'Who is using the high end desktop?',
                        'Which employees is using the high end computers?',
                        'Which employees are using low end specs?',
                    ],
                ];
            }

            $availDevice = $available->firstWhere('asset_tag', $tag);
            if ($availDevice) {
                return [
                    'success' => true,
                    'answer' => "**{$availDevice['asset_tag']}** ({$availDevice['name']}, {$availDevice['ram_gb']}GB RAM) is currently **unassigned and idle in stockroom** at **{$availDevice['location']}**. It is ready for immediate deployment.",
                    'category' => 'inventory_availability',
                    'data_cards' => [$this->formatDeviceCard($availDevice, 'available', '🟢 Ready for Deployment')],
                    'suggested_followups' => [
                        'How many idle devices do we currently have in inventory?',
                        'Who is using the high end desktop?',
                    ],
                ];
            }
        }

        foreach ($assigned as $dev) {
            $name = strtolower($dev['employee']['name'] ?? '');
            $parts = explode(' ', $name);
            $lastName = end($parts);
            $firstName = $parts[0] ?? '';

            if (str_contains($lower, $name) || (strlen($lastName) > 3 && str_contains($lower, $lastName)) || (strlen($firstName) > 3 && str_contains($lower, $firstName))) {
                $emp = $dev['employee'];
                $answer = "**{$emp['name']}** ({$emp['department']}, {$emp['role_profile']}) is currently using **{$dev['asset_tag']}** ({$dev['name']}).\n\n"
                    ."- **Hardware Specifications**: {$dev['ram_gb']}GB RAM • {$dev['storage_gb']}GB SSD • {$dev['cpu']} • {$dev['gpu']}\n"
                    ."- **Location**: {$dev['location']}\n"
                    ."- **Assigned Since**: {$emp['assigned_at']}\n"
                    .'- **Match Compatibility**: '.($emp['match_score'] ? "{$emp['match_score']}%" : 'Optimal');

                return [
                    'success' => true,
                    'answer' => $answer,
                    'category' => 'inventory_availability',
                    'data_cards' => [$this->formatDeviceCard($dev, 'assigned', '🟢 Assigned Machine', "{$dev['name']} ({$emp['name']})")],
                    'suggested_followups' => [
                        'Which employees are using low end specs?',
                        'Which employees is using the high end computers?',
                        'Who is using the high end desktop?',
                    ],
                ];
            }
        }

        return null;
    }

    protected function formatCatalogDeviceLookup(array $deviceInCatalog): ?array
    {
        $status = $deviceInCatalog['status'];
        if ($status === 'assigned') {
            $emp = $deviceInCatalog['assigned_employee'] ?? [];
            $empName = $emp['name'] ?? 'Staff';
            $empDept = $emp['department'] ?? 'General';
            $empRole = $emp['role'] ?? 'Standard Role';
            $answer = "**{$deviceInCatalog['asset_tag']}** ({$deviceInCatalog['full_name']}, {$deviceInCatalog['ram_gb']}GB RAM) is currently assigned to **{$empName}** in the **{$empDept}** department (Role: {$empRole}).\n\n"
                ."- **Location**: {$deviceInCatalog['location']}\n"
                ."- **Hardware Specs**: {$deviceInCatalog['ram_gb']}GB RAM • {$deviceInCatalog['storage_gb']}GB {$deviceInCatalog['storage_type']} • {$deviceInCatalog['cpu']} • {$deviceInCatalog['gpu']}\n"
                .'- **Status**: 🟢 Active Production Assignment';

            return [
                'success' => true,
                'answer' => $answer,
                'category' => 'inventory_availability',
                'data_cards' => [$this->formatDeviceCard($deviceInCatalog, 'assigned', '🟢 Assigned', "{$deviceInCatalog['full_name']} ({$empName})")],
                'suggested_followups' => [
                    'Who is using the high end desktop?',
                    'Which employees is using the high end computers?',
                    'Which employees are using low end specs?',
                ],
            ];
        }

        if ($status === 'available') {
            return [
                'success' => true,
                'answer' => "**{$deviceInCatalog['asset_tag']}** ({$deviceInCatalog['full_name']}, {$deviceInCatalog['ram_gb']}GB RAM) is currently **unassigned and idle in stockroom** at **{$deviceInCatalog['location']}**. It is ready for immediate deployment.",
                'category' => 'inventory_availability',
                'data_cards' => [$this->formatDeviceCard($deviceInCatalog, 'available', '🟢 Ready for Deployment')],
                'suggested_followups' => [
                    'How many idle devices do we currently have in inventory?',
                    'Who is using the high end desktop?',
                ],
            ];
        }

        if ($status === 'in_repair') {
            return [
                'success' => true,
                'answer' => "**{$deviceInCatalog['asset_tag']}** ({$deviceInCatalog['full_name']}, {$deviceInCatalog['ram_gb']}GB RAM) is currently **in repair / maintenance** at **{$deviceInCatalog['location']}**. It is undergoing active hardware servicing and is unavailable for assignment.",
                'category' => 'inventory_availability',
                'data_cards' => [$this->formatDeviceCard($deviceInCatalog, 'in_repair', '🟡 In Repair')],
                'suggested_followups' => [
                    'How many idle devices do we currently have in inventory?',
                    'How many devices are there in a company?',
                ],
            ];
        }

        if ($status === 'retired') {
            return [
                'success' => true,
                'answer' => "**{$deviceInCatalog['asset_tag']}** ({$deviceInCatalog['full_name']}) is a **retired / decommissioned** legacy IT hardware asset.",
                'category' => 'inventory_availability',
                'data_cards' => [$this->formatDeviceCard($deviceInCatalog, 'retired', '⚪ Retired')],
                'suggested_followups' => [
                    'How many devices are there in a company?',
                    'How many idle devices do we currently have in inventory?',
                ],
            ];
        }

        return null;
    }

    protected function resolveIdleInventoryQuery(array $snapshot, ?array $catalog = null): array
    {
        $devices = collect($snapshot['available_devices']);
        $totalIdle = $devices->count();
        $laptops = $devices->filter(fn ($d) => strtolower($d['device_type']) === 'laptop');
        $desktops = $devices->filter(fn ($d) => in_array(strtolower($d['device_type']), ['desktop', 'workstation']));
        $monitors = $devices->filter(fn ($d) => strtolower($d['device_type']) === 'monitor');
        $mobiles = $devices->filter(fn ($d) => strtolower($d['device_type']) === 'mobile');
        $peripherals = $devices->filter(fn ($d) => strtolower($d['device_type']) === 'peripheral');

        $answer = "We currently have **{$totalIdle} idle (available) devices** in inventory across our stockrooms, ready for immediate employee deployment:\n\n"
            ."- **Laptops ({$laptops->count()} units)**: Ready for mobile, remote, or hybrid staff.\n"
            ."- **Desktops & Workstations ({$desktops->count()} units)**: Staged for on-site workstations and high-compute roles.\n";

        if ($monitors->isNotEmpty() || $mobiles->isNotEmpty() || $peripherals->isNotEmpty()) {
            $answer .= "- **Displays, Mobile & Peripherals**: {$monitors->count()} monitors, {$mobiles->count()} mobile units, {$peripherals->count()} peripherals.\n";
        }

        $answer .= "\n### Key Available Units by Category\n\n"
            ."**1. High-Performance & Workstation Units (Ideal for Dev, CAD & Analytics)**:\n";

        $highEndIdle = $devices->filter(fn ($d) => in_array($d['cpu_tier'], ['workstation', 'high']) || (int) ($d['ram_gb'] ?? 0) >= 32);
        foreach ($highEndIdle->take(8) as $d) {
            $answer .= "- **{$d['asset_tag']}**: {$d['name']} ({$d['ram_gb']}GB RAM, {$d['cpu']}) stationed at **{$d['location']}**\n";
        }

        $answer .= "\n**2. Standard & Accessory Units (Productivity, Monitors & Gear)**:\n";
        $standardIdle = $devices->reject(fn ($d) => in_array($d['cpu_tier'], ['workstation', 'high']) || (int) ($d['ram_gb'] ?? 0) >= 32);
        foreach ($standardIdle->take(10) as $d) {
            $specText = ! empty($d['ram_gb']) ? "{$d['ram_gb']}GB RAM, {$d['device_type']}" : ucfirst((string) $d['device_type']);
            $answer .= "- **{$d['asset_tag']}**: {$d['name']} ({$specText}) at **{$d['location']}**\n";
        }

        $cards = $devices->take(8)->map(fn ($d) => $this->formatDeviceCard($d, 'available', '🟢 Ready for Deployment'))->values()->all();

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'inventory_availability',
            'data_cards' => $cards,
            'suggested_followups' => [
                'Which employees are using low end specs?',
                'Who is using the high end desktop?',
                'Which employees is using the high end computers?',
            ],
        ];
    }

    protected function resolveInventoryAvailabilityQuery(string $lower, array $snapshot, ?array $catalog = null): array
    {
        $devices = collect($snapshot['available_devices']);

        if (preg_match('/(\d+)\s*(?:gb|gig)/i', $lower, $m)) {
            $targetRam = (int) $m[1];
            $devices = $devices->filter(fn ($d) => $d['ram_gb'] >= $targetRam);
        }

        if (str_contains($lower, 'bgc') || str_contains($lower, 'taguig')) {
            $devices = $devices->filter(fn ($d) => str_contains(strtolower($d['location']), 'bgc') || str_contains(strtolower($d['location']), 'taguig'));
        } elseif (str_contains($lower, 'ortigas') || str_contains($lower, 'pasig')) {
            $devices = $devices->filter(fn ($d) => str_contains(strtolower($d['location']), 'ortigas') || str_contains(strtolower($d['location']), 'pasig'));
        } elseif (str_contains($lower, 'makati')) {
            $devices = $devices->filter(fn ($d) => str_contains(strtolower($d['location']), 'makati'));
        } elseif (str_contains($lower, 'cebu')) {
            $devices = $devices->filter(fn ($d) => str_contains(strtolower($d['location']), 'cebu'));
        } elseif (str_contains($lower, 'davao')) {
            $devices = $devices->filter(fn ($d) => str_contains(strtolower($d['location']), 'davao'));
        }

        if (str_contains($lower, 'laptop') || str_contains($lower, 'notebook')) {
            $devices = $devices->filter(fn ($d) => strtolower($d['device_type']) === 'laptop');
        } elseif (str_contains($lower, 'desktop') || str_contains($lower, 'workstation')) {
            $devices = $devices->filter(fn ($d) => in_array(strtolower($d['device_type']), ['desktop', 'workstation']));
        }

        if (str_contains($lower, 'thinkpad') || str_contains($lower, 'lenovo')) {
            $devices = $devices->filter(fn ($d) => str_contains(strtolower($d['name']), 'thinkpad') || str_contains(strtolower($d['brand']), 'lenovo'));
        } elseif (str_contains($lower, 'macbook') || str_contains($lower, 'apple')) {
            $devices = $devices->filter(fn ($d) => str_contains(strtolower($d['brand']), 'apple') || str_contains(strtolower($d['name']), 'macbook'));
        }

        $count = $devices->count();
        $cards = $devices->take(6)->map(fn ($d) => $this->formatDeviceCard($d, 'available', '🟢 Ready for Deployment'))->values()->all();

        if ($count === 0) {
            $brandNote = '';
            if ($catalog && ! empty($catalog['all_devices'])) {
                $fleetMatches = collect($catalog['all_devices'])->filter(function ($d) use ($lower) {
                    if (str_contains($lower, 'macbook') || str_contains($lower, 'apple')) {
                        return str_contains(strtolower($d['brand']), 'apple') || str_contains(strtolower($d['model']), 'macbook');
                    }
                    if (str_contains($lower, 'thinkpad') || str_contains($lower, 'lenovo')) {
                        return str_contains(strtolower($d['brand']), 'lenovo') || str_contains(strtolower($d['model']), 'thinkpad');
                    }
                    if (str_contains($lower, 'dell')) {
                        return str_contains(strtolower($d['brand']), 'dell');
                    }
                    if (str_contains($lower, 'hp')) {
                        return str_contains(strtolower($d['brand']), 'hp');
                    }
                    if (str_contains($lower, 'acer')) {
                        return str_contains(strtolower($d['brand']), 'acer');
                    }

                    return false;
                });

                if ($fleetMatches->isNotEmpty()) {
                    $brandNote = " Note: While 0 units are currently idle in the stockroom, the organization owns **{$fleetMatches->count()} matching units** across the wider fleet (currently assigned to staff or in servicing).";
                }
            }

            $answer = "Currently, there are **0 available units** matching your exact criteria in stock. Our overall stockroom currently holds **{$snapshot['metrics']['available_count']} deployable assets** across Metro Manila campuses.{$brandNote}";
        } else {
            $first = $devices->first();
            $answer = "We have **{$count} available unit".($count > 1 ? 's' : '')."** ready for immediate deployment in the stockroom. Highlighted unit: **{$first['asset_tag']}** ({$first['name']}, {$first['ram_gb']}GB RAM) stationed at **{$first['location']}**.";
        }

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'inventory_availability',
            'data_cards' => $cards,
            'suggested_followups' => [
                'Which employees are using low end specs?',
                'Who is using the high end desktop?',
                'Which employees is using the high end computers?',
            ],
        ];
    }

    protected function resolveWarrantyQuery(array $snapshot, bool $canViewFinancials = true): array
    {
        $expiring = collect($snapshot['expiring_devices']);
        $count = $expiring->count();

        $cards = $expiring->take(6)->map(fn ($d) => [
            'type' => 'device',
            'id' => $d['id'],
            'asset_tag' => $d['asset_tag'],
            'name' => $d['name'],
            'specs' => "Vendor: {$d['vendor']} • Expiry: {$d['warranty_expiry']}",
            'location' => $d['location'],
            'status' => 'expiring_soon',
            'action_url' => "/devices/{$d['id']}",
            'image_url' => $d['image_url'],
            'meta' => "{$d['days_left']} days remaining",
        ])->values()->all();

        $answer = $count > 0
            ? "There are **{$count} device".($count > 1 ? 's' : '').'** with manufacturer warranties **expiring in the next 60 days**. Review these units to initiate warranty extension contracts or plan hardware refreshes.'
            : 'Great news! There are **no warranties expiring in the immediate 60-day window**. All active fleet warranty coverage agreements are currently in good standing.';

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'warranty_lifecycle',
            'data_cards' => $cards,
            'suggested_followups' => array_values(array_filter([
                'Which devices are currently undergoing repairs and maintenance?',
                $canViewFinancials ? 'What is our total active fleet book value?' : null,
                'Check available laptops for hardware refresh',
            ])),
        ];
    }

    protected function resolveMismatchQuery(string $lower, array $snapshot): array
    {
        $mismatches = collect($snapshot['mismatches']);
        $under = $mismatches->where('classification', 'under-provisioned');
        $over = $mismatches->where('classification', 'over-provisioned');

        $filtered = $mismatches;
        if (str_contains($lower, 'under')) {
            $filtered = $under;
        } elseif (str_contains($lower, 'over')) {
            $filtered = $over;
        }

        $cards = $filtered->take(6)->map(fn ($m) => [
            'type' => 'mismatch',
            'id' => $m['device_id'] ?? 0,
            'asset_tag' => $m['device_tag'] ?? 'N/A',
            'name' => "{$m['employee_name']} ({$m['department']})",
            'specs' => "Role: {$m['role_profile']} • Machine: {$m['device_name']}",
            'location' => $m['classification'] === 'under-provisioned' ? 'Performance Bottleneck' : 'Capital Waste',
            'status' => $m['classification'],
            'action_url' => '/mismatches',
            'image_url' => $m['image_url'],
            'meta' => "Match Score: {$m['score']}% • {$m['classification']}",
        ])->values()->all();

        $answer = "ITFleet fleet audit detected **{$mismatches->count()} active assignment mismatches** across the organization:\n\n"
            ."* **{$under->count()} Under-Provisioned Machines**: Employees constrained by hardware lacking sufficient CPU or RAM for their role.\n"
            ."* **{$over->count()} Over-Provisioned Machines**: High-spec workstations assigned to light office roles, causing idle resource waste.\n\n"
            .'You can execute an automated **Inventory Bridge Swap** in the Match Engine to rebalance these units without purchasing new machines.';

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'fleet_mismatches',
            'data_cards' => $cards,
            'suggested_followups' => [
                'Which employees are using low end specs?',
                'Who is using the high end desktop?',
                'How many idle devices do we currently have in inventory?',
            ],
        ];
    }

    protected function resolveFinancialQuery(array $snapshot): array
    {
        $m = $snapshot['metrics'];
        $formattedCost = '₱'.number_format($m['total_acquisition_cost'], 2);
        $formattedBook = '₱'.number_format($m['current_book_value'], 2);
        $formattedDep = '₱'.number_format($m['accumulated_depreciation'], 2);

        $answer = "### Enterprise ITAM Financial Summary\n\n"
            ."- **Total Acquisition Spend**: **{$formattedCost}** across {$m['total_devices']} authoritative assets.\n"
            ."- **Current Residual Book Value**: **{$formattedBook}** (calculated via straight-line depreciation).\n"
            ."- **Accumulated Depreciation**: **{$formattedDep}**.\n\n"
            ."By utilizing ITFleet's AI Matching Engine and Bridge Swapping to reassign idle units, the organization actively avoids redundant procurement CapEx.";

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'financials',
            'data_cards' => [[
                'type' => 'financial',
                'id' => 1,
                'asset_tag' => 'FIN-01',
                'name' => 'Fleet Book Value',
                'specs' => "Acquisition: {$formattedCost} • Residual: {$formattedBook}",
                'location' => 'All Metro Manila Hubs',
                'status' => 'financials',
                'action_url' => '/dashboard',
                'image_url' => null,
                'meta' => "Depreciation: {$formattedDep}",
            ]],
            'suggested_followups' => [
                'Which employees are using low end specs?',
                'How many idle devices do we currently have in inventory?',
                'Who is using the high end desktop?',
            ],
        ];
    }

    protected function resolveMaintenanceQuery(array $snapshot): array
    {
        $logs = collect($snapshot['active_maintenance']);
        $count = $logs->count();

        $cards = $logs->take(6)->map(fn ($l) => [
            'type' => 'maintenance',
            'id' => $l['device_id'] ?? 0,
            'asset_tag' => $l['device_tag'] ?? 'MAINT',
            'name' => $l['device_name'] ?? 'Asset',
            'specs' => "Service: {$l['title']} • Type: {$l['type']}",
            'location' => "Tech: {$l['technician']}",
            'status' => $l['status'],
            'action_url' => '/maintenance',
            'image_url' => $l['image_url'],
            'meta' => 'In Servicing',
        ])->values()->all();

        $answer = $count > 0
            ? "Currently, there are **{$count} device".($count > 1 ? 's' : '').' undergoing maintenance or repair**. All repairs are actively tracked with technician assignments and cost logs.'
            : 'There are currently **0 devices undergoing active maintenance**. All fleet units are either in active circulation or staged in the stockroom.';

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'maintenance_health',
            'data_cards' => $cards,
            'suggested_followups' => [
                'How many idle devices do we currently have in inventory?',
                'Which employees are using low end specs?',
                'Open Maintenance Log history',
            ],
        ];
    }

    protected function resolveGeneralFleetSummary(array $snapshot, ?array $catalog = null, bool $canViewFinancials = true, ?User $user = null): array
    {
        $m = $snapshot['metrics'];
        $formattedBook = '₱'.number_format($m['current_book_value'], 2);

        $latestDeviceNote = '';
        if ($catalog && ! empty($catalog['all_devices'])) {
            $sorted = collect($catalog['all_devices'])->sortByDesc('id')->first();
            if ($sorted) {
                $latestSpecs = $sorted['spec_summary'] ?: "{$sorted['ram_gb']}GB RAM";
                $latestDeviceNote = "- **Latest Registered Asset**: **{$sorted['asset_tag']}** ({$sorted['full_name']}, {$latestSpecs}).\n";
            }
        }

        $licenseCount = SoftwareLicense::count();
        $financialLine = $canViewFinancials ? "- **Residual Fleet Book Value**: **{$formattedBook}**.\n" : '';

        $answer = "### ITFleet ITAM Fleet Intelligence\n\n"
            ."Welcome to the **ITAM Fleet Assistant**. Here is our live database overview:\n\n"
            ."- **Authoritative Fleet**: **{$m['total_devices']} total hardware assets** and **{$licenseCount} software license pools**.\n"
            ."- **Stockroom Availability**: **{$m['idle_count']} idle units** ({$m['idle_laptops_count']} laptops, {$m['idle_desktops_count']} desktops) staged for deployment.\n"
            ."- **Active Assignments**: **{$m['assigned_count']} units** currently assigned to staff.\n"
            ."- **Active Mismatches**: **{$m['mismatches_count']} compute assignments** flagged ({$m['under_provisioned_count']} under-provisioned, {$m['over_provisioned_count']} over-provisioned).\n"
            ."- **Warranty Health**: **{$m['expiring_warranties_count']} units** expiring within 60 days.\n"
            .$financialLine
            .$latestDeviceNote."\n"
            ."Ask me specific questions like:\n"
            ."* *\"Which employees are using low end specs?\"*\n"
            ."* *\"How many monitors or peripherals are available in stockroom?\"*\n"
            ."* *\"Show software license seat utilization and upcoming renewals\"*\n"
            .'* *"How many idle devices do we currently have in inventory?"*';

        return [
            'success' => true,
            'answer' => $answer,
            'category' => 'general_itam',
            'data_cards' => [],
            'suggested_followups' => $this->getDefaultFollowups($user),
        ];
    }

    /**
     * Resolve deictic questions grounded in the currently open page record.
     *
     * @param  array<string, mixed>  $pageContext
     */
    protected function resolvePageContextQuery(string $lower, array $pageContext, bool $canViewFinancials, ?User $user = null): ?array
    {
        $entityId = $pageContext['entity_id'] ?? null;
        $entityType = $pageContext['entity_type'] ?? null;

        if (! $entityId || ! $entityType) {
            return null;
        }

        $isDeictic = str_contains($lower, 'this device')
            || str_contains($lower, 'this asset')
            || str_contains($lower, 'this machine')
            || str_contains($lower, 'this laptop')
            || str_contains($lower, 'this desktop')
            || str_contains($lower, 'this monitor')
            || str_contains($lower, 'this unit')
            || str_contains($lower, 'this license')
            || str_contains($lower, 'current device');

        if (! $isDeictic) {
            return null;
        }

        if ($entityType === 'device') {
            $device = Device::with(['activeAssignment.employee.roleProfile', 'maintenanceLogs'])->find((int) $entityId);
            if (! $device) {
                return null;
            }

            $emp = $device->activeAssignment?->employee;
            $answer = "### Active Page Asset: **{$device->asset_tag}** ({$device->brand} {$device->model})\n\n"
                .'- **Category & Status**: '.ucfirst((string) $device->device_type).' · **'.ucfirst(str_replace('_', ' ', (string) $device->status))."** ({$device->lifecycle_stage} stage)\n"
                ."- **Specifications**: {$device->spec_summary}\n"
                ."- **Location**: {$device->location}\n"
                .'- **Warranty**: '.($device->warranty_expiry ? "{$device->warranty_expiry->toDateString()} ({$device->warranty_status})" : 'Not recorded')."\n"
                .'- **Custody**: '.($emp ? "**{$emp->name}** ({$emp->department})" : 'Available in Stockroom');

            if ($canViewFinancials) {
                $answer .= "\n- **Book Value**: ₱".number_format((float) $device->current_book_value, 2)
                    .' (Acquisition: ₱'.number_format((float) ($device->purchase_cost ?? 0), 2).')';
            }

            $card = [
                'type' => 'device',
                'id' => $device->id,
                'asset_tag' => $device->asset_tag,
                'name' => "{$device->brand} {$device->model}",
                'specs' => $device->spec_summary,
                'location' => $device->location ?? '',
                'status' => $device->status,
                'action_url' => "/devices/{$device->id}",
                'image_url' => $device->image_clip_url,
                'meta' => $emp ? "Assigned to {$emp->name}" : 'Stockroom Ready',
            ];

            return $this->withToolTrace([
                'success' => true,
                'answer' => $answer,
                'category' => 'inventory_availability',
                'data_cards' => [$card],
                'suggested_followups' => $this->getDefaultFollowups($user),
            ], 'search_devices', 'Local DB · Page Record', $device->asset_tag);
        }

        return null;
    }

    /**
     * Resolve software licenses & SaaS seat utilization queries.
     */
    protected function resolveSoftwareLicensesQuery(string $lower, bool $canViewFinancials, ?User $user = null): array
    {
        $licenses = SoftwareLicense::withCount('activeAssignments')
            ->with('activeAssignments.employee')
            ->orderBy('name')
            ->get();

        $active = $licenses->where('status', 'active');
        $totalSeats = (int) $active->sum('total_seats');
        $assignedSeats = (int) $active->sum('active_assignments_count');
        $freeSeats = max(0, $totalSeats - $assignedSeats);
        $utilPct = $totalSeats > 0 ? round(($assignedSeats / $totalSeats) * 100, 1) : 0.0;
        $expiringSoon = $active->filter(fn (SoftwareLicense $l): bool => $l->renewal_status === 'expiring_soon');

        $filtered = $licenses;
        if (
            (str_contains($lower, 'expir') || str_contains($lower, 'renew'))
            && ! str_contains($lower, 'utilization')
            && ! str_contains($lower, 'all license')
        ) {
            $filtered = $expiringSoon->isNotEmpty() ? $expiringSoon : $licenses;
        } else {
            $matched = $licenses->filter(
                fn (SoftwareLicense $l): bool => str_contains($lower, strtolower($l->name))
                    || str_contains($lower, strtolower(explode(' ', $l->name)[0]))
                    || str_contains($lower, strtolower($l->vendor))
            );
            if ($matched->isNotEmpty()) {
                $filtered = $matched;
            }
        }

        $answer = "### Software Licenses & SaaS Directory ({$licenses->count()} Subscriptions)\n\n"
            ."- **Seat Allocation**: **{$assignedSeats} / {$totalSeats} active seats assigned** ({$utilPct}% utilization · {$freeSeats} seats free).\n"
            ."- **Upcoming Renewals**: **{$expiringSoon->count()} subscription(s)** expiring within 60 days.\n";

        if ($canViewFinancials) {
            $annualSpend = (float) $active->sum(fn (SoftwareLicense $l): float => $l->annualized_cost);
            $answer .= '- **Annualized SaaS Commitment**: **₱'.number_format($annualSpend, 2)."**.\n";
        }

        $answer .= "\n| Software | Vendor | Category | Assigned / Total | Utilization | Renewal |\n"
            ."|:---|:---|:---|:---|:---|:---|\n";

        $cards = [];
        foreach ($filtered->take(15) as $lic) {
            $used = (int) $lic->active_assignments_count;
            $pct = $lic->total_seats > 0 ? round(($used / $lic->total_seats) * 100, 1) : 0.0;
            $renewalLabel = $lic->renewal_date
                ? "{$lic->renewal_date->toDateString()} ({$lic->renewal_status})"
                : 'Perpetual';

            $answer .= "| **{$lic->name}** | {$lic->vendor} | ".ucfirst((string) $lic->category)." | {$used} / {$lic->total_seats} | {$pct}% | {$renewalLabel} |\n";

            if (count($cards) < 6) {
                $free = max(0, $lic->total_seats - $used);
                $cards[] = [
                    'type' => 'license',
                    'id' => $lic->id,
                    'asset_tag' => strtoupper((string) $lic->license_type),
                    'name' => $lic->name,
                    'specs' => "{$used}/{$lic->total_seats} seats used ({$free} free) · {$lic->vendor}",
                    'location' => ucfirst((string) $lic->category),
                    'status' => $lic->status,
                    'action_url' => '/licenses?search='.urlencode($lic->name),
                    'meta' => $lic->renewal_date ? "Renewal: {$lic->renewal_date->toDateString()}" : 'Perpetual',
                ];
            }
        }

        return $this->withToolTrace([
            'success' => true,
            'answer' => $answer,
            'category' => 'software_licenses',
            'data_cards' => $cards,
            'suggested_followups' => $this->getDefaultFollowups($user),
        ], 'inspect_software_licenses', 'Local DB · Software Licenses', "{$licenses->count()} pools · {$assignedSeats}/{$totalSeats} seats");
    }

    /**
     * Resolve non-compute hardware category queries (monitors, mobile devices, peripherals).
     */
    protected function resolveCategoryQuery(string $lower, array $catalog, ?User $user = null): ?array
    {
        $categoryMap = [
            'monitor' => ['monitor', 'monitors', 'display', 'displays', 'screen'],
            'mobile' => ['mobile', 'phone', 'phones', 'smartphone', 'iphone', 'ipad', 'tablet', 'galaxy', 'pixel'],
            'peripheral' => ['peripheral', 'peripherals', 'dock', 'docking', 'keyboard', 'mouse', 'headset', 'accessory', 'accessories'],
        ];

        $targetType = null;
        foreach ($categoryMap as $type => $keywords) {
            foreach ($keywords as $kw) {
                if (preg_match('/\b'.preg_quote($kw, '/').'\b/i', $lower)) {
                    $targetType = $type;
                    break 2;
                }
            }
        }

        if ($targetType === null) {
            return null;
        }

        $matching = collect($catalog['all_devices'] ?? [])
            ->filter(fn (array $d): bool => strtolower((string) ($d['device_type'] ?? '')) === $targetType)
            ->values();

        if (str_contains($lower, 'available') || str_contains($lower, 'idle') || str_contains($lower, 'stock')) {
            $filtered = $matching->where('status', 'available')->values();
        } elseif (str_contains($lower, 'assigned')) {
            $filtered = $matching->where('status', 'assigned')->values();
        } else {
            $filtered = $matching;
        }

        $label = ucfirst($targetType).'s';
        $availCount = $matching->where('status', 'available')->count();
        $assignedCount = $matching->where('status', 'assigned')->count();

        $answer = "ITFleet manages **{$matching->count()} {$targetType} assets** ({$assignedCount} assigned to staff, {$availCount} available in stockroom):\n\n"
            ."| Asset Tag | Model | Key Specs | Status | Assigned To / Location |\n"
            ."|:---|:---|:---|:---|:---|\n";

        $cards = [];
        foreach ($filtered->take(15) as $d) {
            $custody = $d['assigned_employee']
                ? "{$d['assigned_employee']['name']} ({$d['assigned_employee']['department']})"
                : $d['location'];
            $specs = $d['spec_summary'] ?: ucfirst($targetType);
            $answer .= "| `{$d['asset_tag']}` | **{$d['full_name']}** | {$specs} | ".ucfirst(str_replace('_', ' ', (string) $d['status']))." | {$custody} |\n";

            if (count($cards) < 6) {
                $cards[] = $this->formatDeviceCard(
                    $d,
                    $d['status'],
                    $d['assigned_employee'] ? "Assigned to {$d['assigned_employee']['name']}" : '🟢 Ready in Stock'
                );
            }
        }

        return $this->withToolTrace([
            'success' => true,
            'answer' => $answer,
            'category' => 'inventory_availability',
            'data_cards' => $cards,
            'suggested_followups' => $this->getDefaultFollowups($user),
        ], 'search_devices', "Local DB · {$label}", "{$filtered->count()} matching");
    }

    protected function isFinancialPrompt(string $lower): bool
    {
        return $this->matchesKeywords($lower, [
            'book value',
            'depreciation',
            'acquisition cost',
            'total cost',
            'fleet cost',
            'valuation',
            'financial',
            'capex',
            'opex',
            'budget',
            'annual spend',
            'software spend',
            'license cost',
            'maintenance spend',
            'how much did we spend',
            'how much is our fleet worth',
            'fleet worth',
            'magkano',
            'halaga',
        ]);
    }

    /**
     * Attach a standardized tool trace pill to local fallback responses.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    protected function withToolTrace(array $payload, string $tool, string $label, string $summary): array
    {
        $payload['tool_trace'] = [
            [
                'tool' => $tool,
                'label' => $label,
                'summary' => $summary,
                'mode' => 'local_db',
            ],
        ];

        return $payload;
    }

    protected function matchesKeywords(string $text, array $keywords): bool
    {
        foreach ($keywords as $kw) {
            if (str_contains($text, $kw)) {
                return true;
            }
        }

        return false;
    }
}
