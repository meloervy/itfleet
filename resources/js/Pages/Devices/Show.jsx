import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CustomSelect from '@/Components/CustomSelect';
import DeviceFinancialCard from '@/Components/Devices/DeviceFinancialCard';
import DeviceLifecycleStepper from '@/Components/Devices/DeviceLifecycleStepper';
import {
    LogMaintenanceModal,
    TransitionLifecycleModal,
    UpdateMaintenanceLogModal,
} from '@/Components/Devices/DeviceModals';
import Dropdown from '@/Components/Dropdown';
import HardwareImage from '@/Components/HardwareImage';
import {
    formatDisplayDate,
    formatPhp,
    formatRelativeDays,
    toDateInputValue,
} from '@/lib/formatters';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import axios from 'axios';
import { useState } from 'react';
import {
    RiArchiveLine,
    RiArrowLeftLine,
    RiArrowRightLine,
    RiBarcodeLine,
    RiCheckDoubleLine,
    RiCheckLine,
    RiCheckboxCircleLine,
    RiCloseLine,
    RiCpuLine,
    RiDatabase2Line,
    RiDeleteBinLine,
    RiEditLine,
    RiEqualizerLine,
    RiErrorWarningLine,
    RiExchangeLine,
    RiFileCopyLine,
    RiHardDrive2Line,
    RiInformationLine,
    RiLoader4Line,
    RiMapPinLine,
    RiMoreFill,
    RiPriceTag3Line,
    RiPulseLine,
    RiQrCodeLine,
    RiSaveLine,
    RiShieldCheckLine,
    RiSparklingLine,
    RiToolsLine,
    RiTv2Line,
    RiUser3Line,
} from 'react-icons/ri';

const conditionOptions = [
    { value: 'excellent', label: 'Excellent (Like New / Minimal Wear)', badge: 'Like New', icon: RiCheckboxCircleLine },
    { value: 'good', label: 'Good (Normal Operational Wear)', badge: 'Standard', icon: RiCheckboxCircleLine },
    { value: 'fair', label: 'Fair (Noticeable Scratches / Moderate Wear)', badge: 'Used', icon: RiInformationLine },
    { value: 'needs_repair', label: 'Needs Repair (Requires Servicing / Degraded)', badge: 'Needs Repair', icon: RiToolsLine },
    { value: 'retired', label: 'Retired (Decommissioned)', badge: 'Retired', icon: RiArchiveLine },
];

const statusOptions = [
    { value: 'available', label: 'Available in Pool Stock', badge: 'Stockroom', icon: RiCheckboxCircleLine },
    { value: 'assigned', label: 'Assigned to Employee', badge: 'In Use', icon: RiUser3Line },
    { value: 'in_repair', label: 'Under Servicing / In Repair', badge: 'Servicing', icon: RiToolsLine },
    { value: 'retired', label: 'Decommissioned / Retired', badge: 'Archived', icon: RiArchiveLine },
];

const fieldInputClasses =
    'w-full text-sm rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 py-2 px-3 focus:outline-none focus:border-[#026eff] focus:ring-0 transition';

const fitBadgeStyle = (score) => {
    const s = Number(score);
    if (s >= 0.8) {
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400';
    }
    if (s >= 0.65) {
        return 'bg-[#026eff]/10 border-[#026eff]/20 text-[#026eff] dark:text-sky-400';
    }

    return 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400';
};

