<?php

namespace App\Services;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;

class DemoPresetService
{
    public const PRESET_SMALL = 'small';

    public const PRESET_MEDIUM = 'medium';

    public const PRESET_LARGE = 'large';

    private const SETTING_KEY = 'active_demo_preset';

    /**
     * Metadata describing available company scale presets.
     *
     * @return array<string, array{key: string, label: string, company_name: string, subtitle: string}>
     */
    public static function presets(): array
    {
        return [
            self::PRESET_SMALL => [
                'key' => self::PRESET_SMALL,
                'label' => 'Small',
                'company_name' => 'Manila Digital Studio',
                'subtitle' => 'Boutique Firm (37 assets · 15 staff · 6 licenses)',
            ],
            self::PRESET_MEDIUM => [
                'key' => self::PRESET_MEDIUM,
                'label' => 'Medium',
                'company_name' => 'Archipelago FinTech Corp',
                'subtitle' => 'Mid-Market Enterprise (150 assets · 65 staff · 14 licenses)',
            ],
            self::PRESET_LARGE => [
                'key' => self::PRESET_LARGE,
                'label' => 'Large',
                'company_name' => 'Pacific Metro Holdings Group',
                'subtitle' => 'Large Scale Corporation (450 assets · 200 staff · 25 licenses)',
            ],
        ];
    }

    /**
     * Demo user account definitions keyed by role value.
     *
     * @return array<string, array{name: string, email: string, role: string, department: string, job_title: string, phone: string}>
     */
    public static function demoAccounts(): array
    {
        return [
            'admin' => [
                'name' => 'IT Administrator',
                'email' => 'admin@itfleet.local',
                'role' => 'admin',
                'department' => 'IT Infrastructure & Systems',
                'job_title' => 'Chief IT Architect & Fleet Administrator',
                'phone' => '+63 917 123 4567',
            ],
            'manager' => [
                'name' => 'IT Asset Manager',
                'email' => 'manager@itfleet.local',
                'role' => 'manager',
                'department' => 'Asset Lifecycle & Procurement',
                'job_title' => 'IT Asset & Fleet Operations Manager',
                'phone' => '+63 918 234 5678',
            ],
            'technician' => [
                'name' => 'Hardware Technician',
                'email' => 'tech@itfleet.local',
                'role' => 'technician',
                'department' => 'Hardware Diagnostics & Maintenance',
                'job_title' => 'Senior Hardware Diagnostic Specialist',
                'phone' => '+63 919 345 6789',
            ],
            'viewer' => [
                'name' => 'IT Auditor',
                'email' => 'auditor@itfleet.local',
                'role' => 'viewer',
                'department' => 'Compliance & Internal Audit',
                'job_title' => 'IT Governance & Compliance Auditor',
                'phone' => '+63 920 456 7890',
            ],
        ];
    }

    /**
     * Resolve currently active demo preset key from persistent settings.
     */
    public function getActivePreset(): string
    {
        if (Schema::hasTable('app_settings')) {
            $stored = DB::table('app_settings')->where('key', self::SETTING_KEY)->value('value');
            if (is_string($stored) && array_key_exists($stored, self::presets())) {
                return $stored;
            }
        }

        $default = (string) config('itam.default_demo_preset', self::PRESET_SMALL);

        return array_key_exists($default, self::presets()) ? $default : self::PRESET_SMALL;
    }

    /**
     * Persist the active demo preset key.
     */
    public function setActivePreset(string $preset): void
    {
        if (! Schema::hasTable('app_settings')) {
            return;
        }

        $now = now();
        $exists = DB::table('app_settings')->where('key', self::SETTING_KEY)->exists();

        if ($exists) {
            DB::table('app_settings')
                ->where('key', self::SETTING_KEY)
                ->update(['value' => $preset, 'updated_at' => $now]);

            return;
        }

        DB::table('app_settings')->insert([
            'key' => self::SETTING_KEY,
            'value' => $preset,
            'updated_at' => $now,
        ]);
    }

