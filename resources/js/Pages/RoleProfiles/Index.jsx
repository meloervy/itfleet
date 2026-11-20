import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Checkbox from '@/Components/Checkbox';
import CustomSelect from '@/Components/CustomSelect';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import {
    RiAddLine,
    RiAlertLine,
    RiArrowRightUpLine,
    RiCheckDoubleLine,
    RiCloseLine,
    RiComputerLine,
    RiCpuLine,
    RiDeleteBinLine,
    RiEditLine,
    RiFileCopyLine,
    RiGroupLine,
    RiHardDrive2Line,
    RiLayoutGridLine,
    RiMacbookLine,
    RiRam2Line,
    RiRefreshLine,
    RiSearchLine,
    RiShieldCheckLine,
    RiTableLine,
} from 'react-icons/ri';

const cpuTierLabels = {
    entry: 'Entry',
    mid: 'Mid',
    high: 'High',
    workstation: 'Workstation',
};

const cpuTierRank = {
    entry: 1,
    mid: 2,
    high: 3,
    workstation: 4,
};

const gpuTierLabels = {
    none: 'None',
    integrated: 'Integrated',
    'dedicated-entry': 'Dedicated Entry',
    'dedicated-high': 'Dedicated High',
};

const ramPresets = [8, 16, 32, 64, 128];
const storagePresets = [
    { value: 256, label: '256 GB' },
    { value: 512, label: '512 GB' },
    { value: 1024, label: '1 TB' },
    { value: 2048, label: '2 TB' },
];

const fitBadgeStyle = {
    compliant: {
        label: 'Compliant',
        className: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    },
    'under-provisioned': {
        label: 'Under-provisioned',
        className: 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400',
    },
    'over-provisioned': {
        label: 'Over-allocated',
        className: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
    },
    unassigned: {
        label: 'No compute unit',
        className: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400',
    },
};

function formatStorage(gb) {
    const num = Number(gb || 0);
    if (num >= 1024) {
        const tb = num / 1024;
        return Number.isInteger(tb) ? `${tb} TB` : `${tb.toFixed(1)} TB`;
    }

    return `${num} GB`;
}

function pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
}

