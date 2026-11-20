import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CustomSelect from '@/Components/CustomSelect';
import Dropdown from '@/Components/Dropdown';
import HardwareImage from '@/Components/HardwareImage';
import Pagination from '@/Components/Pagination';
import { formatDisplayDate, formatRelativeDays } from '@/lib/formatters';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    RiAddLine,
    RiArrowDownSLine,
    RiArrowRightLine,
    RiArrowUpDownLine,
    RiArrowUpSLine,
    RiCheckboxCircleLine,
    RiComputerLine,
    RiDownload2Line,
    RiFilePdfLine,
    RiFilter3Line,
    RiKeyboardBoxLine,
    RiLayoutGridLine,
    RiMacbookLine,
    RiMapPinLine,
    RiRefreshLine,
    RiSearchLine,
    RiSmartphoneLine,
    RiTableLine,
    RiTv2Line,
} from 'react-icons/ri';

const statusBadgeMap = {
    available: {
        label: 'Available',
        pill: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
        dot: 'bg-emerald-500',
    },
    assigned: {
        label: 'Assigned',
        pill: 'bg-[#026eff]/10 border-[#026eff]/20 text-[#026eff] dark:text-sky-400',
        dot: 'bg-[#026eff] dark:bg-sky-400',
    },
    in_repair: {
        label: 'In repair',
        pill: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
        dot: 'bg-amber-500',
    },
    retired: {
        label: 'Retired',
        pill: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400',
        dot: 'bg-zinc-400',
    },
};

const warrantyBadgeMap = {
    active: {
        label: 'Active',
        pill: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    },
    expiring_soon: {
        label: 'Expiring',
        pill: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
    },
    expired: {
        label: 'Expired',
        pill: 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400',
    },
    none: {
        label: 'Not Recorded',
        pill: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400',
    },
};

const categoryTabs = [
    { key: '', countKey: 'all', label: 'All Assets', icon: null },
    { key: 'laptop', countKey: 'laptop', label: 'Laptops', icon: RiMacbookLine },
    { key: 'desktop', countKey: 'desktop', label: 'Desktops', icon: RiComputerLine },
    { key: 'monitor', countKey: 'monitor', label: 'Monitors', icon: RiTv2Line },
    { key: 'mobile', countKey: 'mobile', label: 'Mobiles', icon: RiSmartphoneLine },
    { key: 'peripheral', countKey: 'peripheral', label: 'Peripherals', icon: RiKeyboardBoxLine },
];