    /**
     * Ensure all four demo role accounts exist without re-hashing passwords unnecessarily.
     */
    public function ensureDemoUsers(): void
    {
        $accounts = self::demoAccounts();
        $emails = array_column($accounts, 'email');
        $existingEmails = User::whereIn('email', $emails)->pluck('email')->all();

        $missing = array_filter(
            $accounts,
            static fn (array $account): bool => ! in_array($account['email'], $existingEmails, true)
        );

        if (empty($missing)) {
            return;
        }

        $hashedPassword = Hash::make('password');
        $now = now();

        foreach ($missing as $account) {
            User::updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'password' => $hashedPassword,
                    'role' => $account['role'],
                    'department' => $account['department'],
                    'job_title' => $account['job_title'],
                    'phone' => $account['phone'],
                    'email_verified_at' => $now,
                ]
            );
        }
    }

    /**
     * Replace all ITAM operational data with a deterministic company scale preset.
     *
     * @return array{preset: string, label: string, company_name: string, devices_count: int, compute_count: int, employees_count: int, licenses_count: int}
     */
    public function applyPreset(string $preset): array
    {
        $presets = self::presets();
        if (! array_key_exists($preset, $presets)) {
            throw new InvalidArgumentException("Unsupported demo preset '{$preset}'.");
        }

        $this->ensureDemoUsers();
        $adminId = User::where('email', 'admin@itfleet.local')->value('id');

        DB::transaction(function () use ($preset, $adminId): void {
            $this->clearOperationalTables();

            if ($preset === self::PRESET_SMALL) {
                $this->seedSmall($adminId);
            } elseif ($preset === self::PRESET_MEDIUM) {
                $this->seedEnterpriseScale(self::PRESET_MEDIUM, $adminId);
            } else {
                $this->seedEnterpriseScale(self::PRESET_LARGE, $adminId);
            }

            $this->setActivePreset($preset);
        });

        Cache::forget('fleet_catalog_json');

        $meta = $presets[$preset];

        return [
            'preset' => $preset,
            'label' => $meta['label'],
            'company_name' => $meta['company_name'],
            'devices_count' => (int) DB::table('devices')->count(),
            'compute_count' => (int) DB::table('devices')->whereIn('device_type', ['laptop', 'desktop'])->count(),
            'employees_count' => (int) DB::table('employees')->count(),
            'licenses_count' => (int) DB::table('software_licenses')->count(),
        ];
    }

    /**
     * Delete operational ITAM rows in FK-safe child-before-parent order while preserving user accounts.
     */
    private function clearOperationalTables(): void
    {
        $tables = [
            'software_license_assignments',
            'software_licenses',
            'lifecycle_events',
            'maintenance_logs',
            'match_requests',
            'assignments',
            'employees',
            'devices',
            'role_profiles',
        ];

        foreach ($tables as $table) {
            DB::table($table)->delete();
        }

        if (Schema::hasTable('agent_conversation_messages')) {
            DB::table('agent_conversation_messages')->delete();
        }
        if (Schema::hasTable('agent_conversations')) {
            DB::table('agent_conversations')->delete();
        }
    }

    /**
     * Seed the Small Boutique Firm preset (37 devices, 15 employees, 6 licenses, exact 3 compute mismatches).
     */
    private function seedSmall(?int $adminId): void
    {
        $now = CarbonImmutable::now();
        $profileIds = $this->insertRoleProfiles(false, $now);

        $devicesData = array_merge(
            $this->smallComputeCatalog($now),
            $this->smallPeripheralCatalog($now)
        );

        $deviceIds = [];
        $lifecycleRows = [];

        foreach ($devicesData as $device) {
            $tag = $device['asset_tag'];
            $stage = $device['lifecycle_stage'];
            $row = $device;
            $row['specifications'] = isset($row['specifications']) ? json_encode($row['specifications']) : null;
            $row['created_at'] = $now;
            $row['updated_at'] = $now;

            $deviceId = DB::table('devices')->insertGetId($row);
            $deviceIds[$tag] = $deviceId;

            $lifecycleRows[] = [
                'device_id' => $deviceId,
                'from_stage' => 'new',
                'to_stage' => $stage,
                'changed_by_user_id' => $adminId,
                'notes' => "Asset {$tag} onboarded in {$stage} stage.",
                'created_at' => $now,
            ];
        }

        $this->insertChunks('lifecycle_events', $lifecycleRows);

        $maintenanceRows = [
            [
                'device_id' => $deviceIds['LAP-011'],
                'type' => 'repair',
                'title' => 'OEM Battery Replacement & Thermal Paste',
                'description' => 'Swollen battery detected during physical audit. Unit taken off deployment. OEM battery replacement ordered and undergoing installation at Greenhills Authorized Center.',
                'cost' => 7500.00,
                'performed_by' => 'Beyond the Box Service Center / Mark Ramos',
                'started_at' => $now->subDays(2),
                'completed_at' => null,
                'performance_assessment' => null,
                'status' => 'in_progress',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'device_id' => $deviceIds['LAP-002'],
                'type' => 'upgrade',
                'title' => 'RAM Upgrade 16GB -> 32GB DDR5 & NVMe Speed Validation',
                'description' => 'Upgraded memory modules to Corsair Vengeance 32GB DDR5 5200MHz for intensive compiling and local container tasks.',
                'cost' => 9200.00,
                'performed_by' => 'Internal IT Team - Ortigas Hub',
                'started_at' => $now->subDays(45),
                'completed_at' => $now->subDays(44),
                'performance_assessment' => 'Memory bandwidth increased by 38%. PassMark memory benchmark score improved from 2,890 to 3,640. Zero crash logs observed post-burn-in test.',
                'status' => 'completed',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'device_id' => $deviceIds['DSK-001'],
                'type' => 'preventive',
                'title' => 'Quarterly Dust Cleanout & Liquid Cooling Loop Pressure Check',
                'description' => 'Complete air filter dust purging, liquid radiator inspection, and thermal baseline verification under full AVX-512 compute load.',
                'cost' => 4500.00,
                'performed_by' => 'Dell Enterprise Hardware Specialist Manila',
                'started_at' => $now->subDays(20),
                'completed_at' => $now->subDays(20),
                'performance_assessment' => 'Peak temperatures under full GPU render benchmark dropped by 7.2 degrees Celsius (84C -> 76.8C). Fan acoustical profile normalized.',
                'status' => 'completed',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'device_id' => $deviceIds['DSK-002'],
                'type' => 'inspection',
                'title' => 'Annual Power Supply & UPS Load Balancing Inspection',
                'description' => 'Verify secondary 1400W redundant power supply failover and voltage stabilization under maximum CUDA tensor core utilization.',
                'cost' => 3000.00,
                'performed_by' => 'Schneider Electric / APC Certified Tech',
                'started_at' => $now->addDays(5),
                'completed_at' => null,
                'performance_assessment' => null,
                'status' => 'scheduled',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'device_id' => $deviceIds['MON-001'],
                'type' => 'preventive',
                'title' => 'Colorimetric Display Calibration (sRGB / Display P3)',
                'description' => 'Hardware X-Rite calibration and USB-C PD 90W delivery load test for UI/UX design workstation monitor.',
                'cost' => 1800.00,
                'performed_by' => 'Internal IT Team - BGC Hub',
                'started_at' => $now->subDays(14),
                'completed_at' => $now->subDays(14),
                'performance_assessment' => 'Delta-E measured below 1.2 across 100% sRGB gamut. Power delivery stable at 90W.',
                'status' => 'completed',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'device_id' => $deviceIds['PER-001'],
                'type' => 'inspection',
                'title' => 'Thunderbolt 4 Firmware Update & Port Diagnostics',
                'description' => 'Updated host controller firmware to v41.2 and validated dual-4K 60Hz display output stability.',
                'cost' => 1200.00,
                'performed_by' => 'Hardware Diagnostics Bench',
                'started_at' => $now->addDays(7),
                'completed_at' => null,
                'performance_assessment' => null,
                'status' => 'scheduled',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        $this->insertChunks('maintenance_logs', $maintenanceRows);

        $employeesData = [
            ['name' => 'Aaron Creed Celindro', 'department' => 'Engineering', 'role_profile_id' => $profileIds['Software Engineer']],
            ['name' => 'Alwyn Adriano', 'department' => 'Engineering', 'role_profile_id' => $profileIds['Software Engineer']],
            ['name' => 'Kent Joshua A. Olimberio', 'department' => 'UI/UX Design', 'role_profile_id' => $profileIds['UI/UX Designer']],
            ['name' => 'Melo Ervy Garcia', 'department' => 'Product Design', 'role_profile_id' => $profileIds['Product Designer']],
            ['name' => 'Bianca Nicole Reyes', 'department' => 'Creative & Marketing', 'role_profile_id' => $profileIds['Video & Motion Designer']],
            ['name' => 'Maria Clara Santos', 'department' => 'Operations', 'role_profile_id' => $profileIds['Administrative Staff']],
            ['name' => 'Juan Paolo Dela Cruz', 'department' => 'Sales', 'role_profile_id' => $profileIds['Field Sales Specialist']],
            ['name' => 'Patricia Anne Mendoza', 'department' => 'Business Intelligence', 'role_profile_id' => $profileIds['Data Analyst']],
            ['name' => 'Kimberly Mae Flores', 'department' => 'Human Resources', 'role_profile_id' => $profileIds['Administrative Staff']],
            ['name' => 'Angelo Miguel Ramos', 'department' => 'Sales', 'role_profile_id' => $profileIds['Field Sales Specialist']],
            ['name' => 'Dr. Christian Dave Bautista', 'department' => 'R&D', 'role_profile_id' => $profileIds['AI/ML Researcher']],
            ['name' => 'Joshua Emmanuel Castro', 'department' => 'Engineering', 'role_profile_id' => null],
            ['name' => 'Rafael Antonio Villanueva', 'department' => 'Sales', 'role_profile_id' => $profileIds['Field Sales Specialist']],
            ['name' => 'Clarissa Mae Navarro', 'department' => 'Finance', 'role_profile_id' => $profileIds['Data Analyst']],
            ['name' => 'Gabriel Luis Soriano', 'department' => 'Sales', 'role_profile_id' => $profileIds['Field Sales Specialist']],
        ];

        $employeeIds = [];
        foreach ($employeesData as $emp) {
            $employeeIds[$emp['name']] = DB::table('employees')->insertGetId([
                'name' => $emp['name'],
                'department' => $emp['department'],
                'role_profile_id' => $emp['role_profile_id'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $smallAssignments = [
            ['LAP-003', 'Aaron Creed Celindro', 'ai_recommended', 0.94, 18],
            ['LAP-002', 'Alwyn Adriano', 'ai_recommended', 0.95, 22],
            ['LAP-004', 'Kent Joshua A. Olimberio', 'ai_recommended', 0.93, 15],
            ['LAP-001', 'Melo Ervy Garcia', 'ai_recommended', 0.96, 12],
            ['DSK-006', 'Patricia Anne Mendoza', 'manual_override', 0.96, 35],
            ['DSK-010', 'Kimberly Mae Flores', 'manual_override', 0.98, 40],
            ['LAP-006', 'Angelo Miguel Ramos', 'ai_recommended', 0.95, 27],
            ['LAP-005', 'Rafael Antonio Villanueva', 'ai_recommended', 0.96, 19],
            ['DSK-007', 'Clarissa Mae Navarro', 'ai_recommended', 0.97, 24],
            ['LAP-007', 'Gabriel Luis Soriano', 'ai_recommended', 0.96, 11],
            // Exact 3 intentional compute mismatches
            ['LAP-008', 'Bianca Nicole Reyes', 'manual_override', 0.28, 30],
            ['DSK-001', 'Maria Clara Santos', 'manual_override', 0.45, 32],
            ['DSK-009', 'Juan Paolo Dela Cruz', 'manual_override', 0.35, 38],
            // Multi-asset secondary custody (monitors, mobile, peripherals)
            ['MON-001', 'Aaron Creed Celindro', 'manual_override', null, 18],
            ['MON-002', 'Alwyn Adriano', 'manual_override', null, 22],
            ['MON-003', 'Kent Joshua A. Olimberio', 'manual_override', null, 15],
            ['MON-004', 'Melo Ervy Garcia', 'manual_override', null, 12],
            ['MON-005', 'Patricia Anne Mendoza', 'manual_override', null, 35],
            ['MOB-001', 'Melo Ervy Garcia', 'manual_override', null, 10],
            ['MOB-002', 'Kent Joshua A. Olimberio', 'manual_override', null, 14],
            ['MOB-003', 'Angelo Miguel Ramos', 'manual_override', null, 25],
            ['PER-001', 'Aaron Creed Celindro', 'manual_override', null, 18],
            ['PER-002', 'Alwyn Adriano', 'manual_override', null, 22],
            ['PER-003', 'Clarissa Mae Navarro', 'manual_override', null, 24],
        ];

        $assignmentRows = [];
        $assignedDeviceIds = [];

        foreach ($smallAssignments as [$tag, $empName, $source, $score, $daysAgo]) {
            $dId = $deviceIds[$tag];
            $assignedDeviceIds[] = $dId;
            $assignmentRows[] = [
                'device_id' => $dId,
                'employee_id' => $employeeIds[$empName],
                'assigned_at' => $now->subDays($daysAgo),
                'unassigned_at' => null,
                'match_score' => $score,
                'assignment_source' => $source,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $this->insertChunks('assignments', $assignmentRows);
        DB::table('devices')->whereIn('id', $assignedDeviceIds)->update(['status' => 'assigned']);

        $licensesData = [
            [
                'name' => 'Microsoft 365 Business Premium',
                'vendor' => 'Microsoft Philippines',
                'license_key' => 'MS365-PH-SMALL-01',
                'category' => 'productivity',
                'license_type' => 'saas',
                'billing_cycle' => 'annual',
                'total_seats' => 16,
                'cost_per_seat' => 12500.00,
                'purchase_date' => $now->subMonths(9)->toDateString(),
                'renewal_date' => $now->addMonths(3)->toDateString(),
                'status' => 'active',
                'notes' => 'Core identity, Exchange Online, Teams, and Defender endpoint protection.',
                'seats' => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14],
            ],
            [
                'name' => 'Figma Organization',
                'vendor' => 'Figma Inc.',
                'license_key' => 'FIG-ORG-SMALL-02',
                'category' => 'design',
                'license_type' => 'saas',
                'billing_cycle' => 'annual',
                'total_seats' => 5,
                'cost_per_seat' => 29500.00,
                'purchase_date' => $now->subMonths(11)->toDateString(),
                'renewal_date' => $now->addDays(24)->toDateString(),
                'status' => 'active',
                'notes' => 'Design systems, Dev Mode inspection, and shared prototyping workspaces.',
                'seats' => [0, 1, 2, 3],
            ],
            [
                'name' => 'Adobe Creative Cloud for Teams',
                'vendor' => 'Adobe Enterprise APAC',
                'license_key' => 'ADBE-CCT-SMALL-03',
                'category' => 'design',
                'license_type' => 'saas',
                'billing_cycle' => 'monthly',
                'total_seats' => 4,
                'cost_per_seat' => 4650.00,
                'purchase_date' => $now->subMonths(6)->toDateString(),
                'renewal_date' => $now->addMonths(6)->toDateString(),
                'status' => 'active',
                'notes' => 'Premiere Pro, After Effects, Photoshop, and Illustrator.',
                'seats' => [2, 3, 4],
            ],
            [
                'name' => 'JetBrains All Products Pack',
                'vendor' => 'JetBrains s.r.o.',
                'license_key' => 'JB-ALL-SMALL-04',
                'category' => 'development',
                'license_type' => 'saas',
                'billing_cycle' => 'annual',
                'total_seats' => 5,
                'cost_per_seat' => 16800.00,
                'purchase_date' => $now->subMonths(5)->toDateString(),
                'renewal_date' => $now->addMonths(7)->toDateString(),
                'status' => 'active',
                'notes' => 'PhpStorm, IntelliJ IDEA Ultimate, DataGrip, and PyCharm Professional.',
                'seats' => [0, 1, 10, 11],
            ],
            [
                'name' => 'GitHub Enterprise Cloud',
                'vendor' => 'GitHub Inc.',
                'license_key' => 'GHEC-SMALL-05',
                'category' => 'development',
                'license_type' => 'saas',
                'billing_cycle' => 'annual',
                'total_seats' => 6,
                'cost_per_seat' => 14200.00,
                'purchase_date' => $now->subMonths(4)->toDateString(),
                'renewal_date' => $now->addMonths(8)->toDateString(),
                'status' => 'active',
                'notes' => 'Source hosting, CI/CD Actions minutes, and Dependabot alerts.',
                'seats' => [0, 1, 2, 10, 11],
            ],
            [
                'name' => 'Slack Pro Workspace',
                'vendor' => 'Salesforce / Slack',
                'license_key' => 'SLK-PRO-SMALL-06',
                'category' => 'collaboration',
                'license_type' => 'saas',
                'billing_cycle' => 'annual',
                'total_seats' => 18,
                'cost_per_seat' => 5200.00,
                'purchase_date' => $now->subMonths(8)->toDateString(),
                'renewal_date' => $now->addMonths(4)->toDateString(),
                'status' => 'active',
                'notes' => 'Company-wide messaging channels and external client connect.',
                'seats' => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
            ],
        ];

        $empIdList = array_values($employeeIds);
        $seatRows = [];

        foreach ($licensesData as $licenseSpec) {
            $seatIndices = $licenseSpec['seats'];
            unset($licenseSpec['seats']);

            $licenseId = DB::table('software_licenses')->insertGetId(array_merge($licenseSpec, [
                'created_at' => $now,
                'updated_at' => $now,
            ]));

            foreach ($seatIndices as $offset => $empIdx) {
                $seatRows[] = [
                    'software_license_id' => $licenseId,
                    'employee_id' => $empIdList[$empIdx],
                    'assigned_at' => $now->subDays(20 + ($offset * 3)),
                    'revoked_at' => null,
                    'assigned_by_user_id' => $adminId,
                    'notes' => 'Provisioned via standard onboarding pack.',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        $this->insertChunks('software_license_assignments', $seatRows);
    }

    /**
     * Seed Medium (150 assets) or Large (450 assets) scale deterministically via chunked bulk inserts.
     */
    private function seedEnterpriseScale(string $preset, ?int $adminId): void
    {
        $now = CarbonImmutable::now();
        $isLarge = $preset === self::PRESET_LARGE;

        $cfg = $isLarge
            ? [
                'extra_profiles' => true,
                'laptops' => 165,
                'desktops' => 85,
                'monitors' => 95,
                'mobiles' => 55,
                'peripherals' => 50,
                'employees' => 200,
                'assigned_compute' => 180,
                'mismatches' => 22,
                'assigned_non_compute' => 140,
                'maintenance_logs' => 45,
                'licenses' => 25,
                'compute_repair' => 12,
                'compute_retired' => 10,
                'compute_acquisition' => 6,
                'non_compute_repair' => 6,
                'non_compute_retired' => 6,
            ]
            : [
                'extra_profiles' => true,
                'laptops' => 55,
                'desktops' => 30,
                'monitors' => 30,
                'mobiles' => 18,
                'peripherals' => 17,
                'employees' => 65,
                'assigned_compute' => 58,
                'mismatches' => 10,
                'assigned_non_compute' => 45,
                'maintenance_logs' => 18,
                'licenses' => 14,
                'compute_repair' => 5,
                'compute_retired' => 4,
                'compute_acquisition' => 2,
                'non_compute_repair' => 2,
                'non_compute_retired' => 2,
            ];

        $profileIds = $this->insertRoleProfiles($cfg['extra_profiles'], $now, $isLarge);

        $hubs = $isLarge
            ? [
                'BGC, Taguig City - Bonifacio High Street Hub Level 15',
                'Makati City - Ayala Triangle Tower One Level 22',
                'Ortigas Center, Pasig City - Exchange Road Tech Center',
                'Quezon City - Eastwood Cyberpark Tower 3',
                'Alabang, Muntinlupa - Filinvest Corporate City Level 5',
                'Cebu City - Cebu IT Park Tower 2',
                'Davao City - Damosa IT Park Business Hub',
            ]
            : [
                'BGC, Taguig City - Bonifacio High Street Hub Level 15',
                'Makati City - Ayala Triangle Tower One Level 22',
                'Ortigas Center, Pasig City - Exchange Road Tech Center',
                'Quezon City - Eastwood Cyberpark Tower 3',
                'Alabang, Muntinlupa - Filinvest Corporate City Level 5',
            ];

        // 1. Insert Employees deterministically with unique Filipino names
        $roleRoster = $this->enterpriseRoleRoster($isLarge);
        $employeeRows = [];

        for ($i = 0; $i < $cfg['employees']; $i++) {
            [$roleName, $department] = $roleRoster[$i % count($roleRoster)];
            $roleId = ($i >= $cfg['assigned_compute'] && $i % 4 === 0) ? null : $profileIds[$roleName];

            $employeeRows[] = [
                'name' => $this->deterministicFilipinoName($i),
                'department' => $department,
                'role_profile_id' => $roleId,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $this->insertChunks('employees', $employeeRows);
        $employees = DB::table('employees')->orderBy('id')->get(['id', 'name', 'department', 'role_profile_id'])->all();
        $profileNamesById = array_flip($profileIds);

        // 2. Build Compute Blueprint Queue: first assigned_compute slots match assigned employees!
        $laptopBlueprints = [];
        $desktopBlueprints = [];

        $matchedCount = $cfg['assigned_compute'] - $cfg['mismatches'];
        $computeAssignmentsPlanned = []; // [empIndex => [isLaptop, specTemplateKey, targetScore, source, isMismatch]]

        for ($i = 0; $i < $cfg['assigned_compute']; $i++) {
            $emp = $employees[$i];
            $roleName = $emp->role_profile_id ? ($profileNamesById[$emp->role_profile_id] ?? 'Administrative Staff') : 'Software Engineer';

            if ($i < $matchedCount) {
                $templateKey = $this->matchedTemplateForRole($roleName, $i);
                $isLaptop = $this->computeTemplate($templateKey)['device_type'] === 'laptop';
                $computeAssignmentsPlanned[] = [
                    'emp_id' => $emp->id,
                    'template' => $templateKey,
                    'is_laptop' => $isLaptop,
                    'score' => 0.92 + (($i % 7) * 0.01),
                    'source' => ($i % 4 === 0) ? 'manual_override' : 'ai_recommended',
                ];
                if ($isLaptop) {
                    $laptopBlueprints[] = ['template' => $templateKey, 'status' => 'assigned', 'stage' => 'deployment', 'condition' => ($i % 3 === 0) ? 'good' : 'excellent'];
                } else {
                    $desktopBlueprints[] = ['template' => $templateKey, 'status' => 'assigned', 'stage' => 'deployment', 'condition' => ($i % 3 === 0) ? 'good' : 'excellent'];
                }
            } else {
                $mismatchIdx = $i - $matchedCount;
                $mismatchKind = $mismatchIdx % 3;

                if ($mismatchKind === 0) {
                    // Under-provisioned Video & Motion Designer with entry laptop
                    DB::table('employees')->where('id', $emp->id)->update([
                        'role_profile_id' => $profileIds['Video & Motion Designer'],
                        'department' => 'Creative & Marketing',
                    ]);
                    $templateKey = 'laptop_entry';
                    $isLaptop = true;
                    $score = 0.28;
                } elseif ($mismatchKind === 1) {
                    // Over-provisioned Administrative Staff on AI Workstation Tower
                    DB::table('employees')->where('id', $emp->id)->update([
                        'role_profile_id' => $profileIds['Administrative Staff'],
                        'department' => 'Operations',
                    ]);
                    $templateKey = 'desktop_workstation';
                    $isLaptop = false;
                    $score = 0.45;
                } else {
                    // Field Sales Specialist trapped on entry HDD desktop
                    DB::table('employees')->where('id', $emp->id)->update([
                        'role_profile_id' => $profileIds['Field Sales Specialist'],
                        'department' => 'Sales',
                    ]);
                    $templateKey = 'desktop_entry';
                    $isLaptop = false;
                    $score = 0.35;
                }

                $computeAssignmentsPlanned[] = [
                    'emp_id' => $emp->id,
                    'template' => $templateKey,
                    'is_laptop' => $isLaptop,
                    'score' => $score,
                    'source' => 'manual_override',
                ];
                if ($isLaptop) {
                    $laptopBlueprints[] = ['template' => $templateKey, 'status' => 'assigned', 'stage' => 'deployment', 'condition' => 'good'];
                } else {
                    $desktopBlueprints[] = ['template' => $templateKey, 'status' => 'assigned', 'stage' => 'deployment', 'condition' => 'good'];
                }
            }
        }

        // Fill remaining compute stock (available, in_repair, retired, acquisition)
        $stockTemplatePool = ['laptop_high', 'laptop_mid', 'laptop_entry', 'laptop_gpu', 'desktop_workstation', 'desktop_high', 'desktop_mid', 'desktop_entry'];
        $remainingLaptops = max(0, $cfg['laptops'] - count($laptopBlueprints));
        $remainingDesktops = max(0, $cfg['desktops'] - count($desktopBlueprints));

        $unassignedComputeCount = $remainingLaptops + $remainingDesktops;
        $repairLeft = $cfg['compute_repair'];
        $retiredLeft = $cfg['compute_retired'];
        $acquisitionLeft = $cfg['compute_acquisition'];

        for ($k = 0; $k < $unassignedComputeCount; $k++) {
            $wantLaptop = ($remainingLaptops > 0 && ($remainingDesktops === 0 || ($k % 3 !== 2)));
            if ($wantLaptop) {
                $remainingLaptops--;
                $tplChoices = ['laptop_high', 'laptop_mid', 'laptop_gpu', 'laptop_entry'];
            } else {
                $remainingDesktops--;
                $tplChoices = ['desktop_workstation', 'desktop_high', 'desktop_mid', 'desktop_entry'];
            }

            $templateKey = $tplChoices[$k % count($tplChoices)];

            if ($repairLeft > 0) {
                $repairLeft--;
                $status = 'in_repair';
                $stage = 'maintenance';
                $condition = 'needs_repair';
            } elseif ($retiredLeft > 0) {
                $retiredLeft--;
                $status = 'retired';
                $stage = 'retirement';
                $condition = 'retired';
            } elseif ($acquisitionLeft > 0) {
                $acquisitionLeft--;
                $status = 'available';
                $stage = 'acquisition';
                $condition = 'excellent';
            } else {
                $status = 'available';
                $stage = 'deployment';
                $condition = ($k % 5 === 0) ? 'fair' : 'excellent';
            }

            $entry = ['template' => $templateKey, 'status' => $status, 'stage' => $stage, 'condition' => $condition];
            if ($wantLaptop) {
                $laptopBlueprints[] = $entry;
            } else {
                $desktopBlueprints[] = $entry;
            }
        }

        // 3. Prepare Device Rows (Compute + Monitors + Mobiles + Peripherals)
        $deviceRows = [];
        $assignedLaptopTags = [];
        $assignedDesktopTags = [];
        $repairDeviceTags = [];

        foreach ($laptopBlueprints as $idx => $bp) {
            $num = $idx + 1;
            $tag = sprintf('LAP-%03d', $num);
            $deviceRows[] = $this->buildComputeDeviceRow($tag, $bp, $num, $hubs, $now, $isLarge);
            if ($bp['status'] === 'assigned') {
                $assignedLaptopTags[] = $tag;
            } elseif ($bp['status'] === 'in_repair') {
                $repairDeviceTags[] = $tag;
            }
        }

        foreach ($desktopBlueprints as $idx => $bp) {
            $num = $idx + 1;
            $tag = sprintf('DSK-%03d', $num);
            $deviceRows[] = $this->buildComputeDeviceRow($tag, $bp, $num + 200, $hubs, $now, $isLarge);
            if ($bp['status'] === 'assigned') {
                $assignedDesktopTags[] = $tag;
            } elseif ($bp['status'] === 'in_repair') {
                $repairDeviceTags[] = $tag;
            }
        }

        $nonComputeAssignedTags = [];
        $nonComputeRepairLeft = $cfg['non_compute_repair'];
        $nonComputeRetiredLeft = $cfg['non_compute_retired'];

        $nonComputeSpecs = [
            ['prefix' => 'MON', 'type' => 'monitor', 'count' => $cfg['monitors']],
            ['prefix' => 'MOB', 'type' => 'mobile', 'count' => $cfg['mobiles']],
            ['prefix' => 'PER', 'type' => 'peripheral', 'count' => $cfg['peripherals']],
        ];

        $totalNonCompute = $cfg['monitors'] + $cfg['mobiles'] + $cfg['peripherals'];
        $nonComputeCursor = 0;

        foreach ($nonComputeSpecs as $ncSpec) {
            for ($idx = 0; $idx < $ncSpec['count']; $idx++) {
                $num = $idx + 1;
                $tag = sprintf('%s-%03d', $ncSpec['prefix'], $num);

                if ($nonComputeCursor < $cfg['assigned_non_compute']) {
                    $status = 'assigned';
                    $stage = 'deployment';
                    $condition = ($nonComputeCursor % 4 === 0) ? 'good' : 'excellent';
                    $nonComputeAssignedTags[] = $tag;
                } elseif ($nonComputeRepairLeft > 0) {
                    $nonComputeRepairLeft--;
                    $status = 'in_repair';
                    $stage = 'maintenance';
                    $condition = 'needs_repair';
                    $repairDeviceTags[] = $tag;
                } elseif ($nonComputeRetiredLeft > 0) {
                    $nonComputeRetiredLeft--;
                    $status = 'retired';
                    $stage = 'retirement';
                    $condition = 'retired';
                } else {
                    $status = 'available';
                    $stage = 'deployment';
                    $condition = 'excellent';
                }

                $deviceRows[] = $this->buildNonComputeDeviceRow($tag, $ncSpec['type'], $idx, $status, $stage, $condition, $hubs, $now);
                $nonComputeCursor++;
            }
        }

        $this->insertChunks('devices', $deviceRows);

        $deviceIdByTag = DB::table('devices')->pluck('id', 'asset_tag')->all();
        $insertedDevices = DB::table('devices')->orderBy('id')->get(['id', 'asset_tag', 'lifecycle_stage'])->all();

        // 4. Lifecycle Events (NO updated_at column)
        $lifecycleRows = [];
        foreach ($insertedDevices as $dev) {
            $lifecycleRows[] = [
                'device_id' => $dev->id,
                'from_stage' => 'new',
                'to_stage' => $dev->lifecycle_stage,
                'changed_by_user_id' => $adminId,
                'notes' => "Asset {$dev->asset_tag} onboarded in {$dev->lifecycle_stage} stage.",
                'created_at' => $now,
            ];
        }
        $this->insertChunks('lifecycle_events', $lifecycleRows);

        // 5. Assignments (Compute + Multi-Asset Non-Compute Custody)
        $assignmentRows = [];
        $lapCursor = 0;
        $dskCursor = 0;

        foreach ($computeAssignmentsPlanned as $idx => $plan) {
            $tag = $plan['is_laptop']
                ? $assignedLaptopTags[$lapCursor++]
                : $assignedDesktopTags[$dskCursor++];

            $assignmentRows[] = [
                'device_id' => $deviceIdByTag[$tag],
                'employee_id' => $plan['emp_id'],
                'assigned_at' => $now->subDays(5 + ($idx % 75)),
                'unassigned_at' => null,
                'match_score' => round($plan['score'], 2),
                'assignment_source' => $plan['source'],
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach ($nonComputeAssignedTags as $idx => $tag) {
            $emp = $employees[$idx % $cfg['assigned_compute']];
            $assignmentRows[] = [
                'device_id' => $deviceIdByTag[$tag],
                'employee_id' => $emp->id,
                'assigned_at' => $now->subDays(4 + ($idx % 60)),
                'unassigned_at' => null,
                'match_score' => null,
                'assignment_source' => 'manual_override',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $this->insertChunks('assignments', $assignmentRows);

        // 6. Maintenance Logs
        $maintenanceRows = [];
        $allDeviceIds = array_values($deviceIdByTag);
        $logCount = $cfg['maintenance_logs'];
        $maintTitles = [
            ['repair', 'OEM Battery & Thermal Assembly Replacement', 'Internal Battery Bench', 7800.00],
            ['upgrade', 'RAM Capacity Expansion & NVMe Benchmark', 'Internal IT Engineering Bench', 9500.00],
            ['preventive', 'Quarterly Dust Purging & Fan Acoustic Servicing', 'Authorized Service Partner PH', 3800.00],
            ['inspection', 'Annual Power Delivery, Battery Health & Security Audit', 'IT Compliance & Diagnostics Team', 2500.00],
        ];

        for ($m = 0; $m < $logCount; $m++) {
            $targetTag = $m < count($repairDeviceTags)
                ? $repairDeviceTags[$m]
                : null;
            $targetDeviceId = $targetTag
                ? $deviceIdByTag[$targetTag]
                : $allDeviceIds[($m * 7) % count($allDeviceIds)];

            [$mType, $mTitle, $mBy, $mCost] = $maintTitles[$m % count($maintTitles)];

            if ($targetTag !== null) {
                $mStatus = 'in_progress';
                $mType = 'repair';
                $startedAt = $now->subDays(1 + ($m % 5));
                $completedAt = null;
                $assessment = null;
            } elseif ($m % 4 === 1) {
                $mStatus = 'scheduled';
                $startedAt = $now->addDays(3 + ($m % 14));
                $completedAt = null;
                $assessment = null;
            } else {
                $mStatus = 'completed';
                $startedAt = $now->subDays(15 + ($m % 90));
                $completedAt = $startedAt->addDay();
                $assessment = 'Hardware telemetry passed 100% burn-in load verification with zero thermal throttling.';
            }

            $maintenanceRows[] = [
                'device_id' => $targetDeviceId,
                'type' => $mType,
                'title' => $mTitle,
                'description' => "Enterprise ITAM servicing event #{$m} for fleet compliance.",
                'cost' => $mCost + (($m % 4) * 450.00),
                'performed_by' => $mBy,
                'started_at' => $startedAt,
                'completed_at' => $completedAt,
                'performance_assessment' => $assessment,
                'status' => $mStatus,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $this->insertChunks('maintenance_logs', $maintenanceRows);

        // 7. Software Licenses & Bulk Seat Assignments
        $catalog = $this->softwareLicenseCatalog();
        $licenseRows = [];
        $seatPlans = [];
        $empCount = count($employees);

        for ($l = 0; $l < $cfg['licenses']; $l++) {
            $tpl = $catalog[$l % count($catalog)];
            $tierScale = $isLarge ? 3 : 1;
            $totalSeats = max(8, min($empCount, (int) round($tpl['base_seats'] * $tierScale)));
            $status = ($l === $cfg['licenses'] - 1) ? 'suspended' : 'active';
            $renewalDate = match ($l % 5) {
                0 => $now->addDays(15 + $l)->toDateString(),
                1 => $now->subDays(10 + $l)->toDateString(),
                default => $now->addMonths(3 + ($l % 9))->toDateString(),
            };

            if ($tpl['billing_cycle'] === 'one_time') {
                $renewalDate = null;
            }

            $licenseRows[] = [
                'name' => $tpl['name'].($l >= count($catalog) ? ' (Regional Pool '.($l - count($catalog) + 2).')' : ''),
                'vendor' => $tpl['vendor'],
                'license_key' => strtoupper($preset).'-LIC-'.sprintf('%03d', $l + 1),
                'category' => $tpl['category'],
                'license_type' => $tpl['license_type'],
                'billing_cycle' => $tpl['billing_cycle'],
                'total_seats' => $totalSeats,
                'cost_per_seat' => $tpl['cost_per_seat'],
                'purchase_date' => $now->subMonths(6 + ($l % 12))->toDateString(),
                'renewal_date' => $renewalDate,
                'status' => $status,
                'notes' => $tpl['notes'],
                'created_at' => $now,
                'updated_at' => $now,
            ];

            $targetAssigned = $status === 'active'
                ? max(4, (int) floor($totalSeats * (($l % 3 === 0) ? 0.90 : 0.72)))
                : 0;
            $seatPlans[$l] = $targetAssigned;
        }

        $this->insertChunks('software_licenses', $licenseRows);
        $insertedLicenses = DB::table('software_licenses')->orderBy('id')->get(['id'])->all();

        $seatRows = [];
        foreach ($insertedLicenses as $lIdx => $lic) {
            $count = min($empCount, $seatPlans[$lIdx] ?? 0);
            for ($s = 0; $s < $count; $s++) {
                $empIdx = ($s + ($lIdx * 5)) % $empCount;
                $seatRows[] = [
                    'software_license_id' => $lic->id,
                    'employee_id' => $employees[$empIdx]->id,
                    'assigned_at' => $now->subDays(10 + ($s % 80)),
                    'revoked_at' => null,
                    'assigned_by_user_id' => $adminId,
                    'notes' => 'Assigned via enterprise license pool.',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        $this->insertChunks('software_license_assignments', $seatRows);
    }

    /**
     * Insert default 8 or expanded role profiles and return map of profile name => id.
     *
     * @return array<string, int>
     */
    private function insertRoleProfiles(bool $includeEnterpriseRoles, CarbonImmutable $now, bool $includeSecurity = false): array
    {
        $profiles = [
            [
                'name' => 'Software Engineer',
                'min_cpu_tier' => 'high',
                'min_ram_gb' => 16,
                'min_storage_gb' => 512,
                'requires_gpu' => false,
                'min_gpu_tier' => 'integrated',
                'portability_required' => true,
                'description' => 'Docker microservices, local compilation, IDEs, and full-stack software development.',
            ],
            [
                'name' => 'UI/UX Designer',
                'min_cpu_tier' => 'high',
                'min_ram_gb' => 16,
                'min_storage_gb' => 512,
                'requires_gpu' => false,
                'min_gpu_tier' => 'integrated',
                'portability_required' => true,
                'description' => 'Figma design systems, high-density prototyping, asset exports, and user research testing.',
            ],
            [
                'name' => 'Product Designer',
                'min_cpu_tier' => 'high',
                'min_ram_gb' => 32,
                'min_storage_gb' => 1024,
                'requires_gpu' => true,
                'min_gpu_tier' => 'dedicated-entry',
                'portability_required' => true,
                'description' => 'Multi-platform product architecture, interactive 3D mockups, complex component libraries, and motion specs.',
            ],
            [
                'name' => 'Video & Motion Designer',
                'min_cpu_tier' => 'high',
                'min_ram_gb' => 32,
                'min_storage_gb' => 1024,
                'requires_gpu' => true,
                'min_gpu_tier' => 'dedicated-high',
                'portability_required' => true,
                'description' => '4K video rendering, Adobe Premiere, After Effects, DaVinci Resolve, and color grading.',
            ],
            [
                'name' => 'Data Analyst',
                'min_cpu_tier' => 'mid',
                'min_ram_gb' => 16,
                'min_storage_gb' => 512,
                'requires_gpu' => false,
                'min_gpu_tier' => 'integrated',
                'portability_required' => false,
                'description' => 'SQL querying, Tableau/PowerBI, heavy Excel datasets, and statistical models.',
            ],
            [
                'name' => 'Administrative Staff',
                'min_cpu_tier' => 'entry',
                'min_ram_gb' => 8,
                'min_storage_gb' => 256,
                'requires_gpu' => false,
                'min_gpu_tier' => 'none',
                'portability_required' => false,
                'description' => 'Email, ERP web apps, document generation, and basic office productivity.',
            ],
            [
                'name' => 'Field Sales Specialist',
                'min_cpu_tier' => 'mid',
                'min_ram_gb' => 16,
                'min_storage_gb' => 512,
                'requires_gpu' => false,
                'min_gpu_tier' => 'integrated',
                'portability_required' => true,
                'description' => 'Client presentations across Metro Manila, on-site travel, CRM management, video conferencing.',
            ],
            [
                'name' => 'AI/ML Researcher',
                'min_cpu_tier' => 'workstation',
                'min_ram_gb' => 64,
                'min_storage_gb' => 2048,
                'requires_gpu' => true,
                'min_gpu_tier' => 'dedicated-high',
                'portability_required' => false,
                'description' => 'Local LLM fine-tuning, PyTorch model training, and heavy CUDA tensor workloads.',
            ],
        ];

        if ($includeEnterpriseRoles) {
            $profiles[] = [
                'name' => 'DevOps / Cloud Engineer',
                'min_cpu_tier' => 'high',
                'min_ram_gb' => 32,
                'min_storage_gb' => 1024,
                'requires_gpu' => false,
                'min_gpu_tier' => 'integrated',
                'portability_required' => true,
                'description' => 'Kubernetes clusters, Terraform IaC pipelines, observability stacks, and multi-container sandboxes.',
            ];
        }

        if ($includeSecurity) {
            $profiles[] = [
                'name' => 'Security Operations Analyst',
                'min_cpu_tier' => 'high',
                'min_ram_gb' => 32,
                'min_storage_gb' => 1024,
                'requires_gpu' => false,
                'min_gpu_tier' => 'integrated',
                'portability_required' => true,
                'description' => 'SIEM telemetry analysis, sandboxed malware detonation VMs, and incident response.',
            ];
        }

        $ids = [];
        foreach ($profiles as $profile) {
            $ids[$profile['name']] = DB::table('role_profiles')->insertGetId(array_merge($profile, [
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }

        return $ids;
    }

    /**
     * Original 23 Small preset compute units preserving canonical asset tags and locations.
     *
     * @return list<array<string, mixed>>
     */
    private function smallComputeCatalog(CarbonImmutable $now): array
    {
        return [
            [
                'asset_tag' => 'LAP-001', 'serial_number' => 'C02G45XP19F3', 'barcode' => 'BC-LAP-001', 'techspecs_id' => 'apple-macbook-pro-16-m3-max',
                'device_type' => 'laptop', 'brand' => 'Apple', 'model' => 'MacBook Pro 16 M3 Max',
                'location' => 'BGC, Taguig City - Bonifacio High Street Hub, Level 15',
                'image_url' => HardwareImageService::resolveModelImage('Apple', 'MacBook Pro 16'),
                'cpu' => 'Apple M3 Max 14-core', 'cpu_tier' => 'high', 'ram_gb' => 36, 'storage_type' => 'SSD', 'storage_gb' => 1024,
                'gpu' => 'Apple 30-core GPU', 'gpu_tier' => 'dedicated-high', 'year_acquired' => 2024,
                'purchase_cost' => 215000.00, 'purchase_date' => '2024-01-15', 'depreciation_rate_percent' => 20.0,
                'vendor' => 'Power Mac Center Corporate / Apple PH', 'warranty_start' => '2024-01-15', 'warranty_expiry' => '2027-01-15', 'contract_sla' => 'AppleCare+ for Enterprise (4h onsite)',
                'condition' => 'excellent', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'LAP-002', 'serial_number' => '8F29KD3X', 'barcode' => 'BC-LAP-002', 'techspecs_id' => 'dell-xps-15-9530',
                'device_type' => 'laptop', 'brand' => 'Dell', 'model' => 'XPS 15 9530',
                'location' => 'Makati City - Ayala Triangle Tower One, Level 22',
                'image_url' => HardwareImageService::resolveModelImage('Dell', 'XPS 15'),
                'cpu' => 'Intel Core i9-13900H', 'cpu_tier' => 'high', 'ram_gb' => 32, 'storage_type' => 'SSD', 'storage_gb' => 1024,
                'gpu' => 'NVIDIA RTX 4070 Laptop', 'gpu_tier' => 'dedicated-high', 'year_acquired' => 2024,
                'purchase_cost' => 155000.00, 'purchase_date' => '2024-02-10', 'depreciation_rate_percent' => 20.0,
                'vendor' => 'Dell Philippines Direct', 'warranty_start' => '2024-02-10', 'warranty_expiry' => '2027-02-10', 'contract_sla' => 'ProSupport Plus Mission Critical NBD',
                'condition' => 'excellent', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'LAP-003', 'serial_number' => 'PF49XQ11', 'barcode' => 'BC-LAP-003', 'techspecs_id' => 'lenovo-thinkpad-t14s-gen4',
                'device_type' => 'laptop', 'brand' => 'Lenovo', 'model' => 'ThinkPad T14s Gen 4',
                'location' => 'Ortigas Center, Pasig City - Exchange Road Tech Center',
                'image_url' => HardwareImageService::resolveModelImage('Lenovo', 'ThinkPad T14s'),
                'cpu' => 'AMD Ryzen 7 PRO 7840U', 'cpu_tier' => 'high', 'ram_gb' => 32, 'storage_type' => 'SSD', 'storage_gb' => 512,
                'gpu' => 'AMD Radeon 780M', 'gpu_tier' => 'integrated', 'year_acquired' => 2024,
                'purchase_cost' => 98000.00, 'purchase_date' => '2024-03-01', 'depreciation_rate_percent' => 20.0,
                'vendor' => 'Lenovo Philippines Commercial Direct', 'warranty_start' => '2024-03-01', 'warranty_expiry' => '2027-03-01', 'contract_sla' => 'Premier Support NBD Onsite',
                'condition' => 'excellent', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'LAP-004', 'serial_number' => 'H9Y21M89', 'barcode' => 'BC-LAP-004', 'techspecs_id' => 'apple-macbook-pro-14-m3-pro',
                'device_type' => 'laptop', 'brand' => 'Apple', 'model' => 'MacBook Pro 14 M3 Pro',
                'location' => 'BGC, Taguig City - Bonifacio High Street Hub, Level 15',
                'image_url' => HardwareImageService::resolveModelImage('Apple', 'MacBook Pro 14'),
                'cpu' => 'Apple M3 Pro 11-core', 'cpu_tier' => 'high', 'ram_gb' => 18, 'storage_type' => 'SSD', 'storage_gb' => 512,
                'gpu' => 'Apple 14-core GPU', 'gpu_tier' => 'dedicated-entry', 'year_acquired' => 2024,
                'purchase_cost' => 125000.00, 'purchase_date' => '2024-02-20', 'depreciation_rate_percent' => 20.0,
                'vendor' => 'Power Mac Center Corporate / Apple PH', 'warranty_start' => '2024-02-20', 'warranty_expiry' => '2027-02-20', 'contract_sla' => 'AppleCare+ for Enterprise',
                'condition' => 'excellent', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'LAP-005', 'serial_number' => 'PF32098K', 'barcode' => 'BC-LAP-005', 'techspecs_id' => 'lenovo-thinkpad-e14-gen5',
                'device_type' => 'laptop', 'brand' => 'Lenovo', 'model' => 'ThinkPad E14 Gen 5',
                'location' => 'Quezon City - Eastwood Cyberpark Tower 3',
                'image_url' => HardwareImageService::resolveModelImage('Lenovo', 'ThinkPad E14'),
                'cpu' => 'Intel Core i5-1335U', 'cpu_tier' => 'mid', 'ram_gb' => 16, 'storage_type' => 'SSD', 'storage_gb' => 512,
                'gpu' => 'Intel Iris Xe', 'gpu_tier' => 'integrated', 'year_acquired' => 2023,
                'purchase_cost' => 56000.00, 'purchase_date' => '2023-05-12', 'depreciation_rate_percent' => 25.0,
                'vendor' => 'Silicon Valley / Lenovo Partner PH', 'warranty_start' => '2023-05-12', 'warranty_expiry' => '2026-05-12', 'contract_sla' => 'Standard Depot Repair',
                'condition' => 'good', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'LAP-006', 'serial_number' => 'DL98124K', 'barcode' => 'BC-LAP-006', 'techspecs_id' => 'dell-latitude-5440',
                'device_type' => 'laptop', 'brand' => 'Dell', 'model' => 'Latitude 5440',
                'location' => 'Mandaluyong City - Pioneer Innovation Center',
                'image_url' => HardwareImageService::resolveModelImage('Dell', 'Latitude 5440'),
                'cpu' => 'Intel Core i5-1345U', 'cpu_tier' => 'mid', 'ram_gb' => 16, 'storage_type' => 'SSD', 'storage_gb' => 512,
                'gpu' => 'Intel Iris Xe', 'gpu_tier' => 'integrated', 'year_acquired' => 2023,
                'purchase_cost' => 68000.00, 'purchase_date' => '2023-06-18', 'depreciation_rate_percent' => 25.0,
                'vendor' => 'Dell Philippines Direct', 'warranty_start' => '2023-06-18', 'warranty_expiry' => '2026-06-18', 'contract_sla' => 'Dell ProSupport NBD',
                'condition' => 'good', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'LAP-007', 'serial_number' => 'CND29481M', 'barcode' => 'BC-LAP-007', 'techspecs_id' => 'hp-elitebook-840-g10',
                'device_type' => 'laptop', 'brand' => 'HP', 'model' => 'EliteBook 840 G10',
                'location' => 'Makati City - Legaspi Village Design Studio',
                'image_url' => HardwareImageService::resolveModelImage('HP', 'EliteBook 840 G10'),
                'cpu' => 'Intel Core i5-1350P', 'cpu_tier' => 'mid', 'ram_gb' => 16, 'storage_type' => 'SSD', 'storage_gb' => 512,
                'gpu' => 'Intel Iris Xe', 'gpu_tier' => 'integrated', 'year_acquired' => 2023,
                'purchase_cost' => 74000.00, 'purchase_date' => '2023-07-04', 'depreciation_rate_percent' => 25.0,
                'vendor' => 'HP Philippines Enterprise', 'warranty_start' => '2023-07-04', 'warranty_expiry' => $now->addMonths(10)->toDateString(), 'contract_sla' => 'HP Care Pack Next Business Day',
                'condition' => 'good', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'LAP-008', 'serial_number' => 'NX83910A', 'barcode' => 'BC-LAP-008', 'techspecs_id' => 'acer-aspire-3',
                'device_type' => 'laptop', 'brand' => 'Acer', 'model' => 'Aspire 3',
                'location' => 'Pasay City - Mall of Asia Complex, E-Com Tower',
                'image_url' => HardwareImageService::resolveModelImage('Acer', 'Aspire 3'),
                'cpu' => 'Intel Core i3-1215U', 'cpu_tier' => 'entry', 'ram_gb' => 8, 'storage_type' => 'SSD', 'storage_gb' => 256,
                'gpu' => 'Intel UHD Graphics', 'gpu_tier' => 'integrated', 'year_acquired' => 2022,
                'purchase_cost' => 28500.00, 'purchase_date' => '2022-08-10', 'depreciation_rate_percent' => 33.3,
                'vendor' => 'VillMan Computers PH', 'warranty_start' => '2022-08-10', 'warranty_expiry' => $now->addDays(25)->toDateString(), 'contract_sla' => '1-Year Limited Warranty (Extended)',
                'condition' => 'good', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'LAP-009', 'serial_number' => 'PF10928N', 'barcode' => 'BC-LAP-009', 'techspecs_id' => 'lenovo-ideapad-1',
                'device_type' => 'laptop', 'brand' => 'Lenovo', 'model' => 'IdeaPad 1',
                'location' => 'Quezon City - UP-Ayala Technohub Hub 2',
                'image_url' => HardwareImageService::resolveModelImage('Lenovo', 'IdeaPad'),
                'cpu' => 'Intel Celeron N4020', 'cpu_tier' => 'entry', 'ram_gb' => 4, 'storage_type' => 'SSD', 'storage_gb' => 128,
                'gpu' => 'Intel UHD 600', 'gpu_tier' => 'none', 'year_acquired' => 2021,
                'purchase_cost' => 18500.00, 'purchase_date' => '2021-04-12', 'depreciation_rate_percent' => 33.3,
                'vendor' => 'PC Express Commercial', 'warranty_start' => '2021-04-12', 'warranty_expiry' => '2023-04-12', 'contract_sla' => 'Standard Return Only',
                'condition' => 'fair', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'LAP-010', 'serial_number' => '5CD19283X', 'barcode' => 'BC-LAP-010', 'techspecs_id' => 'hp-250-g8',
                'device_type' => 'laptop', 'brand' => 'HP', 'model' => '250 G8',
                'location' => 'Alabang, Muntinlupa - Filinvest Corporate City Level 5',
                'image_url' => HardwareImageService::resolveModelImage('HP', '250 G8'),
                'cpu' => 'Intel Core i3-1115G4', 'cpu_tier' => 'entry', 'ram_gb' => 8, 'storage_type' => 'SSD', 'storage_gb' => 256,
                'gpu' => 'Intel UHD', 'gpu_tier' => 'none', 'year_acquired' => 2022,
                'purchase_cost' => 26000.00, 'purchase_date' => '2022-09-01', 'depreciation_rate_percent' => 33.3,
                'vendor' => 'Octagon Computer Superstore', 'warranty_start' => '2022-09-01', 'warranty_expiry' => $now->addDays(45)->toDateString(), 'contract_sla' => 'HP Base Hardware Support',
                'condition' => 'fair', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'DSK-001', 'serial_number' => 'DPREC-9821-X', 'barcode' => 'BC-DSK-001', 'techspecs_id' => 'dell-precision-7960-tower',
                'device_type' => 'desktop', 'brand' => 'Dell', 'model' => 'Precision 7960 Tower',
                'location' => 'BGC, Taguig City - Level 14 Tech Hub / Data Lab',
                'image_url' => HardwareImageService::resolveModelImage('Dell', 'Precision 7960 Tower', 'desktop'),
                'cpu' => 'Intel Xeon w9-3495X', 'cpu_tier' => 'workstation', 'ram_gb' => 128, 'storage_type' => 'SSD', 'storage_gb' => 4096,
                'gpu' => 'NVIDIA RTX 6000 Ada 48GB', 'gpu_tier' => 'dedicated-high', 'year_acquired' => 2024,
                'purchase_cost' => 540000.00, 'purchase_date' => '2024-01-20', 'depreciation_rate_percent' => 20.0,
                'vendor' => 'Dell Philippines Direct Enterprise', 'warranty_start' => '2024-01-20', 'warranty_expiry' => '2029-01-20', 'contract_sla' => 'Mission Critical 24x7 4-Hour Response',
                'condition' => 'excellent', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'DSK-002', 'serial_number' => 'HPZ8-1928-W', 'barcode' => 'BC-DSK-002', 'techspecs_id' => 'hp-z8-g5-workstation',
                'device_type' => 'desktop', 'brand' => 'HP', 'model' => 'Z8 G5 Workstation',
                'location' => 'Makati City - Ayala Triangle Tower One, Level 22',
                'image_url' => HardwareImageService::resolveModelImage('HP', 'Z8 G5 Workstation', 'desktop'),
                'cpu' => 'Intel Xeon w7-2495X', 'cpu_tier' => 'workstation', 'ram_gb' => 64, 'storage_type' => 'SSD', 'storage_gb' => 2048,
                'gpu' => 'NVIDIA RTX 4500 Ada 24GB', 'gpu_tier' => 'dedicated-high', 'year_acquired' => 2024,
                'purchase_cost' => 380000.00, 'purchase_date' => '2024-02-05', 'depreciation_rate_percent' => 20.0,
                'vendor' => 'HP Philippines Enterprise', 'warranty_start' => '2024-02-05', 'warranty_expiry' => '2029-02-05', 'contract_sla' => 'HP 5-Year Next Business Day Onsite',
                'condition' => 'excellent', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'DSK-003', 'serial_number' => 'RIG-TR-7970-01', 'barcode' => 'BC-DSK-003', 'techspecs_id' => 'custom-ai-studio-rig',
                'device_type' => 'desktop', 'brand' => 'Custom', 'model' => 'AI Studio Rig',
                'location' => 'Ortigas Center, Pasig City - Exchange Road Suite 802',
                'image_url' => HardwareImageService::resolveModelImage('Dell', 'Precision', 'desktop'),
                'cpu' => 'AMD Threadripper 7970X', 'cpu_tier' => 'workstation', 'ram_gb' => 64, 'storage_type' => 'SSD', 'storage_gb' => 2048,
                'gpu' => 'NVIDIA RTX 4090 24GB', 'gpu_tier' => 'dedicated-high', 'year_acquired' => 2024,
                'purchase_cost' => 325000.00, 'purchase_date' => '2024-03-10', 'depreciation_rate_percent' => 25.0,
                'vendor' => 'DynaQuest PC Enterprise Manila', 'warranty_start' => '2024-03-10', 'warranty_expiry' => '2027-03-10', 'contract_sla' => 'Parts & Labor 3-Year Coverage',
                'condition' => 'excellent', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'DSK-004', 'serial_number' => 'OPTI-7010-891', 'barcode' => 'BC-DSK-004', 'techspecs_id' => 'dell-optiplex-7010-tower',
                'device_type' => 'desktop', 'brand' => 'Dell', 'model' => 'OptiPlex 7010 Tower',
                'location' => 'Quezon City - Eastwood Cyberpark Tower 3',
                'image_url' => HardwareImageService::resolveModelImage('Dell', 'OptiPlex 7010', 'desktop'),
                'cpu' => 'Intel Core i7-13700', 'cpu_tier' => 'high', 'ram_gb' => 32, 'storage_type' => 'SSD', 'storage_gb' => 1024,
                'gpu' => 'NVIDIA GTX 1650 4GB', 'gpu_tier' => 'dedicated-entry', 'year_acquired' => 2023,
                'purchase_cost' => 82000.00, 'purchase_date' => '2023-04-15', 'depreciation_rate_percent' => 25.0,
                'vendor' => 'Dell Philippines Direct', 'warranty_start' => '2023-04-15', 'warranty_expiry' => '2026-04-15', 'contract_sla' => 'Dell ProSupport NBD',
                'condition' => 'good', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'DSK-005', 'serial_number' => 'PD-600G9-3829', 'barcode' => 'BC-DSK-005', 'techspecs_id' => 'hp-prodesk-600-g9',
                'device_type' => 'desktop', 'brand' => 'HP', 'model' => 'ProDesk 600 G9',
                'location' => 'Mandaluyong City - Pioneer Innovation Center',
                'image_url' => HardwareImageService::resolveModelImage('HP', 'ProDesk 600 G9', 'desktop'),
                'cpu' => 'Intel Core i7-13700', 'cpu_tier' => 'high', 'ram_gb' => 16, 'storage_type' => 'SSD', 'storage_gb' => 512,
                'gpu' => 'Intel UHD 770', 'gpu_tier' => 'integrated', 'year_acquired' => 2023,
                'purchase_cost' => 65000.00, 'purchase_date' => '2023-05-20', 'depreciation_rate_percent' => 25.0,
                'vendor' => 'HP Philippines Enterprise', 'warranty_start' => '2023-05-20', 'warranty_expiry' => '2026-05-20', 'contract_sla' => 'HP Care Pack Next Business Day',
                'condition' => 'good', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'DSK-006', 'serial_number' => 'TC-M70Q-9182', 'barcode' => 'BC-DSK-006', 'techspecs_id' => 'lenovo-thinkcentre-m70q-gen4',
                'device_type' => 'desktop', 'brand' => 'Lenovo', 'model' => 'ThinkCentre M70q Tiny',
                'location' => 'Alabang, Muntinlupa - Filinvest Corporate City Level 5',
                'image_url' => HardwareImageService::resolveModelImage('Lenovo', 'ThinkCentre M70q', 'desktop'),
                'cpu' => 'Intel Core i5-13400T', 'cpu_tier' => 'mid', 'ram_gb' => 16, 'storage_type' => 'SSD', 'storage_gb' => 512,
                'gpu' => 'Intel UHD 730', 'gpu_tier' => 'integrated', 'year_acquired' => 2023,
                'purchase_cost' => 51000.00, 'purchase_date' => '2023-06-10', 'depreciation_rate_percent' => 25.0,
                'vendor' => 'Lenovo Philippines Commercial', 'warranty_start' => '2023-06-10', 'warranty_expiry' => '2026-06-10', 'contract_sla' => 'Lenovo Premier NBD',
                'condition' => 'good', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'DSK-007', 'serial_number' => 'OPTI-3000-471', 'barcode' => 'BC-DSK-007', 'techspecs_id' => 'dell-optiplex-3000-micro',
                'device_type' => 'desktop', 'brand' => 'Dell', 'model' => 'OptiPlex 3000 Micro',
                'location' => 'Pasay City - Mall of Asia Complex, E-Com Tower',
                'image_url' => HardwareImageService::resolveModelImage('Dell', 'OptiPlex 3000 Micro', 'desktop'),
                'cpu' => 'Intel Core i5-12500T', 'cpu_tier' => 'mid', 'ram_gb' => 16, 'storage_type' => 'SSD', 'storage_gb' => 512,
                'gpu' => 'Intel UHD 770', 'gpu_tier' => 'integrated', 'year_acquired' => 2023,
                'purchase_cost' => 49000.00, 'purchase_date' => '2023-07-15', 'depreciation_rate_percent' => 25.0,
                'vendor' => 'Dell Philippines Direct', 'warranty_start' => '2023-07-15', 'warranty_expiry' => '2026-07-15', 'contract_sla' => 'Standard NBD Onsite',
                'condition' => 'good', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'DSK-008', 'serial_number' => 'ED-800G6-1192', 'barcode' => 'BC-DSK-008', 'techspecs_id' => 'hp-elitedesk-800-g6',
                'device_type' => 'desktop', 'brand' => 'HP', 'model' => 'EliteDesk 800 G6',
                'location' => 'Makati City - Legaspi Village Operations',
                'image_url' => HardwareImageService::resolveModelImage('HP', 'EliteDesk', 'desktop'),
                'cpu' => 'Intel Core i5-10500', 'cpu_tier' => 'mid', 'ram_gb' => 16, 'storage_type' => 'SSD', 'storage_gb' => 512,
                'gpu' => 'Intel UHD 630', 'gpu_tier' => 'integrated', 'year_acquired' => 2021,
                'purchase_cost' => 52000.00, 'purchase_date' => '2021-03-20', 'depreciation_rate_percent' => 33.3,
                'vendor' => 'HP Philippines Enterprise', 'warranty_start' => '2021-03-20', 'warranty_expiry' => '2024-03-20', 'contract_sla' => 'Expired',
                'condition' => 'fair', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'DSK-009', 'serial_number' => 'OPTI-3080-293', 'barcode' => 'BC-DSK-009', 'techspecs_id' => 'dell-optiplex-3080',
                'device_type' => 'desktop', 'brand' => 'Dell', 'model' => 'OptiPlex 3080',
                'location' => 'Taguig City - McKinley Hill Depot',
                'image_url' => HardwareImageService::resolveModelImage('Dell', 'OptiPlex 3080', 'desktop'),
                'cpu' => 'Intel Core i3-10100', 'cpu_tier' => 'entry', 'ram_gb' => 8, 'storage_type' => 'HDD', 'storage_gb' => 1000,
                'gpu' => null, 'gpu_tier' => 'none', 'year_acquired' => 2020,
                'purchase_cost' => 35000.00, 'purchase_date' => '2020-05-10', 'depreciation_rate_percent' => 33.3,
                'vendor' => 'Dell Philippines Direct', 'warranty_start' => '2020-05-10', 'warranty_expiry' => '2023-05-10', 'contract_sla' => 'Expired',
                'condition' => 'fair', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'DSK-010', 'serial_number' => 'TC-M720S-048', 'barcode' => 'BC-DSK-010', 'techspecs_id' => 'lenovo-thinkcentre-m720s',
                'device_type' => 'desktop', 'brand' => 'Lenovo', 'model' => 'ThinkCentre M720s',
                'location' => 'BGC, Taguig City - Reception Hub Desk',
                'image_url' => HardwareImageService::resolveModelImage('Lenovo', 'ThinkCentre M720s', 'desktop'),
                'cpu' => 'Intel Core i3-9100', 'cpu_tier' => 'entry', 'ram_gb' => 8, 'storage_type' => 'SSD', 'storage_gb' => 256,
                'gpu' => null, 'gpu_tier' => 'none', 'year_acquired' => 2020,
                'purchase_cost' => 34000.00, 'purchase_date' => '2020-08-14', 'depreciation_rate_percent' => 33.3,
                'vendor' => 'PC Express Commercial', 'warranty_start' => '2020-08-14', 'warranty_expiry' => '2023-08-14', 'contract_sla' => 'Expired',
                'condition' => 'fair', 'status' => 'available', 'lifecycle_stage' => 'deployment', 'notes' => null,
            ],
            [
                'asset_tag' => 'LAP-011', 'serial_number' => 'C02F23KLMD6R', 'barcode' => 'BC-LAP-011', 'techspecs_id' => 'apple-macbook-air-m1',
                'device_type' => 'laptop', 'brand' => 'Apple', 'model' => 'MacBook Air M1',
                'location' => 'IT Repair Bench - Makati Staging Depot (Desk 3)',
                'image_url' => HardwareImageService::resolveModelImage('Apple', 'MacBook Air M1'),
                'cpu' => 'Apple M1 8-core', 'cpu_tier' => 'mid', 'ram_gb' => 8, 'storage_type' => 'SSD', 'storage_gb' => 256,
                'gpu' => 'Apple 7-core GPU', 'gpu_tier' => 'integrated', 'year_acquired' => 2021,
                'purchase_cost' => 58000.00, 'purchase_date' => '2021-11-18', 'depreciation_rate_percent' => 25.0,
                'vendor' => 'Beyond the Box / Apple Premium Reseller PH', 'warranty_start' => '2021-11-18', 'warranty_expiry' => '2024-11-18', 'contract_sla' => 'AppleCare+ Expired',
                'condition' => 'needs_repair', 'status' => 'in_repair', 'lifecycle_stage' => 'maintenance',
                'notes' => 'Swollen battery replacement and trackpad recalibration in progress.',
            ],
            [
                'asset_tag' => 'DSK-011', 'serial_number' => 'CQ-8200-LEGACY', 'barcode' => 'BC-DSK-011', 'techspecs_id' => 'hp-compaq-8200-elite',
                'device_type' => 'desktop', 'brand' => 'HP', 'model' => 'Compaq 8200 Elite',
                'location' => 'Pasig City - Decommissioning Depot (Basement)',
                'image_url' => HardwareImageService::resolveModelImage('HP', 'Compaq', 'desktop'),
                'cpu' => 'Intel Core i5-2400', 'cpu_tier' => 'entry', 'ram_gb' => 4, 'storage_type' => 'HDD', 'storage_gb' => 500,
                'gpu' => null, 'gpu_tier' => 'none', 'year_acquired' => 2014,
                'purchase_cost' => 42000.00, 'purchase_date' => '2014-06-12', 'depreciation_rate_percent' => 33.3,
                'vendor' => 'Legacy Hardware Vendor Manila', 'warranty_start' => '2014-06-12', 'warranty_expiry' => '2017-06-12', 'contract_sla' => 'Decommissioned',
                'condition' => 'retired', 'status' => 'retired', 'lifecycle_stage' => 'retirement',
                'notes' => 'End of 10-year lifecycle. Hard drives wiped via NIST 800-88 standard. Awaiting electronic recycling.',
            ],
            [
                'asset_tag' => 'LAP-012', 'serial_number' => 'PF5420MN', 'barcode' => 'BC-LAP-012', 'techspecs_id' => 'lenovo-thinkpad-x1-carbon-gen11',
                'device_type' => 'laptop', 'brand' => 'Lenovo', 'model' => 'ThinkPad X1 Carbon Gen 11',
                'location' => 'BGC, Taguig City - IT Staging & Procurement Depot',
                'image_url' => HardwareImageService::resolveModelImage('Lenovo', 'ThinkPad X1 Carbon'),
                'cpu' => 'Intel Core i7-1365U', 'cpu_tier' => 'high', 'ram_gb' => 32, 'storage_type' => 'SSD', 'storage_gb' => 1024,
                'gpu' => 'Intel Iris Xe', 'gpu_tier' => 'integrated', 'year_acquired' => 2024,
                'purchase_cost' => 128000.00, 'purchase_date' => $now->subDays(3)->toDateString(), 'depreciation_rate_percent' => 20.0,
                'vendor' => 'Lenovo Philippines Commercial', 'warranty_start' => $now->subDays(3)->toDateString(), 'warranty_expiry' => $now->addYears(3)->toDateString(), 'contract_sla' => 'Premier Support Plus 3-Yr',
                'condition' => 'excellent', 'status' => 'available', 'lifecycle_stage' => 'acquisition',
                'notes' => 'Newly arrived from vendor. Staging corporate image, disk encryption, and asset tags.',
            ],
        ];
    }

    /**
     * 14 Non-Compute Hardware Assets (6 monitors, 4 mobiles, 4 peripherals) for Small preset.
     *
     * @return list<array<string, mixed>>
     */
    private function smallPeripheralCatalog(CarbonImmutable $now): array
    {
        $items = [
            ['MON-001', 'monitor', 'Dell', 'UltraSharp U2723QE', 'BGC, Taguig City - Bonifacio High Street Hub, Level 15', 36500.00, 36, ['screen_size' => '27"', 'resolution' => '3840x2160 4K', 'panel_type' => 'IPS Black', 'refresh_rate' => '60Hz', 'connectivity' => 'USB-C 90W PD / HDMI / DP']],
            ['MON-002', 'monitor', 'LG', 'UltraWide 34WN80C-B', 'Makati City - Ayala Triangle Tower One, Level 22', 29800.00, 28, ['screen_size' => '34"', 'resolution' => '3440x1440 UWQHD', 'panel_type' => 'IPS Curved', 'refresh_rate' => '60Hz', 'connectivity' => 'USB-C 60W / 2x HDMI']],
            ['MON-003', 'monitor', 'LG', 'UltraFine 5K 27MD5KL', 'BGC, Taguig City - Bonifacio High Street Hub, Level 15', 68000.00, 14, ['screen_size' => '27"', 'resolution' => '5120x2880 5K', 'panel_type' => 'Nano IPS', 'refresh_rate' => '60Hz', 'connectivity' => 'Thunderbolt 3 (94W PD)']],
            ['MON-004', 'monitor', 'Apple', 'Studio Display 27" 5K', 'Ortigas Center, Pasig City - Exchange Road Tech Center', 96000.00, 20, ['screen_size' => '27"', 'resolution' => '5120x2880 5K Retina', 'panel_type' => 'IPS Standard Glass', 'refresh_rate' => '60Hz', 'connectivity' => 'Thunderbolt 3 / 3x USB-C']],
            ['MON-005', 'monitor', 'Dell', 'P2423DE QHD USB-C', 'Alabang, Muntinlupa - Filinvest Corporate City Level 5', 19500.00, 10, ['screen_size' => '23.8"', 'resolution' => '2560x1440 QHD', 'panel_type' => 'IPS', 'refresh_rate' => '60Hz', 'connectivity' => 'USB-C 65W / RJ45 / DP']],
            ['MON-006', 'monitor', 'ASUS', 'ProArt PA279CV 4K', 'Quezon City - Eastwood Cyberpark Tower 3', 31000.00, 1, ['screen_size' => '27"', 'resolution' => '3840x2160 4K', 'panel_type' => 'IPS Calman Verified', 'refresh_rate' => '60Hz', 'connectivity' => 'USB-C 65W / DP / HDMI']],
            ['MOB-001', 'mobile', 'Apple', 'iPhone 15 Pro 256GB', 'BGC, Taguig City - Bonifacio High Street Hub, Level 15', 76990.00, 16, ['os' => 'iOS 17', 'storage' => '256GB', 'cellular' => '5G Dual eSIM', 'mdm_enrolled' => 'Yes (Jamf Pro)']],
            ['MOB-002', 'mobile', 'Apple', 'iPad Pro 12.9 M2', 'Makati City - Ayala Triangle Tower One, Level 22', 69990.00, 14, ['os' => 'iPadOS 17', 'storage' => '256GB', 'cellular' => 'Wi-Fi 6E + 5G', 'mdm_enrolled' => 'Yes (Jamf Pro)']],
            ['MOB-003', 'mobile', 'Samsung', 'Galaxy S24 Enterprise', 'Mandaluyong City - Pioneer Innovation Center', 53990.00, 18, ['os' => 'Android 14 One UI', 'storage' => '256GB', 'cellular' => '5G Dual SIM', 'mdm_enrolled' => 'Yes (Intune Knox)']],
            ['MOB-004', 'mobile', 'Google', 'Pixel 8 Pro Test Unit', 'Quezon City - Eastwood Cyberpark Tower 3', 54000.00, 12, ['os' => 'Android 14', 'storage' => '128GB', 'cellular' => '5G', 'mdm_enrolled' => 'QA Sandbox Pool']],
            ['PER-001', 'peripheral', 'CalDigit', 'TS4 Thunderbolt 4 Dock', 'Ortigas Center, Pasig City - Exchange Road Tech Center', 24500.00, 18, ['category' => 'Thunderbolt 4 Dock', 'interface' => 'Thunderbolt 4 (98W Charging)', 'ports' => '18 Ports + 2.5GbE']],
            ['PER-002', 'peripheral', 'Keychron', 'Q1 Pro Mechanical Keyboard', 'Makati City - Ayala Triangle Tower One, Level 22', 11500.00, 22, ['category' => 'Mechanical Keyboard', 'interface' => 'Bluetooth 5.1 / USB-C', 'switches' => 'Keychron K Pro Banana']],
            ['PER-003', 'peripheral', 'Logitech', 'MX Master 3S + MX Keys', 'Pasay City - Mall of Asia Complex, E-Com Tower', 12900.00, 20, ['category' => 'Ergonomic Input Bundle', 'interface' => 'Logi Bolt / Bluetooth', 'battery' => 'USB-C Rechargeable']],
            ['PER-004', 'peripheral', 'Jabra', 'Evolve2 75 UC Headset', 'BGC, Taguig City - IT Staging & Procurement Depot', 19800.00, 10, ['category' => 'ANC Conference Headset', 'interface' => 'Bluetooth / USB-C Link 380', 'certification' => 'Microsoft Teams & Zoom']],
        ];

        $rows = [];
        foreach ($items as $idx => [$tag, $type, $brand, $model, $location, $cost, $monthsToExpiry, $specs]) {
            $prefix = substr($tag, 0, 3);
            $purchaseDate = $now->subMonths(12 + ($idx % 18));
            $warrantyExpiry = ($tag === 'MON-006')
                ? $now->addDays(30)->toDateString()
                : $now->addMonths($monthsToExpiry)->toDateString();

            $rows[] = [
                'asset_tag' => $tag,
                'serial_number' => "{$prefix}-SN-90".sprintf('%02d', $idx + 1),
                'barcode' => "BC-{$tag}",
                'techspecs_id' => null,
                'device_type' => $type,
                'brand' => $brand,
                'model' => $model,
                'location' => $location,
                'image_url' => HardwareImageService::resolvePublicAssetImage($brand, $model, $type),
                'cpu' => null,
                'cpu_tier' => null,
                'ram_gb' => null,
                'storage_type' => null,
                'storage_gb' => null,
                'gpu' => null,
                'gpu_tier' => 'none',
                'specifications' => $specs,
                'year_acquired' => (int) $purchaseDate->format('Y'),
                'purchase_cost' => $cost,
                'purchase_date' => $purchaseDate->toDateString(),
                'depreciation_rate_percent' => 25.0,
                'vendor' => $brand === 'Apple' ? 'Power Mac Center Corporate' : 'ITFleet Commercial Hardware PH',
                'warranty_start' => $purchaseDate->toDateString(),
                'warranty_expiry' => $warrantyExpiry,
                'contract_sla' => 'Standard 3-Year Enterprise Replacement',
                'condition' => 'excellent',
                'status' => 'available',
                'lifecycle_stage' => 'deployment',
                'notes' => null,
            ];
        }

        return $rows;
    }

    /**
     * Build one compute device row from template for Medium/Large presets.
     *
     * @param  array{template: string, status: string, stage: string, condition: string}  $bp
     * @param  list<string>  $hubs
     * @return array<string, mixed>
     */
    private function buildComputeDeviceRow(string $tag, array $bp, int $seed, array $hubs, CarbonImmutable $now, bool $isLarge): array
    {
        $tpl = $this->computeTemplate($bp['template']);
        $ageMonths = match ($bp['stage']) {
            'acquisition' => 1 + ($seed % 2),
            'retirement' => 60 + ($seed % 24),
            'maintenance' => 30 + ($seed % 18),
            default => 4 + ($seed % 36),
        };
        $purchaseDate = $now->subMonths($ageMonths);

        if ($bp['stage'] === 'retirement') {
            $warrantyExpiry = $purchaseDate->addYears(3)->toDateString();
        } elseif ($seed % 11 === 0) {
            $warrantyExpiry = $now->addDays(12 + ($seed % 42))->toDateString();
        } elseif ($seed % 17 === 0) {
            $warrantyExpiry = $now->subDays(20 + ($seed % 90))->toDateString();
        } else {
            $warrantyExpiry = $purchaseDate->addYears(3)->toDateString();
        }

        return [
            'asset_tag' => $tag,
            'serial_number' => ($isLarge ? 'LG-' : 'MD-').str_replace('-', '', $tag).'-'.sprintf('%04d', 1000 + $seed),
            'barcode' => "BC-{$tag}",
            'techspecs_id' => null,
            'device_type' => $tpl['device_type'],
            'brand' => $tpl['brand'],
            'model' => $tpl['model'],
            'location' => $hubs[$seed % count($hubs)],
            'image_url' => HardwareImageService::resolvePublicAssetImage($tpl['brand'], $tpl['model'], $tpl['device_type']),
            'cpu' => $tpl['cpu'],
            'cpu_tier' => $tpl['cpu_tier'],
            'ram_gb' => $tpl['ram_gb'],
            'storage_type' => $tpl['storage_type'],
            'storage_gb' => $tpl['storage_gb'],
            'gpu' => $tpl['gpu'],
            'gpu_tier' => $tpl['gpu_tier'],
            'specifications' => null,
            'year_acquired' => (int) $purchaseDate->format('Y'),
            'purchase_cost' => $tpl['cost'],
            'purchase_date' => $purchaseDate->toDateString(),
            'depreciation_rate_percent' => $tpl['cpu_tier'] === 'entry' ? 33.3 : 20.0,
            'vendor' => $tpl['vendor'],
            'warranty_start' => $purchaseDate->toDateString(),
            'warranty_expiry' => $warrantyExpiry,
            'contract_sla' => $bp['stage'] === 'retirement' ? 'Decommissioned' : $tpl['sla'],
            'condition' => $bp['condition'],
            'status' => $bp['status'],
            'lifecycle_stage' => $bp['stage'],
            'notes' => $bp['status'] === 'in_repair' ? 'Unit undergoing depot diagnostics and component servicing.' : null,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    /**
     * Build one non-compute asset row with category-specific JSON specifications.
     *
     * @param  list<string>  $hubs
     * @return array<string, mixed>
     */
    private function buildNonComputeDeviceRow(
        string $tag,
        string $type,
        int $idx,
        string $status,
        string $stage,
        string $condition,
        array $hubs,
        CarbonImmutable $now
    ): array {
        $catalogs = [
            'monitor' => [
                ['Dell', 'UltraSharp U2723QE', 36500.00, ['screen_size' => '27"', 'resolution' => '3840x2160 4K', 'panel_type' => 'IPS Black', 'refresh_rate' => '60Hz']],
                ['LG', 'UltraWide 34WN80C-B', 29800.00, ['screen_size' => '34"', 'resolution' => '3440x1440 UWQHD', 'panel_type' => 'IPS Curved', 'refresh_rate' => '60Hz']],
                ['Apple', 'Studio Display 27" 5K', 96000.00, ['screen_size' => '27"', 'resolution' => '5120x2880 5K', 'panel_type' => 'Retina IPS', 'refresh_rate' => '60Hz']],
                ['ASUS', 'ProArt PA279CV', 31000.00, ['screen_size' => '27"', 'resolution' => '3840x2160 4K', 'panel_type' => 'IPS', 'refresh_rate' => '60Hz']],
            ],
            'mobile' => [
                ['Apple', 'iPhone 15 Pro 256GB', 76990.00, ['os' => 'iOS 17', 'storage' => '256GB', 'cellular' => '5G Dual eSIM', 'mdm_enrolled' => 'Yes (Jamf Pro)']],
                ['Apple', 'iPad Pro 12.9 M2', 69990.00, ['os' => 'iPadOS 17', 'storage' => '256GB', 'cellular' => 'Wi-Fi 6E + 5G', 'mdm_enrolled' => 'Yes (Jamf Pro)']],
                ['Samsung', 'Galaxy S24 Enterprise', 53990.00, ['os' => 'Android 14', 'storage' => '256GB', 'cellular' => '5G Dual SIM', 'mdm_enrolled' => 'Yes (Intune Knox)']],
            ],
            'peripheral' => [
                ['CalDigit', 'TS4 Thunderbolt 4 Dock', 24500.00, ['category' => 'Thunderbolt 4 Dock', 'interface' => 'Thunderbolt 4 (98W)', 'ports' => '18 Ports']],
                ['Keychron', 'Q1 Pro Mechanical Keyboard', 11500.00, ['category' => 'Mechanical Keyboard', 'interface' => 'Bluetooth / USB-C']],
                ['Logitech', 'MX Master 3S Combo', 12900.00, ['category' => 'Ergonomic Input Bundle', 'interface' => 'Logi Bolt / Bluetooth']],
                ['Jabra', 'Evolve2 75 UC Headset', 19800.00, ['category' => 'ANC Conference Headset', 'interface' => 'Bluetooth / USB-C']],
            ],
        ];

        $pool = $catalogs[$type];
        [$brand, $model, $cost, $specs] = $pool[$idx % count($pool)];
        $ageMonths = ($stage === 'retirement') ? 48 : (4 + ($idx % 28));
        $purchaseDate = $now->subMonths($ageMonths);
        $warrantyExpiry = ($idx % 12 === 0 && $stage !== 'retirement')
            ? $now->addDays(18 + ($idx % 30))->toDateString()
            : $purchaseDate->addYears(3)->toDateString();

        return [
            'asset_tag' => $tag,
            'serial_number' => strtoupper(substr($type, 0, 3)).'-'.str_replace('-', '', $tag).'-'.sprintf('%03d', $idx + 100),
            'barcode' => "BC-{$tag}",
            'techspecs_id' => null,
            'device_type' => $type,
            'brand' => $brand,
            'model' => $model,
            'location' => $hubs[($idx + 1) % count($hubs)],
            'image_url' => HardwareImageService::resolvePublicAssetImage($brand, $model, $type),
            'cpu' => null,
            'cpu_tier' => null,
            'ram_gb' => null,
            'storage_type' => null,
            'storage_gb' => null,
            'gpu' => null,
            'gpu_tier' => 'none',
            'specifications' => json_encode($specs),
            'year_acquired' => (int) $purchaseDate->format('Y'),
            'purchase_cost' => $cost,
            'purchase_date' => $purchaseDate->toDateString(),
            'depreciation_rate_percent' => 25.0,
            'vendor' => $brand === 'Apple' ? 'Power Mac Center Corporate' : 'ITFleet Commercial Hardware PH',
            'warranty_start' => $purchaseDate->toDateString(),
            'warranty_expiry' => $warrantyExpiry,
            'contract_sla' => $stage === 'retirement' ? 'Decommissioned' : 'Standard 3-Year Enterprise Replacement',
            'condition' => $condition,
            'status' => $status,
            'lifecycle_stage' => $stage,
            'notes' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    /**
     * Hardware spec templates guaranteed to produce crisp scores for matched vs mismatched pairings.
     *
     * @return array<string, mixed>
     */
    private function computeTemplate(string $key): array
    {
        $templates = [
            'laptop_high' => [
                'device_type' => 'laptop', 'brand' => 'Lenovo', 'model' => 'ThinkPad T14s Gen 4',
                'cpu' => 'AMD Ryzen 7 PRO 7840U', 'cpu_tier' => 'high', 'ram_gb' => 32, 'storage_type' => 'SSD', 'storage_gb' => 1024,
                'gpu' => 'AMD Radeon 780M', 'gpu_tier' => 'integrated', 'cost' => 108000.00,
                'vendor' => 'Lenovo Philippines Commercial Direct', 'sla' => 'Premier Support NBD Onsite',
            ],
            'laptop_x1' => [
                'device_type' => 'laptop', 'brand' => 'Lenovo', 'model' => 'ThinkPad X1 Carbon Gen 11',
                'cpu' => 'Intel Core i7-1365U', 'cpu_tier' => 'high', 'ram_gb' => 32, 'storage_type' => 'SSD', 'storage_gb' => 1024,
                'gpu' => 'Intel Iris Xe', 'gpu_tier' => 'integrated', 'cost' => 128000.00,
                'vendor' => 'Lenovo Philippines Commercial Direct', 'sla' => 'Premier Support Plus 3-Yr',
            ],
            'laptop_gpu' => [
                'device_type' => 'laptop', 'brand' => 'Apple', 'model' => 'MacBook Pro 16 M3 Max',
                'cpu' => 'Apple M3 Max 14-core', 'cpu_tier' => 'high', 'ram_gb' => 36, 'storage_type' => 'SSD', 'storage_gb' => 1024,
                'gpu' => 'Apple 30-core GPU', 'gpu_tier' => 'dedicated-high', 'cost' => 215000.00,
                'vendor' => 'Power Mac Center Corporate', 'sla' => 'AppleCare+ for Enterprise',
            ],
            'laptop_xps' => [
                'device_type' => 'laptop', 'brand' => 'Dell', 'model' => 'XPS 15 9530',
                'cpu' => 'Intel Core i9-13900H', 'cpu_tier' => 'high', 'ram_gb' => 32, 'storage_type' => 'SSD', 'storage_gb' => 1024,
                'gpu' => 'NVIDIA RTX 4070 Laptop', 'gpu_tier' => 'dedicated-high', 'cost' => 155000.00,
                'vendor' => 'Dell Philippines Direct', 'sla' => 'ProSupport Plus NBD',
            ],
            'laptop_mid' => [
                'device_type' => 'laptop', 'brand' => 'Dell', 'model' => 'Latitude 5440',
                'cpu' => 'Intel Core i5-1345U', 'cpu_tier' => 'mid', 'ram_gb' => 16, 'storage_type' => 'SSD', 'storage_gb' => 512,
                'gpu' => 'Intel Iris Xe', 'gpu_tier' => 'integrated', 'cost' => 68000.00,
                'vendor' => 'Dell Philippines Direct', 'sla' => 'Dell ProSupport NBD',
            ],
            'laptop_hp_mid' => [
                'device_type' => 'laptop', 'brand' => 'HP', 'model' => 'EliteBook 840 G10',
                'cpu' => 'Intel Core i5-1350P', 'cpu_tier' => 'mid', 'ram_gb' => 16, 'storage_type' => 'SSD', 'storage_gb' => 512,
                'gpu' => 'Intel Iris Xe', 'gpu_tier' => 'integrated', 'cost' => 74000.00,
                'vendor' => 'HP Philippines Enterprise', 'sla' => 'HP Care Pack NBD',
            ],
            'laptop_entry' => [
                'device_type' => 'laptop', 'brand' => 'Acer', 'model' => 'Aspire 3',
                'cpu' => 'Intel Core i3-1215U', 'cpu_tier' => 'entry', 'ram_gb' => 8, 'storage_type' => 'SSD', 'storage_gb' => 256,
                'gpu' => 'Intel UHD Graphics', 'gpu_tier' => 'integrated', 'cost' => 28500.00,
                'vendor' => 'VillMan Computers PH', 'sla' => '1-Year Limited Warranty',
            ],
            'desktop_workstation' => [
                'device_type' => 'desktop', 'brand' => 'Dell', 'model' => 'Precision 7960 Tower',
                'cpu' => 'Intel Xeon w9-3495X', 'cpu_tier' => 'workstation', 'ram_gb' => 128, 'storage_type' => 'SSD', 'storage_gb' => 4096,
                'gpu' => 'NVIDIA RTX 6000 Ada 48GB', 'gpu_tier' => 'dedicated-high', 'cost' => 540000.00,
                'vendor' => 'Dell Philippines Direct Enterprise', 'sla' => 'Mission Critical 24x7',
            ],
            'desktop_high' => [
                'device_type' => 'desktop', 'brand' => 'HP', 'model' => 'ProDesk 600 G9',
                'cpu' => 'Intel Core i7-13700', 'cpu_tier' => 'high', 'ram_gb' => 32, 'storage_type' => 'SSD', 'storage_gb' => 1024,
                'gpu' => 'Intel UHD 770', 'gpu_tier' => 'integrated', 'cost' => 72000.00,
                'vendor' => 'HP Philippines Enterprise', 'sla' => 'HP Care Pack NBD',
            ],
            'desktop_mid' => [
                'device_type' => 'desktop', 'brand' => 'Lenovo', 'model' => 'ThinkCentre M70q Tiny',
                'cpu' => 'Intel Core i5-13400T', 'cpu_tier' => 'mid', 'ram_gb' => 16, 'storage_type' => 'SSD', 'storage_gb' => 512,
                'gpu' => 'Intel UHD 730', 'gpu_tier' => 'integrated', 'cost' => 51000.00,
                'vendor' => 'Lenovo Philippines Commercial', 'sla' => 'Lenovo Premier NBD',
            ],
            'desktop_entry' => [
                'device_type' => 'desktop', 'brand' => 'Dell', 'model' => 'OptiPlex 3080',
                'cpu' => 'Intel Core i3-10100', 'cpu_tier' => 'entry', 'ram_gb' => 8, 'storage_type' => 'HDD', 'storage_gb' => 1000,
                'gpu' => null, 'gpu_tier' => 'none', 'cost' => 35000.00,
                'vendor' => 'Dell Philippines Direct', 'sla' => 'Standard Warranty',
            ],
        ];

        return $templates[$key];
    }

    private function matchedTemplateForRole(string $roleName, int $index): string
    {
        return match ($roleName) {
            'Software Engineer', 'UI/UX Designer', 'DevOps / Cloud Engineer', 'Security Operations Analyst' => ($index % 2 === 0) ? 'laptop_high' : 'laptop_x1',
            'Product Designer', 'Video & Motion Designer' => ($index % 2 === 0) ? 'laptop_gpu' : 'laptop_xps',
            'Data Analyst' => ($index % 2 === 0) ? 'desktop_mid' : 'desktop_high',
            'Administrative Staff' => 'desktop_entry',
            'Field Sales Specialist' => ($index % 2 === 0) ? 'laptop_mid' : 'laptop_hp_mid',
            'AI/ML Researcher' => 'desktop_workstation',
            default => 'laptop_mid',
        };
    }

    /**
     * Role + department rotation table for Medium & Large presets.
     *
     * @return list<array{0: string, 1: string}>
     */
    private function enterpriseRoleRoster(bool $includeSecurity): array
    {
        $roster = [
            ['Software Engineer', 'Engineering'],
            ['Software Engineer', 'Engineering'],
            ['UI/UX Designer', 'UI/UX Design'],
            ['Product Designer', 'Product Design'],
            ['Video & Motion Designer', 'Creative & Marketing'],
            ['Data Analyst', 'Business Intelligence'],
            ['Administrative Staff', 'Operations'],
            ['Field Sales Specialist', 'Sales'],
            ['AI/ML Researcher', 'R&D'],
            ['DevOps / Cloud Engineer', 'Cloud Infrastructure'],
        ];

        if ($includeSecurity) {
            $roster[] = ['Security Operations Analyst', 'Cybersecurity'];
        }

        return $roster;
    }

    /**
     * Deterministic unique Filipino full name generator supporting >=250 unique names.
     */
    private function deterministicFilipinoName(int $index): string
    {
        $firstNames = [
            'Aaron', 'Alwyn', 'Kent Joshua', 'Melo Ervy', 'Bianca Nicole', 'Maria Clara', 'Juan Paolo',
            'Patricia Anne', 'Kimberly Mae', 'Angelo Miguel', 'Christian Dave', 'Joshua Emmanuel', 'Rafael Antonio',
            'Clarissa Mae', 'Gabriel Luis', 'Marco Vicente', 'Camille Andrea', 'Lorenzo Miguel', 'Sofia Isabel',
            'Katrina Beatrice', 'Dominic Paolo', 'Nathaniel Jose', 'Janelle Marie', 'Paolo Enrico', 'Trixie Mae',
        ];

        $lastNames = [
            'Celindro', 'Adriano', 'Olimberio', 'Garcia', 'Reyes', 'Santos', 'Dela Cruz',
            'Mendoza', 'Flores', 'Ramos', 'Bautista', 'Castro', 'Villanueva', 'Navarro',
            'Soriano', 'Aquino', 'Fernandez', 'Gonzales', 'Tolentino', 'Pangilinan',
        ];

        $first = $firstNames[$index % count($firstNames)];
        $last = $lastNames[((int) floor($index / count($firstNames)) + ($index * 3)) % count($lastNames)];
        $cycle = (int) floor($index / 25);

        $middleInitials = ['A.', 'B.', 'C.', 'D.', 'E.', 'L.', 'M.', 'P.', 'R.', 'S.'];

        return $cycle === 0
            ? "{$first} {$last}"
            : "{$first} {$middleInitials[$cycle % count($middleInitials)]} {$last}";
    }

    /**
     * Software license catalog for Medium/Large enterprise scaling.
     *
     * @return list<array<string, mixed>>
     */
    private function softwareLicenseCatalog(): array
    {
        return [
            ['name' => 'Microsoft 365 Enterprise E3', 'vendor' => 'Microsoft Philippines', 'category' => 'productivity', 'license_type' => 'saas', 'billing_cycle' => 'annual', 'base_seats' => 65, 'cost_per_seat' => 21600.00, 'notes' => 'Enterprise M365 suite with Intune MDM and Defender for Office 365.'],
            ['name' => 'Figma Organization', 'vendor' => 'Figma Inc.', 'category' => 'design', 'license_type' => 'saas', 'billing_cycle' => 'annual', 'base_seats' => 18, 'cost_per_seat' => 29500.00, 'notes' => 'Design libraries, Dev Mode, and prototyping workspaces.'],
            ['name' => 'Adobe Creative Cloud Enterprise', 'vendor' => 'Adobe Enterprise APAC', 'category' => 'design', 'license_type' => 'saas', 'billing_cycle' => 'monthly', 'base_seats' => 15, 'cost_per_seat' => 4650.00, 'notes' => 'Video editing, motion graphics, and creative publishing tools.'],
            ['name' => 'JetBrains All Products Pack', 'vendor' => 'JetBrains s.r.o.', 'category' => 'development', 'license_type' => 'saas', 'billing_cycle' => 'annual', 'base_seats' => 25, 'cost_per_seat' => 16800.00, 'notes' => 'PhpStorm, IntelliJ Ultimate, WebStorm, DataGrip, and PyCharm.'],
            ['name' => 'GitHub Enterprise Cloud', 'vendor' => 'GitHub Inc.', 'category' => 'development', 'license_type' => 'saas', 'billing_cycle' => 'annual', 'base_seats' => 35, 'cost_per_seat' => 14200.00, 'notes' => 'Enterprise SCM, Advanced Security, and hosted runners.'],
            ['name' => 'CrowdStrike Falcon Endpoint', 'vendor' => 'CrowdStrike APAC', 'category' => 'security', 'license_type' => 'saas', 'billing_cycle' => 'annual', 'base_seats' => 65, 'cost_per_seat' => 6800.00, 'notes' => 'Next-gen EDR/XDR telemetry across laptops and desktops.'],
            ['name' => 'Slack Business+', 'vendor' => 'Salesforce / Slack', 'category' => 'collaboration', 'license_type' => 'saas', 'billing_cycle' => 'annual', 'base_seats' => 65, 'cost_per_seat' => 8400.00, 'notes' => 'SAML SSO messaging, compliance exports, and Huddles.'],
            ['name' => 'Okta Workforce Identity', 'vendor' => 'Okta Inc.', 'category' => 'security', 'license_type' => 'saas', 'billing_cycle' => 'annual', 'base_seats' => 65, 'cost_per_seat' => 5400.00, 'notes' => 'Enterprise SSO, Adaptive MFA, and lifecycle provisioning.'],
            ['name' => 'Tableau Creator', 'vendor' => 'Salesforce Tableau', 'category' => 'analytics', 'license_type' => 'saas', 'billing_cycle' => 'annual', 'base_seats' => 14, 'cost_per_seat' => 48000.00, 'notes' => 'Executive BI dashboard authoring and data modeling.'],
            ['name' => 'AWS IAM Identity / Client VPN', 'vendor' => 'Amazon Web Services', 'category' => 'infrastructure', 'license_type' => 'saas', 'billing_cycle' => 'monthly', 'base_seats' => 30, 'cost_per_seat' => 1850.00, 'notes' => 'Managed Zero-Trust engineering VPC access.'],
            ['name' => 'Atlassian Jira + Confluence Cloud', 'vendor' => 'Atlassian Pty Ltd', 'category' => 'collaboration', 'license_type' => 'saas', 'billing_cycle' => 'annual', 'base_seats' => 55, 'cost_per_seat' => 7200.00, 'notes' => 'Sprint planning, change management, and engineering runbooks.'],
            ['name' => 'Docker Business Subscription', 'vendor' => 'Docker Inc.', 'category' => 'infrastructure', 'license_type' => 'saas', 'billing_cycle' => 'annual', 'base_seats' => 28, 'cost_per_seat' => 15900.00, 'notes' => 'Commercial Docker Desktop licensing and image access management.'],
            ['name' => '1Password Enterprise Business', 'vendor' => '1Password', 'category' => 'security', 'license_type' => 'saas', 'billing_cycle' => 'annual', 'base_seats' => 65, 'cost_per_seat' => 5600.00, 'notes' => 'Secrets management, SSH keys, and shared credential vaults.'],
            ['name' => 'Microsoft Office LTSC Volume', 'vendor' => 'Microsoft Volume Licensing', 'category' => 'productivity', 'license_type' => 'perpetual', 'billing_cycle' => 'one_time', 'base_seats' => 20, 'cost_per_seat' => 24500.00, 'notes' => 'Perpetual offline office installations for air-gapped terminals.'],
        ];
    }

    /**
     * Insert rows in SQLite/MySQL-safe 100-row batches.
     *
     * @param  list<array<string, mixed>>  $rows
     */
    private function insertChunks(string $table, array $rows, int $chunkSize = 100): void
    {
        foreach (array_chunk($rows, $chunkSize) as $chunk) {
            DB::table($table)->insert($chunk);
        }
    }
}
