import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Checkbox from '@/Components/Checkbox';
import CustomSelect from '@/Components/CustomSelect';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import Pagination from '@/Components/Pagination';
import PrimaryButton from '@/Components/PrimaryButton';
import ResizableTh from '@/Components/ResizableTh';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { useResizableColumns } from '@/Hooks/useResizableColumns';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    RiCalendarLine,
    RiCloseLine,
    RiComputerLine,
    RiEditLine,
    RiFilter3Line,
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
        label: 'In progress',
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

const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

export default function MaintenanceIndex({ logs, stats = {}, filters = {} }) {
    const { auth } = usePage().props;
    const user = auth?.user;
    const canUpdate = ['admin', 'manager', 'technician'].includes(user?.role);

    const [search, setSearch] = useState(filters.search || '');
    const [type, setType] = useState(filters.type || '');
    const [status, setStatus] = useState(filters.status || '');
    const [wrapText, setWrapText] = useState(false);
    const [selectedLogToUpdate, setSelectedLogToUpdate] = useState(null);

    const isFirstRender = useRef(true);

    const initialWidths = {
        device: 280,
        activity: 380,
        technician: 220,
        cost: 140,
        status: 140,
        actions: 140,
    };

    const { widths, startResize, autoExpandCol, resetWidths, resizingCol } = useResizableColumns(
        initialWidths,
        'maintenance_table_v5'
    );

    const { data, setData, put, processing, errors, reset, clearErrors } = useForm({
        cost: 0,
        completed_at: new Date().toISOString().split('T')[0],
        performance_assessment: '',
        status: 'completed',
        restore_to_available: true,
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
            { preserveState: true, replace: true }
        );
    };

    const handleFilter = (e) => {
        e?.preventDefault();
        router.get(
            route('maintenance.index'),
            {
                search,
                type,
                status,
                sort: filters?.sort,
                direction: filters?.direction,
            },
            { preserveState: true, replace: true }
        );
    };

    const clearFilters = () => {
        setSearch('');
        setType('');
        setStatus('');
        router.get(route('maintenance.index'));
    };

    const openUpdateModal = (log) => {
        clearErrors();
        setSelectedLogToUpdate(log);
        setData({
            cost: log.cost ?? 0,
            completed_at: log.completed_at
                ? String(log.completed_at).split('T')[0]
                : new Date().toISOString().split('T')[0],
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

    const activeFilterCount = [search, type, status].filter(Boolean).length;

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Maintenance & Servicing Hub
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Centralized repair queue, preventive upgrades, expenditure ledger, and post-repair checks.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Link
                            href={route('devices.index')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                        >
                            <RiComputerLine className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Inspect Fleet Devices</span>
                        </Link>
                    </div>
                </div>
            }
        >
            <Head title="Maintenance Hub - ITFleet" />

            {/* 3 Minimal KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Completed Servicing Spend
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {formatCurrency(stats.total_spend)}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Cumulative closed repair &amp; upgrade cost
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setStatus((prev) => (prev === 'in_progress' ? '' : 'in_progress'))}
                    className={`text-left rounded-sm border p-4 transition cursor-pointer ${
                        status === 'in_progress'
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-400 dark:border-amber-700'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Active Queue (Scheduled / In Progress)
                        </span>
                        {(stats.active_count ?? 0) > 0 && (
                            <span className="w-1.5 h-1.5 rounded-sm bg-amber-500" />
                        )}
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {stats.active_count ?? 0}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        {status === 'in_progress' ? 'Filtered to in progress' : 'Click to filter in-progress repairs'}
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setStatus((prev) => (prev === 'completed' ? '' : 'completed'))}
                    className={`text-left rounded-sm border p-4 transition cursor-pointer ${
                        status === 'completed'
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-700'
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
                        {status === 'completed' ? 'Filtered to completed' : 'Click to filter completed logs'}
                    </div>
                </button>
            </div>

            {/* Filter & Toolbar */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4 mb-5">
                <form onSubmit={handleFilter}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-2 lg:col-span-5 relative">
                            <RiSearchLine className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search activity title, asset tag, model, technician..."
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
                                placeholder="Service type"
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

                        <div className="lg:col-span-2">
                            <CustomSelect
                                value={status}
                                onChange={setStatus}
                                placeholder="Status"
                                options={[
                                    { value: '', label: 'All statuses' },
                                    { value: 'scheduled', label: 'Scheduled' },
                                    { value: 'in_progress', label: 'In Progress' },
                                    { value: 'completed', label: 'Completed' },
                                    { value: 'cancelled', label: 'Cancelled' },
                                ]}
                            />
                        </div>

                        <div className="lg:col-span-2 flex items-center gap-1.5">
                            <button
                                type="submit"
                                className="flex-1 py-2 px-3 text-xs font-medium rounded-sm border border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <RiFilter3Line className="w-3.5 h-3.5" />
                                <span>Filter</span>
                            </button>
                            {activeFilterCount > 0 && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="py-2 px-2.5 text-xs font-medium rounded-sm border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                    title="Reset all filters"
                                >
                                    <RiRefreshLine className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </form>

                {/* Single clean toolbar */}
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 tabular-nums">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {logs.total} Service Records
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700">&bull;</span>
                        <button
                            type="button"
                            onClick={() => handleSort('timeline')}
                            className={`inline-flex items-center gap-1 text-[11px] hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer ${
                                (filters.sort || 'started_at') === 'timeline' || filters.sort === 'started_at'
                                    ? 'text-[#026eff] dark:text-sky-400 font-medium'
                                    : ''
                            }`}
                        >
                            <RiCalendarLine className="w-3 h-3" />
                            <span>Sort by timeline</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={() => setWrapText(!wrapText)}
                            className={`px-2.5 py-1 rounded-sm border text-[11px] font-medium transition cursor-pointer ${
                                wrapText
                                    ? 'bg-[#026eff]/10 text-[#026eff] border-[#026eff]/30 dark:text-sky-400'
                                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            }`}
                        >
                            Wrap: {wrapText ? 'ON' : 'OFF'}
                        </button>
                        <button
                            type="button"
                            onClick={resetWidths}
                            className="px-2.5 py-1 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 text-[11px] font-medium transition cursor-pointer"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Maintenance Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {logs.data.length === 0 ? (
                    <div className="p-12 text-center">
                        <RiToolsLine className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            No maintenance logs found
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            Log a new repair or inspection directly from any device&apos;s detail page.
                        </p>
                        {activeFilterCount > 0 && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="mt-4 px-3.5 py-1.5 rounded-sm border border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white transition cursor-pointer"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table
                            className="w-full text-left text-xs table-fixed"
                            style={{ minWidth: `${Math.max(960, Object.values(widths).reduce((a, b) => a + b, 0))}px` }}
                        >
                            <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <ResizableTh
                                        colKey="device"
                                        sortKey="device"
                                        sortable
                                        currentSort={filters.sort}
                                        sortDirection={filters.direction}
                                        onSort={handleSort}
                                        width={widths.device}
                                        onResizeStart={startResize}
                                        onAutoExpand={autoExpandCol}
                                        isResizing={resizingCol === 'device'}
                                    >
                                        Hardware Unit
                                    </ResizableTh>
                                    <ResizableTh
                                        colKey="activity"
                                        sortKey="activity"
                                        sortable
                                        currentSort={filters.sort}
                                        sortDirection={filters.direction}
                                        onSort={handleSort}
                                        width={widths.activity}
                                        onResizeStart={startResize}
                                        onAutoExpand={autoExpandCol}
                                        isResizing={resizingCol === 'activity'}
                                    >
                                        Service Activity
                                    </ResizableTh>
                                    <ResizableTh
                                        colKey="technician"
                                        sortKey="technician"
                                        sortable
                                        currentSort={filters.sort}
                                        sortDirection={filters.direction}
                                        onSort={handleSort}
                                        width={widths.technician}
                                        onResizeStart={startResize}
                                        onAutoExpand={autoExpandCol}
                                        isResizing={resizingCol === 'technician'}
                                    >
                                        Technician &amp; Dates
                                    </ResizableTh>
                                    <ResizableTh
                                        colKey="cost"
                                        sortKey="cost"
                                        sortable
                                        currentSort={filters.sort}
                                        sortDirection={filters.direction}
                                        onSort={handleSort}
                                        align="right"
                                        width={widths.cost}
                                        onResizeStart={startResize}
                                        onAutoExpand={autoExpandCol}
                                        isResizing={resizingCol === 'cost'}
                                    >
                                        Cost
                                    </ResizableTh>
                                    <ResizableTh
                                        colKey="status"
                                        sortKey="status"
                                        sortable
                                        currentSort={filters.sort}
                                        sortDirection={filters.direction}
                                        onSort={handleSort}
                                        width={widths.status}
                                        onResizeStart={startResize}
                                        onAutoExpand={autoExpandCol}
                                        isResizing={resizingCol === 'status'}
                                    >
                                        Status
                                    </ResizableTh>
                                    <ResizableTh
                                        colKey="actions"
                                        align="right"
                                        resizable={false}
                                        width={widths.actions}
                                    >
                                        Actions
                                    </ResizableTh>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                                {logs.data.map((log) => {
                                    const statusInfo = statusBadgeMap[log.status] || statusBadgeMap.scheduled;
                                    const typeInfo = typeLabelMap[log.type] || typeLabelMap.repair;
                                    const device = log.device;

                                    return (
                                        <tr
                                            key={log.id}
                                            className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                                        >
                                            <td className="py-3 px-4 align-middle">
                                                {device ? (
                                                    <div className="min-w-0">
                                                        <Link
                                                            href={route('devices.show', device.id)}
                                                            className={`block font-medium text-zinc-900 dark:text-zinc-100 hover:text-[#026eff] dark:hover:text-sky-400 transition ${
                                                                wrapText ? 'whitespace-normal wrap-break-word' : 'truncate'
                                                            }`}
                                                        >
                                                            {device.brand} {device.model}
                                                        </Link>
                                                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                                            <span className="font-mono tabular-nums">{device.asset_tag}</span>
                                                            {device.lifecycle_stage === 'maintenance' && (
                                                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                                                    In service bay
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-400 dark:text-zinc-500">Removed device</span>
                                                )}
                                            </td>

                                            <td className="py-3 px-4 align-middle">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span
                                                        className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[10px] font-medium ${typeInfo.className}`}
                                                    >
                                                        {typeInfo.label}
                                                    </span>
                                                    <span
                                                        className={`font-medium text-zinc-900 dark:text-zinc-100 ${
                                                            wrapText ? 'whitespace-normal wrap-break-word' : 'truncate'
                                                        }`}
                                                    >
                                                        {log.title}
                                                    </span>
                                                </div>
                                                {log.description && (
                                                    <p
                                                        className={`text-[11px] text-zinc-500 dark:text-zinc-400 ${
                                                            wrapText ? 'whitespace-normal wrap-break-word' : 'truncate'
                                                        }`}
                                                    >
                                                        {log.description}
                                                    </p>
                                                )}
                                                {log.performance_assessment && (
                                                    <p
                                                        className={`text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 ${
                                                            wrapText ? 'whitespace-normal wrap-break-word' : 'truncate'
                                                        }`}
                                                    >
                                                        Assessment: {log.performance_assessment}
                                                    </p>
                                                )}
                                            </td>

                                            <td className="py-3 px-4 align-middle">
                                                <div
                                                    className={`text-xs text-zinc-800 dark:text-zinc-200 font-medium ${
                                                        wrapText ? 'whitespace-normal wrap-break-word' : 'truncate'
                                                    }`}
                                                >
                                                    {log.performed_by || 'Internal IT'}
                                                </div>
                                                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 tabular-nums">
                                                    {formatDate(log.started_at)}
                                                    {log.completed_at ? ` → ${formatDate(log.completed_at)}` : ''}
                                                </div>
                                            </td>

                                            <td className="py-3 px-4 align-middle text-right font-mono tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                                                {formatCurrency(log.cost)}
                                            </td>

                                            <td className="py-3 px-4 align-middle">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[11px] font-medium ${statusInfo.pill}`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-sm ${statusInfo.dot}`} />
                                                    {statusInfo.label}
                                                </span>
                                            </td>

                                            <td className="py-3 px-4 align-middle text-right">
                                                {canUpdate ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openUpdateModal(log)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:border-[#026eff] hover:text-[#026eff] dark:hover:text-sky-400 transition cursor-pointer"
                                                    >
                                                        <RiEditLine className="w-3.5 h-3.5" />
                                                        <span>Assess</span>
                                                    </button>
                                                ) : device ? (
                                                    <Link
                                                        href={route('devices.show', device.id)}
                                                        className="text-[11px] font-medium text-zinc-500 hover:text-[#026eff] dark:hover:text-sky-400 transition"
                                                    >
                                                        View device
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
            <Modal show={Boolean(selectedLogToUpdate)} onClose={closeUpdateModal} maxWidth="md">
                <form onSubmit={handleUpdateSubmit} className="p-6">
                    <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div>
                            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                                Assess &amp; Update Servicing
                            </h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {selectedLogToUpdate?.device?.brand} {selectedLogToUpdate?.device?.model} &bull;{' '}
                                <span className="font-mono">{selectedLogToUpdate?.device?.asset_tag}</span>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={closeUpdateModal}
                            className="p-1.5 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                            aria-label="Close modal"
                        >
                            <RiCloseLine className="w-4 h-4" />
                        </button>
                    </div>

                    {selectedLogToUpdate && (
                        <div className="mt-4 p-3 rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                            <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                {selectedLogToUpdate.title}
                            </div>
                            {selectedLogToUpdate.description && (
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    {selectedLogToUpdate.description}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        </div>

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
        </AuthenticatedLayout>
    );
}
