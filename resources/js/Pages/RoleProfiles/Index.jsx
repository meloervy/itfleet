import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Checkbox from '@/Components/Checkbox';
import CustomSelect from '@/Components/CustomSelect';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import ExpandableCardContainer from '@/Components/ui/ExpandableCard';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import {
    RiAddLine,
    RiArrowRightUpLine,
    RiCloseLine,
    RiCpuLine,
    RiEditLine,
    RiGroupLine,
    RiHardDrive2Line,
    RiMacbookLine,
    RiRam2Line,
    RiSearchLine,
    RiShieldCheckLine,
} from 'react-icons/ri';

const cpuTierLabels = {
    entry: 'Entry',
    mid: 'Mid',
    high: 'High',
    workstation: 'Workstation',
};

const gpuTierLabels = {
    none: 'None',
    integrated: 'Integrated',
    'dedicated-entry': 'Dedicated Entry',
    'dedicated-high': 'Dedicated High',
};

export default function RoleProfilesIndex({ profiles = [] }) {
    const { auth } = usePage().props;
    const user = auth?.user;
    const isAdminOrManager = ['admin', 'manager'].includes(user?.role);

    const [searchQuery, setSearchQuery] = useState('');
    const [requirementFilter, setRequirementFilter] = useState('all'); // 'all' | 'gpu' | 'portable'
    const [showModal, setShowModal] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);

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

    const filteredProfiles = useMemo(() => {
        return profiles.filter((p) => {
            if (requirementFilter === 'gpu' && !p.requires_gpu) return false;
            if (requirementFilter === 'portable' && !p.portability_required) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return (
                    p.name?.toLowerCase().includes(q) ||
                    p.description?.toLowerCase().includes(q) ||
                    p.min_cpu_tier?.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [profiles, searchQuery, requirementFilter]);

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
            min_gpu_tier: profile.min_gpu_tier || 'none',
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

    const renderCard = (profile) => (
        <div className="h-full bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition flex flex-col justify-between">
            <div>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate group-hover:text-[#026eff] dark:group-hover:text-sky-400 transition-colors">
                            {profile.name}
                        </h3>
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                            <RiGroupLine className="w-3 h-3" />
                            <span>{profile.employees_count ?? 0} employees</span>
                        </div>
                    </div>

                    {isAdminOrManager && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(profile);
                            }}
                            className="p-1.5 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shrink-0 cursor-pointer"
                            title="Edit role profile"
                        >
                            <RiEditLine className="w-3.5 h-3.5" />
                        </button>
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
                        <div className="mt-0.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
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
                            {profile.min_storage_gb} GB
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
            </div>
        </div>
    );

    const renderExpanded = (profile, closeExpanded) => (
        <div>
            <div className="pr-8">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 mb-2 tabular-nums">
                    <RiGroupLine className="w-3 h-3" />
                    <span>{profile.employees_count ?? 0} assigned employees</span>
                </div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {profile.name}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                    {profile.description || 'Standard hardware provisioning baseline for this organizational role.'}
                </p>
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <RiCpuLine className="w-3.5 h-3.5" />
                        <span>CPU Tier</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {cpuTierLabels[profile.min_cpu_tier] || profile.min_cpu_tier}
                    </div>
                </div>

                <div className="p-3 rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <RiRam2Line className="w-3.5 h-3.5" />
                        <span>Memory</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {profile.min_ram_gb} GB
                    </div>
                </div>

                <div className="p-3 rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <RiHardDrive2Line className="w-3.5 h-3.5" />
                        <span>Storage</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {profile.min_storage_gb} GB
                    </div>
                </div>

                <div className="p-3 rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <RiMacbookLine className="w-3.5 h-3.5" />
                        <span>Form Factor</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {profile.portability_required ? 'Laptop Only' : 'Any'}
                    </div>
                </div>
            </div>

            <div className="mt-4 p-3.5 rounded-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                <div>
                    <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        Graphics Requirement
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {profile.requires_gpu
                            ? `Requires ${gpuTierLabels[profile.min_gpu_tier] || profile.min_gpu_tier} tier GPU acceleration.`
                            : 'Dedicated graphics acceleration is not mandatory for this role.'}
                    </div>
                </div>
                <span
                    className={`px-2.5 py-1 rounded-sm border text-[11px] font-medium shrink-0 ${
                        profile.requires_gpu
                            ? 'bg-[#026eff]/10 border-[#026eff]/20 text-[#026eff] dark:text-sky-400'
                            : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                    }`}
                >
                    {profile.requires_gpu ? gpuTierLabels[profile.min_gpu_tier] : 'Optional'}
                </span>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                <Link
                    href={route('mismatches.index')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-[#026eff] dark:hover:text-sky-400 transition"
                >
                    <span>Inspect workforce mismatches</span>
                    <RiArrowRightUpLine className="w-3.5 h-3.5" />
                </Link>

                <div className="flex items-center gap-2 ml-auto">
                    <SecondaryButton type="button" onClick={closeExpanded}>
                        Close
                    </SecondaryButton>
                    {isAdminOrManager && (
                        <PrimaryButton
                            type="button"
                            onClick={() => {
                                closeExpanded();
                                openEditModal(profile);
                            }}
                        >
                            Edit Specifications
                        </PrimaryButton>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Role Profiles &amp; Baselines
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Minimum hardware thresholds driving Smart Match eligibility and mismatch detection.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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

            {/* Compact Filter Toolbar */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-3.5 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                    <RiSearchLine className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search role profiles..."
                        className="w-full pl-9 pr-8 py-1.5 text-xs rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-[#026eff] focus:ring-0"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                        >
                            <RiCloseLine className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums hidden md:inline mr-1">
                        {filteredProfiles.length} of {profiles.length} profiles
                    </span>
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 p-0.5 rounded-sm">
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'gpu', label: 'GPU Required' },
                            { id: 'portable', label: 'Portable' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setRequirementFilter(tab.id)}
                                className={`px-2.5 py-1 rounded-sm border text-[11px] font-medium transition cursor-pointer ${
                                    requirementFilter === tab.id
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

            {filteredProfiles.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                    <RiShieldCheckLine className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No role profiles match</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Create a workload baseline or clear your search filter.
                    </p>
                </div>
            ) : (
                <ExpandableCardContainer
                    cards={filteredProfiles}
                    renderCard={renderCard}
                    renderExpanded={renderExpanded}
                    gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                />
            )}

            {/* Create / Edit Role Profile Modal */}
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
                                <InputLabel htmlFor="rp_gpu_tier" value="Minimum GPU Tier" />
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
        </AuthenticatedLayout>
    );
}