export default function DevicesShow({ device, employees = [], can_view_financials = true }) {
    const { auth } = usePage().props;
    const user = auth?.user;
    const isAdminOrManager = ['admin', 'manager'].includes(user?.role);
    const canPerformMaintenance = ['admin', 'manager', 'technician'].includes(user?.role);
    const canViewFinancials = Boolean(can_view_financials) && user?.role !== 'technician';
    const isAssigned = device.status === 'assigned' || Boolean(device.active_assignment);
    const isCompute = ['laptop', 'desktop'].includes(device.device_type);
    const isAppleHardware =
        String(device.brand || '').toLowerCase() === 'apple' ||
        String(device.cpu || '').toLowerCase().includes('apple m');

    const [activeTab, setActiveTab] = useState('overview');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showLifecycleModal, setShowLifecycleModal] = useState(false);
    const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
    const [selectedLogToUpdate, setSelectedLogToUpdate] = useState(null);
    const [copiedField, setCopiedField] = useState(null);
    const [fetchingPhoto, setFetchingPhoto] = useState(false);
    const [photoNotice, setPhotoNotice] = useState(null);

    const {
        data: editData,
        setData: setEditData,
        put: putUpdate,
        processing: updateProcessing,
        errors: editErrors,
        reset: resetEdit,
    } = useForm({
        asset_tag: device.asset_tag || '',
        serial_number: device.serial_number || '',
        barcode: device.barcode || '',
        techspecs_id: device.techspecs_id || '',
        image_url: device.image_url || '',
        device_type: device.device_type || 'laptop',
        brand: device.brand || '',
        model: device.model || '',
        location: device.location || '',
        cpu: device.cpu || '',
        cpu_tier: device.cpu_tier || 'mid',
        ram_gb: device.ram_gb || 16,
        storage_type: device.storage_type || 'SSD',
        storage_gb: device.storage_gb || 512,
        gpu: device.gpu || '',
        gpu_tier: device.gpu_tier || 'none',
        specifications: device.specifications || {},
        year_acquired: device.year_acquired || new Date().getFullYear(),
        purchase_cost: device.purchase_cost ?? '',
        purchase_date: toDateInputValue(device.purchase_date),
        depreciation_rate_percent: device.depreciation_rate_percent ?? 20.0,
        vendor: device.vendor || '',
        warranty_start: toDateInputValue(device.warranty_start),
        warranty_expiry: toDateInputValue(device.warranty_expiry),
        contract_sla: device.contract_sla || '',
        condition: device.condition || 'excellent',
        status: device.status || 'available',
        lifecycle_stage: device.lifecycle_stage || 'deployment',
        notes: device.notes || '',
    });

    const handleCopy = (text, fieldName) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleFetchHardwarePhoto = async () => {
        if (!editData.brand && !editData.model) {
            setPhotoNotice({ type: 'error', message: 'Please enter a Brand and Model first.' });
            return;
        }
        setFetchingPhoto(true);
        setPhotoNotice(null);
        try {
            const res = await axios.post(route('hardware.image-lookup'), {
                brand: editData.brand,
                model: editData.model,
                device_type: editData.device_type,
            });
            if (res.data.image_url) {
                setEditData('image_url', res.data.image_url);
                const sourceLabel =
                    res.data.source === 'google_search'
                        ? 'Google Image Search'
                        : res.data.source === 'public_asset'
                        ? 'Hardware Asset Library'
                        : 'Wikimedia Commons';
                setPhotoNotice({ type: 'success', message: `Found authentic photo from ${sourceLabel}.` });
            } else {
                setPhotoNotice({ type: 'info', message: 'No exact photo found in database. You may enter a custom URL.' });
            }
        } catch {
            setPhotoNotice({ type: 'error', message: 'Failed to look up hardware image. Please check network connection.' });
        } finally {
            setFetchingPhoto(false);
        }
    };

    const handleCancelEdit = () => {
        resetEdit();
        setPhotoNotice(null);
        setIsEditing(false);
    };

    const { data: lifecycleData, setData: setLifecycleData, post: postLifecycle, processing: lifecycleProcessing, reset: resetLifecycle } = useForm({
        to_stage: device.lifecycle_stage,
        notes: '',
    });

    const { data: maintData, setData: setMaintData, post: postMaintenance, processing: maintProcessing, reset: resetMaintenance } = useForm({
        type: 'repair',
        title: '',
        description: '',
        cost: 0,
        performed_by: '',
        started_at: new Date().toISOString().split('T')[0],
        completed_at: '',
        performance_assessment: '',
        status: 'in_progress',
        send_to_maintenance_stage: true,
    });

    const { data: updateMaintData, setData: setUpdateMaintData, put: putMaintenanceLog, processing: updateMaintProcessing } = useForm({
        cost: 0,
        completed_at: new Date().toISOString().split('T')[0],
        performance_assessment: '',
        status: 'completed',
        restore_to_available: true,
    });

    const { post: postRetire } = useForm();
    const {
        data: assignData,
        setData: setAssignData,
        post: postAssign,
        processing: assignProcessing,
    } = useForm({ employee_id: '' });
    const { post: postDeviceUnassign, processing: unassignProcessing } = useForm({});

    const handleDirectAssign = (e) => {
        e.preventDefault();
        if (!assignData.employee_id) return;
        postAssign(route('devices.assign', device.id), {
            preserveScroll: true,
            onSuccess: () => setAssignData('employee_id', ''),
        });
    };

    const handleDirectUnassign = () => {
        postDeviceUnassign(route('devices.unassign', device.id), { preserveScroll: true });
    };

    const handleUpdate = (e) => {
        e.preventDefault();
        putUpdate(route('devices.update', device.id), {
            onSuccess: () => {
                setIsEditing(false);
                setPhotoNotice(null);
            },
        });
    };

    const handleLifecycleTransition = (e) => {
        e.preventDefault();
        postLifecycle(route('devices.lifecycle.update', device.id), {
            onSuccess: () => {
                setShowLifecycleModal(false);
                resetLifecycle();
            },
        });
    };

    const handleCreateMaintenance = (e) => {
        e.preventDefault();
        postMaintenance(route('devices.maintenance.store', device.id), {
            onSuccess: () => {
                setShowMaintenanceModal(false);
                resetMaintenance();
            },
        });
    };

    const handleOpenUpdateLog = (log) => {
        setSelectedLogToUpdate(log);
        setUpdateMaintData({
            cost: log.cost || 0,
            completed_at: toDateInputValue(log.completed_at) || new Date().toISOString().split('T')[0],
            performance_assessment: log.performance_assessment || '',
            status: 'completed',
            restore_to_available: true,
        });
    };

    const handleUpdateMaintenanceLog = (e) => {
        e.preventDefault();
        if (!selectedLogToUpdate) return;
        putMaintenanceLog(route('maintenance.update', selectedLogToUpdate.id), {
            onSuccess: () => setSelectedLogToUpdate(null),
        });
    };

    const handleRetire = () => {
        if (confirm(`Are you sure you want to decommission and retire ${device.asset_tag}? This will release any active employee assignment and move asset to Retirement stage.`)) {
            postRetire(route('devices.retire', device.id));
        }
    };

    const handleDelete = () => {
        if (isAssigned) {
            alert('Cannot delete an assigned device. Please unassign or reclaim the asset first.');
            return;
        }
        if (confirm(`Are you sure you want to permanently delete device ${device.asset_tag}? This action cannot be undone.`)) {
            router.delete(route('devices.destroy', device.id), {
                onStart: () => setIsDeleting(true),
                onFinish: () => setIsDeleting(false),
            });
        }
    };

    const stages = [
        { key: 'acquisition', label: 'Acquisition', desc: 'Procurement & staging' },
        { key: 'deployment', label: 'Deployment', desc: 'Active production' },
        { key: 'reclaimed', label: 'Reclaimed', desc: 'Sanitized in pool' },
        { key: 'maintenance', label: 'Maintenance', desc: 'Repairs & servicing' },
        { key: 'retirement', label: 'Retirement', desc: 'Decommissioned / EOL' },
    ];
    const currentStageIndex = stages.findIndex((s) => s.key === device.lifecycle_stage);

    const conditionConfig = {
        excellent: {
            label: 'Excellent Condition',
            scoreText: '100% Health',
            barWidth: 'w-full',
            barColor: 'bg-emerald-500',
            textColor: 'text-emerald-700 dark:text-emerald-400',
            badgeBg: 'bg-emerald-500/10',
            desc: 'Flawless chassis, display, and components. Exceeds standard operating parameters.',
        },
        good: {
            label: 'Good Condition',
            scoreText: '75% Health',
            barWidth: 'w-3/4',
            barColor: 'bg-[#026eff]',
            textColor: 'text-[#026eff] dark:text-sky-400',
            badgeBg: 'bg-[#026eff]/10',
            desc: 'Minor cosmetic signs of normal operational usage. Full hardware health.',
        },
        fair: {
            label: 'Fair Condition',
            scoreText: '50% Health',
            barWidth: 'w-1/2',
            barColor: 'bg-amber-500',
            textColor: 'text-amber-700 dark:text-amber-400',
            badgeBg: 'bg-amber-500/10',
            desc: 'Moderate wear or surface scratches. Functional and suitable for general productivity.',
        },
        needs_repair: {
            label: 'Needs Repair / Degraded',
            scoreText: '25% Health',
            barWidth: 'w-1/4',
            barColor: 'bg-rose-500',
            textColor: 'text-rose-700 dark:text-rose-400',
            badgeBg: 'bg-rose-500/10',
            desc: 'Heavy wear or component failure. Recommended for hardware servicing intake.',
        },
        retired: {
            label: 'Retired / Decommissioned',
            scoreText: '0% Health',
            barWidth: 'w-0',
            barColor: 'bg-zinc-400',
            textColor: 'text-zinc-600 dark:text-zinc-400',
            badgeBg: 'bg-zinc-200/70 dark:bg-zinc-800',
            desc: 'Asset decommissioned from active circulation and awaiting disposal/recycling.',
        },
    };
    const activeCondition = conditionConfig[device.condition] || conditionConfig.good;

    const statusConfig = {
        available: {
            label: 'Available in Fleet',
            bg: 'bg-emerald-500/10',
            text: 'text-emerald-700 dark:text-emerald-400',
            dot: 'bg-emerald-500',
        },
        assigned: {
            label: 'Assigned to Custodian',
            bg: 'bg-[#026eff]/10',
            text: 'text-[#026eff] dark:text-sky-400',
            dot: 'bg-[#026eff] dark:bg-sky-400',
        },
        in_repair: {
            label: 'Under Servicing',
            bg: 'bg-amber-500/10',
            text: 'text-amber-700 dark:text-amber-400',
            dot: 'bg-amber-500',
        },
        retired: {
            label: 'Retired',
            bg: 'bg-zinc-100 dark:bg-zinc-800',
            text: 'text-zinc-600 dark:text-zinc-400',
            dot: 'bg-zinc-400',
        },
    };
    const currentStatus = statusConfig[isEditing ? editData.status : device.status] || statusConfig.available;

    const purchaseCost = Number(device.purchase_cost || 0);
    const bookValue = Number(device.current_book_value ?? purchaseCost);
    const totalDepreciated = Math.max(0, purchaseCost - bookValue);
    const deprPercent = purchaseCost > 0 ? Math.min(100, Math.max(0, Math.round((totalDepreciated / purchaseCost) * 100))) : 0;
    const retainedPercent = 100 - deprPercent;

    const maintenanceLogs = device.maintenance_logs || [];
    const assignmentsHistory = device.assignments || [];
    const lifecycleEvents = device.lifecycle_events || [];
    const warrantyCountdown = formatRelativeDays(device.days_until_warranty_expiry);

    const tabs = [
        { key: 'overview', label: 'Overview' },
        ...(canViewFinancials ? [{ key: 'financials', label: 'Financials & Warranty' }] : []),
        { key: 'maintenance', label: `Maintenance (${maintenanceLogs.length})` },
        { key: 'history', label: `History (${assignmentsHistory.length + lifecycleEvents.length})` },
    ];

    return (
        <AuthenticatedLayout
            header={
                <div className="space-y-3">
                    <Link
                        href={route('devices.index')}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
                    >
                        <RiArrowLeftLine className="w-3.5 h-3.5" />
                        <span>Back to Inventory</span>
                    </Link>

                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex items-start gap-4 min-w-0">
                            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0 overflow-hidden">
                                <HardwareImage
                                    src={isEditing ? (editData.image_url || device.image_clip_url || device.image_url) : (device.image_clip_url || device.image_url)}
                                    alt={`${device.brand} ${device.model}`}
                                    deviceType={device.device_type}
                                    className="w-full h-full object-cover object-center"
                                />
                            </div>

                            <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                                        {isEditing
                                            ? `Editing: ${editData.brand || device.brand} ${editData.model || device.model}`
                                            : `${device.brand} ${device.model}`}
                                    </h1>
                                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-sm border border-current/15 ${currentStatus.bg} ${currentStatus.text}`}>
                                        <span className={`w-1.5 h-1.5 rounded-sm ${currentStatus.dot}`} />
                                        <span>{currentStatus.label}</span>
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                    <span className="capitalize font-medium text-zinc-700 dark:text-zinc-300">{device.device_type}</span>
                                    {isCompute ? (
                                        <>
                                            <span>&middot;</span>
                                            <span>{device.cpu}</span>
                                            <span>&middot;</span>
                                            <span className="tabular-nums">{device.ram_gb} GB {isAppleHardware ? 'Unified Memory' : 'RAM'}</span>
                                            <span>&middot;</span>
                                            <span className="tabular-nums">{device.storage_gb} GB {device.storage_type}</span>
                                            {device.gpu && (
                                                <>
                                                    <span>&middot;</span>
                                                    <span>{device.gpu}</span>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        device.spec_summary && (
                                            <>
                                                <span>&middot;</span>
                                                <span>{device.spec_summary}</span>
                                            </>
                                        )
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(isEditing ? editData.asset_tag : device.asset_tag, 'asset_tag')}
                                        title="Copy Asset Tag"
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition cursor-pointer text-zinc-700 dark:text-zinc-300"
                                    >
                                        <RiPriceTag3Line className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                        <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                                            {isEditing ? editData.asset_tag : device.asset_tag}
                                        </span>
                                        {copiedField === 'asset_tag' ? (
                                            <RiCheckLine className="w-3 h-3 text-emerald-500" />
                                        ) : (
                                            <RiFileCopyLine className="w-3 h-3 text-zinc-400" />
                                        )}
                                    </button>

                                    {(isEditing ? editData.serial_number : device.serial_number) && (
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(isEditing ? editData.serial_number : device.serial_number, 'serial')}
                                            title="Copy Serial Number"
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition cursor-pointer text-zinc-600 dark:text-zinc-300"
                                        >
                                            <RiBarcodeLine className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                            <span className="font-mono text-[11px]">
                                                SN: {isEditing ? editData.serial_number : device.serial_number}
                                            </span>
                                            {copiedField === 'serial' ? (
                                                <RiCheckLine className="w-3 h-3 text-emerald-500" />
                                            ) : (
                                                <RiFileCopyLine className="w-3 h-3 text-zinc-400" />
                                            )}
                                        </button>
                                    )}

                                    {(isEditing ? editData.barcode : device.barcode) && (
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(isEditing ? editData.barcode : device.barcode, 'barcode')}
                                            title="Copy Barcode"
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition cursor-pointer text-zinc-600 dark:text-zinc-300"
                                        >
                                            <RiQrCodeLine className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                            <span className="font-mono text-[11px]">
                                                BC: {isEditing ? editData.barcode : device.barcode}
                                            </span>
                                            {copiedField === 'barcode' ? (
                                                <RiCheckLine className="w-3 h-3 text-emerald-500" />
                                            ) : (
                                                <RiFileCopyLine className="w-3 h-3 text-zinc-400" />
                                            )}
                                        </button>
                                    )}

                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-xs">
                                        <RiMapPinLine className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                        <span>{(isEditing ? editData.location : device.location) || 'Pool Stock'}</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {isEditing ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="h-8 inline-flex items-center gap-1.5 px-3 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                    >
                                        <RiCloseLine className="w-3.5 h-3.5" />
                                        <span>Discard</span>
                                    </button>
                                    <button
                                        type="submit"
                                        form="edit-device-form"
                                        disabled={updateProcessing}
                                        className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white text-xs font-medium transition disabled:opacity-50 cursor-pointer"
                                    >
                                        {updateProcessing ? (
                                            <>
                                                <RiLoader4Line className="animate-spin h-3.5 w-3.5" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <RiSaveLine className="w-3.5 h-3.5" />
                                                <span>Save Changes</span>
                                            </>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {canPerformMaintenance && (
                                        <button
                                            type="button"
                                            onClick={() => setShowMaintenanceModal(true)}
                                            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                        >
                                            <RiToolsLine className="w-3.5 h-3.5 text-amber-500" />
                                            <span>Log Servicing</span>
                                        </button>
                                    )}

                                    {isAdminOrManager && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditing(true)}
                                                className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-xs font-medium text-white transition cursor-pointer"
                                            >
                                                <RiEditLine className="w-3.5 h-3.5" />
                                                <span>Edit Asset</span>
                                            </button>

                                            <Dropdown>
                                                <Dropdown.Trigger>
                                                    <button
                                                        type="button"
                                                        className="h-8 w-8 inline-flex items-center justify-center rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                                        aria-label="More asset actions"
                                                    >
                                                        <RiMoreFill className="w-4 h-4" />
                                                    </button>
                                                </Dropdown.Trigger>
                                                <Dropdown.Content align="right" width="56">
                                                    <Dropdown.Header title="Asset Actions" />
                                                    <Dropdown.Button
                                                        icon={RiExchangeLine}
                                                        variant="primary"
                                                        onClick={() => setShowLifecycleModal(true)}
                                                    >
                                                        Transition Lifecycle
                                                    </Dropdown.Button>
                                                    {device.status !== 'retired' && (
                                                        <Dropdown.Button
                                                            icon={RiArchiveLine}
                                                            onClick={handleRetire}
                                                        >
                                                            Retire Asset
                                                        </Dropdown.Button>
                                                    )}
                                                    <Dropdown.Divider />
                                                    <Dropdown.Button
                                                        icon={RiDeleteBinLine}
                                                        variant="danger"
                                                        disabled={isAssigned || isDeleting}
                                                        onClick={handleDelete}
                                                        description={isAssigned ? 'Unassign custodian before deleting' : undefined}
                                                    >
                                                        {isDeleting ? 'Deleting...' : 'Delete Asset'}
                                                    </Dropdown.Button>
                                                </Dropdown.Content>
                                            </Dropdown>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            }
        >
            <Head title={`${device.asset_tag} - ${isEditing ? 'Edit Asset Record' : 'Hardware Details'}`} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-8 space-y-5">
                    {isEditing ? (
                        <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5">
                            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3.5 mb-5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                        Edit Asset Record
                                    </h3>
                                    <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                                        {device.asset_tag}
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Update physical tagging, serial number, barcode, location, condition, and image URL.
                                </p>
                            </div>

                            <form id="edit-device-form" onSubmit={handleUpdate} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                            Asset Tag <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={editData.asset_tag}
                                            onChange={(e) => setEditData('asset_tag', e.target.value.toUpperCase())}
                                            placeholder="e.g. LAP-023"
                                            className={`${fieldInputClasses} font-mono ${editErrors.asset_tag ? 'border-rose-400 dark:border-rose-600' : ''}`}
                                            required
                                        />
                                        {editErrors.asset_tag && (
                                            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                                <RiErrorWarningLine className="w-3.5 h-3.5 shrink-0" />
                                                <span>{editErrors.asset_tag}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                            Serial Number
                                        </label>
                                        <input
                                            type="text"
                                            value={editData.serial_number}
                                            onChange={(e) => setEditData('serial_number', e.target.value)}
                                            placeholder="e.g. C02G45XP19F3"
                                            className={`${fieldInputClasses} font-mono ${editErrors.serial_number ? 'border-rose-400 dark:border-rose-600' : ''}`}
                                        />
                                        {editErrors.serial_number && (
                                            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                                <RiErrorWarningLine className="w-3.5 h-3.5 shrink-0" />
                                                <span>{editErrors.serial_number}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                            Barcode
                                        </label>
                                        <input
                                            type="text"
                                            value={editData.barcode}
                                            onChange={(e) => setEditData('barcode', e.target.value)}
                                            placeholder="e.g. 748291038472"
                                            className={`${fieldInputClasses} font-mono ${editErrors.barcode ? 'border-rose-400 dark:border-rose-600' : ''}`}
                                        />
                                        {editErrors.barcode && (
                                            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                                <RiErrorWarningLine className="w-3.5 h-3.5 shrink-0" />
                                                <span>{editErrors.barcode}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                            Physical Location
                                        </label>
                                        <input
                                            type="text"
                                            value={editData.location}
                                            onChange={(e) => setEditData('location', e.target.value)}
                                            placeholder="e.g. Floor 3 - IT Room"
                                            className={`${fieldInputClasses} ${editErrors.location ? 'border-rose-400 dark:border-rose-600' : ''}`}
                                        />
                                        {editErrors.location && (
                                            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                                <RiErrorWarningLine className="w-3.5 h-3.5 shrink-0" />
                                                <span>{editErrors.location}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                            Physical Condition <span className="text-rose-500">*</span>
                                        </label>
                                        <CustomSelect
                                            value={editData.condition}
                                            onChange={(val) => setEditData('condition', val)}
                                            options={conditionOptions}
                                            placeholder="Select physical condition..."
                                            size="md"
                                        />
                                        {editErrors.condition && (
                                            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{editErrors.condition}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                            Fleet Availability Status <span className="text-rose-500">*</span>
                                        </label>
                                        <CustomSelect
                                            value={editData.status}
                                            onChange={(val) => setEditData('status', val)}
                                            options={statusOptions}
                                            placeholder="Select fleet status..."
                                            size="md"
                                        />
                                        {editErrors.status && (
                                            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{editErrors.status}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                            Device Image URL
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleFetchHardwarePhoto}
                                            disabled={fetchingPhoto}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-[#026eff]/30 bg-[#026eff]/10 text-[#026eff] dark:text-sky-400 hover:bg-[#026eff]/15 text-xs font-medium transition disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                                        >
                                            <RiSparklingLine className="w-3.5 h-3.5" />
                                            <span>{fetchingPhoto ? 'Searching...' : 'Auto-Fetch Photo'}</span>
                                        </button>
                                    </div>
                                    <input
                                        type="url"
                                        value={editData.image_url}
                                        onChange={(e) => setEditData('image_url', e.target.value)}
                                        placeholder="https://... (Auto-fetch photo or enter custom URL)"
                                        className={fieldInputClasses}
                                    />
                                    {photoNotice && (
                                        <p className={`text-xs ${
                                            photoNotice.type === 'success'
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : photoNotice.type === 'error'
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : 'text-amber-600 dark:text-amber-400'
                                        }`}>
                                            {photoNotice.message}
                                        </p>
                                    )}
                                    {editErrors.image_url && (
                                        <p className="text-xs text-rose-600 dark:text-rose-400">{editErrors.image_url}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                        Internal Audit Notes
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={editData.notes}
                                        onChange={(e) => setEditData('notes', e.target.value)}
                                        placeholder="Peripheral serial numbers, physical condition notes, or intake remarks..."
                                        className={fieldInputClasses}
                                    />
                                    {editErrors.notes && (
                                        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{editErrors.notes}</p>
                                    )}
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="px-3.5 py-2 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={updateProcessing}
                                        className="px-4 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white text-xs font-medium transition disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                                    >
                                        {updateProcessing ? (
                                            <>
                                                <RiLoader4Line className="animate-spin h-3.5 w-3.5" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <RiSaveLine className="w-3.5 h-3.5" />
                                                <span>Save Changes</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <>
                            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 px-4 pt-2 flex items-center gap-1 overflow-x-auto">
                                {tabs.map((tab) => {
                                    const isActive = activeTab === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setActiveTab(tab.key)}
                                            className={`px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                                                isActive
                                                    ? 'border-[#026eff] text-[#026eff] dark:text-sky-400'
                                                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {activeTab === 'overview' && (
                                <div className="space-y-5">
                                    <DeviceLifecycleStepper
                                        device={device}
                                        stages={stages}
                                        currentStageIndex={currentStageIndex}
                                        onOpenTransition={() => setShowLifecycleModal(true)}
                                        canTransition={isAdminOrManager}
                                    />

                                    <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5">
                                        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                                            <div>
                                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                    Hardware Specifications &amp; Health
                                                </h3>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                    Core architecture, memory, storage, and physical rating
                                                </p>
                                            </div>
                                        </div>

                                        {isCompute ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                                                <div className="flex items-start gap-3">
                                                    <RiCpuLine className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                                                    <div className="min-w-0">
                                                        <dt className="text-[11px] text-zinc-400 dark:text-zinc-500">Processor (CPU)</dt>
                                                        <dd className="font-medium text-zinc-900 dark:text-zinc-100 text-xs mt-0.5 truncate">{device.cpu}</dd>
                                                        <span className="text-[11px] text-[#026eff] dark:text-sky-400 capitalize">{device.cpu_tier} tier</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-3">
                                                    <RiDatabase2Line className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                                                    <div className="min-w-0">
                                                        <dt className="text-[11px] text-zinc-400 dark:text-zinc-500">System Memory</dt>
                                                        <dd className="font-medium text-zinc-900 dark:text-zinc-100 text-xs mt-0.5 tabular-nums">
                                                            {device.ram_gb} GB {isAppleHardware ? 'Unified Memory' : 'RAM'}
                                                        </dd>
                                                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                                            {isAppleHardware ? 'Unified SoC memory' : 'Installed system memory'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-3">
                                                    <RiHardDrive2Line className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                                                    <div className="min-w-0">
                                                        <dt className="text-[11px] text-zinc-400 dark:text-zinc-500">Storage Capacity</dt>
                                                        <dd className="font-medium text-zinc-900 dark:text-zinc-100 text-xs mt-0.5 tabular-nums">
                                                            {device.storage_gb} GB {device.storage_type}
                                                        </dd>
                                                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Primary drive</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-3">
                                                    <RiTv2Line className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                                                    <div className="min-w-0">
                                                        <dt className="text-[11px] text-zinc-400 dark:text-zinc-500">Graphics Accelerator</dt>
                                                        <dd className="font-medium text-zinc-900 dark:text-zinc-100 text-xs mt-0.5 truncate">
                                                            {device.gpu || 'Integrated Graphics'}
                                                        </dd>
                                                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 capitalize">{device.gpu_tier} tier</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                                                <div className="flex items-start gap-3">
                                                    <RiTv2Line className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                                                    <div className="min-w-0">
                                                        <dt className="text-[11px] text-zinc-400 dark:text-zinc-500">Asset Category</dt>
                                                        <dd className="font-medium text-zinc-900 dark:text-zinc-100 text-xs mt-0.5 capitalize">{device.device_type}</dd>
                                                    </div>
                                                </div>
                                                {device.specifications && Object.keys(device.specifications).length > 0 ? (
                                                    Object.entries(device.specifications).map(([specKey, specVal]) => (
                                                        <div key={specKey} className="flex items-start gap-3">
                                                            <RiInformationLine className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                                                            <div className="min-w-0">
                                                                <dt className="text-[11px] text-zinc-400 dark:text-zinc-500 capitalize">
                                                                    {specKey.replace(/_/g, ' ')}
                                                                </dt>
                                                                <dd className="font-medium text-zinc-900 dark:text-zinc-100 text-xs mt-0.5 break-words">
                                                                    {String(specVal)}
                                                                </dd>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="flex items-start gap-3">
                                                        <RiInformationLine className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                                                        <div className="min-w-0">
                                                            <dt className="text-[11px] text-zinc-400 dark:text-zinc-500">Specification Summary</dt>
                                                            <dd className="font-medium text-zinc-900 dark:text-zinc-100 text-xs mt-0.5">
                                                                {device.spec_summary || 'Standard Hardware'}
                                                            </dd>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
                                                    <RiPulseLine className="w-3.5 h-3.5 text-zinc-400" />
                                                    <span>Physical Health &amp; Integrity</span>
                                                </div>
                                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border border-current/15 ${activeCondition.badgeBg} ${activeCondition.textColor}`}>
                                                    {activeCondition.label} ({activeCondition.scoreText})
                                                </span>
                                            </div>
                                            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-sm h-1.5 overflow-hidden">
                                                <div className={`${activeCondition.barColor} ${activeCondition.barWidth} h-full rounded-sm transition-all duration-500`} />
                                            </div>
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                                {activeCondition.desc}
                                            </p>
                                        </div>

                                        {device.notes && (
                                            <div className="mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                                                <RiInformationLine className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-medium text-zinc-800 dark:text-zinc-200">Audit Notes:</span> {device.notes}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {!canViewFinancials && (
                                        <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5">
                                            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                                                <div className="flex items-center gap-2">
                                                    <RiShieldCheckLine className="w-4 h-4 text-[#026eff] dark:text-sky-400 shrink-0" />
                                                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                        Warranty &amp; Vendor Support Coverage
                                                    </h3>
                                                </div>
                                                <span className="text-[11px] font-medium capitalize px-2 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                                    {device.warranty_status ? device.warranty_status.replace('_', ' ') : 'Not Recorded'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                                <div>
                                                    <dt className="text-[11px] text-zinc-400 dark:text-zinc-500">Vendor</dt>
                                                    <dd className="font-medium text-zinc-900 dark:text-zinc-100 mt-0.5">{device.vendor || 'Direct Purchase'}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-[11px] text-zinc-400 dark:text-zinc-500">Warranty Start</dt>
                                                    <dd className="font-medium text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                                                        {formatDisplayDate(device.warranty_start, 'Not Recorded')}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-[11px] text-zinc-400 dark:text-zinc-500">Warranty Expiration</dt>
                                                    <dd className="font-medium text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                                                        {formatDisplayDate(device.warranty_expiry, 'Not Recorded')}
                                                    </dd>
                                                    {warrantyCountdown && (
                                                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block mt-0.5">
                                                            {warrantyCountdown}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {device.contract_sla && (
                                                <div className="mt-3.5 px-3 py-2 rounded-sm bg-[#026eff]/5 dark:bg-[#026eff]/10 border border-[#026eff]/20 text-xs text-zinc-800 dark:text-zinc-200">
                                                    SLA: <span className="font-medium">{device.contract_sla}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'financials' && canViewFinancials && (
                                <DeviceFinancialCard
                                    device={device}
                                    purchaseCost={purchaseCost}
                                    bookValue={bookValue}
                                    deprPercent={deprPercent}
                                    retainedPercent={retainedPercent}
                                />
                            )}

                            {activeTab === 'maintenance' && (
                                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5">
                                    <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-800 mb-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                Maintenance &amp; Servicing History
                                            </h3>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                Repairs, upgrades, and performance assessments
                                            </p>
                                        </div>
                                        {canPerformMaintenance && (
                                            <button
                                                type="button"
                                                onClick={() => setShowMaintenanceModal(true)}
                                                className="text-xs font-medium text-[#026eff] dark:text-sky-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                            >
                                                <RiToolsLine className="w-3.5 h-3.5" />
                                                <span>Log Servicing</span>
                                            </button>
                                        )}
                                    </div>

                                    {maintenanceLogs.length === 0 ? (
                                        <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
                                            No maintenance activities recorded for this asset.
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {maintenanceLogs.map((log) => (
                                                <div key={log.id} className="py-3.5 first:pt-1 last:pb-1 text-xs">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 text-[11px] font-medium capitalize rounded-sm border border-current/15 ${
                                                                log.type === 'repair'
                                                                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                                                                    : log.type === 'upgrade'
                                                                    ? 'bg-[#026eff]/10 text-[#026eff] dark:text-sky-400'
                                                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                                            }`}>
                                                                {log.type}
                                                            </span>
                                                            <h4 className="font-medium text-zinc-900 dark:text-zinc-100 text-[13px]">{log.title}</h4>
                                                        </div>
                                                        <div className="flex items-center gap-2.5">
                                                            <span className={`px-2 py-0.5 text-[11px] font-medium rounded-sm border border-current/15 capitalize ${
                                                                log.status === 'completed'
                                                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                                            }`}>
                                                                {log.status.replace('_', ' ')}
                                                            </span>
                                                            {canViewFinancials && log.cost !== null && log.cost !== undefined && (
                                                                <span className="font-mono font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                                                                    {formatPhp(log.cost)}
                                                                </span>
                                                            )}
                                                            {log.status !== 'completed' && canPerformMaintenance && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenUpdateLog(log)}
                                                                    className="text-[#026eff] dark:text-sky-400 font-medium hover:underline cursor-pointer"
                                                                >
                                                                    Assess &amp; Close
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">{log.description}</p>

                                                    {log.performance_assessment && (
                                                        <div className="mt-2 px-3 py-2 rounded-sm bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                                                            <RiCheckDoubleLine className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                                            <div>
                                                                <span className="font-medium">Audit Assessment:</span> {log.performance_assessment}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2 flex items-center justify-between">
                                                        <span>Technician: {log.performed_by || 'Internal IT Services'}</span>
                                                        <span className="tabular-nums">Started: {formatDisplayDate(log.started_at)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="space-y-5">
                                    <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5">
                                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-3">
                                            Custody Assignment History
                                        </h3>
                                        {assignmentsHistory.length === 0 ? (
                                            <p className="text-xs text-zinc-400 dark:text-zinc-500">No past custody assignments logged.</p>
                                        ) : (
                                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                                                {assignmentsHistory.map((asg) => (
                                                    <div key={asg.id} className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3">
                                                        <div>
                                                            <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                                                {asg.employee?.name || 'Unknown Employee'}
                                                            </div>
                                                            <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 tabular-nums">
                                                                {formatDisplayDate(asg.assigned_at)}
                                                                {asg.unassigned_at
                                                                    ? ` — ${formatDisplayDate(asg.unassigned_at)}`
                                                                    : ' — Present'}
                                                            </div>
                                                        </div>
                                                        {asg.match_score !== null && asg.match_score !== undefined && (
                                                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border tabular-nums ${fitBadgeStyle(asg.match_score)}`}>
                                                                {Math.round(asg.match_score * 100)}% Fit
                                                                {Number(asg.match_score) < 0.65 ? ' · Mismatch' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5">
                                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-3">
                                            Lifecycle Transition Audit Trail
                                        </h3>
                                        {lifecycleEvents.length === 0 ? (
                                            <p className="text-xs text-zinc-400 dark:text-zinc-500">No transition events recorded.</p>
                                        ) : (
                                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                                                {lifecycleEvents.map((evt) => (
                                                    <div key={evt.id} className="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3">
                                                        <div className="space-y-1">
                                                            <div className="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                                                                <span className="capitalize font-mono text-[11px] text-zinc-500">{evt.from_stage}</span>
                                                                <RiArrowRightLine className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                                                <span className="capitalize font-mono text-[11px] font-semibold text-[#026eff] dark:text-sky-400">
                                                                    {evt.to_stage}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-zinc-600 dark:text-zinc-400">{evt.notes}</p>
                                                            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                                                Authorized by {evt.user?.name || 'IT System Administrator'}
                                                            </div>
                                                        </div>
                                                        <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 whitespace-nowrap tabular-nums">
                                                            {formatDisplayDate(evt.created_at)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Right Sticky Sidebar */}
                <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-20 self-start">
                    <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                            Current Custodian
                        </h3>
                        {device.active_assignment?.employee ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold flex items-center justify-center text-xs shrink-0">
                                        {device.active_assignment.employee.name?.substring(0, 2).toUpperCase() || 'EM'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                                            {device.active_assignment.employee.name}
                                        </div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                            {device.active_assignment.employee.department}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs gap-2">
                                    <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
                                        Assigned {formatDisplayDate(device.active_assignment.assigned_at)}
                                    </span>
                                    {device.active_assignment.match_score !== null && device.active_assignment.match_score !== undefined && (
                                        <span className={`font-medium text-[11px] px-2 py-0.5 rounded-sm border tabular-nums ${fitBadgeStyle(device.active_assignment.match_score)}`}>
                                            {Math.round(device.active_assignment.match_score * 100)}% Fit
                                            {Number(device.active_assignment.match_score) < 0.65 ? ' · Mismatch' : ''}
                                        </span>
                                    )}
                                </div>

                                {isAdminOrManager && (
                                    <button
                                        type="button"
                                        onClick={handleDirectUnassign}
                                        disabled={unassignProcessing}
                                        className="w-full py-2 px-3 rounded-sm border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                                    >
                                        {unassignProcessing ? 'Unassigning...' : 'Unassign from Custodian'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="py-3 text-center space-y-3">
                                <div className="w-9 h-9 rounded-sm border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                                    <RiCheckLine className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">Available in Pool</div>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        Idle in stockroom inventory and unassigned.
                                    </p>
                                </div>
                                {isAdminOrManager && device.status === 'available' && employees.length > 0 && (
                                    <form onSubmit={handleDirectAssign} className="pt-2 space-y-2 text-left">
                                        <CustomSelect
                                            value={assignData.employee_id}
                                            onChange={(val) => setAssignData('employee_id', val)}
                                            placeholder="Select employee to assign..."
                                            options={employees.map((emp) => ({
                                                value: String(emp.id),
                                                label: `${emp.name} (${emp.department})`,
                                            }))}
                                        />
                                        <button
                                            type="submit"
                                            disabled={assignProcessing || !assignData.employee_id}
                                            className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-sm border border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white text-xs font-medium transition disabled:opacity-50 cursor-pointer"
                                        >
                                            <RiUser3Line className="w-3.5 h-3.5" />
                                            <span>{assignProcessing ? 'Assigning...' : 'Assign Directly'}</span>
                                        </button>
                                    </form>
                                )}
                                {isAdminOrManager && isCompute && (
                                    <Link
                                        href={route('match.index')}
                                        className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white text-xs font-medium transition"
                                    >
                                        <RiEqualizerLine className="w-3.5 h-3.5" />
                                        <span>Assign via Match Engine</span>
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-3">
                            Quick Asset Summary
                        </h3>
                        <dl className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                            <div className="py-2 flex items-center justify-between gap-2">
                                <dt className="text-zinc-500 dark:text-zinc-400">Category</dt>
                                <dd className="font-medium text-zinc-900 dark:text-zinc-100 capitalize">{device.device_type}</dd>
                            </div>
                            <div className="py-2 flex items-center justify-between gap-2">
                                <dt className="text-zinc-500 dark:text-zinc-400">Lifecycle Phase</dt>
                                <dd className="font-medium text-zinc-900 dark:text-zinc-100 capitalize">{device.lifecycle_stage}</dd>
                            </div>
                            <div className="py-2 flex items-center justify-between gap-2">
                                <dt className="text-zinc-500 dark:text-zinc-400">Physical Condition</dt>
                                <dd className="font-medium text-zinc-900 dark:text-zinc-100 capitalize">{(device.condition || 'good').replace('_', ' ')}</dd>
                            </div>
                            <div className="py-2 flex items-center justify-between gap-2">
                                <dt className="text-zinc-500 dark:text-zinc-400">Warranty</dt>
                                <dd className="font-medium text-zinc-900 dark:text-zinc-100 capitalize tabular-nums">
                                    {device.warranty_expiry
                                        ? formatDisplayDate(device.warranty_expiry)
                                        : (device.warranty_status || 'None').replace('_', ' ')}
                                </dd>
                            </div>
                            <div className="py-2 flex items-center justify-between gap-2">
                                <dt className="text-zinc-500 dark:text-zinc-400">Location</dt>
                                <dd className="font-medium text-zinc-900 dark:text-zinc-100 text-right truncate max-w-[170px]">
                                    {device.location || 'Pool Stock'}
                                </dd>
                            </div>
                            <div className="py-2 flex items-center justify-between gap-2">
                                <dt className="text-zinc-500 dark:text-zinc-400">Acquired</dt>
                                <dd className="font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                                    {device.purchase_date ? formatDisplayDate(device.purchase_date) : (device.year_acquired || '—')}
                                </dd>
                            </div>
                            {canViewFinancials && (
                                <div className="pt-2.5 flex items-center justify-between gap-2">
                                    <dt className="text-zinc-500 dark:text-zinc-400">Book Value</dt>
                                    <dd className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                        {formatPhp(device.current_book_value)}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </div>
                </div>
            </div>

            <TransitionLifecycleModal
                show={showLifecycleModal}
                data={lifecycleData}
                setData={setLifecycleData}
                processing={lifecycleProcessing}
                onClose={() => setShowLifecycleModal(false)}
                onSubmit={handleLifecycleTransition}
            />

            <LogMaintenanceModal
                show={showMaintenanceModal}
                data={maintData}
                setData={setMaintData}
                processing={maintProcessing}
                onClose={() => setShowMaintenanceModal(false)}
                onSubmit={handleCreateMaintenance}
            />

            <UpdateMaintenanceLogModal
                selectedLog={selectedLogToUpdate}
                data={updateMaintData}
                setData={setUpdateMaintData}
                processing={updateMaintProcessing}
                onClose={() => setSelectedLogToUpdate(null)}
                onSubmit={handleUpdateMaintenanceLog}
            />
        </AuthenticatedLayout>
    );
}