export default function RoleProfilesIndex({
    profiles = [],
    summary = {},
    match_threshold_pct = 65,
}) {
    const { auth } = usePage().props;
    const user = auth?.user;
    const isAdminOrManager = ['admin', 'manager'].includes(user?.role);

    const [searchQuery, setSearchQuery] = useState('');
    const [requirementFilter, setRequirementFilter] = useState('all'); // 'all' | 'gpu' | 'portable' | 'mismatched' | 'no_stock'
    const [sortBy, setSortBy] = useState('name'); // 'name' | 'employees' | 'spec' | 'mismatches' | 'stock_asc'
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'matrix'

    const [inspectProfileId, setInspectProfileId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        name: '',
        min_cpu_tier: 'mid',
        min_ram_gb: 16,
        min_storage_gb: 512,
        requires_gpu: false,
        min_gpu_tier: 'none',
        portability_required: false,
        description: '',
    });

    const inspectProfile = useMemo(
        () => profiles.find((p) => p.id === inspectProfileId) || null,
        [profiles, inspectProfileId]
    );

    const mismatchProfilesCount = useMemo(
        () => profiles.filter((p) => (p.mismatch_count ?? 0) > 0).length,
        [profiles]
    );

    const noStockProfilesCount = useMemo(
        () => profiles.filter((p) => (p.eligible_stock_count ?? 0) === 0).length,
        [profiles]
    );

    const filteredProfiles = useMemo(() => {
        const filtered = profiles.filter((p) => {
            if (requirementFilter === 'gpu' && !p.requires_gpu) return false;
            if (requirementFilter === 'portable' && !p.portability_required) return false;
            if (requirementFilter === 'mismatched' && (p.mismatch_count ?? 0) === 0) return false;
            if (requirementFilter === 'no_stock' && (p.eligible_stock_count ?? 0) > 0) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return (
                    p.name?.toLowerCase().includes(q) ||
                    p.description?.toLowerCase().includes(q) ||
                    p.min_cpu_tier?.toLowerCase().includes(q) ||
                    (cpuTierLabels[p.min_cpu_tier] || '').toLowerCase().includes(q)
                );
            }

            return true;
        });

        return [...filtered].sort((a, b) => {
            if (sortBy === 'employees') {
                return (b.employees_count ?? 0) - (a.employees_count ?? 0) || a.name.localeCompare(b.name);
            }
            if (sortBy === 'spec') {
                const scoreA = (cpuTierRank[a.min_cpu_tier] || 0) * 10000 + (a.min_ram_gb || 0) * 10 + (a.requires_gpu ? 500 : 0);
                const scoreB = (cpuTierRank[b.min_cpu_tier] || 0) * 10000 + (b.min_ram_gb || 0) * 10 + (b.requires_gpu ? 500 : 0);
                return scoreB - scoreA || a.name.localeCompare(b.name);
            }
            if (sortBy === 'mismatches') {
                return (b.mismatch_count ?? 0) - (a.mismatch_count ?? 0) || a.name.localeCompare(b.name);
            }
            if (sortBy === 'stock_asc') {
                return (a.eligible_stock_count ?? 0) - (b.eligible_stock_count ?? 0) || a.name.localeCompare(b.name);
            }

            return a.name.localeCompare(b.name);
        });
    }, [profiles, searchQuery, requirementFilter, sortBy]);

    const activeFilterCount = (searchQuery.trim() ? 1 : 0) + (requirementFilter !== 'all' ? 1 : 0);

    const openCreateModal = () => {
        setEditingProfile(null);
        reset();
        clearErrors();
        setShowModal(true);
    };

    const openEditModal = (profile) => {
        setEditingProfile(profile);
        clearErrors();
        setData({
            name: profile.name || '',
            min_cpu_tier: profile.min_cpu_tier || 'mid',
            min_ram_gb: profile.min_ram_gb ?? 16,
            min_storage_gb: profile.min_storage_gb ?? 512,
            requires_gpu: Boolean(profile.requires_gpu),
            min_gpu_tier: profile.requires_gpu ? (profile.min_gpu_tier || 'dedicated-entry') : 'none',
            portability_required: Boolean(profile.portability_required),
            description: profile.description || '',
        });
        setShowModal(true);
    };

    const openCloneModal = (profile) => {
        setEditingProfile(null);
        clearErrors();
        setData({
            name: `${profile.name} (Copy)`,
            min_cpu_tier: profile.min_cpu_tier || 'mid',
            min_ram_gb: profile.min_ram_gb ?? 16,
            min_storage_gb: profile.min_storage_gb ?? 512,
            requires_gpu: Boolean(profile.requires_gpu),
            min_gpu_tier: profile.requires_gpu ? (profile.min_gpu_tier || 'dedicated-entry') : 'none',
            portability_required: Boolean(profile.portability_required),
            description: profile.description || '',
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingProfile(null);
        reset();
        clearErrors();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingProfile) {
            put(route('role-profiles.update', editingProfile.id), {
                preserveScroll: true,
                onSuccess: () => closeModal(),
            });
        } else {
            post(route('role-profiles.store'), {
                preserveScroll: true,
                onSuccess: () => closeModal(),
            });
        }
    };

    const handleDelete = () => {
        if (!deleteTarget) return;
        router.delete(route('role-profiles.destroy', deleteTarget.id), {
            preserveScroll: true,
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
            onSuccess: () => {
                if (inspectProfileId === deleteTarget.id) {
                    setInspectProfileId(null);
                }
                setDeleteTarget(null);
            },
        });
    };

    const clearFilters = () => {
        setSearchQuery('');
        setRequirementFilter('all');
    };

    const renderComplianceBadge = (profile) => {
        if ((profile.assigned_compute_count ?? 0) === 0) {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    No Compute
                </span>
            );
        }

        if ((profile.mismatch_count ?? 0) > 0) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-rose-500/20 bg-rose-500/10 text-[10px] font-medium text-rose-700 dark:text-rose-400 tabular-nums">
                    <span className="w-1.5 h-1.5 rounded-sm bg-rose-500" />
                    {pluralize(profile.mismatch_count, 'Mismatch', 'Mismatches')}
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />
                {profile.compliance_rate ?? 100}% Fit
            </span>
        );
    };

    const filterTabs = [
        { id: 'all', label: 'All', count: profiles.length },
        { id: 'gpu', label: 'GPU Required', count: summary.gpu_required_count ?? profiles.filter((p) => p.requires_gpu).length },
        { id: 'portable', label: 'Portable', count: summary.portable_count ?? profiles.filter((p) => p.portability_required).length },
        { id: 'mismatched', label: 'Mismatches', count: mismatchProfilesCount },
        { id: 'no_stock', label: 'No Stock', count: noStockProfilesCount },
    ];

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Role Profiles &amp; Baselines
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Hardware policy thresholds, live workforce compliance, and stockroom readiness.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Link
                            href={route('mismatches.index')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                        >
                            <RiAlertLine className="w-3.5 h-3.5 text-amber-500" />
                            <span>Mismatch Audit</span>
                        </Link>
                        {isAdminOrManager && (
                            <button
                                type="button"
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-xs font-medium text-white transition cursor-pointer"
                            >
                                <RiAddLine className="w-3.5 h-3.5" />
                                <span>New Role Profile</span>
                            </button>
                        )}
                    </div>
                </div>
            }
        >
            <Head title="Role Profiles - ITFleet" />

            {/* 4-Card Operational KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Defined Baselines
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {summary.total_profiles ?? profiles.length}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-50 tabular-nums">
                        {summary.gpu_required_count ?? 0} GPU &middot; {summary.portable_count ?? 0} portable
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Workforce Coverage
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
                        <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            {summary.covered_employees ?? 0} / {summary.total_employees ?? 0}
                        </span>
                        <span className="text-xs font-medium text-[#026eff] dark:text-sky-400">
                            {summary.coverage_pct ?? 100}%
                        </span>
                    </div>
                    <div className="mt-2 w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 overflow-hidden">
                        <div
                            className="bg-[#026eff] h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, summary.coverage_pct ?? 100)}%` }}
                        />
                    </div>
                    <div className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-50 truncate">
                        {(summary.uncovered_employees ?? 0) === 0
                            ? 'All staff mapped to baselines'
                            : `${summary.uncovered_employees} staff without a role profile`}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setRequirementFilter((prev) => (prev === 'mismatched' ? 'all' : 'mismatched'))}
                    className={`text-left rounded-sm border p-4 transition cursor-pointer ${
                        requirementFilter === 'mismatched'
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-400 dark:border-rose-700 ring-1 ring-rose-400/30'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Policy Compliance
                        </span>
                        <span
                            className={`w-1.5 h-1.5 rounded-sm ${
                                (summary.total_mismatches ?? 0) > 0 ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                        />
                    </div>
                    <div
                        className={`mt-1.5 text-2xl font-semibold tracking-tight tabular-nums ${
                            (summary.total_mismatches ?? 0) > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                    >
                        {summary.compliance_pct ?? 100}%
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {summary.total_mismatches ?? 0} active mismatches across {summary.total_evaluated_assignments ?? 0} units
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setRequirementFilter((prev) => (prev === 'no_stock' ? 'all' : 'no_stock'))}
                    className={`text-left rounded-sm border p-4 transition cursor-pointer ${
                        requirementFilter === 'no_stock'
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-400 dark:border-amber-700 ring-1 ring-amber-400/30'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Stockroom Gaps
                        </span>
                        {(summary.stock_gap_profiles_count ?? 0) > 0 && (
                            <span className="w-1.5 h-1.5 rounded-sm bg-amber-500" />
                        )}
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {summary.stock_gap_profiles_count ?? 0}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-50">
                        Baselines with 0 eligible units in stock
                    </div>
                </button>
            </div>

            {/* Filter & View Toolbar */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4 mb-5 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                        <RiSearchLine className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search role name, workload description, CPU tier..."
                            className="w-full pl-9 pr-8 py-2 text-xs rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-[#026eff] focus:ring-0"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                aria-label="Clear search"
                            >
                                <RiCloseLine className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="w-44">
                            <CustomSelect
                                value={sortBy}
                                onChange={setSortBy}
                                options={[
                                    { value: 'name', label: 'Sort: Name A–Z' },
                                    { value: 'employees', label: 'Sort: Most Employees' },
                                    { value: 'spec', label: 'Sort: Highest Spec' },
                                    { value: 'mismatches', label: 'Sort: Most Mismatches' },
                                    { value: 'stock_asc', label: 'Sort: Lowest Stock' },
                                ]}
                            />
                        </div>

                        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 p-0.5 rounded-sm">
                            <button
                                type="button"
                                onClick={() => setViewMode('cards')}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm border text-[11px] font-medium transition cursor-pointer ${
                                    viewMode === 'cards'
                                        ? 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                                        : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                                }`}
                            >
                                <RiLayoutGridLine className="w-3.5 h-3.5" />
                                <span>Cards</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('matrix')}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm border text-[11px] font-medium transition cursor-pointer ${
                                    viewMode === 'matrix'
                                        ? 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                                        : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                                }`}
                            >
                                <RiTableLine className="w-3.5 h-3.5" />
                                <span>Matrix</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Requirement / Policy Tabs */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {filterTabs.map((tab) => {
                            const isActive = requirementFilter === tab.id;
                            const showAlertDot = (tab.id === 'mismatched' || tab.id === 'no_stock') && tab.count > 0 && !isActive;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setRequirementFilter(tab.id)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-xs font-medium transition cursor-pointer ${
                                        isActive
                                            ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    {showAlertDot && <span className="w-1.5 h-1.5 rounded-sm bg-amber-500" />}
                                    <span>{tab.label}</span>
                                    <span
                                        className={`text-[10px] px-1.5 py-0.2 rounded-sm tabular-nums ${
                                            isActive
                                                ? 'bg-white/15 dark:bg-zinc-900/15 text-white dark:text-zinc-900'
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                        }`}
                                    >
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                            Showing {filteredProfiles.length} of {profiles.length} baselines
                        </span>
                        {activeFilterCount > 0 && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                            >
                                <RiRefreshLine className="w-3 h-3" />
                                <span>Reset</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {filteredProfiles.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                    <RiShieldCheckLine className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        No role profiles match
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        {activeFilterCount > 0
                            ? 'Adjust your search query or requirement filter to inspect baselines.'
                            : 'Create an organizational hardware baseline to power Smart Match scoring.'}
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                        {activeFilterCount > 0 ? (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="px-3.5 py-1.5 rounded-sm border border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white transition cursor-pointer"
                            >
                                Reset filters
                            </button>
                        ) : (
                            isAdminOrManager && (
                                <button
                                    type="button"
                                    onClick={openCreateModal}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white text-xs font-medium transition cursor-pointer"
                                >
                                    <RiAddLine className="w-3.5 h-3.5" />
                                    <span>New Role Profile</span>
                                </button>
                            )
                        )}
                    </div>
                </div>
            ) : viewMode === 'cards' ? (
                /* Cards Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProfiles.map((profile) => (
                        <div
                            key={profile.id}
                            onClick={() => setInspectProfileId(profile.id)}
                            className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition flex flex-col justify-between cursor-pointer group"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate group-hover:text-[#026eff] dark:group-hover:text-sky-400 transition-colors">
                                            {profile.name}
                                        </h3>
                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                            <Link
                                                href={route('employees.index', { role_profile_id: profile.id })}
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-[#026eff] dark:hover:text-sky-400 tabular-nums transition"
                                            >
                                                <RiGroupLine className="w-3 h-3" />
                                                <span>{pluralize(profile.employees_count ?? 0, 'employee', 'employees')}</span>
                                            </Link>
                                            {renderComplianceBadge(profile)}
                                        </div>
                                    </div>

                                    {isAdminOrManager && (
                                        <div
                                            className="flex items-center gap-0.5 shrink-0"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => openCloneModal(profile)}
                                                className="p-1.5 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                                                title="Clone role profile"
                                            >
                                                <RiFileCopyLine className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openEditModal(profile)}
                                                className="p-1.5 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                                                title="Edit role profile"
                                            >
                                                <RiEditLine className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeleteTarget(profile)}
                                                className="p-1.5 rounded-sm border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                                                title="Delete role profile"
                                            >
                                                <RiDeleteBinLine className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <p className="mt-2.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 min-h-[2.25rem]">
                                    {profile.description || 'Standard hardware provisioning baseline for this organizational role.'}
                                </p>
                            </div>

                            <div className="mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 px-2.5 py-2 border border-zinc-200 dark:border-zinc-800">
                                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">Min CPU</div>
                                        <div className="mt-0.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                            {cpuTierLabels[profile.min_cpu_tier] || profile.min_cpu_tier}
                                        </div>
                                    </div>
                                    <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 px-2.5 py-2 border border-zinc-200 dark:border-zinc-800">
                                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">Min RAM</div>
                                        <div className="mt-0.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                                            {profile.min_ram_gb} GB
                                        </div>
                                    </div>
                                    <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 px-2.5 py-2 border border-zinc-200 dark:border-zinc-800">
                                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">Storage</div>
                                        <div className="mt-0.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                                            {formatStorage(profile.min_storage_gb)}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                    {profile.requires_gpu ? (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-[#026eff]/20 text-[11px] font-medium bg-[#026eff]/10 text-[#026eff] dark:text-sky-400">
                                            <span className="w-1.5 h-1.5 rounded-sm bg-[#026eff] dark:bg-sky-400" />
                                            GPU: {gpuTierLabels[profile.min_gpu_tier] || profile.min_gpu_tier}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                            Standard Graphics
                                        </span>
                                    )}

                                    {profile.portability_required && (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-emerald-500/20 text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                            <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />
                                            Portable
                                        </span>
                                    )}
                                </div>

                                {/* Operational Readiness Footer */}
                                <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 text-[11px]">
                                    {(profile.eligible_stock_count ?? 0) > 0 ? (
                                        <span className="font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                                            {profile.eligible_stock_count} ready in stock
                                        </span>
                                    ) : (
                                        <span className="font-medium text-amber-600 dark:text-amber-400">
                                            0 in stock — procure
                                        </span>
                                    )}

                                    <span className="inline-flex items-center gap-1 font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-[#026eff] dark:group-hover:text-sky-400 transition">
                                        <span>Inspect</span>
                                        <RiArrowRightUpLine className="w-3.5 h-3.5" />
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Matrix Comparison Table View */
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                <tr>
                                    <th className="py-3 px-4">Role Baseline</th>
                                    <th className="py-3 px-4">Min CPU</th>
                                    <th className="py-3 px-4">Min RAM</th>
                                    <th className="py-3 px-4">Storage</th>
                                    <th className="py-3 px-4">GPU &amp; Mobility</th>
                                    <th className="py-3 px-4">Staff &amp; Compliance</th>
                                    <th className="py-3 px-4">Stockroom Ready</th>
                                    <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                                {filteredProfiles.map((profile) => (
                                    <tr
                                        key={profile.id}
                                        onClick={() => setInspectProfileId(profile.id)}
                                        className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                                    >
                                        <td className="py-3.5 px-4 align-top max-w-[260px]">
                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-[13px]">
                                                {profile.name}
                                            </div>
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                                                {profile.description || 'Standard hardware provisioning baseline.'}
                                            </p>
                                        </td>

                                        <td className="py-3.5 px-4 align-top font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                                            {cpuTierLabels[profile.min_cpu_tier] || profile.min_cpu_tier}
                                        </td>

                                        <td className="py-3.5 px-4 align-top font-mono font-medium text-zinc-900 dark:text-zinc-100 tabular-nums whitespace-nowrap">
                                            {profile.min_ram_gb} GB
                                        </td>

                                        <td className="py-3.5 px-4 align-top font-mono font-medium text-zinc-900 dark:text-zinc-100 tabular-nums whitespace-nowrap">
                                            {formatStorage(profile.min_storage_gb)}
                                        </td>

                                        <td className="py-3.5 px-4 align-top">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {profile.requires_gpu ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-[#026eff]/20 text-[10px] font-medium bg-[#026eff]/10 text-[#026eff] dark:text-sky-400">
                                                        GPU: {gpuTierLabels[profile.min_gpu_tier] || profile.min_gpu_tier}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                                        Standard
                                                    </span>
                                                )}
                                                {profile.portability_required && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-emerald-500/20 text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                                        Laptop Only
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                                            <div className="flex flex-col items-start gap-1">
                                                <span className="text-zinc-700 dark:text-zinc-300 font-medium tabular-nums">
                                                    {pluralize(profile.employees_count ?? 0, 'employee', 'employees')}
                                                </span>
                                                {renderComplianceBadge(profile)}
                                            </div>
                                        </td>

                                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                                            {(profile.eligible_stock_count ?? 0) > 0 ? (
                                                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                                                    {profile.eligible_stock_count} eligible unit{profile.eligible_stock_count === 1 ? '' : 's'}
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                                    0 in stock
                                                </span>
                                            )}
                                        </td>

                                        <td
                                            className="py-3.5 px-4 align-top text-right whitespace-nowrap"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="inline-flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setInspectProfileId(profile.id)}
                                                    className="px-2.5 py-1 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:border-[#026eff] hover:text-[#026eff] dark:hover:text-sky-400 transition cursor-pointer"
                                                >
                                                    Inspect
                                                </button>
                                                {isAdminOrManager && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => openCloneModal(profile)}
                                                            className="p-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                                            title="Clone profile"
                                                        >
                                                            <RiFileCopyLine className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditModal(profile)}
                                                            className="p-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                                            title="Edit profile"
                                                        >
                                                            <RiEditLine className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleteTarget(profile)}
                                                            className="p-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                                                            title="Delete profile"
                                                        >
                                                            <RiDeleteBinLine className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Role Profile Detail Inspector Modal */}
            <Modal show={Boolean(inspectProfile)} onClose={() => setInspectProfileId(null)} maxWidth="2xl">
                <div className="p-6">
                    <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                                    {inspectProfile?.name}
                                </h2>
                                {inspectProfile && renderComplianceBadge(inspectProfile)}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 tabular-nums">
                                    <RiGroupLine className="w-3 h-3" />
                                    {pluralize(inspectProfile?.employees_count ?? 0, 'employee', 'employees')}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                                {inspectProfile?.description || 'Standard hardware provisioning baseline for this organizational role.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setInspectProfileId(null)}
                            className="p-1.5 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
                            aria-label="Close modal"
                        >
                            <RiCloseLine className="w-4 h-4" />
                        </button>
                    </div>

                    {inspectProfile && (
                        <div className="mt-4 max-h-[58vh] overflow-y-auto space-y-5 pr-1">
                            {/* 4-Card Hardware Thresholds */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3 rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                        <RiCpuLine className="w-3.5 h-3.5" />
                                        <span>CPU Tier</span>
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                        {cpuTierLabels[inspectProfile.min_cpu_tier] || inspectProfile.min_cpu_tier}
                                    </div>
                                </div>

                                <div className="p-3 rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                        <RiRam2Line className="w-3.5 h-3.5" />
                                        <span>Memory</span>
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                                        {inspectProfile.min_ram_gb} GB
                                    </div>
                                </div>

                                <div className="p-3 rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                        <RiHardDrive2Line className="w-3.5 h-3.5" />
                                        <span>Storage</span>
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                                        {formatStorage(inspectProfile.min_storage_gb)}
                                    </div>
                                </div>

                                <div className="p-3 rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                        <RiMacbookLine className="w-3.5 h-3.5" />
                                        <span>Form Factor</span>
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                        {inspectProfile.portability_required ? 'Laptop Only' : 'Any'}
                                    </div>
                                </div>
                            </div>

                            {/* Graphics Requirement Banner */}
                            <div className="p-3.5 rounded-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                        Graphics Requirement
                                    </div>
                                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        {inspectProfile.requires_gpu
                                            ? `Requires ${gpuTierLabels[inspectProfile.min_gpu_tier] || inspectProfile.min_gpu_tier} tier GPU acceleration.`
                                            : 'Dedicated graphics acceleration is not mandatory for this role.'}
                                    </div>
                                </div>
                                <span
                                    className={`px-2.5 py-1 rounded-sm border text-[11px] font-medium shrink-0 ${
                                        inspectProfile.requires_gpu
                                            ? 'bg-[#026eff]/10 border-[#026eff]/20 text-[#026eff] dark:text-sky-400'
                                            : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                                    }`}
                                >
                                    {inspectProfile.requires_gpu
                                        ? gpuTierLabels[inspectProfile.min_gpu_tier] || inspectProfile.min_gpu_tier
                                        : 'Optional'}
                                </span>
                            </div>

                            {/* Assigned Workforce Roster */}
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                        Assigned Workforce ({inspectProfile.roster?.length || 0})
                                    </div>
                                    <Link
                                        href={route('employees.index', { role_profile_id: inspectProfile.id })}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#026eff] dark:text-sky-400 hover:underline"
                                    >
                                        <span>Open in Employees</span>
                                        <RiArrowRightUpLine className="w-3 h-3" />
                                    </Link>
                                </div>

                                {(!inspectProfile.roster || inspectProfile.roster.length === 0) ? (
                                    <div className="p-4 rounded-sm border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400 dark:text-zinc-500">
                                        No staff members currently mapped to this role baseline.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-sm">
                                        {inspectProfile.roster.map((member) => {
                                            const badge = fitBadgeStyle[member.fit_status] || fitBadgeStyle.unassigned;

                                            return (
                                                <div
                                                    key={member.id}
                                                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-zinc-900"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                                {member.name}
                                                            </span>
                                                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                                                {member.department}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                            {member.device_id ? (
                                                                <Link
                                                                    href={route('devices.show', member.device_id)}
                                                                    className="hover:text-[#026eff] dark:hover:text-sky-400 transition inline-flex items-center gap-1.5"
                                                                >
                                                                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                                                        {member.asset_tag}
                                                                    </span>
                                                                    <span>&bull;</span>
                                                                    <span>{member.device_name}</span>
                                                                </Link>
                                                            ) : (
                                                                <span className="text-zinc-400 dark:text-zinc-500">
                                                                    No compute hardware assigned
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[10px] font-medium shrink-0 tabular-nums ${badge.className}`}
                                                    >
                                                        {member.fit_status === 'compliant' && (
                                                            <RiCheckDoubleLine className="w-3 h-3" />
                                                        )}
                                                        <span>
                                                            {badge.label}
                                                            {member.fit_score_pct !== null ? ` (${member.fit_score_pct}%)` : ''}
                                                        </span>
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Eligible Stockroom Units */}
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                                        Eligible Stockroom Units ({inspectProfile.eligible_stock_count ?? 0})
                                    </div>
                                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                                        Meets &ge; {match_threshold_pct}% threshold
                                    </span>
                                </div>

                                {(!inspectProfile.eligible_stock_preview || inspectProfile.eligible_stock_preview.length === 0) ? (
                                    <div className="p-4 rounded-sm border border-amber-500/25 bg-amber-500/5 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                                        <RiComputerLine className="w-4 h-4 shrink-0 mt-0.5" />
                                        <div>
                                            <div className="font-medium">No ready stockroom units qualify for this baseline</div>
                                            <p className="text-[11px] opacity-90 mt-0.5">
                                                New hires or hardware replacements for {inspectProfile.name} will require new procurement or a bridge swap.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-sm">
                                        {inspectProfile.eligible_stock_preview.map((unit) => (
                                            <div
                                                key={unit.id}
                                                className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-zinc-900"
                                            >
                                                <div className="min-w-0">
                                                    <Link
                                                        href={route('devices.show', unit.id)}
                                                        className="text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:text-[#026eff] dark:hover:text-sky-400 inline-flex items-center gap-1.5"
                                                    >
                                                        <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                                                            {unit.asset_tag}
                                                        </span>
                                                        <span>
                                                            {unit.brand} {unit.model}
                                                        </span>
                                                        <RiArrowRightUpLine className="w-3 h-3 shrink-0" />
                                                    </Link>
                                                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                                                        {cpuTierLabels[unit.cpu_tier] || unit.cpu_tier} &bull; {unit.ram_gb}GB RAM &bull;{' '}
                                                        {formatStorage(unit.storage_gb)}
                                                        {unit.location ? ` • ${unit.location}` : ''}
                                                    </div>
                                                </div>

                                                <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0">
                                                    {unit.score_pct}% match
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                            {inspectProfile && (
                                <Link
                                    href={route('employees.index', { role_profile_id: inspectProfile.id })}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-[#026eff] dark:hover:text-sky-400 transition"
                                >
                                    <span>View Staff</span>
                                    <RiArrowRightUpLine className="w-3.5 h-3.5" />
                                </Link>
                            )}
                            <Link
                                href={route('mismatches.index')}
                                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-[#026eff] dark:hover:text-sky-400 transition"
                            >
                                <span>Mismatch Audit</span>
                                <RiArrowRightUpLine className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 ml-auto">
                            <SecondaryButton type="button" onClick={() => setInspectProfileId(null)}>
                                Close
                            </SecondaryButton>
                            {isAdminOrManager && inspectProfile && (
                                <>
                                    <SecondaryButton
                                        type="button"
                                        onClick={() => {
                                            const target = inspectProfile;
                                            setInspectProfileId(null);
                                            openCloneModal(target);
                                        }}
                                    >
                                        Clone
                                    </SecondaryButton>
                                    <PrimaryButton
                                        type="button"
                                        onClick={() => {
                                            const target = inspectProfile;
                                            setInspectProfileId(null);
                                            openEditModal(target);
                                        }}
                                    >
                                        Edit Specifications
                                    </PrimaryButton>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Create / Edit / Clone Role Profile Modal */}
            <Modal show={showModal} onClose={closeModal} maxWidth="lg">
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div>
                            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                                {editingProfile ? `Edit ${editingProfile.name}` : 'Create Role Profile'}
                            </h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Define hardware baselines evaluated by automated recommendation scoring.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={closeModal}
                            className="p-1.5 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                            aria-label="Close modal"
                        >
                            <RiCloseLine className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="mt-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <InputLabel htmlFor="rp_name" value="Profile Name *" />
                                <TextInput
                                    id="rp_name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className="mt-1.5 block w-full text-xs"
                                    placeholder="e.g. ML Engineer"
                                    required
                                />
                                <InputError message={errors.name} className="mt-1" />
                            </div>

                            <div>
                                <InputLabel htmlFor="rp_cpu" value="Minimum CPU Tier *" />
                                <div className="mt-1.5">
                                    <CustomSelect
                                        value={data.min_cpu_tier}
                                        onChange={(val) => setData('min_cpu_tier', val)}
                                        options={[
                                            { value: 'entry', label: 'Entry Tier (Core i3 / Ryzen 3)' },
                                            { value: 'mid', label: 'Mid Tier (Core i5 / Ryzen 5)' },
                                            { value: 'high', label: 'High Tier (Core i7 / M-Pro)' },
                                            { value: 'workstation', label: 'Workstation (Core i9 / Ultra / Max)' },
                                        ]}
                                    />
                                </div>
                                <InputError message={errors.min_cpu_tier} className="mt-1" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <InputLabel htmlFor="rp_ram" value="Minimum RAM (GB) *" />
                                <TextInput
                                    id="rp_ram"
                                    type="number"
                                    min="4"
                                    value={data.min_ram_gb}
                                    onChange={(e) => setData('min_ram_gb', e.target.value)}
                                    className="mt-1.5 block w-full text-xs font-mono tabular-nums"
                                    required
                                />
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    {ramPresets.map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setData('min_ram_gb', preset)}
                                            className={`px-2 py-0.5 rounded-sm border text-[10px] font-medium tabular-nums transition cursor-pointer ${
                                                Number(data.min_ram_gb) === preset
                                                    ? 'border-[#026eff] bg-[#026eff]/10 text-[#026eff] dark:text-sky-400'
                                                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                            }`}
                                        >
                                            {preset} GB
                                        </button>
                                    ))}
                                </div>
                                <InputError message={errors.min_ram_gb} className="mt-1" />
                            </div>

                            <div>
                                <InputLabel htmlFor="rp_storage" value="Minimum Storage (GB) *" />
                                <TextInput
                                    id="rp_storage"
                                    type="number"
                                    min="64"
                                    value={data.min_storage_gb}
                                    onChange={(e) => setData('min_storage_gb', e.target.value)}
                                    className="mt-1.5 block w-full text-xs font-mono tabular-nums"
                                    required
                                />
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    {storagePresets.map((preset) => (
                                        <button
                                            key={preset.value}
                                            type="button"
                                            onClick={() => setData('min_storage_gb', preset.value)}
                                            className={`px-2 py-0.5 rounded-sm border text-[10px] font-medium tabular-nums transition cursor-pointer ${
                                                Number(data.min_storage_gb) === preset.value
                                                    ? 'border-[#026eff] bg-[#026eff]/10 text-[#026eff] dark:text-sky-400'
                                                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                            }`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                                <InputError message={errors.min_storage_gb} className="mt-1" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="flex items-start gap-2.5 p-3 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 cursor-pointer">
                                <Checkbox
                                    checked={data.requires_gpu}
                                    onChange={(e) =>
                                        setData((prev) => ({
                                            ...prev,
                                            requires_gpu: e.target.checked,
                                            min_gpu_tier: e.target.checked
                                                ? prev.min_gpu_tier === 'none'
                                                    ? 'dedicated-entry'
                                                    : prev.min_gpu_tier
                                                : 'none',
                                        }))
                                    }
                                    className="mt-0.5"
                                />
                                <div>
                                    <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                        GPU Acceleration Required
                                    </div>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        Enforce minimum graphics compute tier.
                                    </p>
                                </div>
                            </label>

                            <label className="flex items-start gap-2.5 p-3 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 cursor-pointer">
                                <Checkbox
                                    checked={data.portability_required}
                                    onChange={(e) => setData('portability_required', e.target.checked)}
                                    className="mt-0.5"
                                />
                                <div>
                                    <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                        Portability Required
                                    </div>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        Restrict to mobile form factors (laptops).
                                    </p>
                                </div>
                            </label>
                        </div>

                        {data.requires_gpu && (
                            <div>
                                <InputLabel htmlFor="rp_gpu_tier" value="Minimum GPU Tier *" />
                                <div className="mt-1.5">
                                    <CustomSelect
                                        value={data.min_gpu_tier}
                                        onChange={(val) => setData('min_gpu_tier', val)}
                                        options={[
                                            { value: 'integrated', label: 'Integrated Graphics (Apple Silicon / Iris)' },
                                            { value: 'dedicated-entry', label: 'Dedicated Entry (RTX 3050 / 4050)' },
                                            { value: 'dedicated-high', label: 'Dedicated High (RTX 4070+ / Quadro)' },
                                        ]}
                                    />
                                </div>
                                <InputError message={errors.min_gpu_tier} className="mt-1" />
                            </div>
                        )}

                        <div>
                            <InputLabel htmlFor="rp_desc" value="Workload & Software Context" />
                            <textarea
                                id="rp_desc"
                                rows={3}
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                placeholder="Outline primary tools, IDEs, containers, or rendering workloads..."
                                className="mt-1.5 block w-full rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 py-2 px-3 focus:outline-none focus:border-[#026eff] focus:ring-0"
                            />
                            <InputError message={errors.description} className="mt-1" />
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                        <SecondaryButton type="button" onClick={closeModal}>
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton type="submit" disabled={processing}>
                            {processing ? 'Saving...' : editingProfile ? 'Save Profile' : 'Create Profile'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            {/* Safe Delete Confirmation Modal */}
            <Modal show={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="sm">
                <div className="p-6">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {(deleteTarget?.employees_count ?? 0) > 0
                            ? 'Role Baseline In Use'
                            : 'Delete Role Profile'}
                    </h3>

                    {(deleteTarget?.employees_count ?? 0) > 0 ? (
                        <>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                    {deleteTarget?.name}
                                </span>{' '}
                                is currently assigned to{' '}
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                    {pluralize(deleteTarget?.employees_count ?? 0, 'employee', 'employees')}
                                </span>
                                . Reassign those staff members to another role baseline before deleting it.
                            </p>
                            <div className="mt-5 flex items-center justify-end gap-2">
                                <SecondaryButton type="button" onClick={() => setDeleteTarget(null)}>
                                    Cancel
                                </SecondaryButton>
                                <Link
                                    href={route('employees.index', { role_profile_id: deleteTarget?.id })}
                                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-xs font-medium text-white transition"
                                >
                                    <span>Reassign Staff</span>
                                    <RiArrowRightUpLine className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                                Permanently remove the{' '}
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                    {deleteTarget?.name}
                                </span>{' '}
                                hardware baseline? This action cannot be undone.
                            </p>
                            <div className="mt-5 flex items-center justify-end gap-2">
                                <SecondaryButton type="button" onClick={() => setDeleteTarget(null)}>
                                    Cancel
                                </SecondaryButton>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="px-3.5 py-2 rounded-sm border border-rose-600 bg-rose-600 hover:bg-rose-700 text-xs font-medium text-white transition cursor-pointer disabled:opacity-50"
                                >
                                    {deleting ? 'Deleting...' : 'Delete Baseline'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
