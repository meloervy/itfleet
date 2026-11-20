import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Checkbox from '@/Components/Checkbox';
import CustomSelect from '@/Components/CustomSelect';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import Pagination from '@/Components/Pagination';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { formatDisplayDate, formatPhp, toDateInputValue } from '@/lib/formatters';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    RiAddLine,
    RiArrowDownSLine,
    RiArrowRightUpLine,
    RiArrowUpDownLine,
    RiArrowUpSLine,
    RiCalendarLine,
    RiCloseLine,
    RiComputerLine,
    RiEditLine,
    RiRefreshLine,
    RiSearchLine,
    RiToolsLine,
} from 'react-icons/ri';

const statusBadgeMap = {
    scheduled: {
        label: 'Scheduled',
        pill: 'bg-[#026eff]/10 border-[#026eff]/20 text-[#026eff] dark:text-sky-400',
        dot: 'bg-[#026eff] dark:bg-sky-400',
    },
    in_progress: {
        label: 'In Progress',
        pill: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
        dot: 'bg-amber-500',
    },
    completed: {
        label: 'Completed',
        pill: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
        dot: 'bg-emerald-500',
    },
    cancelled: {
        label: 'Cancelled',
        pill: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400',
        dot: 'bg-zinc-400',
    },
};

const typeLabelMap = {
    repair: {
        label: 'Repair',
        className: 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400',
    },
    upgrade: {
        label: 'Upgrade',
        className: 'bg-[#026eff]/10 border-[#026eff]/20 text-[#026eff] dark:text-sky-400',
    },
    preventive: {
        label: 'Preventive',
        className: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    },
    inspection: {
        label: 'Inspection',
        className: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300',
    },
    replacement: {
        label: 'Replacement',
        className: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
    },
};

const serviceTypeOptions = [
    { value: 'repair', label: 'Repair' },
    { value: 'upgrade', label: 'Hardware Upgrade' },
    { value: 'preventive', label: 'Preventive Servicing' },
    { value: 'inspection', label: 'Inspection / Audit' },
    { value: 'replacement', label: 'Component Replacement' },
];

function getTodayDateInputValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export default function MaintenanceIndex({
    logs,
    stats = {},
    filters = {},
    devices = [],
    can_view_financials = true,
    financials_restricted = false,
}) {
    const { auth } = usePage().props;
    const user = auth?.user;
    const canViewFinancials = Boolean(can_view_financials) && !financials_restricted && user?.role !== 'technician';
    const canUpdate = ['admin', 'manager', 'technician'].includes(user?.role);

    const [search, setSearch] = useState(filters.search || '');
    const [type, setType] = useState(filters.type || '');
    const [status, setStatus] = useState(filters.status || '');
    const [selectedLogToUpdate, setSelectedLogToUpdate] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const isFirstRender = useRef(true);

    const {
        data,
        setData,
        put,
        processing,
        errors,
        reset,
        clearErrors,
    } = useForm({
        cost: 0,
        completed_at: getTodayDateInputValue(),
        performance_assessment: '',
        status: 'completed',
        restore_to_available: true,
    });

    const {
        data: createData,
        setData: setCreateData,
        post: postCreate,
        processing: createProcessing,
        errors: createErrors,
        reset: resetCreate,
        clearErrors: clearCreateErrors,
    } = useForm({
        device_id: '',
        type: 'repair',
        title: '',
        description: '',
        cost: 0,
        performed_by: '',
        started_at: getTodayDateInputValue(),
        status: 'in_progress',
        send_to_maintenance_stage: true,
    });

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = setTimeout(() => {
            router.get(
                route('maintenance.index'),
                {
                    search,
                    type,
                    status,
                    sort: filters?.sort,
                    direction: filters?.direction,
                },
                { preserveState: true, replace: true, preserveScroll: true }
            );
        }, 300);

        return () => clearTimeout(timer);
    }, [search, type, status]);

    const handleSort = (sortKey) => {
        const currentSort = filters.sort || 'started_at';
        const currentDirection = filters.direction || 'desc';
        const nextDirection = currentSort === sortKey && currentDirection === 'asc' ? 'desc' : 'asc';

        router.get(
            route('maintenance.index'),
            {
                search,
                type,
                status,
                sort: sortKey,
                direction: nextDirection,
            },
            { preserveState: true, replace: true, preserveScroll: true }
        );
    };

    const clearFilters = () => {
        setSearch('');
        setType('');
        setStatus('');
        router.get(route('maintenance.index'), {}, { preserveState: true, replace: true });
    };

    const openUpdateModal = (log) => {
        clearErrors();
        setSelectedLogToUpdate(log);
        setData({
            cost: canViewFinancials ? (log.cost ?? 0) : '',
            completed_at: toDateInputValue(log.completed_at) || getTodayDateInputValue(),
            performance_assessment: log.performance_assessment || '',
            status: log.status === 'scheduled' || log.status === 'in_progress' ? 'completed' : log.status,
            restore_to_available: log.device?.lifecycle_stage === 'maintenance',
        });
    };

    const closeUpdateModal = () => {
        setSelectedLogToUpdate(null);
        reset();
        clearErrors();
    };

    const handleUpdateSubmit = (e) => {
        e.preventDefault();
        if (!selectedLogToUpdate) return;
        put(route('maintenance.update', selectedLogToUpdate.id), {
            preserveScroll: true,
            onSuccess: () => closeUpdateModal(),
        });
    };

    const openCreateModal = () => {
        clearCreateErrors();
        setCreateData({
            device_id: devices[0]?.id ? String(devices[0].id) : '',
            type: 'repair',
            title: '',
            description: '',
            cost: 0,
            performed_by: '',
            started_at: getTodayDateInputValue(),
            status: 'in_progress',
            send_to_maintenance_stage: true,
        });
        setShowCreateModal(true);
    };

    const closeCreateModal = () => {
        setShowCreateModal(false);
        resetCreate();
        clearCreateErrors();
    };

    const handleCreateSubmit = (e) => {
        e.preventDefault();
        if (!createData.device_id) return;
        postCreate(route('devices.maintenance.store', createData.device_id), {
            preserveScroll: true,
            onSuccess: () => closeCreateModal(),
        });
    };

    const renderSortHeader = (label, sortKey) => {
        const activeSort = filters.sort || 'started_at';
        const isActive = activeSort === sortKey;
        const direction = filters.direction || 'desc';

        return (
            <button
                type="button"
                onClick={() => handleSort(sortKey)}
                className={`inline-flex items-center gap-1 text-[11px] font-medium transition cursor-pointer ${
                    isActive
                        ? 'text-zinc-900 dark:text-zinc-100'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
            >
                <span>{label}</span>
                {isActive ? (
                    direction === 'asc' ? (
                        <RiArrowUpSLine className="w-3.5 h-3.5 text-[#026eff] dark:text-sky-400" />
                    ) : (
                        <RiArrowDownSLine className="w-3.5 h-3.5 text-[#026eff] dark:text-sky-400" />
                    )
                ) : (
                    <RiArrowUpDownLine className="w-3 h-3 opacity-50" />
                )}
            </button>
        );
    };

    const activeFilterCount = [search, type, status].filter(Boolean).length;
    const isTimelineSortActive = ['started_at', 'timeline'].includes(filters.sort || 'started_at');

    const statusTabs = [
        { key: '', label: 'All', count: stats.total_count ?? logs?.total ?? 0 },
        { key: 'active', label: 'Active Queue', count: stats.active_count ?? 0 },
        { key: 'scheduled', label: 'Scheduled', count: stats.scheduled_count ?? 0 },
        { key: 'in_progress', label: 'In Progress', count: stats.in_progress_count ?? 0 },
        { key: 'completed', label: 'Completed', count: stats.completed_count ?? 0 },
        { key: 'cancelled', label: 'Cancelled', count: stats.cancelled_count ?? 0 },
    ];

    const deviceOptions = devices.map((d) => ({
        value: String(d.id),
        label: `${d.asset_tag} — ${d.brand} ${d.model}`,
        badge: d.lifecycle_stage === 'maintenance' ? 'In Service' : String(d.status || 'available').replace('_', ' '),
    }));

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Maintenance &amp; Servicing Hub
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            {canViewFinancials
                                ? 'Centralized repair queue, preventive upgrades, expenditure ledger, and post-repair checks.'
                                : 'Centralized repair queue, preventive upgrades, and post-repair performance checks.'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Link
                            href={route('devices.index')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                        >
                            <RiComputerLine className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                            <span>Inspect Fleet Devices</span>
                        </Link>
                        {canUpdate && (
                            <button
                                type="button"
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-xs font-medium text-white transition cursor-pointer"
                            >
                                <RiAddLine className="w-3.5 h-3.5" />
                                <span>Log Servicing</span>
                            </button>
                        )}
                    </div>
                </div>
            }
        >
            <Head title="Maintenance Hub - ITFleet" />

            {/* 4 Operational KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <button
                    type="button"
                    onClick={() => setStatus((prev) => (prev === 'active' ? '' : 'active'))}
                    className={`text-left rounded-sm border p-4 transition cursor-pointer ${
                        status === 'active'
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-400 dark:border-amber-700 ring-1 ring-amber-400/30'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Active Queue
                        </span>
                        {(stats.active_count ?? 0) > 0 && (
                            <span className="w-1.5 h-1.5 rounded-sm bg-amber-500" />
                        )}
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {stats.active_count ?? 0}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {stats.in_progress_count ?? 0} in progress &middot; {stats.scheduled_count ?? 0} scheduled
                    </div>
                </button>

                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            In Service Bay
                        </span>
                        <span className="w-1.5 h-1.5 rounded-sm bg-[#026eff]" />
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {stats.in_service_bay_count ?? 0}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Units currently off-floor in repair
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setStatus((prev) => (prev === 'completed' ? '' : 'completed'))}
                    className={`text-left rounded-sm border p-4 transition cursor-pointer ${
                        status === 'completed'
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-700 ring-1 ring-emerald-400/30'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Completed Logs
                        </span>
                        <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {stats.completed_count ?? 0}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Closed repairs &amp; preventive checks
                    </div>
                </button>

                {canViewFinancials ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4">
                        <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Completed Servicing Spend
                        </div>
                        <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                            {formatPhp(stats.total_spend ?? 0)}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                            Cumulative closed repair &amp; upgrade cost
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setStatus((prev) => (prev === 'scheduled' ? '' : 'scheduled'))}
                        className={`text-left rounded-sm border p-4 transition cursor-pointer ${
                            status === 'scheduled'
                                ? 'bg-[#026eff]/5 dark:bg-sky-950/20 border-[#026eff] ring-1 ring-[#026eff]/30'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                Scheduled Queue
                            </span>
                            <span className="w-1.5 h-1.5 rounded-sm bg-[#026eff]" />
                        </div>
                        <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                            {stats.scheduled_count ?? 0}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                            Upcoming scheduled inspections &amp; repairs
                        </div>
                    </button>
                )}
            </div>

            {/* Status Tabs & Streamlined Filter Card */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4 mb-5 space-y-3">
                {/* 1-Click Status Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    {statusTabs.map((tab) => {
                        const isActive = status === tab.key;
                        return (
                            <button
                                key={tab.key || 'all'}
                                type="button"
                                onClick={() => setStatus(tab.key)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-xs font-medium transition cursor-pointer ${
                                    isActive
                                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                }`}
                            >
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

                {/* Search + Service Type + Timeline Sort / Reset */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-2 lg:col-span-6 relative">
                        <RiSearchLine className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search activity, asset tag, model, technician..."
                            className="w-full pl-9 pr-8 py-2 text-xs rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-[#026eff] focus:ring-0"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                aria-label="Clear search"
                            >
                                <RiCloseLine className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="lg:col-span-3">
                        <CustomSelect
                            value={type}
                            onChange={setType}
                            variant="filter"
                            placeholder="All service types"
                            options={[
                                { value: '', label: 'All service types' },
                                { value: 'repair', label: 'Repair' },
                                { value: 'upgrade', label: 'Upgrade' },
                                { value: 'preventive', label: 'Preventive' },
                                { value: 'inspection', label: 'Inspection' },
                                { value: 'replacement', label: 'Replacement' },
                            ]}
                        />
                    </div>

                    <div className="lg:col-span-3 flex items-center justify-between sm:justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => handleSort('started_at')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm border text-[11px] font-medium transition cursor-pointer ${
                                isTimelineSortActive
                                    ? 'border-[#026eff]/30 bg-[#026eff]/5 text-[#026eff] dark:text-sky-400'
                                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            }`}
                            title="Sort by servicing start date"
                        >
                            <RiCalendarLine className="w-3.5 h-3.5" />
                            <span>Timeline</span>
                        </button>

                        <span className="text-[11px] font-medium px-2 py-1 rounded-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 tabular-nums">
                            {logs.total} records
                        </span>

                        {activeFilterCount > 0 && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                title="Clear filters"
                            >
                                <RiRefreshLine className="w-3.5 h-3.5" />
                                <span>Clear filters</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Responsive Maintenance Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {logs.data.length === 0 ? (
                    <div className="p-12 text-center">
                        <RiToolsLine className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            No maintenance logs found
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {activeFilterCount > 0
                                ? 'No servicing tickets match the active search or status filters.'
                                : 'Record repairs, hardware upgrades, or preventive inspections across the fleet.'}
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2">
                            {activeFilterCount > 0 ? (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="px-3.5 py-1.5 rounded-sm border border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white transition cursor-pointer"
                                >
                                    Clear filters
                                </button>
                            ) : (
                                canUpdate && (
                                    <button
                                        type="button"
                                        onClick={openCreateModal}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white text-xs font-medium transition cursor-pointer"
                                    >
                                        <RiAddLine className="w-3.5 h-3.5" />
                                        <span>Log Servicing</span>
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                <tr>
                                    <th className="py-3 px-4">{renderSortHeader('Hardware Unit', 'device')}</th>
                                    <th className="py-3 px-4">{renderSortHeader('Service Activity', 'activity')}</th>
                                    <th className="py-3 px-4">{renderSortHeader('Technician & Dates', 'technician')}</th>
                                    {canViewFinancials && (
                                        <th className="py-3 px-4 text-right">{renderSortHeader('Cost', 'cost')}</th>
                                    )}
                                    <th className="py-3 px-4">{renderSortHeader('Status', 'status')}</th>
                                    <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                                {logs.data.map((log) => {
                                    const statusInfo = statusBadgeMap[log.status] || statusBadgeMap.scheduled;
                                    const typeInfo = typeLabelMap[log.type] || typeLabelMap.repair;
                                    const device = log.device;
                                    const isActiveLog = log.status === 'scheduled' || log.status === 'in_progress';

                                    return (
                                        <tr
                                            key={log.id}
                                            onClick={canUpdate ? () => openUpdateModal(log) : undefined}
                                            className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors ${
                                                canUpdate ? 'cursor-pointer' : ''
                                            }`}
                                        >
                                            <td className="py-3.5 px-4 align-top min-w-[175px]">
                                                {device ? (
                                                    <div>
                                                        <Link
                                                            href={route('devices.show', device.id)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-[#026eff] dark:hover:text-sky-400 transition inline-flex items-center gap-1"
                                                        >
                                                            <span>
                                                                {device.brand} {device.model}
                                                            </span>
                                                        </Link>
                                                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                                            <span className="font-mono tabular-nums">{device.asset_tag}</span>
                                                            {device.lifecycle_stage === 'maintenance' && (
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-medium">
                                                                    In service bay
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-400 dark:text-zinc-500">Removed device</span>
                                                )}
                                            </td>

                                            <td className="py-3.5 px-4 align-top max-w-[340px]">
                                                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                                    <span
                                                        className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[10px] font-medium shrink-0 ${typeInfo.className}`}
                                                    >
                                                        {typeInfo.label}
                                                    </span>
                                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                                        {log.title}
                                                    </span>
                                                </div>
                                                {log.description && (
                                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                                                        {log.description}
                                                    </p>
                                                )}
                                                {log.performance_assessment && (
                                                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 line-clamp-1">
                                                        Assessment: {log.performance_assessment}
                                                    </p>
                                                )}
                                            </td>

                                            <td className="py-3.5 px-4 align-top min-w-[170px]">
                                                <div className="text-xs text-zinc-800 dark:text-zinc-200 font-medium">
                                                    {log.performed_by || 'Internal IT'}
                                                </div>
                                                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 tabular-nums whitespace-nowrap">
                                                    {formatDisplayDate(log.started_at)}
                                                    {log.completed_at ? ` → ${formatDisplayDate(log.completed_at)}` : ''}
                                                </div>
                                            </td>

                                            {canViewFinancials && (
                                                <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                                                    {formatPhp(log.cost)}
                                                </td>
                                            )}

                                            <td className="py-3.5 px-4 align-top whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[11px] font-medium ${statusInfo.pill}`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-sm ${statusInfo.dot}`} />
                                                    {statusInfo.label}
                                                </span>
                                            </td>

                                            <td
                                                className="py-3.5 px-4 align-top text-right whitespace-nowrap"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {canUpdate ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openUpdateModal(log)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:border-[#026eff] hover:text-[#026eff] dark:hover:text-sky-400 transition cursor-pointer"
                                                    >
                                                        <RiEditLine className="w-3.5 h-3.5" />
                                                        <span>{isActiveLog ? 'Assess' : 'Edit'}</span>
                                                    </button>
                                                ) : device ? (
                                                    <Link
                                                        href={route('devices.show', device.id)}
                                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-[#026eff] dark:hover:text-sky-400 transition"
                                                    >
                                                        <span>View</span>
                                                        <RiArrowRightUpLine className="w-3 h-3" />
                                                    </Link>
                                                ) : (
                                                    <span className="text-zinc-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Pagination
                links={logs.links}
                from={logs.from}
                to={logs.to}
                total={logs.total}
                label="maintenance records"
            />

            {/* Assess & Update Servicing Modal */}
            <Modal show={Boolean(selectedLogToUpdate)} onClose={closeUpdateModal} maxWidth="lg">
                <form onSubmit={handleUpdateSubmit} className="p-6">
                    <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="min-w-0">
                            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                                Assess &amp; Update Servicing
                            </h2>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                <span>
                                    {selectedLogToUpdate?.device?.brand} {selectedLogToUpdate?.device?.model}
                                </span>
                                {selectedLogToUpdate?.device?.asset_tag && (
                                    <>
                                        <span>&bull;</span>
                                        <span className="font-mono">{selectedLogToUpdate.device.asset_tag}</span>
                                    </>
                                )}
                                {selectedLogToUpdate?.device?.id && (
                                    <Link
                                        href={route('devices.show', selectedLogToUpdate.device.id)}
                                        className="inline-flex items-center gap-0.5 text-[#026eff] dark:text-sky-400 hover:underline font-medium"
                                    >
                                        <span>Open asset</span>
                                        <RiArrowRightUpLine className="w-3 h-3" />
                                    </Link>
                                )}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={closeUpdateModal}
                            className="p-1.5 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
                            aria-label="Close modal"
                        >
                            <RiCloseLine className="w-4 h-4" />
                        </button>
                    </div>

                    {selectedLogToUpdate && (
                        <div className="mt-4 p-3 rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[10px] font-medium ${
                                            (typeLabelMap[selectedLogToUpdate.type] || typeLabelMap.repair).className
                                        }`}
                                    >
                                        {(typeLabelMap[selectedLogToUpdate.type] || typeLabelMap.repair).label}
                                    </span>
                                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                        {selectedLogToUpdate.title}
                                    </span>
                                </div>
                                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                                    Started {formatDisplayDate(selectedLogToUpdate.started_at)}
                                </span>
                            </div>
                            {selectedLogToUpdate.description && (
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                    {selectedLogToUpdate.description}
                                </p>
                            )}
                            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                Technician / Vendor:{' '}
                                <span className="text-zinc-600 dark:text-zinc-300 font-medium">
                                    {selectedLogToUpdate.performed_by || 'Internal IT'}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 space-y-4">
                        <div className={`grid grid-cols-1 gap-4 ${canViewFinancials ? 'sm:grid-cols-2' : ''}`}>
                            <div>
                                <InputLabel htmlFor="maint_status" value="Service Status *" />
                                <div className="mt-1.5">
                                    <CustomSelect
                                        value={data.status}
                                        onChange={(val) => setData('status', val)}
                                        options={[
                                            { value: 'scheduled', label: 'Scheduled' },
                                            { value: 'in_progress', label: 'In Progress' },
                                            { value: 'completed', label: 'Completed' },
                                            { value: 'cancelled', label: 'Cancelled' },
                                        ]}
                                    />
                                </div>
                                <InputError message={errors.status} className="mt-1" />
                            </div>

                            {canViewFinancials && (
                                <div>
                                    <InputLabel htmlFor="maint_cost" value="Final Servicing Cost (PHP) *" />
                                    <TextInput
                                        id="maint_cost"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.cost}
                                        onChange={(e) => setData('cost', e.target.value)}
                                        className="mt-1.5 block w-full text-xs font-mono tabular-nums"
                                        required
                                    />
                                    <InputError message={errors.cost} className="mt-1" />
                                </div>
                            )}
                        </div>

                        {data.status === 'completed' && (
                            <div>
                                <InputLabel htmlFor="maint_completed_at" value="Completion Date" />
                                <TextInput
                                    id="maint_completed_at"
                                    type="date"
                                    value={data.completed_at}
                                    onChange={(e) => setData('completed_at', e.target.value)}
                                    className="mt-1.5 block w-full text-xs tabular-nums"
                                />
                                <InputError message={errors.completed_at} className="mt-1" />
                            </div>
                        )}

                        <div>
                            <InputLabel htmlFor="maint_assessment" value="Post-Repair Performance Assessment" />
                            <textarea
                                id="maint_assessment"
                                rows={3}
                                value={data.performance_assessment}
                                onChange={(e) => setData('performance_assessment', e.target.value)}
                                placeholder="Document benchmark stability, thermal health, or replaced parts..."
                                className="mt-1.5 block w-full rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 py-2 px-3 focus:outline-none focus:border-[#026eff] focus:ring-0"
                            />
                            <InputError message={errors.performance_assessment} className="mt-1" />
                        </div>

                        {data.status === 'completed' &&
                            selectedLogToUpdate?.device?.lifecycle_stage === 'maintenance' && (
                                <label className="flex items-start gap-2.5 p-3 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 cursor-pointer">
                                    <Checkbox
                                        checked={data.restore_to_available}
                                        onChange={(e) => setData('restore_to_available', e.target.checked)}
                                        className="mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                            Return device to Deployment Pool
                                        </div>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            Moves unit out of the service bay and restores it to Available or Assigned status.
                                        </p>
                                    </div>
                                </label>
                            )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                        <SecondaryButton type="button" onClick={closeUpdateModal}>
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton type="submit" disabled={processing}>
                            {processing ? 'Updating...' : 'Save Servicing Log'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            {/* Log New Servicing Modal */}
            {canUpdate && (
                <Modal show={showCreateModal} onClose={closeCreateModal} maxWidth="lg">
                    <form onSubmit={handleCreateSubmit} className="p-6">
                        <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                            <div>
                                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                                    Log Maintenance / Servicing
                                </h2>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Schedule a repair, preventive checkup, or component upgrade for any fleet unit.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeCreateModal}
                                className="p-1.5 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
                                aria-label="Close modal"
                            >
                                <RiCloseLine className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="mt-4 space-y-4">
                            <div>
                                <InputLabel value="Hardware Unit *" />
                                <div className="mt-1.5">
                                    <CustomSelect
                                        value={createData.device_id}
                                        onChange={(val) => setCreateData('device_id', val)}
                                        placeholder="Select hardware unit..."
                                        options={deviceOptions}
                                    />
                                </div>
                                {devices.length === 0 && (
                                    <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                                        No active non-retired hardware units found.
                                    </p>
                                )}
                            </div>

                            <div className={`grid grid-cols-1 gap-4 ${canViewFinancials ? 'sm:grid-cols-2' : ''}`}>
                                <div>
                                    <InputLabel value="Activity Type *" />
                                    <div className="mt-1.5">
                                        <CustomSelect
                                            value={createData.type}
                                            onChange={(val) => setCreateData('type', val)}
                                            options={serviceTypeOptions}
                                        />
                                    </div>
                                    <InputError message={createErrors.type} className="mt-1" />
                                </div>

                                {canViewFinancials && (
                                    <div>
                                        <InputLabel htmlFor="create_maint_cost" value="Servicing Cost (PHP) *" />
                                        <TextInput
                                            id="create_maint_cost"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={createData.cost}
                                            onChange={(e) => setCreateData('cost', e.target.value)}
                                            className="mt-1.5 block w-full text-xs font-mono tabular-nums"
                                            required
                                        />
                                        <InputError message={createErrors.cost} className="mt-1" />
                                    </div>
                                )}
                            </div>

                            <div>
                                <InputLabel htmlFor="create_maint_title" value="Service Title *" />
                                <TextInput
                                    id="create_maint_title"
                                    type="text"
                                    value={createData.title}
                                    onChange={(e) => setCreateData('title', e.target.value)}
                                    placeholder="e.g. Battery replacement & thermal repaste"
                                    className="mt-1.5 block w-full text-xs"
                                    required
                                />
                                <InputError message={createErrors.title} className="mt-1" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <InputLabel htmlFor="create_maint_tech" value="Technician / Vendor" />
                                    <TextInput
                                        id="create_maint_tech"
                                        type="text"
                                        value={createData.performed_by}
                                        onChange={(e) => setCreateData('performed_by', e.target.value)}
                                        placeholder="e.g. Internal IT Desk, Beyond the Box"
                                        className="mt-1.5 block w-full text-xs"
                                    />
                                    <InputError message={createErrors.performed_by} className="mt-1" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="create_maint_started_at" value="Start Date *" />
                                    <TextInput
                                        id="create_maint_started_at"
                                        type="date"
                                        value={createData.started_at}
                                        onChange={(e) => setCreateData('started_at', e.target.value)}
                                        className="mt-1.5 block w-full text-xs tabular-nums"
                                        required
                                    />
                                    <InputError message={createErrors.started_at} className="mt-1" />
                                </div>
                            </div>

                            <div>
                                <InputLabel htmlFor="create_maint_desc" value="Description of Work *" />
                                <textarea
                                    id="create_maint_desc"
                                    rows={2}
                                    value={createData.description}
                                    onChange={(e) => setCreateData('description', e.target.value)}
                                    placeholder="Describe reported fault, components replaced, or inspection checklist..."
                                    className="mt-1.5 block w-full rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 py-2 px-3 focus:outline-none focus:border-[#026eff] focus:ring-0"
                                    required
                                />
                                <InputError message={createErrors.description} className="mt-1" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                                <div>
                                    <InputLabel value="Initial Status *" />
                                    <div className="mt-1.5">
                                        <CustomSelect
                                            value={createData.status}
                                            onChange={(val) => setCreateData('status', val)}
                                            options={[
                                                { value: 'in_progress', label: 'In Progress' },
                                                { value: 'scheduled', label: 'Scheduled' },
                                                { value: 'completed', label: 'Completed' },
                                            ]}
                                        />
                                    </div>
                                    <InputError message={createErrors.status} className="mt-1" />
                                </div>

                                <label className="flex items-start gap-2.5 p-3 sm:mt-5 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 cursor-pointer">
                                    <Checkbox
                                        checked={createData.send_to_maintenance_stage}
                                        onChange={(e) => setCreateData('send_to_maintenance_stage', e.target.checked)}
                                        className="mt-0.5"
                                    />
                                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                        Move unit to Maintenance Phase
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                            <SecondaryButton type="button" onClick={closeCreateModal}>
                                Cancel
                            </SecondaryButton>
                            <PrimaryButton type="submit" disabled={createProcessing || !createData.device_id}>
                                {createProcessing ? 'Recording...' : 'Record Servicing Log'}
                            </PrimaryButton>
                        </div>
                    </form>
                </Modal>
            )}
        </AuthenticatedLayout>
    );
}
