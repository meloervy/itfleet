import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import {
    RiArrowRightUpLine,
    RiCheckboxCircleLine,
    RiCloseLine,
    RiComputerLine,
    RiSearchLine,
    RiShieldCheckLine,
    RiSparkling2Line,
} from 'react-icons/ri';

const DEFAULT_AVATAR = '/user/default-profile-picture.png';

const resolveAvatarUrl = (emp) => {
    if (!emp) return DEFAULT_AVATAR;
    if (emp.profile_picture_url) return emp.profile_picture_url;
    if (emp.profile_picture?.startsWith('public/')) {
        return '/' + emp.profile_picture.slice(7);
    }
    return emp.profile_picture || DEFAULT_AVATAR;
};

const formatPct = (val) => {
    const num = Number(val ?? 0);
    return Math.round(num <= 1 ? num * 100 : num);
};

export default function MismatchesIndex({ mismatches = [], threshold = 0.65 }) {
    const { auth } = usePage().props;
    const isAdminOrManager = ['admin', 'manager'].includes(auth?.user?.role);
    const thresholdPct = formatPct(threshold);
    const [filterType, setFilterType] = useState('all'); // 'all' | 'under-provisioned' | 'over-provisioned'
    const [search, setSearch] = useState('');

    const underCount = useMemo(
        () => mismatches.filter((m) => m.classification === 'under-provisioned').length,
        [mismatches]
    );
    const overCount = useMemo(
        () => mismatches.filter((m) => m.classification === 'over-provisioned').length,
        [mismatches]
    );

    const filteredMismatches = useMemo(() => {
        return mismatches.filter((item) => {
            if (filterType !== 'all' && item.classification !== filterType) {
                return false;
            }
            if (search.trim()) {
                const q = search.toLowerCase();
                const emp = item.employee;
                const dev = item.device;
                const rp = item.role_profile;
                return (
                    emp?.name?.toLowerCase().includes(q) ||
                    emp?.department?.toLowerCase().includes(q) ||
                    dev?.brand?.toLowerCase().includes(q) ||
                    dev?.model?.toLowerCase().includes(q) ||
                    dev?.asset_tag?.toLowerCase().includes(q) ||
                    rp?.name?.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [mismatches, filterType, search]);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Hardware Mismatch Audit
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
                            Active workstation assignments scoring below the {thresholdPct}% alignment threshold or breaching role baselines.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Link
                            href={route('role-profiles.index')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                        >
                            <RiShieldCheckLine className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Role Baselines</span>
                        </Link>
                        {isAdminOrManager && (
                            <Link
                                href={route('match.index')}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-xs font-medium text-white transition"
                            >
                                <RiSparkling2Line className="w-3.5 h-3.5" />
                                <span>Open Match Engine</span>
                            </Link>
                        )}
                    </div>
                </div>
            }
        >
            <Head title="Mismatch Audit - ITFleet" />

            {/* 3 Interactive Summary Filter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`text-left rounded-sm border p-4 transition cursor-pointer ${
                        filterType === 'all'
                            ? 'bg-white dark:bg-zinc-900 border-zinc-400 dark:border-zinc-600'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                >
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Total Flagged Mismatches
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {mismatches.length}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                        Threshold baseline: {thresholdPct}% minimum fit
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        setFilterType((prev) => (prev === 'under-provisioned' ? 'all' : 'under-provisioned'))
                    }
                    className={`text-left rounded-sm border p-4 transition cursor-pointer ${
                        filterType === 'under-provisioned'
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-400 dark:border-rose-700'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Under-Provisioned
                        </span>
                        <span className="w-1.5 h-1.5 rounded-sm bg-rose-500" />
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {underCount}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Hardware bottlenecks limiting daily workflow
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        setFilterType((prev) => (prev === 'over-provisioned' ? 'all' : 'over-provisioned'))
                    }
                    className={`text-left rounded-sm border p-4 transition cursor-pointer ${
                        filterType === 'over-provisioned'
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-400 dark:border-amber-700'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Over-Provisioned
                        </span>
                        <span className="w-1.5 h-1.5 rounded-sm bg-amber-500" />
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {overCount}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Surplus hardware available for reallocation
                    </div>
                </button>
            </div>

            {/* Search & Segmented Filter Toolbar */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-3.5 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <RiSearchLine className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search employee, department, device model, asset tag..."
                        className="w-full pl-9 pr-8 py-1.5 text-xs rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-[#026eff] focus:ring-0"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                        >
                            <RiCloseLine className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums hidden md:inline mr-1">
                        Showing {filteredMismatches.length} of {mismatches.length}
                    </span>
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 p-0.5 rounded-sm">
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'under-provisioned', label: 'Under' },
                            { id: 'over-provisioned', label: 'Over' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setFilterType(tab.id)}
                                className={`px-2.5 py-1 rounded-sm border text-[11px] font-medium transition cursor-pointer ${
                                    filterType === tab.id
                                        ? 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                                        : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mismatches Feed */}
            {mismatches.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                    <RiCheckboxCircleLine className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        All assignments aligned
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
                        Every employee with a role profile scores at or above the {thresholdPct}% hardware threshold.
                    </p>
                </div>
            ) : filteredMismatches.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                    <RiComputerLine className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        No mismatches match your filter
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setFilterType('all');
                            setSearch('');
                        }}
                        className="mt-3 px-3 py-1.5 rounded-sm border border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium cursor-pointer"
                    >
                        Reset view
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredMismatches.map((item, idx) => {
                        const { assignment, device, employee, role_profile, score, classification, rationale, disqualified, disqualification_reason } =
                            item;
                        const isUnder = classification === 'under-provisioned';
                        const ramShort = (device?.ram_gb ?? 0) < (role_profile?.min_ram_gb ?? 0);
                        const storageShort = (device?.storage_gb ?? 0) < (role_profile?.min_storage_gb ?? 0);

                        return (
                            <div
                                key={assignment?.id || `${employee?.id}-${device?.id}-${idx}`}
                                className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5"
                            >
                                {/* Top Header */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <img
                                            src={resolveAvatarUrl(employee)}
                                            alt={employee?.name}
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = DEFAULT_AVATAR;
                                            }}
                                            className="w-9 h-9 rounded-sm object-cover bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                                                {employee?.name}
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                                {employee?.department} &bull; {role_profile?.name}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm border text-[11px] font-medium ${
                                                isUnder
                                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
                                                    : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                                            }`}
                                        >
                                            <span
                                                className={`w-1.5 h-1.5 rounded-sm ${
                                                    isUnder ? 'bg-rose-500' : 'bg-amber-500'
                                                }`}
                                            />
                                            {isUnder ? 'Under-provisioned' : 'Over-provisioned'}
                                        </span>

                                        <span className="px-2.5 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 tabular-nums">
                                            {formatPct(score)}% fit
                                        </span>

                                        {isAdminOrManager && (
                                            <Link
                                                href={route('match.index', { employee_id: employee?.id })}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-[11px] font-medium text-white transition"
                                            >
                                                <RiSparkling2Line className="w-3.5 h-3.5" />
                                                <span>Re-match</span>
                                            </Link>
                                        )}
                                    </div>
                                </div>

                                {/* Architectural Comparison Panels */}
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    <div className="rounded-sm bg-zinc-50/70 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3.5">
                                        <div className="flex items-center justify-between gap-2 mb-2.5">
                                            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                                Assigned Hardware
                                            </span>
                                            <Link
                                                href={route('devices.show', device?.id)}
                                                className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-600 dark:text-zinc-300 hover:text-[#026eff] dark:hover:text-sky-400 transition tabular-nums"
                                            >
                                                <span>{device?.asset_tag}</span>
                                                <RiArrowRightUpLine className="w-3 h-3" />
                                            </Link>
                                        </div>
                                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2.5">
                                            {device?.brand} {device?.model}
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 text-[11px] tabular-nums">
                                            <div>
                                                <div className="text-zinc-400 dark:text-zinc-500 text-[10px]">CPU</div>
                                                <div className="font-medium text-zinc-800 dark:text-zinc-200 capitalize mt-0.5">
                                                    {device?.cpu_tier}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-400 dark:text-zinc-500 text-[10px]">RAM</div>
                                                <div
                                                    className={`font-medium mt-0.5 ${
                                                        ramShort
                                                            ? 'text-rose-600 dark:text-rose-400'
                                                            : 'text-zinc-800 dark:text-zinc-200'
                                                    }`}
                                                >
                                                    {device?.ram_gb} GB
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-400 dark:text-zinc-500 text-[10px]">Storage</div>
                                                <div
                                                    className={`font-medium mt-0.5 ${
                                                        storageShort
                                                            ? 'text-rose-600 dark:text-rose-400'
                                                            : 'text-zinc-800 dark:text-zinc-200'
                                                    }`}
                                                >
                                                    {device?.storage_gb} GB
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-400 dark:text-zinc-500 text-[10px]">GPU</div>
                                                <div className="font-medium text-zinc-800 dark:text-zinc-200 capitalize mt-0.5 truncate">
                                                    {device?.gpu_tier}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-sm bg-zinc-50/70 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 p-3.5">
                                        <div className="flex items-center justify-between gap-2 mb-2.5">
                                            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                                Role Baseline
                                            </span>
                                            <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                                                {role_profile?.name}
                                            </span>
                                        </div>
                                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2.5">
                                            Minimum Thresholds
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 text-[11px] tabular-nums">
                                            <div>
                                                <div className="text-zinc-400 dark:text-zinc-500 text-[10px]">Min CPU</div>
                                                <div className="font-medium text-zinc-800 dark:text-zinc-200 capitalize mt-0.5">
                                                    {role_profile?.min_cpu_tier}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-400 dark:text-zinc-500 text-[10px]">Min RAM</div>
                                                <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                                                    {role_profile?.min_ram_gb} GB
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-400 dark:text-zinc-500 text-[10px]">Min Disk</div>
                                                <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                                                    {role_profile?.min_storage_gb} GB
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-400 dark:text-zinc-500 text-[10px]">Form</div>
                                                <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                                                    {role_profile?.portability_required ? 'Portable' : 'Any'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Diagnostic Rationale */}
                                {(rationale || (disqualified && disqualification_reason)) && (
                                    <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                                        {disqualified && disqualification_reason && (
                                            <span className="font-medium text-rose-600 dark:text-rose-400 mr-1.5">
                                                [{disqualification_reason}]
                                            </span>
                                        )}
                                        {rationale}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </AuthenticatedLayout>
    );
}
