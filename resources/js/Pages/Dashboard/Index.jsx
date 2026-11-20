import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import HardwareImage from '@/Components/HardwareImage';
import { Head, Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    RiAddLine,
    RiAlertLine,
    RiArrowRightLine,
    RiCheckboxCircleLine,
    RiComputerLine,
    RiFlashlightLine,
    RiKey2Line,
    RiKeyboardBoxLine,
    RiMacbookLine,
    RiShieldCheckLine,
    RiSmartphoneLine,
    RiToolsLine,
    RiTv2Line,
} from 'react-icons/ri';

export default function Dashboard({
    metrics = {},
    recent_assignments = [],
    available_fleet = [],
}) {
    const { auth } = usePage().props;
    const user = auth?.user;
    const isAdminOrManager = ['admin', 'manager'].includes(user?.role);
    const canViewFinancials = !metrics?.financials_restricted && user?.role !== 'technician';

    const [activeTab, setActiveTab] = useState('assignments');

    const totalActive = metrics?.total_devices ?? 0;
    const assignedCount = metrics?.assigned_devices ?? 0;
    const availableCount = metrics?.idle_devices ?? 0;
    const inRepairCount = metrics?.in_repair_devices ?? 0;
    const retiredCount = metrics?.retired_devices ?? 0;
    const totalInventory = totalActive + retiredCount;
    const utilizationRate = Number(metrics?.utilization_rate ?? 0);

    const software = metrics?.software_licenses || {};
    const licenseRenewalsCount = (software.expiring_soon_count ?? 0) + (software.expired_count ?? 0);
    const warrantyExpiringCount = metrics?.expiring_warranties_count ?? 0;
    const warrantyExpiredCount = metrics?.expired_warranties_count ?? 0;
    const warrantyAttentionCount = warrantyExpiringCount + warrantyExpiredCount;
    const mismatchCount = metrics?.mismatch_count ?? 0;
    const activeMaintenanceCount = metrics?.active_maintenance_count ?? 0;

    const statusItems = [
        {
            key: 'assigned',
            label: 'Assigned',
            count: assignedCount,
            dot: 'bg-emerald-500',
            bar: 'bg-emerald-500',
            href: route('devices.index', { status: 'assigned' }),
        },
        {
            key: 'available',
            label: 'Available',
            count: availableCount,
            dot: 'bg-[#026eff]',
            bar: 'bg-[#026eff]',
            href: route('devices.index', { status: 'available' }),
        },
        {
            key: 'in_repair',
            label: 'In Repair',
            count: inRepairCount,
            dot: 'bg-amber-500',
            bar: 'bg-amber-500',
            href: route('devices.index', { status: 'in_repair' }),
        },
        {
            key: 'retired',
            label: 'Retired',
            count: retiredCount,
            dot: 'bg-zinc-400',
            bar: 'bg-zinc-400',
            href: route('devices.index', { status: 'retired' }),
        },
    ];

    const categoryItems = [
        { key: 'laptop', label: 'Laptops', count: metrics?.category_breakdown?.laptop ?? 0, icon: RiMacbookLine },
        { key: 'desktop', label: 'Desktops', count: metrics?.category_breakdown?.desktop ?? 0, icon: RiComputerLine },
        { key: 'monitor', label: 'Monitors', count: metrics?.category_breakdown?.monitor ?? 0, icon: RiTv2Line },
        { key: 'mobile', label: 'Mobiles', count: metrics?.category_breakdown?.mobile ?? 0, icon: RiSmartphoneLine },
        { key: 'peripheral', label: 'Peripherals', count: metrics?.category_breakdown?.peripheral ?? 0, icon: RiKeyboardBoxLine },
    ];

    const attentionItems = [
        {
            key: 'mismatches',
            label: 'Role-Hardware Mismatches',
            count: mismatchCount,
            description: mismatchCount > 0
                ? 'Assigned compute units failing workload fit'
                : 'All active assignments fit role benchmarks',
            href: route('mismatches.index'),
            icon: RiAlertLine,
            activeTone: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
        },
        {
            key: 'warranties',
            label: 'Hardware Warranties',
            count: warrantyAttentionCount,
            description: warrantyAttentionCount > 0
                ? `${warrantyExpiringCount} expiring ≤60d · ${warrantyExpiredCount} expired`
                : 'All active hardware under warranty coverage',
            href: route('devices.index'),
            icon: RiShieldCheckLine,
            activeTone: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
        },
        {
            key: 'licenses',
            label: 'Software License Renewals',
            count: licenseRenewalsCount,
            description: licenseRenewalsCount > 0
                ? `${software.expiring_soon_count ?? 0} expiring · ${software.expired_count ?? 0} expired contracts`
                : 'All active SaaS agreements up to date',
            href: route('licenses.index'),
            icon: RiKey2Line,
            activeTone: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
        },
        {
            key: 'maintenance',
            label: 'Active Repairs & Maintenance',
            count: activeMaintenanceCount,
            description: activeMaintenanceCount > 0
                ? 'Open scheduled or in-progress service logs'
                : 'No open maintenance or repair tickets',
            href: route('maintenance.index'),
            icon: RiToolsLine,
            activeTone: 'text-[#026eff] dark:text-sky-400 bg-[#026eff]/10 border-[#026eff]/20',
        },
    ];

    const activeAttentionCount = attentionItems.filter((item) => item.count > 0).length;

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Asset Operations Overview
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Hardware inventory status, custody activity, software license seats, and compliance queue.
                        </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                        {isAdminOrManager && (
                            <Link
                                href={route('devices.create')}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                            >
                                <RiAddLine className="w-3.5 h-3.5" />
                                <span>Register Asset</span>
                            </Link>
                        )}
                        {isAdminOrManager ? (
                            <Link
                                href={route('match.index')}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] hover:border-[#0258d1] text-xs font-medium text-white transition"
                            >
                                <RiFlashlightLine className="w-3.5 h-3.5" />
                                <span>Run Match Pipeline</span>
                            </Link>
                        ) : (
                            <Link
                                href={route('devices.index')}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] hover:border-[#0258d1] text-xs font-medium text-white transition"
                            >
                                <span>View Fleet Inventory</span>
                            </Link>
                        )}
                    </div>
                </div>
            }
        >
            <Head title="Asset Operations Overview - ITFleet" />

            <div className="space-y-5">
                {/* 1. Core Operational KPI Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-sm p-5 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                    Total Hardware Assets
                                </span>
                                {retiredCount > 0 && (
                                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 tabular-nums">
                                        {retiredCount} retired
                                    </span>
                                )}
                            </div>
                            <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
                                {totalActive}
                            </div>
                        </div>
                        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                            {assignedCount} assigned &middot; {availableCount} available &middot; {inRepairCount} in repair
                        </p>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-sm p-5 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                        <div>
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                Deployment &amp; Stockroom
                            </span>
                            <div className="mt-2 flex items-baseline justify-between gap-2">
                                <span className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
                                    {utilizationRate}%
                                </span>
                                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                    deployed
                                </span>
                            </div>
                            <div className="mt-2.5 w-full h-1.5 rounded-sm bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                <div
                                    className="h-full rounded-sm bg-[#026eff] transition-all duration-300"
                                    style={{ width: `${Math.max(0, Math.min(100, utilizationRate))}%` }}
                                />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
                                {availableCount} ready in stockroom
                            </span>
                            <Link
                                href={route('devices.index', { status: 'available' })}
                                className="text-[#026eff] dark:text-sky-400 font-medium hover:underline"
                            >
                                Pool &rarr;
                            </Link>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-sm p-5 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                        <div>
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                Software &amp; SaaS Seats
                            </span>
                            <div className="mt-2 flex items-baseline justify-between gap-2">
                                <span className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
                                    {software.assigned_seats ?? 0} / {software.total_seats ?? 0}
                                </span>
                                <span className="text-[11px] font-medium text-[#026eff] dark:text-sky-400 tabular-nums">
                                    {software.seat_utilization_pct ?? 0}% used
                                </span>
                            </div>
                        </div>
                        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums truncate">
                            {canViewFinancials
                                ? `₱${Number(software.annual_software_spend || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}/yr · ${software.active_licenses ?? 0} licenses`
                                : `${software.available_seats ?? 0} seats available · ${software.active_licenses ?? 0} active contracts`}
                        </p>
                    </div>

                    {canViewFinancials ? (
                        <div className="bg-white dark:bg-zinc-900 rounded-sm p-5 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                            <div>
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                    Net Book Value
                                </span>
                                <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
                                    ₱{Number(metrics?.current_book_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums truncate">
                                ₱{Number(metrics?.total_acquisition_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} acquisition cost
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-zinc-900 rounded-sm p-5 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                            <div>
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                    Maintenance &amp; Repairs
                                </span>
                                <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
                                    {activeMaintenanceCount} Active
                                </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-xs">
                                <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
                                    {inRepairCount} units in servicing
                                </span>
                                <Link
                                    href={route('maintenance.index')}
                                    className="text-[#026eff] dark:text-sky-400 font-medium hover:underline"
                                >
                                    Queue &rarr;
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Two-Column Operational Overview */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left: Unified Hardware Inventory by Status & Category */}
                    <div className="lg:col-span-7 bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col justify-between gap-5">
                        <div>
                            <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                                <div>
                                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                        Hardware Inventory by Status &amp; Category
                                    </h2>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        Live distribution across {totalInventory} tracked hardware records
                                    </p>
                                </div>
                                <Link
                                    href={route('devices.index')}
                                    className="text-xs font-medium text-[#026eff] dark:text-sky-400 hover:underline shrink-0"
                                >
                                    Full Catalog &rarr;
                                </Link>
                            </div>

                            {/* Status Stacked Bar + Clickable Summary Strip */}
                            <div className="mt-4">
                                <div className="w-full h-2 rounded-sm bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex gap-0.5">
                                    {statusItems.map((status) =>
                                        status.count > 0 ? (
                                            <div
                                                key={status.key}
                                                className={`${status.bar} h-full transition-all duration-300`}
                                                style={{ width: `${(status.count / (totalInventory || 1)) * 100}%` }}
                                                title={`${status.label}: ${status.count}`}
                                            />
                                        ) : null
                                    )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                                    {statusItems.map((status) => {
                                        const pct = totalInventory > 0 ? Math.round((status.count / totalInventory) * 100) : 0;

                                        return (
                                            <Link
                                                key={status.key}
                                                href={status.href}
                                                className="px-3 py-2.5 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/30 hover:border-[#026eff] transition"
                                            >
                                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                                    <span className={`w-1.5 h-1.5 rounded-sm shrink-0 ${status.dot}`} />
                                                    <span className="truncate">{status.label}</span>
                                                </div>
                                                <div className="mt-1 flex items-baseline justify-between gap-2">
                                                    <span className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                                                        {status.count}
                                                    </span>
                                                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                                                        {pct}%
                                                    </span>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Active Hardware Category Breakdown */}
                        <div>
                            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2.5">
                                Active Hardware Categories ({totalActive} units)
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                                {categoryItems.map((cat) => {
                                    const IconComponent = cat.icon;
                                    const sharePct = totalActive > 0 ? Math.round((cat.count / totalActive) * 100) : 0;

                                    return (
                                        <Link
                                            key={cat.key}
                                            href={route('devices.index', { device_type: cat.key })}
                                            className="p-3 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-[#026eff] transition flex flex-col justify-between gap-2"
                                        >
                                            <div className="flex items-center justify-between gap-1 text-zinc-500 dark:text-zinc-400">
                                                <IconComponent className="w-4 h-4 shrink-0" />
                                                <span className="text-[10px] tabular-nums">{sharePct}%</span>
                                            </div>
                                            <div>
                                                <div className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 leading-none">
                                                    {cat.count}
                                                </div>
                                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                                                    {cat.label}
                                                </div>
                                            </div>
                                            <div className="w-full h-1 rounded-sm bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                                <div
                                                    className="h-full bg-[#026eff]/80 rounded-sm"
                                                    style={{ width: `${Math.min(100, sharePct)}%` }}
                                                />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right: Needs Attention Action Queue */}
                    <div className="lg:col-span-5 bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col">
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                            <div>
                                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    Needs Attention
                                </h2>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Actionable compliance &amp; lifecycle items
                                </p>
                            </div>
                            {activeAttentionCount === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-emerald-500/20 bg-emerald-500/10 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                                    <RiCheckboxCircleLine className="w-3.5 h-3.5" />
                                    All Clear
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-amber-500/20 bg-amber-500/10 text-[11px] font-medium text-amber-700 dark:text-amber-400 tabular-nums shrink-0">
                                    {activeAttentionCount} Active
                                </span>
                            )}
                        </div>

                        <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800/80 flex-1 flex flex-col justify-between">
                            {attentionItems.map((item) => {
                                const IconComponent = item.icon;
                                const hasIssues = item.count > 0;

                                return (
                                    <Link
                                        key={item.key}
                                        href={item.href}
                                        className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 group"
                                    >
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className={`w-8 h-8 rounded-sm border flex items-center justify-center shrink-0 ${
                                                hasIssues
                                                    ? item.activeTone
                                                    : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500'
                                            }`}>
                                                <IconComponent className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-[#026eff] dark:group-hover:text-sky-400 transition truncate">
                                                    {item.label}
                                                </div>
                                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`px-2 py-0.5 rounded-sm border text-xs font-semibold tabular-nums ${
                                                hasIssues
                                                    ? item.activeTone
                                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                            }`}>
                                                {item.count}
                                            </span>
                                            <RiArrowRightLine className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#026eff] group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 3. Tabbed Custody Activity & Ready-to-Deploy Stockroom Table */}
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-1 p-1 rounded-sm bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 w-fit">
                            <button
                                type="button"
                                onClick={() => setActiveTab('assignments')}
                                className={`px-3 py-1.5 rounded-sm text-xs font-medium transition cursor-pointer ${
                                    activeTab === 'assignments'
                                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                }`}
                            >
                                Recent Assignments
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('available')}
                                className={`px-3 py-1.5 rounded-sm text-xs font-medium transition cursor-pointer tabular-nums ${
                                    activeTab === 'available'
                                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                }`}
                            >
                                Ready to Deploy ({availableCount})
                            </button>
                        </div>

                        {activeTab === 'assignments' ? (
                            <Link
                                href={route('employees.index')}
                                className="text-xs font-medium text-[#026eff] dark:text-sky-400 hover:underline shrink-0"
                            >
                                View All Employees &rarr;
                            </Link>
                        ) : (
                            <Link
                                href={route('devices.index', { status: 'available' })}
                                className="text-xs font-medium text-[#026eff] dark:text-sky-400 hover:underline shrink-0"
                            >
                                View All Available ({availableCount}) &rarr;
                            </Link>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        {activeTab === 'assignments' ? (
                            <table className="w-full text-left text-xs">
                                <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    <tr>
                                        <th className="py-2.5 px-5">Device</th>
                                        <th className="py-2.5 px-5">Employee</th>
                                        <th className="py-2.5 px-5">Department / Profile</th>
                                        <th className="py-2.5 px-5">Match Fit</th>
                                        <th className="py-2.5 px-5">Source</th>
                                        <th className="py-2.5 px-5">Assigned Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                                    {(!recent_assignments || recent_assignments.length === 0) ? (
                                        <tr>
                                            <td colSpan="6" className="py-10 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                                                No recent fleet assignments recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        recent_assignments.map((asg) => (
                                            <tr key={asg.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                                                <td className="py-3.5 px-5">
                                                    {asg.device ? (
                                                        <Link href={route('devices.show', asg.device.id)} className="font-mono font-medium text-[#026eff] dark:text-sky-400 hover:underline">
                                                            {asg.device.asset_tag}
                                                        </Link>
                                                    ) : (
                                                        <span className="font-mono text-zinc-400">N/A</span>
                                                    )}
                                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                        {asg.device ? `${asg.device.brand} ${asg.device.model}` : 'Unassigned'}
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-5 font-medium text-zinc-900 dark:text-zinc-100">
                                                    {asg.employee?.name || 'Unknown Staff'}
                                                </td>
                                                <td className="py-3.5 px-5">
                                                    <div className="font-medium text-zinc-800 dark:text-zinc-200">{asg.employee?.department || 'General'}</div>
                                                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{asg.employee?.role_profile?.name || 'Custom Role'}</div>
                                                </td>
                                                <td className="py-3.5 px-5">
                                                    {asg.match_score ? (
                                                        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-sm border tabular-nums ${
                                                            asg.match_score >= 0.8 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
                                                            asg.match_score >= 0.65 ? 'bg-[#026eff]/10 border-[#026eff]/20 text-[#026eff] dark:text-sky-400' :
                                                            'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
                                                        }`}>
                                                            {Math.round(asg.match_score * 100)}% Match
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-400 dark:text-zinc-500">&mdash;</span>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-5">
                                                    <span className="text-[11px] capitalize font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-sm">
                                                        {(asg.assignment_source || 'manual').replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-5 text-zinc-500 dark:text-zinc-400 tabular-nums">
                                                    {asg.assigned_at ? new Date(asg.assigned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left text-xs">
                                <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    <tr>
                                        <th className="py-2.5 px-5">Asset</th>
                                        <th className="py-2.5 px-5">Category</th>
                                        <th className="py-2.5 px-5">Specs</th>
                                        <th className="py-2.5 px-5">Condition</th>
                                        <th className="py-2.5 px-5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                                    {(!available_fleet || available_fleet.length === 0) ? (
                                        <tr>
                                            <td colSpan="5" className="py-10 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                                                No idle devices currently available in stockroom.
                                            </td>
                                        </tr>
                                    ) : (
                                        available_fleet.map((device) => (
                                            <tr key={device.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                                                <td className="py-3 px-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0 overflow-hidden">
                                                            <HardwareImage
                                                                src={device.image_clip_url || device.image_url}
                                                                alt={`${device.brand} ${device.model}`}
                                                                deviceType={device.device_type}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <Link href={route('devices.show', device.id)} className="font-mono font-medium text-[#026eff] dark:text-sky-400 hover:underline">
                                                                {device.asset_tag}
                                                            </Link>
                                                            <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                                {device.brand} {device.model}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-5 capitalize text-zinc-600 dark:text-zinc-300">
                                                    {device.device_type}
                                                </td>
                                                <td className="py-3 px-5 text-zinc-600 dark:text-zinc-300">
                                                    {['laptop', 'desktop'].includes(device.device_type) ? (
                                                        <span className="tabular-nums">
                                                            {device.cpu || 'Standard CPU'} &middot; {device.ram_gb}GB &middot; {device.storage_gb}GB {device.storage_type}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-500 dark:text-zinc-400">
                                                            {device.serial_number || 'Standard accessory unit'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-5">
                                                    <span className="text-[11px] capitalize font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm">
                                                        {device.condition || 'good'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-5 text-right">
                                                    <Link
                                                        href={route('devices.show', device.id)}
                                                        className="font-medium text-[#026eff] dark:text-sky-400 hover:underline"
                                                    >
                                                        Inspect &rarr;
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
