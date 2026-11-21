import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CustomSelect from '@/Components/CustomSelect';
import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import Pagination from '@/Components/Pagination';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { formatDisplayDate, formatPhp, formatRelativeDays } from '@/lib/formatters';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    RiAddLine,
    RiArrowDownSLine,
    RiArrowUpDownLine,
    RiArrowUpSLine,
    RiCheckLine,
    RiCloseLine,
    RiDeleteBinLine,
    RiDownload2Line,
    RiEditLine,
    RiFileCopyLine,
    RiFilePdfLine,
    RiKey2Line,
    RiRefreshLine,
    RiSearchLine,
    RiUserAddLine,
    RiUserUnfollowLine,
} from 'react-icons/ri';

const categoryOptions = [
    { value: 'productivity', label: 'Productivity' },
    { value: 'design', label: 'Design & Creative' },
    { value: 'development', label: 'Software Development' },
    { value: 'security', label: 'Security & Identity' },
    { value: 'collaboration', label: 'Collaboration' },
    { value: 'analytics', label: 'Data & Analytics' },
    { value: 'infrastructure', label: 'Cloud & Infrastructure' },
];

const licenseTypeOptions = [
    { value: 'saas', label: 'SaaS Subscription' },
    { value: 'perpetual', label: 'Perpetual License' },
    { value: 'volume', label: 'Volume Agreement' },
];

const billingCycleOptions = [
    { value: 'annual', label: 'Annual' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'one_time', label: 'One-Time' },
];

const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'cancelled', label: 'Cancelled' },
];

const renewalFilterOptions = [
    { value: 'needs_attention', label: 'Needs Attention (≤ 60d / Expired)' },
    { value: 'expiring_soon', label: 'Expiring Soon (≤ 60d)' },
    { value: 'expired', label: 'Expired' },
    { value: 'perpetual', label: 'Perpetual / No Expiry' },
];

const renewalStatusPill = {
    active: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    expiring_soon: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
    expired: 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400',
    perpetual: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300',
    cancelled: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400',
};

const formatSeatRate = (cost, billingCycle) => {
    if (cost === null || cost === undefined) {
        return null;
    }

    const suffix =
        billingCycle === 'monthly'
            ? '/ seat / mo'
            : billingCycle === 'one_time'
            ? '/ seat (one-time)'
            : '/ seat / yr';

    return `${formatPhp(cost)} ${suffix}`;
};

