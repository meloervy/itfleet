<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Seed the demo administrative and staff users for ITFleet.
     *
     * Demo Credentials:
     * - IT Administrator: admin@itfleet.local / password (Role: admin)
     * - Asset Manager:    manager@itfleet.local / password (Role: manager)
     * - Hardware Tech:    tech@itfleet.local / password (Role: technician)
     * - IT Auditor:       auditor@itfleet.local / password (Role: viewer)
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@itfleet.local'],
            [
                'name' => 'IT Administrator',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'department' => 'IT Infrastructure & Systems',
                'job_title' => 'Chief IT Architect & Fleet Administrator',
                'phone' => '+63 917 123 4567',
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'manager@itfleet.local'],
            [
                'name' => 'IT Asset Manager',
                'password' => Hash::make('password'),
                'role' => 'manager',
                'department' => 'Asset Lifecycle & Procurement',
                'job_title' => 'IT Asset & Fleet Operations Manager',
                'phone' => '+63 918 234 5678',
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'tech@itfleet.local'],
            [
                'name' => 'Hardware Technician',
                'password' => Hash::make('password'),
                'role' => 'technician',
                'department' => 'Hardware Diagnostics & Maintenance',
                'job_title' => 'Senior Hardware Diagnostic Specialist',
                'phone' => '+63 919 345 6789',
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'auditor@itfleet.local'],
            [
                'name' => 'IT Auditor',
                'password' => Hash::make('password'),
                'role' => 'viewer',
                'department' => 'Compliance & Internal Audit',
                'job_title' => 'IT Governance & Compliance Auditor',
                'phone' => '+63 920 456 7890',
                'email_verified_at' => now(),
            ]
        );
    }
}