export default function DevicesIndex({ devices, filters = {}, category_counts = {} }) {
    const { auth } = usePage().props;
    const user = auth?.user;
    const isAdminOrManager = ['admin', 'manager'].includes(user?.role);

    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const [lifecycleStage, setLifecycleStage] = useState(filters.lifecycle_stage || '');
    const [deviceType, setDeviceType] = useState(filters.device_type || '');
    const [cpuTier, setCpuTier] = useState(filters.cpu_tier || '');
    const [warranty, setWarranty] = useState(filters.warranty || '');
    const [condition, setCondition] = useState(filters.condition || '');
    const [viewMode, setViewMode] = useState('table');
    const [showMoreFilters, setShowMoreFilters] = useState(
        Boolean(filters.lifecycle_stage || filters.cpu_tier || filters.warranty || filters.condition)
    );

    const isComputeFilter = !deviceType || ['laptop', 'desktop'].includes(deviceType);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = setTimeout(() => {
            router.get(
                route('devices.index'),
                {
                    search,
                    status,
                    lifecycle_stage: lifecycleStage,
                    device_type: deviceType,
                    cpu_tier: cpuTier,
                    warranty,
                    condition,
                    sort: filters?.sort,
                    direction: filters?.direction,
                },
                { preserveState: true, replace: true, preserveScroll: true }
            );
        }, 300);

        return () => clearTimeout(timer);
    }, [search, status, lifecycleStage, deviceType, cpuTier, warranty, condition]);

    const handleCategorySelect = (nextType) => {
        setDeviceType(nextType);
        if (nextType && !['laptop', 'desktop'].includes(nextType) && cpuTier) {
            setCpuTier('');
        }
    };

    const handleSort = (sortKey) => {
        const currentSort = filters.sort || 'asset_tag';
        const currentDirection = filters.direction || 'asc';
        const nextDirection = currentSort === sortKey && currentDirection === 'asc' ? 'desc' : 'asc';

        router.get(
            route('devices.index'),
            {
                search,
                status,
                lifecycle_stage: lifecycleStage,
                device_type: deviceType,
                cpu_tier: cpuTier,
                warranty,
                condition,
                sort: sortKey,
                direction: nextDirection,
            },
            { preserveState: true, replace: true }
        );
    };

    const clearFilters = () => {
        setSearch('');
        setStatus('');
        setLifecycleStage('');
        setDeviceType('');
        setCpuTier('');
        setWarranty('');
        setCondition('');
        router.get(route('devices.index'));
    };

    const activeFilterCount = [search, status, lifecycleStage, deviceType, cpuTier, warranty, condition].filter(Boolean).length;
    const extraFilterCount = [lifecycleStage, cpuTier, warranty, condition].filter(Boolean).length;

    const renderSortButton = (label, sortKey) => {
        const isActive = (filters.sort || 'asset_tag') === sortKey;
        const direction = filters.direction || 'asc';

        return (
            <button
                type="button"
                onClick={() => handleSort(sortKey)}
                className={`inline-flex items-center gap-1 uppercase tracking-wider text-[11px] font-medium transition cursor-pointer ${
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
                            Hardware Fleet Inventory
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Authoritative hardware catalog with warranty status, physical locations, and custodian allocation.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {isAdminOrManager && (
                            <>
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                        >
                                            <RiDownload2Line className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                                            <span>Export</span>
                                            <RiArrowDownSLine className="w-3.5 h-3.5 text-zinc-400" />
                                        </button>
                                    </Dropdown.Trigger>
                                    <Dropdown.Content align="right" width="48">
                                        <Dropdown.Header title="Inventory Reports" />
                                        <a
                                            href={route('devices.export.csv')}
                                            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-medium rounded-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition"
                                        >
                                            <RiDownload2Line className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                            <span>Export CSV</span>
                                        </a>
                                        <a
                                            href={route('devices.export.pdf')}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-medium rounded-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition"
                                        >
                                            <RiFilePdfLine className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                            <span>Export PDF</span>
                                        </a>
                                    </Dropdown.Content>
                                </Dropdown>

                                <Link
                                    href={route('devices.create')}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] hover:border-[#0258d1] text-xs font-medium text-white transition"
                                >
                                    <RiAddLine className="w-3.5 h-3.5" />
                                    <span>Register Asset</span>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            }
        >
            <Head title="Hardware Inventory - ITFleet" />

            {/* Category Tabs + Search/Filter Bar */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 mb-5">
                <div className="px-4 pt-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-1 overflow-x-auto">
                    {categoryTabs.map((tab) => {
                        const isActive = deviceType === tab.key;
                        const IconComponent = tab.icon;
                        const count = category_counts[tab.countKey] ?? (tab.key === '' ? devices.total : 0);

                        return (
                            <button
                                key={tab.key || 'all'}
                                type="button"
                                onClick={() => handleCategorySelect(tab.key)}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                                    isActive
                                        ? 'border-[#026eff] text-[#026eff] dark:text-sky-400'
                                        : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                }`}
                            >
                                {IconComponent && <IconComponent className="w-3.5 h-3.5 shrink-0" />}
                                <span>{tab.label}</span>
                                <span className={`px-1.5 py-0.5 rounded-sm text-[10px] tabular-nums ${
                                    isActive
                                        ? 'bg-[#026eff]/10 text-[#026eff] dark:text-sky-400'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                            <div className="sm:col-span-6 relative">
                                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4 pointer-events-none" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search tag, serial, model, location..."
                                    className="w-full text-xs pl-9 pr-3 py-2 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#026eff] focus:ring-0 transition"
                                />
                            </div>

                            <div className="sm:col-span-3">
                                <CustomSelect
                                    value={status}
                                    onChange={(val) => setStatus(val)}
                                    placeholder="All Statuses"
                                    options={[
                                        { value: 'available', label: 'Available (Pool)' },
                                        { value: 'assigned', label: 'Assigned' },
                                        { value: 'in_repair', label: 'In Repair' },
                                        { value: 'retired', label: 'Retired' },
                                    ]}
                                />
                            </div>

                            <div className="sm:col-span-3 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowMoreFilters(!showMoreFilters)}
                                    className={`flex-1 py-2 px-3 rounded-sm border text-xs font-medium transition cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                                        showMoreFilters || extraFilterCount > 0
                                            ? 'border-[#026eff]/40 bg-[#026eff]/5 text-[#026eff] dark:text-sky-400'
                                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    <RiFilter3Line className="w-3.5 h-3.5 shrink-0" />
                                    <span>More Filters</span>
                                    {extraFilterCount > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-sm bg-[#026eff] text-white text-[10px] leading-none tabular-nums">
                                            {extraFilterCount}
                                        </span>
                                    )}
                                </button>

                                {activeFilterCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="py-2 px-2.5 text-xs font-medium rounded-sm border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
                                        title="Reset all filters"
                                    >
                                        <RiRefreshLine className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">{devices.total}</span> units
                            </span>

                            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 p-0.5 rounded-sm">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('table')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-[11px] font-medium transition cursor-pointer ${
                                        viewMode === 'table'
                                            ? 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                                            : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    <RiTableLine className="w-3.5 h-3.5" />
                                    <span>Table</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('grid')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-[11px] font-medium transition cursor-pointer ${
                                        viewMode === 'grid'
                                            ? 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                                            : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    <RiLayoutGridLine className="w-3.5 h-3.5" />
                                    <span>Cards</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {showMoreFilters && (
                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <CustomSelect
                                value={warranty}
                                onChange={(val) => setWarranty(val)}
                                placeholder="All Warranties"
                                options={[
                                    { value: 'active', label: 'Warranty: Active' },
                                    { value: 'expiring_soon', label: 'Expiring Soon (≤ 60d)' },
                                    { value: 'expired', label: 'Warranty: Expired' },
                                    { value: 'none', label: 'No Warranty Recorded' },
                                ]}
                            />

                            <CustomSelect
                                value={lifecycleStage}
                                onChange={(val) => setLifecycleStage(val)}
                                placeholder="All Lifecycle Stages"
                                options={[
                                    { value: 'acquisition', label: 'Acquisition' },
                                    { value: 'deployment', label: 'Deployment' },
                                    { value: 'reclaimed', label: 'Reclaimed' },
                                    { value: 'maintenance', label: 'Maintenance' },
                                    { value: 'retirement', label: 'Retirement' },
                                ]}
                            />

                            <CustomSelect
                                value={condition}
                                onChange={(val) => setCondition(val)}
                                placeholder="All Conditions"
                                options={[
                                    { value: 'excellent', label: 'Excellent' },
                                    { value: 'good', label: 'Good' },
                                    { value: 'fair', label: 'Fair' },
                                    { value: 'needs_repair', label: 'Needs Repair' },
                                    { value: 'retired', label: 'Retired' },
                                ]}
                            />

                            {isComputeFilter && (
                                <CustomSelect
                                    value={cpuTier}
                                    onChange={(val) => setCpuTier(val)}
                                    placeholder="All CPU Tiers"
                                    options={[
                                        { value: 'entry', label: 'Entry Tier' },
                                        { value: 'mid', label: 'Mid Tier' },
                                        { value: 'high', label: 'High Tier' },
                                        { value: 'workstation', label: 'Workstation Tier' },
                                    ]}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Table vs Cards */}
            {viewMode === 'table' ? (
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="py-3 px-4">{renderSortButton('Asset & Model', 'model')}</th>
                                    <th className="py-3 px-4">{renderSortButton('Specs', 'specs')}</th>
                                    <th className="py-3 px-4">{renderSortButton('Status', 'status')}</th>
                                    <th className="py-3 px-4">{renderSortButton('Custodian & Location', 'location')}</th>
                                    <th className="py-3 px-4">{renderSortButton('Warranty', 'warranty')}</th>
                                    <th className="py-3 px-4 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                                {devices.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-14 text-center text-zinc-400 dark:text-zinc-500">
                                            No hardware assets found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    devices.data.map((device) => {
                                        const st = statusBadgeMap[device.status] || statusBadgeMap.retired;
                                        const wr = warrantyBadgeMap[device.warranty_status] || warrantyBadgeMap.none;
                                        const warrantySubtext =
                                            device.warranty_status === 'expiring_soon' || device.warranty_status === 'expired'
                                                ? formatRelativeDays(device.days_until_warranty_expiry)
                                                : formatDisplayDate(device.warranty_expiry, 'No expiry date');

                                        return (
                                            <tr
                                                key={device.id}
                                                onClick={() => router.visit(route('devices.show', device.id))}
                                                className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                                            >
                                                <td className="py-3.5 px-4 min-w-[230px]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0 overflow-hidden">
                                                            <HardwareImage
                                                                src={device.image_clip_url || device.image_url}
                                                                alt={`${device.brand} ${device.model}`}
                                                                deviceType={device.device_type}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-[13px] leading-snug truncate max-w-[220px]">
                                                                {device.brand} {device.model}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                                                <span className="font-mono font-medium text-[#026eff] dark:text-sky-400">
                                                                    {device.asset_tag}
                                                                </span>
                                                                <span className="text-zinc-300 dark:text-zinc-700">&bull;</span>
                                                                <span className="capitalize">{device.device_type}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="py-3.5 px-4 min-w-[200px]">
                                                    {['laptop', 'desktop'].includes(device.device_type) ? (
                                                        <>
                                                            <div className="font-medium text-zinc-800 dark:text-zinc-200 text-xs truncate max-w-[210px]" title={device.cpu}>
                                                                {device.cpu || '—'}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                                                                {device.ram_gb ? <span>{device.ram_gb}GB RAM</span> : null}
                                                                {device.ram_gb && device.storage_gb ? <span className="text-zinc-300 dark:text-zinc-700">&middot;</span> : null}
                                                                {device.storage_gb ? <span>{device.storage_gb}GB {device.storage_type}</span> : null}
                                                                {device.gpu_tier && device.gpu_tier !== 'none' && (
                                                                    <>
                                                                        <span className="text-zinc-300 dark:text-zinc-700">&middot;</span>
                                                                        <span className="text-[#026eff] dark:text-sky-400 capitalize">{device.gpu_tier}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="font-medium text-zinc-800 dark:text-zinc-200 text-xs truncate max-w-[210px]">
                                                                {device.spec_summary || `${device.brand} ${device.model}`}
                                                            </div>
                                                            <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 capitalize">
                                                                {device.device_type} Asset
                                                            </div>
                                                        </>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border border-current/15 inline-flex items-center gap-1.5 ${st.pill}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-sm ${st.dot}`} />
                                                            {st.label}
                                                        </span>
                                                        {device.lifecycle_stage && device.lifecycle_stage !== 'deployment' && (
                                                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 capitalize">
                                                                {device.lifecycle_stage}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="py-3.5 px-4 min-w-[180px]">
                                                    {device.active_assignment?.employee ? (
                                                        <div className="font-medium text-zinc-900 dark:text-zinc-100 text-xs truncate max-w-[185px]">
                                                            {device.active_assignment.employee.name}
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                                            <RiCheckboxCircleLine className="w-3.5 h-3.5 shrink-0" />
                                                            <span>Pool Ready</span>
                                                        </span>
                                                    )}
                                                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[185px]">
                                                        <RiMapPinLine className="w-3 h-3 shrink-0" />
                                                        <span className="truncate">{device.location || 'Stockroom Pool'}</span>
                                                    </div>
                                                </td>

                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-sm border border-current/15 ${wr.pill}`}>
                                                        {wr.label}
                                                    </span>
                                                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                                                        {warrantySubtext}
                                                    </div>
                                                </td>

                                                <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                    <Link
                                                        href={route('devices.show', device.id)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 group-hover:border-[#026eff] group-hover:text-[#026eff] dark:group-hover:text-sky-400 transition"
                                                    >
                                                        <span>Inspect</span>
                                                        <RiArrowRightLine className="w-3 h-3" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {devices.data.length === 0 ? (
                        <div className="col-span-full py-16 text-center text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 text-xs">
                            No hardware assets found matching your filters.
                        </div>
                    ) : (
                        devices.data.map((device) => {
                            const st = statusBadgeMap[device.status] || statusBadgeMap.retired;
                            const wr = warrantyBadgeMap[device.warranty_status] || warrantyBadgeMap.none;

                            return (
                                <div
                                    key={device.id}
                                    onClick={() => router.visit(route('devices.show', device.id))}
                                    className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition cursor-pointer flex flex-col justify-between group"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <span className="font-mono text-[11px] font-medium text-[#026eff] dark:text-sky-400">
                                                {device.asset_tag}
                                            </span>
                                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border border-current/15 inline-flex items-center gap-1.5 ${st.pill}`}>
                                                <span className={`w-1.5 h-1.5 rounded-sm ${st.dot}`} />
                                                {st.label}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 mb-3.5">
                                            <div className="w-12 h-12 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0">
                                                <HardwareImage
                                                    src={device.image_clip_url || device.image_url}
                                                    alt={`${device.brand} ${device.model}`}
                                                    deviceType={device.device_type}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                                                    {device.brand} {device.model}
                                                </h4>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 capitalize">
                                                    {['laptop', 'desktop'].includes(device.device_type)
                                                        ? (device.cpu || device.device_type)
                                                        : `${device.device_type} · ${device.spec_summary || 'Standard Hardware'}`}
                                                </p>
                                            </div>
                                        </div>

                                        {['laptop', 'desktop'].includes(device.device_type) ? (
                                            <div className="flex flex-wrap gap-1.5 mb-3 text-[11px] text-zinc-600 dark:text-zinc-300">
                                                {device.ram_gb ? (
                                                    <span className="px-2 py-0.5 rounded-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                                        {device.ram_gb}GB RAM
                                                    </span>
                                                ) : null}
                                                {device.storage_gb ? (
                                                    <span className="px-2 py-0.5 rounded-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                                        {device.storage_gb}GB {device.storage_type}
                                                    </span>
                                                ) : null}
                                                <span className={`px-2 py-0.5 rounded-sm border border-current/15 ${wr.pill}`}>
                                                    Warranty: {wr.label}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5 mb-3 text-[11px] text-zinc-600 dark:text-zinc-300">
                                                <span className="px-2 py-0.5 rounded-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 capitalize">
                                                    {device.device_type}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-sm border border-current/15 ${wr.pill}`}>
                                                    Warranty: {wr.label}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 mb-3 truncate">
                                            <RiMapPinLine className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{device.location || 'Stockroom Pool'}</span>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                                        <div className="min-w-0">
                                            {device.active_assignment?.employee ? (
                                                <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate block max-w-[160px]">
                                                    {device.active_assignment.employee.name}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                                    <RiCheckboxCircleLine className="w-3.5 h-3.5" />
                                                    <span>Pool Ready</span>
                                                </span>
                                            )}
                                        </div>
                                        <Link
                                            href={route('devices.show', device.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1 font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-[#026eff] dark:group-hover:text-sky-400 transition-colors"
                                        >
                                            <span>Inspect</span>
                                            <RiArrowRightLine className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            <Pagination links={devices.links} from={devices.from} to={devices.to} total={devices.total} label="units" />
        </AuthenticatedLayout>
    );
}