export default function LicensesIndex({
    licenses,
    employees = [],
    summary = {},
    filters = {},
    financials_restricted = false,
}) {
    const { auth } = usePage().props;
    const user = auth?.user;
    const isAdminOrManager = ['admin', 'manager'].includes(user?.role);
    const canViewFinancials = !financials_restricted && user?.role !== 'technician';

    const [search, setSearch] = useState(filters.search || '');
    const [category, setCategory] = useState(filters.category || '');
    const [licenseType, setLicenseType] = useState(filters.license_type || '');
    const [status, setStatus] = useState(filters.status || '');
    const [renewalFilter, setRenewalFilter] = useState(filters.renewal_filter || '');

    const [showFormModal, setShowFormModal] = useState(false);
    const [editingLicense, setEditingLicense] = useState(null);
    const [seatsModalLicenseId, setSeatsModalLicenseId] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [copiedKey, setCopiedKey] = useState(false);

    const isFirstRender = useRef(true);
    const seatsLicense = licenses.data.find((l) => l.id === seatsModalLicenseId) || null;

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        name: '',
        vendor: '',
        license_key: '',
        category: 'productivity',
        license_type: 'saas',
        billing_cycle: 'annual',
        total_seats: 10,
        cost_per_seat: 0,
        purchase_date: '',
        renewal_date: '',
        status: 'active',
        notes: '',
    });

    const {
        data: seatData,
        setData: setSeatData,
        post: postSeatAssign,
        processing: assigningSeat,
        errors: seatErrors,
        reset: resetSeatForm,
    } = useForm({
        employee_id: '',
        notes: '',
    });

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        const timer = setTimeout(() => {
            router.get(
                route('licenses.index'),
                {
                    search,
                    category,
                    license_type: licenseType,
                    status,
                    renewal_filter: renewalFilter,
                    sort: filters?.sort,
                    direction: filters?.direction,
                },
                { preserveState: true, replace: true, preserveScroll: true }
            );
        }, 300);

        return () => clearTimeout(timer);
    }, [search, category, licenseType, status, renewalFilter]);

    const handleSort = (sortKey) => {
        const currentSort = filters.sort || 'name';
        const currentDirection = filters.direction || 'asc';
        const nextDirection = currentSort === sortKey && currentDirection === 'asc' ? 'desc' : 'asc';

        router.get(
            route('licenses.index'),
            {
                search,
                category,
                license_type: licenseType,
                status,
                renewal_filter: renewalFilter,
                sort: sortKey,
                direction: nextDirection,
            },
            { preserveState: true, replace: true }
        );
    };

    const clearFilters = () => {
        setSearch('');
        setCategory('');
        setLicenseType('');
        setStatus('');
        setRenewalFilter('');
        router.get(route('licenses.index'));
    };

    const openCreateModal = () => {
        setEditingLicense(null);
        reset();
        clearErrors();
        setShowFormModal(true);
    };

    const openEditModal = (lic) => {
        setEditingLicense(lic);
        clearErrors();
        setData({
            name: lic.name || '',
            vendor: lic.vendor || '',
            license_key: lic.license_key || '',
            category: lic.category || 'productivity',
            license_type: lic.license_type || 'saas',
            billing_cycle: lic.billing_cycle || 'annual',
            total_seats: lic.total_seats || 1,
            cost_per_seat: lic.cost_per_seat ?? 0,
            purchase_date: lic.purchase_date ? String(lic.purchase_date).slice(0, 10) : '',
            renewal_date: lic.renewal_date ? String(lic.renewal_date).slice(0, 10) : '',
            status: lic.status || 'active',
            notes: lic.notes || '',
        });
        setShowFormModal(true);
    };

    const closeFormModal = () => {
        setShowFormModal(false);
        setEditingLicense(null);
        reset();
        clearErrors();
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (editingLicense) {
            put(route('licenses.update', editingLicense.id), {
                preserveScroll: true,
                onSuccess: () => closeFormModal(),
            });
        } else {
            post(route('licenses.store'), {
                preserveScroll: true,
                onSuccess: () => closeFormModal(),
            });
        }
    };

    const handleAssignSeat = (e) => {
        e.preventDefault();
        if (!seatsLicense || !seatData.employee_id) return;
        postSeatAssign(route('licenses.assign', seatsLicense.id), {
            preserveScroll: true,
            onSuccess: () => resetSeatForm(),
        });
    };

    const handleDelete = () => {
        if (!deleteTarget) return;
        router.delete(route('licenses.destroy', deleteTarget.id), {
            preserveScroll: true,
            onSuccess: () => setDeleteTarget(null),
        });
    };

    const handleCopyKey = (keyValue) => {
        if (!keyValue) return;
        navigator.clipboard.writeText(keyValue);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const activeFilterCount = [search, category, licenseType, status, renewalFilter].filter(Boolean).length;
    const assignedEmployeeIds = new Set((seatsLicense?.active_assignments || []).map((a) => a.employee_id));
    const availableEmployees = employees.filter((e) => !assignedEmployeeIds.has(e.id));
    const renewalAlertsTotal = (summary.expiring_soon_count ?? 0) + (summary.expired_count ?? 0);
    const isRenewalCardFiltering = renewalFilter === 'needs_attention';

    const renderSortHeader = (label, sortKey) => {
        const isActive = (filters.sort || 'name') === sortKey;
        const direction = filters.direction || 'asc';

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

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Software Licenses &amp; SaaS Entitlements
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            {canViewFinancials
                                ? 'Seat allocation, annualized software spend, and contract renewal compliance.'
                                : 'Seat allocation, agreement terms, and contract renewal tracking.'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {isAdminOrManager && (
                            <>
                                <a
                                    href={route('licenses.export.csv')}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                                >
                                    <RiDownload2Line className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>Export CSV</span>
                                </a>
                                <a
                                    href={route('licenses.export.pdf')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                                >
                                    <RiFilePdfLine className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Export PDF</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={openCreateModal}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-xs font-medium text-white transition cursor-pointer"
                                >
                                    <RiAddLine className="w-3.5 h-3.5" />
                                    <span>Add License</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            }
        >
            <Head title="Software Licenses - ITFleet" />

            {/* KPI Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Tracked Software Titles
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {summary.total_licenses ?? 0}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {summary.active_licenses ?? 0} active contracts
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Seat Utilization
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
                        <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            {summary.assigned_seats ?? 0} / {summary.total_seats ?? 0}
                        </span>
                        <span className="text-xs font-medium text-[#026eff] dark:text-sky-400">
                            {summary.seat_utilization_pct ?? 0}%
                        </span>
                    </div>
                    <div className="mt-2 w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 overflow-hidden">
                        <div
                            className="bg-[#026eff] h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, summary.seat_utilization_pct ?? 0)}%` }}
                        />
                    </div>
                </div>

                {canViewFinancials ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4">
                        <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Annualized Software Spend
                        </div>
                        <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                            {formatPhp(summary.annual_software_spend ?? 0)}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                            Active seats &amp; recurring SaaS commitments
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4">
                        <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Available Seats
                        </div>
                        <div className="mt-1.5 text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {summary.available_seats ?? 0}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                            Spare seats ready to assign
                        </div>
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => setRenewalFilter(isRenewalCardFiltering ? '' : 'needs_attention')}
                    className={`text-left bg-white dark:bg-zinc-900 rounded-sm border p-4 transition cursor-pointer ${
                        isRenewalCardFiltering
                            ? 'border-amber-500 ring-1 ring-amber-500/30'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                    title="Click to filter contracts needing renewal attention"
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Renewal Alerts (&le; 60 Days)
                        </span>
                        {isRenewalCardFiltering && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                Filtered
                            </span>
                        )}
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
                        <span className="text-2xl font-semibold tracking-tight text-amber-600 dark:text-amber-400">
                            {renewalAlertsTotal}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {summary.expiring_soon_count ?? 0} soon &middot; {summary.expired_count ?? 0} expired
                        </span>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Click to focus expiring &amp; overdue contracts
                    </div>
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4 mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
                    <div className="lg:col-span-3 relative">
                        <RiSearchLine className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search software title, vendor..."
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-[#026eff]"
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <CustomSelect
                            value={category}
                            onChange={setCategory}
                            placeholder="All Categories"
                            options={[{ value: '', label: 'All Categories' }, ...categoryOptions]}
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <CustomSelect
                            value={licenseType}
                            onChange={setLicenseType}
                            placeholder="All Types"
                            options={[{ value: '', label: 'All Types' }, ...licenseTypeOptions]}
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <CustomSelect
                            value={status}
                            onChange={setStatus}
                            placeholder="All Statuses"
                            options={[{ value: '', label: 'All Statuses' }, ...statusOptions]}
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <CustomSelect
                            value={renewalFilter}
                            onChange={setRenewalFilter}
                            placeholder="All Renewals"
                            options={[{ value: '', label: 'All Renewals' }, ...renewalFilterOptions]}
                        />
                    </div>

                    <div className="lg:col-span-1 flex items-center justify-end gap-1.5">
                        {activeFilterCount > 0 ? (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="w-full py-2 px-2 text-xs font-medium rounded-sm border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer flex items-center justify-center gap-1"
                                title="Reset filters"
                            >
                                <RiRefreshLine className="w-3.5 h-3.5" />
                                <span>Reset</span>
                            </button>
                        ) : (
                            <span className="text-[11px] text-zinc-400 flex items-center gap-1 tabular-nums">
                                <RiKey2Line className="w-3.5 h-3.5" />
                                <span>{licenses.total}</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {licenses.data.length === 0 ? (
                    <div className="p-12 text-center">
                        <RiKey2Line className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No software licenses found</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            Register SaaS subscriptions or volume software entitlements to track seat usage.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                <tr>
                                    <th className="py-3 px-4">{renderSortHeader('Software & Vendor', 'name')}</th>
                                    <th className="py-3 px-4">Category &amp; Type</th>
                                    <th className="py-3 px-4">{renderSortHeader('Seat Allocation', 'utilization')}</th>
                                    {canViewFinancials && (
                                        <th className="py-3 px-4">{renderSortHeader('Annualized Cost', 'annualized_cost')}</th>
                                    )}
                                    <th className="py-3 px-4">{renderSortHeader('Renewal', 'renewal_date')}</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                                {licenses.data.map((lic) => {
                                    const assigned = lic.active_assignments_count ?? lic.active_assignments?.length ?? 0;
                                    const pct = lic.total_seats > 0 ? Math.min(100, Math.round((assigned / lic.total_seats) * 100)) : 0;
                                    const pillClass = renewalStatusPill[lic.renewal_status] || renewalStatusPill.active;
                                    const countdown =
                                        lic.renewal_status !== 'perpetual' && lic.renewal_status !== 'cancelled'
                                            ? formatRelativeDays(lic.days_until_renewal)
                                            : null;

                                    return (
                                        <tr
                                            key={lic.id}
                                            onClick={() => setSeatsModalLicenseId(lic.id)}
                                            className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                                        >
                                            <td className="py-3.5 px-4">
                                                <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-[13px]">
                                                    {lic.name}
                                                </div>
                                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                                                    <span>{lic.vendor}</span>
                                                    {lic.license_key && (
                                                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                                                            {lic.license_key}
                                                        </span>
                                                    )}
                                                    {lic.status !== 'active' && (
                                                        <span className="uppercase text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                                            {lic.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4">
                                                <div className="capitalize font-medium text-zinc-800 dark:text-zinc-200">
                                                    {lic.category}
                                                </div>
                                                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase mt-0.5">
                                                    {lic.license_type} &bull; {lic.billing_cycle.replace('_', '-')}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4 min-w-[160px]">
                                                <div className="flex items-center justify-between text-[11px] tabular-nums mb-1">
                                                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                                        {assigned} / {lic.total_seats} seats
                                                    </span>
                                                    <span className="text-zinc-400">{pct}%</span>
                                                </div>
                                                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full ${pct >= 95 ? 'bg-amber-500' : 'bg-[#026eff]'}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </td>

                                            {canViewFinancials && (
                                                <td className="py-3.5 px-4 tabular-nums">
                                                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                                                        {formatPhp(lic.annualized_cost)}
                                                    </div>
                                                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                                        {formatSeatRate(lic.cost_per_seat, lic.billing_cycle)}
                                                    </div>
                                                </td>
                                            )}

                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-sm border capitalize ${pillClass}`}>
                                                    {(lic.renewal_status || 'active').replace('_', ' ')}
                                                </span>
                                                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 tabular-nums">
                                                    {lic.renewal_date ? formatDisplayDate(lic.renewal_date) : 'No expiry'}
                                                    {countdown ? ` · ${countdown}` : ''}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                <div className="inline-flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSeatsModalLicenseId(lic.id)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:border-[#026eff] hover:text-[#026eff] dark:hover:text-sky-400 transition cursor-pointer"
                                                    >
                                                        <RiUserAddLine className="w-3.5 h-3.5" />
                                                        <span>Seats</span>
                                                    </button>
                                                    {isAdminOrManager && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditModal(lic)}
                                                                className="p-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                                                title="Edit license"
                                                            >
                                                                <RiEditLine className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeleteTarget(lic)}
                                                                className="p-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                                                                title="Delete license"
                                                            >
                                                                <RiDeleteBinLine className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Pagination links={licenses.links} from={licenses.from} to={licenses.to} total={licenses.total} label="licenses" />

            {/* Create / Edit License Modal */}
            <Modal show={showFormModal} onClose={closeFormModal} maxWidth="lg">
                <form onSubmit={handleFormSubmit} className="p-6">
                    <div className="flex items-start justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                {editingLicense ? `Edit License — ${editingLicense.name}` : 'Register Software License'}
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Track seats, subscription spend, and renewal schedules.
                            </p>
                        </div>
                        <button type="button" onClick={closeFormModal} className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer">
                            <RiCloseLine className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <InputLabel htmlFor="lic_name" value="Software / Product Name *" />
                                <TextInput
                                    id="lic_name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className="mt-1.5 block w-full text-xs"
                                    placeholder="e.g. Microsoft 365 E3"
                                    required
                                />
                                <InputError message={errors.name} className="mt-1" />
                            </div>
                            <div>
                                <InputLabel htmlFor="lic_vendor" value="Vendor / Publisher *" />
                                <TextInput
                                    id="lic_vendor"
                                    value={data.vendor}
                                    onChange={(e) => setData('vendor', e.target.value)}
                                    className="mt-1.5 block w-full text-xs"
                                    placeholder="e.g. Microsoft, Adobe, JetBrains"
                                    required
                                />
                                <InputError message={errors.vendor} className="mt-1" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <InputLabel value="Category *" className="mb-1.5" />
                                <CustomSelect
                                    value={data.category}
                                    onChange={(v) => setData('category', v)}
                                    options={categoryOptions}
                                />
                                <InputError message={errors.category} className="mt-1" />
                            </div>
                            <div>
                                <InputLabel value="License Type *" className="mb-1.5" />
                                <CustomSelect
                                    value={data.license_type}
                                    onChange={(v) => setData('license_type', v)}
                                    options={licenseTypeOptions}
                                />
                                <InputError message={errors.license_type} className="mt-1" />
                            </div>
                            <div>
                                <InputLabel value="Billing Cycle *" className="mb-1.5" />
                                <CustomSelect
                                    value={data.billing_cycle}
                                    onChange={(v) => setData('billing_cycle', v)}
                                    options={billingCycleOptions}
                                />
                                <InputError message={errors.billing_cycle} className="mt-1" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <InputLabel htmlFor="lic_seats" value="Total Seats *" />
                                <TextInput
                                    id="lic_seats"
                                    type="number"
                                    min="1"
                                    value={data.total_seats}
                                    onChange={(e) => setData('total_seats', parseInt(e.target.value, 10) || 1)}
                                    className="mt-1.5 block w-full text-xs"
                                    required
                                />
                                <InputError message={errors.total_seats} className="mt-1" />
                            </div>
                            <div>
                                <InputLabel htmlFor="lic_cost" value="Cost per Seat (₱) *" />
                                <TextInput
                                    id="lic_cost"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.cost_per_seat}
                                    onChange={(e) => setData('cost_per_seat', e.target.value)}
                                    className="mt-1.5 block w-full text-xs"
                                    required
                                />
                                <InputError message={errors.cost_per_seat} className="mt-1" />
                            </div>
                            <div>
                                <InputLabel value="Status *" className="mb-1.5" />
                                <CustomSelect
                                    value={data.status}
                                    onChange={(v) => setData('status', v)}
                                    options={statusOptions}
                                />
                                <InputError message={errors.status} className="mt-1" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <InputLabel htmlFor="lic_purchase" value="Purchase Date" />
                                <TextInput
                                    id="lic_purchase"
                                    type="date"
                                    value={data.purchase_date}
                                    onChange={(e) => setData('purchase_date', e.target.value)}
                                    className="mt-1.5 block w-full text-xs"
                                />
                            </div>
                            <div>
                                <InputLabel htmlFor="lic_renewal" value="Renewal / Expiry Date" />
                                <TextInput
                                    id="lic_renewal"
                                    type="date"
                                    value={data.renewal_date}
                                    onChange={(e) => setData('renewal_date', e.target.value)}
                                    className="mt-1.5 block w-full text-xs"
                                />
                            </div>
                            <div>
                                <InputLabel htmlFor="lic_key" value="Agreement / Key Ref" />
                                <TextInput
                                    id="lic_key"
                                    value={data.license_key}
                                    onChange={(e) => setData('license_key', e.target.value)}
                                    className="mt-1.5 block w-full text-xs font-mono"
                                    placeholder="EA-2026-..."
                                />
                            </div>
                        </div>

                        <div>
                            <InputLabel htmlFor="lic_notes" value="Notes" />
                            <textarea
                                id="lic_notes"
                                rows={2}
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                className="mt-1.5 block w-full rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 py-2 px-3 focus:outline-none focus:border-[#026eff]"
                            />
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                        <SecondaryButton type="button" onClick={closeFormModal}>
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton type="submit" disabled={processing}>
                            {processing ? 'Saving...' : editingLicense ? 'Save Changes' : 'Register License'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            {/* License Details & Seat Allocations Modal */}
            <Modal show={Boolean(seatsLicense)} onClose={() => setSeatsModalLicenseId(null)} maxWidth="lg">
                <div className="p-6">
                    <div className="flex items-start justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 gap-3">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                    {seatsLicense?.name}
                                </h3>
                                {seatsLicense?.renewal_status && (
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-sm border capitalize ${
                                        renewalStatusPill[seatsLicense.renewal_status] || renewalStatusPill.active
                                    }`}>
                                        {seatsLicense.renewal_status.replace('_', ' ')}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                                {seatsLicense?.vendor} &bull; {seatsLicense?.active_assignments?.length || 0} of {seatsLicense?.total_seats || 0} seats assigned
                            </p>
                        </div>
                        <button type="button" onClick={() => setSeatsModalLicenseId(null)} className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer shrink-0">
                            <RiCloseLine className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Contract Metadata Strip */}
                    {seatsLicense && (
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-sm bg-zinc-50/70 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 text-xs">
                            <div>
                                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Agreement Ref</div>
                                {seatsLicense.license_key ? (
                                    <button
                                        type="button"
                                        onClick={() => handleCopyKey(seatsLicense.license_key)}
                                        className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-medium text-zinc-900 dark:text-zinc-100 hover:text-[#026eff] cursor-pointer"
                                        title="Copy Agreement / Key Ref"
                                    >
                                        <span>{seatsLicense.license_key}</span>
                                        {copiedKey ? <RiCheckLine className="w-3 h-3 text-emerald-500" /> : <RiFileCopyLine className="w-3 h-3 text-zinc-400" />}
                                    </button>
                                ) : (
                                    <div className="mt-1 text-zinc-400 dark:text-zinc-500">Not recorded</div>
                                )}
                            </div>

                            <div>
                                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Renewal Schedule</div>
                                <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                                    {seatsLicense.renewal_date ? formatDisplayDate(seatsLicense.renewal_date) : 'No expiry'}
                                </div>
                                {seatsLicense.purchase_date && (
                                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                                        Started {formatDisplayDate(seatsLicense.purchase_date)}
                                    </div>
                                )}
                            </div>

                            {canViewFinancials ? (
                                <div>
                                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Annualized Spend</div>
                                    <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                                        {formatPhp(seatsLicense.annualized_cost)}
                                    </div>
                                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                                        {formatSeatRate(seatsLicense.cost_per_seat, seatsLicense.billing_cycle)}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Entitlement Type</div>
                                    <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-100 uppercase text-[11px]">
                                        {seatsLicense.license_type} &bull; {seatsLicense.billing_cycle.replace('_', '-')}
                                    </div>
                                </div>
                            )}

                            {seatsLicense.notes && (
                                <div className="col-span-full pt-2 border-t border-zinc-200/70 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300">
                                    <span className="font-medium text-zinc-800 dark:text-zinc-200">Notes:</span> {seatsLicense.notes}
                                </div>
                            )}
                        </div>
                    )}

                    {isAdminOrManager && (seatsLicense?.active_assignments?.length || 0) < (seatsLicense?.total_seats || 0) && (
                        <form onSubmit={handleAssignSeat} className="mt-4 p-3.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 space-y-2.5">
                            <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">Assign Available Seat</div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="flex-1">
                                    <CustomSelect
                                        value={seatData.employee_id}
                                        onChange={(val) => setSeatData('employee_id', val)}
                                        placeholder="Select employee..."
                                        options={availableEmployees.map((e) => ({
                                            value: String(e.id),
                                            label: `${e.name} (${e.department})`,
                                        }))}
                                    />
                                    <InputError message={seatErrors.employee_id} className="mt-1" />
                                </div>
                                <PrimaryButton type="submit" disabled={assigningSeat || !seatData.employee_id}>
                                    {assigningSeat ? 'Assigning...' : 'Assign Seat'}
                                </PrimaryButton>
                            </div>
                        </form>
                    )}

                    <div className="mt-4 max-h-[42vh] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800">
                        {(!seatsLicense?.active_assignments || seatsLicense.active_assignments.length === 0) ? (
                            <div className="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                                No active seats assigned yet.
                            </div>
                        ) : (
                            seatsLicense.active_assignments.map((asg) => (
                                <div key={asg.id} className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-zinc-900">
                                    <div className="min-w-0">
                                        <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                            {asg.employee?.name}
                                        </div>
                                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                                            {asg.employee?.department} &bull; Assigned{' '}
                                            {asg.assigned_at ? formatDisplayDate(asg.assigned_at) : '—'}
                                        </div>
                                    </div>
                                    {isAdminOrManager && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.post(
                                                    route('licenses.revoke', asg.id),
                                                    {},
                                                    { preserveScroll: true }
                                                )
                                            }
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-rose-500/25 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer shrink-0"
                                        >
                                            <RiUserUnfollowLine className="w-3.5 h-3.5" />
                                            <span>Revoke</span>
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-5 flex justify-end">
                        <SecondaryButton type="button" onClick={() => setSeatsModalLicenseId(null)}>
                            Close
                        </SecondaryButton>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal show={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="sm">
                <div className="p-6">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        Delete Software License
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                        Permanently remove <span className="font-medium text-zinc-800 dark:text-zinc-200">{deleteTarget?.name}</span> from tracked software entitlements?
                    </p>
                    <div className="mt-5 flex justify-end gap-2">
                        <SecondaryButton type="button" onClick={() => setDeleteTarget(null)}>
                            Cancel
                        </SecondaryButton>
                        <DangerButton type="button" onClick={handleDelete}>
                            Delete
                        </DangerButton>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
