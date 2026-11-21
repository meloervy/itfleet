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
import DangerButton from '@/Components/DangerButton';
import TextInput from '@/Components/TextInput';
import { useResizableColumns } from '@/Hooks/useResizableColumns';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import {
    RiAddLine,
    RiAlertLine,
    RiCheckLine,
    RiCloseLine,
    RiComputerLine,
    RiDeleteBinLine,
    RiDownload2Line,
    RiEditLine,
    RiExchangeLine,
    RiExternalLinkLine,
    RiFilePdfLine,
    RiFilter3Line,
    RiKey2Line,
    RiLinkUnlink,
    RiMore2Fill,
    RiRefreshLine,
    RiSearchLine,
    RiShieldCheckLine,
    RiSparkling2Line,
    RiUpload2Line,
    RiUser3Line,
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

export default function EmployeesIndex({ employees, role_profiles = [], departments = [], stats = {}, filters = {} }) {
    const { auth } = usePage().props;
    const user = auth?.user;
    const isAdminOrManager = ['admin', 'manager'].includes(user?.role);

    const [search, setSearch] = useState(filters.search || '');
    const [department, setDepartment] = useState(filters.department || '');
    const [roleProfileId, setRoleProfileId] = useState(filters.role_profile_id ? String(filters.role_profile_id) : '');
    const [hardwareStatus, setHardwareStatus] = useState(filters.hardware_status || '');
    const [wrapText, setWrapText] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);

    const [showModal, setShowModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingEmp, setEditingEmp] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [unassignTarget, setUnassignTarget] = useState(null);
    const [custodyTargetId, setCustodyTargetId] = useState(null);
    const custodyTarget = employees.data.find((e) => e.id === custodyTargetId) || null;

    const [offboardTarget, setOffboardTarget] = useState(null);
    const [offboardForm, setOffboardForm] = useState({
        reason: 'resignation',
        condition: 'good',
        wipe_confirmed: false,
        revoke_licenses: true,
        notes: '',
    });
    const [offboardSubmitting, setOffboardSubmitting] = useState(false);
    const [offboardError, setOffboardError] = useState(null);
    const [offboardResult, setOffboardResult] = useState(null);

    const fileInputRef = useRef(null);
    const csvInputRef = useRef(null);
    const isFirstRender = useRef(true);

    const initialWidths = {
        employee: 260,
        department: 170,
        role_profile: 190,
        hardware: 280,
        specs: 230,
        date: 150,
        actions: 120,
    };

    const { widths, startResize, autoExpandCol, resetWidths, resizingCol } = useResizableColumns(
        initialWidths,
        'employees_table_v6'
    );

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        name: '',
        department: '',
        role_profile_id: '',
        profile_picture: '',
        profile_picture_file: null,
        notes: '',
    });

    const { post: postUnassign, processing: unassigning } = useForm({});

    const {
        data: importData,
        setData: setImportData,
        post: postImport,
        processing: importingCsv,
        errors: importErrors,
        reset: resetImport,
        clearErrors: clearImportErrors,
    } = useForm({
        file: null,
    });

    const openImportModal = () => {
        resetImport();
        clearImportErrors();
        if (csvInputRef.current) csvInputRef.current.value = '';
        setShowImportModal(true);
    };

    const closeImportModal = () => {
        setShowImportModal(false);
        resetImport();
        clearImportErrors();
    };

    const handleImportSubmit = (e) => {
        e.preventDefault();
        postImport(route('employees.import.csv'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => closeImportModal(),
        });
    };

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = setTimeout(() => {
            router.get(
                route('employees.index'),
                {
                    search,
                    department,
                    role_profile_id: roleProfileId,
                    hardware_status: hardwareStatus,
                    sort: filters?.sort,
                    direction: filters?.direction,
                },
                { preserveState: true, replace: true, preserveScroll: true }
            );
        }, 300);

        return () => clearTimeout(timer);
    }, [search, department, roleProfileId, hardwareStatus]);

    useEffect(() => {
        if (!openMenuId) return;
        const handleClickOutside = (e) => {
            if (!e.target.closest('[data-emp-menu]')) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openMenuId]);

    const handleSort = (sortKey) => {
        const currentSort = filters.sort || 'name';
        const currentDirection = filters.direction || 'asc';
        const nextDirection = currentSort === sortKey && currentDirection === 'asc' ? 'desc' : 'asc';

        router.get(
            route('employees.index'),
            {
                search,
                department,
                role_profile_id: roleProfileId,
                hardware_status: hardwareStatus,
                sort: sortKey,
                direction: nextDirection,
            },
            { preserveState: true, replace: true }
        );
    };

    const handleFilter = (e) => {
        e?.preventDefault();
        router.get(
            route('employees.index'),
            {
                search,
                department,
                role_profile_id: roleProfileId,
                hardware_status: hardwareStatus,
                sort: filters?.sort,
                direction: filters?.direction,
            },
            { preserveState: true, replace: true }
        );
    };

    const clearFilters = () => {
        setSearch('');
        setDepartment('');
        setRoleProfileId('');
        setHardwareStatus('');
        router.get(route('employees.index'));
    };

    const openCreateModal = () => {
        setEditingEmp(null);
        reset();
        clearErrors();
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setShowModal(true);
    };

    const openEditModal = (emp) => {
        setOpenMenuId(null);
        setEditingEmp(emp);
        clearErrors();
        setData({
            name: emp.name || '',
            department: emp.department || '',
            role_profile_id: emp.role_profile_id ? String(emp.role_profile_id) : '',
            profile_picture: emp.profile_picture || '',
            profile_picture_file: null,
            notes: emp.notes || '',
        });
        setFilePreview(resolveAvatarUrl(emp));
        if (fileInputRef.current) fileInputRef.current.value = '';
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingEmp(null);
        setFilePreview(null);
        reset();
        clearErrors();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setData('profile_picture_file', file);
        const reader = new FileReader();
        reader.onloadend = () => setFilePreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleClearAvatar = () => {
        setData((prev) => ({
            ...prev,
            profile_picture: 'public/user/default-profile-picture.png',
            profile_picture_file: null,
        }));
        setFilePreview(DEFAULT_AVATAR);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingEmp) {
            post(route('employees.update', editingEmp.id), {
                preserveScroll: true,
                forceFormData: true,
                onSuccess: () => closeModal(),
            });
        } else {
            post(route('employees.store'), {
                preserveScroll: true,
                forceFormData: true,
                onSuccess: () => closeModal(),
            });
        }
    };

    const confirmUnassign = () => {
        if (!unassignTarget) return;
        postUnassign(route('employees.unassign', unassignTarget.id), {
            preserveScroll: true,
            onSuccess: () => setUnassignTarget(null),
        });
    };

    const openOffboardModal = (emp) => {
        setOpenMenuId(null);
        setCustodyTargetId(null);
        setOffboardTarget(emp);
        setOffboardForm({
            reason: 'resignation',
            condition: 'good',
            wipe_confirmed: false,
            revoke_licenses: true,
            notes: '',
        });
        setOffboardError(null);
        setOffboardResult(null);
    };

    const closeOffboardModal = () => {
        setOffboardTarget(null);
        setOffboardError(null);
        setOffboardResult(null);
    };

    const handleOffboardSubmit = async (e) => {
        e.preventDefault();
        if (!offboardTarget || offboardSubmitting) return;

        setOffboardSubmitting(true);
        setOffboardError(null);

        try {
            const res = await axios.post(
                route('employees.offboard', offboardTarget.id),
                offboardForm,
                { headers: { Accept: 'application/json' } }
            );
            setOffboardResult(res.data);
            router.reload({ only: ['employees', 'stats'] });
        } catch (err) {
            const msg =
                err.response?.data?.message ||
                Object.values(err.response?.data?.errors || {})[0]?.[0] ||
                'Failed to offboard employee and reclaim assets.';
            setOffboardError(msg);
        } finally {
            setOffboardSubmitting(false);
        }
    };

    const activeFilterCount = [search, department, roleProfileId, hardwareStatus].filter(Boolean).length;

    const totalWorkforce = stats?.total ?? employees.total ?? 0;
    const assignedCount = stats?.assigned ?? 0;
    const assignedPct = stats?.assigned_percentage ?? 0;
    const unassignedCount = stats?.unassigned ?? 0;
    const profiledCount = stats?.with_profile ?? 0;

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Employee Directory
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Workforce roster, target role profiles, and assigned hardware custodianship.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {isAdminOrManager && (
                            <>
                                <button
                                    type="button"
                                    onClick={openImportModal}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                >
                                    <RiUpload2Line className="w-3.5 h-3.5 text-[#026eff]" />
                                    <span>Import CSV</span>
                                </button>
                                <a
                                    href={route('employees.export.csv')}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                                >
                                    <RiDownload2Line className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>Export CSV</span>
                                </a>
                                <a
                                    href={route('employees.export.pdf')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                                >
                                    <RiFilePdfLine className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Export PDF</span>
                                </a>
                            </>
                        )}
                        {isAdminOrManager && (
                            <>
                                <Link
                                    href={route('match.index')}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                                >
                                    <RiSparkling2Line className="w-3.5 h-3.5 text-[#026eff]" />
                                    <span>Smart Match</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={openCreateModal}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-xs font-medium text-white transition cursor-pointer"
                                >
                                    <RiAddLine className="w-3.5 h-3.5" />
                                    <span>Add Employee</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            }
        >
            <Head title="Employees - ITFleet" />

            {/* Minimal KPI Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Total Workforce
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {totalWorkforce}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {departments.length} departments active
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setHardwareStatus((prev) => (prev === 'assigned' ? '' : 'assigned'))}
                    className={`text-left rounded-sm border p-4 transition cursor-pointer ${
                        hardwareStatus === 'assigned'
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-700'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Assigned Hardware
                        </span>
                        <span className="px-2 py-0.5 rounded-sm border border-emerald-500/20 text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {assignedPct}%
                        </span>
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {assignedCount}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        {hardwareStatus === 'assigned' ? 'Filtered to assigned' : 'Click to filter assigned'}
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setHardwareStatus((prev) => (prev === 'unassigned' ? '' : 'unassigned'))}
                    className={`text-left rounded-sm border p-4 transition cursor-pointer ${
                        hardwareStatus === 'unassigned'
                            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-400 dark:border-amber-700'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            Awaiting Hardware
                        </span>
                        {unassignedCount > 0 && (
                            <span className="w-1.5 h-1.5 rounded-sm bg-amber-500" />
                        )}
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {unassignedCount}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        {hardwareStatus === 'unassigned' ? 'Filtered to unassigned' : 'Click to filter unassigned'}
                    </div>
                </button>

                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Role Profiled
                    </div>
                    <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
                        {profiledCount}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                        Across {role_profiles.length} workload profiles
                    </div>
                </div>
            </div>

            {/* Filter & Toolbar */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4 mb-5">
                <form onSubmit={handleFilter}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-2 lg:col-span-4 relative">
                            <RiSearchLine className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search name, department, role, asset..."
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

                        <div className="lg:col-span-2">
                            <CustomSelect
                                value={department}
                                onChange={setDepartment}
                                placeholder="Department"
                                options={[
                                    { value: '', label: 'All departments' },
                                    ...departments.map((dept) => ({ value: dept, label: dept })),
                                ]}
                            />
                        </div>

                        <div className="lg:col-span-2">
                            <CustomSelect
                                value={roleProfileId}
                                onChange={setRoleProfileId}
                                placeholder="Role profile"
                                options={[
                                    { value: '', label: 'All profiles' },
                                    ...role_profiles.map((rp) => ({ value: String(rp.id), label: rp.name })),
                                ]}
                            />
                        </div>

                        <div className="lg:col-span-2">
                            <CustomSelect
                                value={hardwareStatus}
                                onChange={setHardwareStatus}
                                placeholder="Hardware"
                                options={[
                                    { value: '', label: 'All hardware' },
                                    { value: 'assigned', label: 'Assigned' },
                                    { value: 'unassigned', label: 'Unassigned' },
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
                            {employees.total} Employees
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700">&bull;</span>
                        <span className="hidden sm:inline text-[11px]">
                            Drag column dividers to resize or click headers to sort
                        </span>
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

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {employees.data.length === 0 ? (
                    <div className="p-12 text-center">
                        <RiUser3Line className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No employees found</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            Try adjusting your search query or department filters.
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
                                        colKey="employee"
                                        sortKey="name"
                                        sortable
                                        currentSort={filters.sort || 'name'}
                                        sortDirection={filters.direction || 'asc'}
                                        onSort={handleSort}
                                        width={widths.employee}
                                        onResizeStart={startResize}
                                        onAutoExpand={autoExpandCol}
                                        isResizing={resizingCol === 'employee'}
                                    >
                                        Employee
                                    </ResizableTh>
                                    <ResizableTh
                                        colKey="department"
                                        sortKey="department"
                                        sortable
                                        currentSort={filters.sort}
                                        sortDirection={filters.direction}
                                        onSort={handleSort}
                                        width={widths.department}
                                        onResizeStart={startResize}
                                        onAutoExpand={autoExpandCol}
                                        isResizing={resizingCol === 'department'}
                                    >
                                        Department
                                    </ResizableTh>
                                    <ResizableTh
                                        colKey="role_profile"
                                        width={widths.role_profile}
                                        onResizeStart={startResize}
                                        onAutoExpand={autoExpandCol}
                                        isResizing={resizingCol === 'role_profile'}
                                    >
                                        Role Profile
                                    </ResizableTh>
                                    <ResizableTh
                                        colKey="hardware"
                                        width={widths.hardware}
                                        onResizeStart={startResize}
                                        onAutoExpand={autoExpandCol}
                                        isResizing={resizingCol === 'hardware'}
                                    >
                                        Assigned Hardware
                                    </ResizableTh>
                                    <ResizableTh
                                        colKey="specs"
                                        width={widths.specs}
                                        onResizeStart={startResize}
                                        onAutoExpand={autoExpandCol}
                                        isResizing={resizingCol === 'specs'}
                                    >
                                        Hardware / Min Specs
                                    </ResizableTh>
                                    <ResizableTh
                                        colKey="date"
                                        sortKey="created_at"
                                        sortable
                                        currentSort={filters.sort}
                                        sortDirection={filters.direction}
                                        onSort={handleSort}
                                        width={widths.date}
                                        onResizeStart={startResize}
                                        onAutoExpand={autoExpandCol}
                                        isResizing={resizingCol === 'date'}
                                    >
                                        Registered
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
                                {employees.data.map((emp, idx) => {
                                    const activeAssignment = emp.active_assignment;
                                    const activeAssignments = emp.active_assignments || (activeAssignment ? [activeAssignment] : []);
                                    const activeLicenses = emp.active_license_assignments || [];
                                    const extraGearCount = Math.max(0, activeAssignments.length - (activeAssignment ? 1 : 0));
                                    const device = activeAssignment?.device;
                                    const roleProfile = emp.role_profile;
                                    const isBottomRow = idx >= employees.data.length - 2 && employees.data.length > 3;

                                    return (
                                        <tr
                                            key={emp.id}
                                            className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                                        >
                                            <td className="py-3 px-4 align-middle">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <img
                                                        src={resolveAvatarUrl(emp)}
                                                        alt={emp.name}
                                                        onError={(e) => {
                                                            e.currentTarget.onerror = null;
                                                            e.currentTarget.src = DEFAULT_AVATAR;
                                                        }}
                                                        className="w-8 h-8 rounded-sm object-cover bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0"
                                                    />
                                                    <div className="min-w-0">
                                                        <div
                                                            className={`text-xs font-medium text-zinc-900 dark:text-zinc-100 ${
                                                                wrapText ? 'whitespace-normal wrap-break-word' : 'truncate'
                                                            }`}
                                                        >
                                                            {emp.name}
                                                        </div>
                                                        {emp.notes && (
                                                            <div
                                                                className={`text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 ${
                                                                    wrapText ? 'whitespace-normal wrap-break-word' : 'truncate'
                                                                }`}
                                                            >
                                                                {emp.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-3 px-4 align-middle">
                                                <span
                                                    className={`inline-block text-xs text-zinc-700 dark:text-zinc-300 ${
                                                        wrapText ? 'whitespace-normal wrap-break-word' : 'truncate max-w-full'
                                                    }`}
                                                >
                                                    {emp.department}
                                                </span>
                                            </td>

                                            <td className="py-3 px-4 align-middle">
                                                {roleProfile ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                                        {roleProfile.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                                                        No role profile
                                                    </span>
                                                )}
                                            </td>

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
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                                            <span className="font-mono tabular-nums">{device.asset_tag}</span>
                                                            {activeAssignment.match_score != null && (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium tabular-nums">
                                                                    {Math.round(
                                                                        activeAssignment.match_score <= 1
                                                                            ? activeAssignment.match_score * 100
                                                                            : activeAssignment.match_score
                                                                    )}% fit
                                                                </span>
                                                            )}
                                                            {(extraGearCount > 0 || activeLicenses.length > 0) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setCustodyTargetId(emp.id)}
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-[#026eff]/25 bg-[#026eff]/10 text-[#026eff] dark:text-sky-400 text-[10px] font-medium hover:bg-[#026eff]/15 transition cursor-pointer"
                                                                    title="Inspect all assigned gear and licenses"
                                                                >
                                                                    {extraGearCount > 0 && <span>+{extraGearCount} gear</span>}
                                                                    {extraGearCount > 0 && activeLicenses.length > 0 && <span>&middot;</span>}
                                                                    {activeLicenses.length > 0 && <span>{activeLicenses.length} lic</span>}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-amber-500/20 text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                                            <span className="w-1.5 h-1.5 rounded-sm bg-amber-500" />
                                                            Unassigned
                                                        </span>
                                                        {activeLicenses.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setCustodyTargetId(emp.id)}
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-[#026eff]/25 bg-[#026eff]/10 text-[#026eff] dark:text-sky-400 text-[10px] font-medium hover:bg-[#026eff]/15 transition cursor-pointer"
                                                            >
                                                                <RiKey2Line className="w-3 h-3" />
                                                                <span>{activeLicenses.length} lic</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-3 px-4 align-middle">
                                                {device ? (
                                                    ['laptop', 'desktop'].includes(device.device_type) ? (
                                                        <div className="text-[11px] text-zinc-600 dark:text-zinc-300 font-mono tabular-nums">
                                                            <span className="uppercase">{device.cpu_tier || 'N/A'}</span>
                                                            <span className="mx-1 text-zinc-300 dark:text-zinc-700">/</span>
                                                            <span>{device.ram_gb || 0}GB</span>
                                                            <span className="mx-1 text-zinc-300 dark:text-zinc-700">/</span>
                                                            <span>{device.storage_gb || 0}GB</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate">
                                                            {device.spec_summary || device.device_type}
                                                        </div>
                                                    )
                                                ) : roleProfile ? (
                                                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                                                        Min: <span className="uppercase font-mono">{roleProfile.min_cpu_tier}</span> /{' '}
                                                        {roleProfile.min_ram_gb}GB / {roleProfile.min_storage_gb}GB
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">—</span>
                                                )}
                                            </td>

                                            <td className="py-3 px-4 align-middle text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                                                {emp.created_at
                                                    ? new Date(emp.created_at).toLocaleDateString('en-US', {
                                                          month: 'short',
                                                          day: 'numeric',
                                                          year: 'numeric',
                                                      })
                                                    : '—'}
                                            </td>

                                            <td className="py-3 px-4 align-middle text-right">
                                                <div className="inline-flex items-center justify-end gap-1" data-emp-menu>
                                                    {isAdminOrManager && (
                                                        <Link
                                                            href={route('match.index', { employee_id: emp.id })}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:border-[#026eff] hover:text-[#026eff] dark:hover:text-sky-400 transition"
                                                            title="Match hardware for employee"
                                                        >
                                                            <RiSparkling2Line className="w-3 h-3 text-[#026eff]" />
                                                            <span>Match</span>
                                                        </Link>
                                                    )}

                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={() => setOpenMenuId((prev) => (prev === emp.id ? null : emp.id))}
                                                            className="p-1.5 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition cursor-pointer"
                                                            aria-label="Employee actions"
                                                        >
                                                            <RiMore2Fill className="w-4 h-4" />
                                                        </button>

                                                        {openMenuId === emp.id && (
                                                            <div
                                                                className={`absolute right-0 w-44 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 py-1 z-30 text-left ${
                                                                    isBottomRow ? 'bottom-full mb-1' : 'top-full mt-1'
                                                                }`}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setOpenMenuId(null);
                                                                        setCustodyTargetId(emp.id);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                                                >
                                                                    <RiComputerLine className="w-3.5 h-3.5 text-zinc-400" />
                                                                    <span>Assets &amp; Licenses</span>
                                                                </button>

                                                                {device && (
                                                                    <Link
                                                                        href={route('devices.show', device.id)}
                                                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                                                                        onClick={() => setOpenMenuId(null)}
                                                                    >
                                                                        <RiExternalLinkLine className="w-3.5 h-3.5 text-zinc-400" />
                                                                        <span>Inspect Device</span>
                                                                    </Link>
                                                                )}

                                                                {isAdminOrManager && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openEditModal(emp)}
                                                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                                                    >
                                                                        <RiEditLine className="w-3.5 h-3.5 text-zinc-400" />
                                                                        <span>Edit Employee</span>
                                                                    </button>
                                                                )}

                                                                {isAdminOrManager && (activeAssignments.length > 0 || activeLicenses.length > 0) && (
                                                                    <>
                                                                        <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openOffboardModal(emp)}
                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer"
                                                                        >
                                                                            <RiExchangeLine className="w-3.5 h-3.5" />
                                                                            <span>Offboard &amp; Reclaim</span>
                                                                        </button>
                                                                    </>
                                                                )}

                                                                {isAdminOrManager && activeAssignment && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setOpenMenuId(null);
                                                                            setUnassignTarget(emp);
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                                                    >
                                                                        <RiLinkUnlink className="w-3.5 h-3.5" />
                                                                        <span>Unassign Device</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
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

            <Pagination
                links={employees.links}
                from={employees.from}
                to={employees.to}
                total={employees.total}
                label="employees"
            />

            {/* Create / Edit Employee Modal */}
            <Modal show={showModal} onClose={closeModal} maxWidth="lg">
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div>
                            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                                {editingEmp ? `Edit ${editingEmp.name}` : 'Register Employee'}
                            </h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {editingEmp
                                    ? 'Update profile photo, department, and baseline workload role.'
                                    : 'Add a team member to assign workstation hardware and role profiles.'}
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
                        {/* Avatar uploader */}
                        <div className="flex items-center gap-4 p-3 rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                            <img
                                src={filePreview || DEFAULT_AVATAR}
                                alt="Avatar preview"
                                onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = DEFAULT_AVATAR;
                                }}
                                className="w-14 h-14 rounded-sm object-cover bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                    Profile Picture
                                </div>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    PNG, JPG, WebP, or GIF up to 5MB.
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                    >
                                        <RiUpload2Line className="w-3.5 h-3.5" />
                                        <span>Upload photo</span>
                                    </button>
                                    {(filePreview && filePreview !== DEFAULT_AVATAR) && (
                                        <button
                                            type="button"
                                            onClick={handleClearAvatar}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-rose-500/20 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                                        >
                                            <RiDeleteBinLine className="w-3.5 h-3.5" />
                                            <span>Reset</span>
                                        </button>
                                    )}
                                </div>
                                <InputError message={errors.profile_picture_file || errors.profile_picture} className="mt-1.5" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <InputLabel htmlFor="emp_name" value="Full Name *" />
                                <TextInput
                                    id="emp_name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className="mt-1.5 block w-full text-xs"
                                    placeholder="e.g. Elena Rostova"
                                    required
                                />
                                <InputError message={errors.name} className="mt-1" />
                            </div>

                            <div>
                                <InputLabel htmlFor="emp_dept" value="Department *" />
                                <TextInput
                                    id="emp_dept"
                                    type="text"
                                    list="emp-departments-list"
                                    value={data.department}
                                    onChange={(e) => setData('department', e.target.value)}
                                    className="mt-1.5 block w-full text-xs"
                                    placeholder="e.g. Engineering"
                                    required
                                />
                                <datalist id="emp-departments-list">
                                    {departments.map((d) => (
                                        <option key={d} value={d} />
                                    ))}
                                </datalist>
                                <InputError message={errors.department} className="mt-1" />
                            </div>
                        </div>

                        <div>
                            <InputLabel htmlFor="emp_role_profile" value="Role Profile (Workload Baseline)" />
                            <div className="mt-1.5">
                                <CustomSelect
                                    value={data.role_profile_id}
                                    onChange={(val) => setData('role_profile_id', val)}
                                    placeholder="Select role profile..."
                                    options={[
                                        { value: '', label: 'None / Custom evaluation only' },
                                        ...role_profiles.map((rp) => ({
                                            value: String(rp.id),
                                            label: `${rp.name} (${rp.min_cpu_tier?.toUpperCase()} / ${rp.min_ram_gb}GB RAM)`,
                                        })),
                                    ]}
                                />
                            </div>
                            <InputError message={errors.role_profile_id} className="mt-1" />
                        </div>

                        <div>
                            <InputLabel htmlFor="emp_notes" value="Workstation & Custodian Notes" />
                            <textarea
                                id="emp_notes"
                                rows={3}
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                placeholder="Optional seating location, accessory preferences, or accessibility needs..."
                                className="mt-1.5 block w-full rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 py-2 px-3 focus:outline-none focus:border-[#026eff] focus:ring-0"
                            />
                            <InputError message={errors.notes} className="mt-1" />
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                        <SecondaryButton type="button" onClick={closeModal}>
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton type="submit" disabled={processing}>
                            {processing ? 'Saving...' : editingEmp ? 'Save Changes' : 'Register Employee'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            {/* Unassign Hardware Confirmation Modal */}
            <Modal show={Boolean(unassignTarget)} onClose={() => setUnassignTarget(null)} maxWidth="sm">
                <div className="p-6">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-sm border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                            <RiComputerLine className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                Unassign Hardware
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                Return{' '}
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                    {unassignTarget?.active_assignment?.device?.brand}{' '}
                                    {unassignTarget?.active_assignment?.device?.model}
                                </span>{' '}
                                ({unassignTarget?.active_assignment?.device?.asset_tag}) from{' '}
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                    {unassignTarget?.name}
                                </span>{' '}
                                back into available stockroom inventory?
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-2">
                        <SecondaryButton type="button" onClick={() => setUnassignTarget(null)}>
                            Cancel
                        </SecondaryButton>
                        <DangerButton type="button" onClick={confirmUnassign} disabled={unassigning}>
                            {unassigning ? 'Unassigning...' : 'Confirm Unassign'}
                        </DangerButton>
                    </div>
                </div>
            </Modal>

            {/* Import Employees CSV Modal */}
            <Modal show={showImportModal} onClose={closeImportModal} maxWidth="md">
                <form onSubmit={handleImportSubmit} className="p-6">
                    <div className="flex items-start justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                Import Employees from CSV
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Bulk add or update staff records matched by name and department.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={closeImportModal}
                            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer"
                        >
                            <RiCloseLine className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="mt-4 space-y-4">
                        <div className="p-3 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
                            <div className="font-medium text-zinc-800 dark:text-zinc-200">Expected CSV Columns</div>
                            <code className="block font-mono text-[11px] text-[#026eff] dark:text-sky-400">
                                name, department, role_profile, notes
                            </code>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                <span className="font-medium">name</span> and <span className="font-medium">department</span> are required. Matching <span className="font-medium">role_profile</span> names are linked automatically.
                            </p>
                        </div>

                        <div>
                            <InputLabel htmlFor="employees_csv_file" value="CSV File *" />
                            <input
                                ref={csvInputRef}
                                id="employees_csv_file"
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(e) => setImportData('file', e.target.files?.[0] || null)}
                                required
                                className="mt-1.5 block w-full text-xs text-zinc-700 dark:text-zinc-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border file:border-zinc-200 dark:file:border-zinc-700 file:text-xs file:font-medium file:bg-white dark:file:bg-zinc-900 file:text-zinc-700 dark:file:text-zinc-200 hover:file:bg-zinc-50 dark:hover:file:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 p-1.5 bg-white dark:bg-zinc-950 cursor-pointer"
                            />
                            <InputError message={importErrors.file} className="mt-1.5" />
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                        <SecondaryButton type="button" onClick={closeImportModal}>
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton type="submit" disabled={importingCsv || !importData.file}>
                            {importingCsv ? 'Importing...' : 'Import CSV'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            {/* Employee Multi-Asset Custody & Software Licenses Modal */}
            <Modal show={Boolean(custodyTarget)} onClose={() => setCustodyTargetId(null)} maxWidth="lg">
                <div className="p-6">
                    <div className="flex items-start justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                Assets &amp; Licenses Custody &mdash; {custodyTarget?.name}
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {custodyTarget?.department} &bull;{' '}
                                {custodyTarget?.role_profile?.name || 'No Role Profile'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCustodyTargetId(null)}
                            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer"
                        >
                            <RiCloseLine className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="mt-4 space-y-5 max-h-[65vh] overflow-y-auto pr-1">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                                    Assigned Hardware ({custodyTarget?.active_assignments?.length || 0})
                                </h4>
                            </div>

                            {(!custodyTarget?.active_assignments || custodyTarget.active_assignments.length === 0) ? (
                                <p className="text-xs text-zinc-400 dark:text-zinc-500 py-3 border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                                    No hardware assets currently assigned.
                                </p>
                            ) : (
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800">
                                    {custodyTarget.active_assignments.map((asg) => (
                                        <div key={asg.id} className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-zinc-950/40">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={route('devices.show', asg.device?.id)}
                                                        className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-[#026eff] dark:hover:text-sky-400 truncate"
                                                    >
                                                        {asg.device?.brand} {asg.device?.model}
                                                    </Link>
                                                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
                                                        {asg.device?.asset_tag}
                                                    </span>
                                                    <span className="capitalize text-[10px] px-1.5 py-0.5 bg-[#026eff]/10 text-[#026eff] dark:text-sky-400 border border-[#026eff]/20">
                                                        {asg.device?.device_type}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                                                    {asg.device?.spec_summary}
                                                </div>
                                            </div>

                                            {isAdminOrManager && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.post(
                                                            route('employees.unassign', custodyTarget.id),
                                                            { assignment_id: asg.id },
                                                            { preserveScroll: true }
                                                        )
                                                    }
                                                    className="px-2.5 py-1 rounded-sm border border-rose-500/25 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer shrink-0"
                                                >
                                                    Unassign
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                                    Software Licenses ({custodyTarget?.active_license_assignments?.length || 0})
                                </h4>
                                <Link
                                    href={route('licenses.index')}
                                    className="text-[11px] font-medium text-[#026eff] dark:text-sky-400 hover:underline"
                                >
                                    Manage Licenses &rarr;
                                </Link>
                            </div>

                            {(!custodyTarget?.active_license_assignments || custodyTarget.active_license_assignments.length === 0) ? (
                                <p className="text-xs text-zinc-400 dark:text-zinc-500 py-3 border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                                    No active software license seats assigned.
                                </p>
                            ) : (
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800">
                                    {custodyTarget.active_license_assignments.map((licAsg) => (
                                        <div key={licAsg.id} className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-zinc-950/40">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                                        {licAsg.license?.name}
                                                    </span>
                                                    <span className="capitalize text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
                                                        {licAsg.license?.license_type}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                    {licAsg.license?.vendor} &bull;{' '}
                                                    {licAsg.license?.category}
                                                </div>
                                            </div>

                                            {isAdminOrManager && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.post(
                                                            route('licenses.revoke', licAsg.id),
                                                            {},
                                                            { preserveScroll: true }
                                                        )
                                                    }
                                                    className="px-2.5 py-1 rounded-sm border border-rose-500/25 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer shrink-0"
                                                >
                                                    Revoke
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                        <div>
                            {isAdminOrManager &&
                                ((custodyTarget?.active_assignments?.length || 0) > 0 ||
                                    (custodyTarget?.active_license_assignments?.length || 0) > 0) && (
                                    <button
                                        type="button"
                                        onClick={() => openOffboardModal(custodyTarget)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 text-xs font-medium transition cursor-pointer"
                                    >
                                        <RiExchangeLine className="w-3.5 h-3.5" />
                                        <span>Offboard &amp; Reclaim All</span>
                                    </button>
                                )}
                        </div>
                        <SecondaryButton type="button" onClick={() => setCustodyTargetId(null)}>
                            Close
                        </SecondaryButton>
                    </div>
                </div>
            </Modal>

            {/* Employee Offboarding & Multi-Asset Reclamation Modal */}
            <Modal show={Boolean(offboardTarget)} onClose={closeOffboardModal} maxWidth="lg">
                <div className="p-6">
                    <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                Offboard &amp; Reclaim Assets &mdash; {offboardTarget?.name}
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {offboardTarget?.department} &bull;{' '}
                                {offboardTarget?.role_profile?.name || 'No Role Profile'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={closeOffboardModal}
                            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer"
                            aria-label="Close offboarding modal"
                        >
                            <RiCloseLine className="w-4 h-4" />
                        </button>
                    </div>

                    {!offboardResult ? (
                        <form onSubmit={handleOffboardSubmit} className="mt-4 space-y-4">
                            <div className="p-3.5 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/50 space-y-2.5 text-xs">
                                <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                                    Custody Items to Reclaim
                                </div>
                                {(offboardTarget?.active_assignments?.length || 0) > 0 && (
                                    <div className="space-y-1.5">
                                        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                            Hardware Assets ({offboardTarget.active_assignments.length})
                                        </div>
                                        <div className="space-y-1">
                                            {offboardTarget.active_assignments.map((asg) => (
                                                <div
                                                    key={asg.id}
                                                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                                                >
                                                    <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                                        {asg.device?.brand} {asg.device?.model}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <span className="capitalize text-[10px] px-1.5 py-0.5 bg-[#026eff]/10 text-[#026eff] dark:text-sky-400 border border-[#026eff]/20 rounded-sm">
                                                            {asg.device?.device_type}
                                                        </span>
                                                        <span className="font-mono text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-sm">
                                                            {asg.device?.asset_tag}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(offboardTarget?.active_license_assignments?.length || 0) > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                            Active Software Seats ({offboardTarget.active_license_assignments.length})
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {offboardTarget.active_license_assignments.map((licAsg) => (
                                                <span
                                                    key={licAsg.id}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300"
                                                >
                                                    <RiKey2Line className="w-3 h-3 text-[#026eff] dark:text-sky-400" />
                                                    <span>{licAsg.license?.name}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <InputLabel value="Offboarding Reason *" className="mb-1.5" />
                                    <CustomSelect
                                        value={offboardForm.reason}
                                        onChange={(val) => setOffboardForm((prev) => ({ ...prev, reason: val }))}
                                        options={[
                                            { value: 'resignation', label: 'Resignation / Separation' },
                                            { value: 'role_transition', label: 'Role Transition / Transfer' },
                                            { value: 'hardware_upgrade', label: 'Hardware Refresh / Upgrade' },
                                            { value: 'contract_end', label: 'Contract End' },
                                            { value: 'other', label: 'Other' },
                                        ]}
                                    />
                                </div>
                                <div>
                                    <InputLabel value="Returned Hardware Condition *" className="mb-1.5" />
                                    <CustomSelect
                                        value={offboardForm.condition}
                                        onChange={(val) => setOffboardForm((prev) => ({ ...prev, condition: val }))}
                                        options={[
                                            { value: 'excellent', label: 'Excellent (Like New)' },
                                            { value: 'good', label: 'Good (Ready for Recirculation)' },
                                            { value: 'fair', label: 'Fair (Functional / Minor Wear)' },
                                            { value: 'needs_repair', label: 'Needs Repair (Route to Maintenance)' },
                                        ]}
                                    />
                                </div>
                            </div>

                            {offboardForm.condition === 'needs_repair' && (
                                <div className="p-3 rounded-sm border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                    <RiAlertLine className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>
                                        Hardware marked <span className="font-semibold">Needs Repair</span> will be routed directly to the{' '}
                                        <span className="font-semibold">Maintenance</span> stage with status{' '}
                                        <span className="font-mono">in_repair</span> rather than the available stockroom pool.
                                    </span>
                                </div>
                            )}

                            <div className="space-y-2.5 p-3 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40">
                                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-zinc-700 dark:text-zinc-200">
                                    <Checkbox
                                        checked={offboardForm.wipe_confirmed}
                                        onChange={(e) =>
                                            setOffboardForm((prev) => ({ ...prev, wipe_confirmed: e.target.checked }))
                                        }
                                    />
                                    <span>Data wipe &amp; sanitization verified (NIST SP 800-88 / ISO 19770-1)</span>
                                </label>

                                {(offboardTarget?.active_license_assignments?.length || 0) > 0 && (
                                    <label className="flex items-center gap-2.5 cursor-pointer text-xs text-zinc-700 dark:text-zinc-200">
                                        <Checkbox
                                            checked={offboardForm.revoke_licenses}
                                            onChange={(e) =>
                                                setOffboardForm((prev) => ({ ...prev, revoke_licenses: e.target.checked }))
                                            }
                                        />
                                        <span>
                                            Revoke all active software license seats ({offboardTarget.active_license_assignments.length})
                                        </span>
                                    </label>
                                )}
                            </div>

                            <div>
                                <InputLabel htmlFor="offboard_notes" value="Offboarding Audit Notes" />
                                <textarea
                                    id="offboard_notes"
                                    rows={2}
                                    value={offboardForm.notes}
                                    onChange={(e) => setOffboardForm((prev) => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Charger returned, SSD sanitized, accessories accounted for..."
                                    className="mt-1.5 block w-full rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 py-2 px-3 focus:outline-none focus:border-[#026eff] focus:ring-0"
                                />
                            </div>

                            {offboardError && (
                                <div className="p-3 rounded-sm border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300">
                                    {offboardError}
                                </div>
                            )}

                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                                <SecondaryButton type="button" onClick={closeOffboardModal}>
                                    Cancel
                                </SecondaryButton>
                                <DangerButton type="submit" disabled={offboardSubmitting}>
                                    {offboardSubmitting ? 'Reclaiming...' : 'Confirm Offboard & Reclaim'}
                                </DangerButton>
                            </div>
                        </form>
                    ) : (
                        <div className="mt-4 space-y-4">
                            <div className="p-3.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                                <RiCheckLine className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                                <div>
                                    <div className="font-semibold">Offboarding Complete</div>
                                    <div className="mt-0.5">{offboardResult.message}</div>
                                </div>
                            </div>

                            {(offboardResult.reclaimed_devices?.length || 0) > 0 && (
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                                        Reclaimed Hardware ({offboardResult.reclaimed_devices.length})
                                    </div>
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-sm">
                                        {offboardResult.reclaimed_devices.map((dev) => (
                                            <div key={dev.id} className="p-2.5 flex items-center justify-between gap-2 text-xs bg-white dark:bg-zinc-950/40">
                                                <div className="min-w-0">
                                                    <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 mr-2">
                                                        {dev.asset_tag}
                                                    </span>
                                                    <span className="text-zinc-700 dark:text-zinc-300">
                                                        {dev.brand} {dev.model}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className="capitalize text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                                                        {dev.lifecycle_stage}
                                                    </span>
                                                    <span className="capitalize text-[10px] px-1.5 py-0.5 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
                                                        {dev.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(offboardResult.revoked_licenses?.length || 0) > 0 && (
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                                        Revoked Software Seats ({offboardResult.revoked_licenses.length})
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {offboardResult.revoked_licenses.map((lic) => (
                                            <span
                                                key={lic.assignment_id}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-700 dark:text-zinc-300"
                                            >
                                                <RiShieldCheckLine className="w-3 h-3 text-emerald-500" />
                                                <span>{lic.license_name}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(offboardResult.circulation_matches?.length || 0) > 0 && (
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                                        Immediate Recirculation Opportunities
                                    </div>
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-sm max-h-48 overflow-y-auto">
                                        {offboardResult.circulation_matches.map((m) => (
                                            <div key={m.employee_id} className="p-2.5 flex items-center justify-between gap-3 text-xs bg-white dark:bg-zinc-950/40">
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                                        {m.name}
                                                    </div>
                                                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                                        {m.department} &bull; {m.role_name} &bull; {m.priority_reason}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="px-1.5 py-0.5 rounded-sm bg-[#026eff]/10 border border-[#026eff]/20 text-[#026eff] dark:text-sky-400 text-[10px] font-semibold tabular-nums">
                                                        {Math.round(m.match_score * 100)}% fit
                                                    </span>
                                                    <Link
                                                        href={route('match.index', { employee_id: m.employee_id })}
                                                        onClick={closeOffboardModal}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-[#026eff] hover:bg-[#0258d1] text-white text-[11px] font-medium transition"
                                                    >
                                                        <RiSparkling2Line className="w-3 h-3" />
                                                        <span>Reassign via Match</span>
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                                <PrimaryButton type="button" onClick={closeOffboardModal}>
                                    Done
                                </PrimaryButton>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
