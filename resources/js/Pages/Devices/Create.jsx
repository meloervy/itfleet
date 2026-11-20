import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CustomSelect from '@/Components/CustomSelect';
import FileUpload from '@/Components/ui/FileUpload';
import HardwareImage from '@/Components/HardwareImage';
import {
    architectureQuickChips,
    calculateWorkloadFit,
    conditionOptions,
    cpuTierOptions,
    deviceTypeOptions,
    fullHardwareTemplates,
    getDetectedArchitectureInfo,
    gpuTierOptions,
    lifecycleStageOptions,
    statusOptions,
    storageTypeOptions,
    supportedBrands,
    supportedCpus,
    supportedModels,
} from '@/Components/Devices/deviceCatalogConstants';
import { Head, Link, useForm } from '@inertiajs/react';
import axios from 'axios';
import { useState } from 'react';
import {
    RiApps2Line,
    RiArrowLeftLine,
    RiBarcodeLine,
    RiCheckLine,
    RiCloseLine,
    RiCpuLine,
    RiFolderImageLine,
    RiGoogleFill,
    RiLoader4Line,
    RiMagicLine,
    RiSearchLine,
    RiShieldCheckLine,
    RiSparklingLine,
} from 'react-icons/ri';

const inputClasses =
    'w-full text-sm rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 py-2 px-3 focus:outline-none focus:border-[#026eff] focus:ring-0 transition';

const labelClasses = 'block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5';

export default function DevicesCreate() {
    const { data, setData, post, processing, errors, transform } = useForm({
        asset_tag: '',
        serial_number: '',
        barcode: '',
        techspecs_id: '',
        image_url: '',
        device_type: 'laptop',
        brand: '',
        model: '',
        cpu: '',
        cpu_tier: 'mid',
        ram_gb: 16,
        storage_type: 'SSD',
        storage_gb: 512,
        gpu: '',
        gpu_tier: 'none',
        specifications: {},
        year_acquired: new Date().getFullYear(),
        location: '',
        purchase_cost: '',
        purchase_date: new Date().toISOString().split('T')[0],
        depreciation_rate_percent: 20.0,
        vendor: '',
        warranty_start: new Date().toISOString().split('T')[0],
        warranty_expiry: '',
        contract_sla: '',
        condition: 'excellent',
        status: 'available',
        lifecycle_stage: 'deployment',
        notes: '',
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [identifying, setIdentifying] = useState(false);
    const [apiError, setApiError] = useState(null);
    const [autoFilledNotice, setAutoFilledNotice] = useState(null);
    const [aiSource, setAiSource] = useState(null);

    const [selectedArchCategory, setSelectedArchCategory] = useState('snapdragon');
    const [showTemplatesDrawer, setShowTemplatesDrawer] = useState(false);

    const [fetchingPhoto, setFetchingPhoto] = useState(false);
    const [photoNotice, setPhotoNotice] = useState(null);

    const handleFetchHardwarePhoto = async (preference = 'public_asset') => {
        if (!data.brand && !data.model) {
            setPhotoNotice({ type: 'error', message: 'Please enter Brand and Model first before fetching photo.' });
            return;
        }
        setFetchingPhoto(true);
        setPhotoNotice(null);
        try {
            const res = await axios.post(route('hardware.image-lookup'), {
                brand: data.brand,
                model: data.model,
                device_type: data.device_type,
                prefer: preference,
            });
            if (res.data.image_url) {
                setData('image_url', res.data.image_url);
                const sourceLabel = res.data.source === 'public_asset'
                    ? 'Public Asset Folder'
                    : res.data.source === 'google_search'
                    ? 'Google Image Search'
                    : 'Hardware Registry';
                setPhotoNotice({
                    type: 'success',
                    message: `Found authentic photo from ${sourceLabel}.`,
                });
            } else {
                setPhotoNotice({
                    type: 'info',
                    message: preference === 'google_search'
                        ? 'No image found via Google Search. You may fetch from Public Asset or upload a photo.'
                        : 'No matching photo in public assets. You may upload a local image or enter a custom URL.',
                });
            }
        } catch (err) {
            setPhotoNotice({
                type: 'error',
                message: 'Failed to look up hardware image. Please check network connection.',
            });
        } finally {
            setFetchingPhoto(false);
        }
    };

    const handleAiIdentify = async (e, queryOverride = null) => {
        if (e && e.preventDefault) e.preventDefault();
        const targetQuery = (queryOverride || searchQuery || '').trim();
        if (!targetQuery || targetQuery.length < 2) return;

        setSearchQuery(targetQuery);
        setIdentifying(true);
        setApiError(null);
        setAutoFilledNotice(null);
        setAiSource(null);

        try {
            const res = await axios.post(route('devices.identify-specs'), {
                query: targetQuery,
            });

            if (res.data.success && res.data.specs) {
                const specs = res.data.specs;
                setData((prev) => ({
                    ...prev,
                    brand: specs.brand || prev.brand,
                    model: specs.model || prev.model,
                    device_type: specs.device_type || prev.device_type,
                    cpu: specs.cpu || prev.cpu,
                    cpu_tier: specs.cpu_tier || prev.cpu_tier,
                    ram_gb: specs.ram_gb || prev.ram_gb,
                    storage_type: specs.storage_type || prev.storage_type,
                    storage_gb: specs.storage_gb || prev.storage_gb,
                    gpu: specs.gpu || prev.gpu,
                    gpu_tier: specs.gpu_tier || prev.gpu_tier,
                    year_acquired: specs.year_acquired || prev.year_acquired,
                    vendor: prev.vendor || specs.brand,
                    image_url: specs.image_url || prev.image_url,
                }));

                const hasPhoto = Boolean(specs.image_url);
                setAutoFilledNotice(
                    `AI identified and auto-populated hardware specs for "${specs.brand} ${specs.model}".` +
                    (hasPhoto ? ' Device photo automatically matched.' : '')
                );
                setAiSource(res.data.source);
                if (hasPhoto) {
                    setPhotoNotice({
                        type: 'success',
                        message: 'Hardware photo automatically matched and loaded.',
                    });
                }
            } else {
                setApiError(res.data.error || 'AI could not identify this device. Please enter specs manually.');
            }
        } catch (err) {
            setApiError(err.response?.data?.error || 'Failed to identify device. Please enter specs manually.');
        } finally {
            setIdentifying(false);
        }
    };

    const handleApplyTemplate = (template) => {
        setData((prev) => ({
            ...prev,
            ...template.data,
            asset_tag: prev.asset_tag || `${template.data.device_type === 'desktop' ? 'DSK' : 'LAP'}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        }));
        setAutoFilledNotice(`Loaded preset template: "${template.title}" (${template.subtitle}).`);
        setAiSource('template_preset');
    };

    const isCompute = ['laptop', 'desktop'].includes(data.device_type);

    const getTagPrefix = (type) => {
        switch (type) {
            case 'desktop':
                return 'DSK';
            case 'monitor':
                return 'MON';
            case 'mobile':
                return 'MOB';
            case 'peripheral':
                return 'PER';
            default:
                return 'LAP';
        }
    };

    const updateSpecField = (key, val) => {
        setData('specifications', {
            ...(data.specifications || {}),
            [key]: val,
        });
    };

    const generateAssetTag = () => {
        const prefix = getTagPrefix(data.device_type);
        const year = new Date().getFullYear();
        const rand = Math.floor(1000 + Math.random() * 9000);
        const tag = `${prefix}-${year}-${rand}`;
        setData('asset_tag', tag);
        if (!data.barcode) {
            setData('barcode', `BC-${tag}`);
        }
    };

    const generateBarcode = () => {
        const base = data.asset_tag || `${getTagPrefix(data.device_type)}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        setData('barcode', `BC-${base.replace(/[^A-Z0-9-]/gi, '')}`);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        transform((formData) => {
            if (['laptop', 'desktop'].includes(formData.device_type)) {
                return formData;
            }
            return {
                ...formData,
                cpu: null,
                cpu_tier: null,
                ram_gb: null,
                storage_type: null,
                storage_gb: null,
                gpu: null,
                gpu_tier: 'none',
            };
        });
        post(route('devices.store'));
    };

    const previewImage = data.image_url || (
        data.device_type === 'monitor'
            ? '/images/devices/default-monitor.svg'
            : data.device_type === 'mobile'
            ? '/images/devices/default-mobile.svg'
            : data.device_type === 'peripheral'
            ? '/images/devices/default-peripheral.svg'
            : data.brand.toLowerCase().includes('apple') || data.model.toLowerCase().includes('macbook')
            ? (data.model.toLowerCase().includes('air') ? '/images/devices/apple-macbook-air.jpg' : '/images/devices/apple-macbook-pro.jpg')
            : data.brand.toLowerCase().includes('dell')
            ? '/images/devices/dell-xps.jpg'
            : data.brand.toLowerCase().includes('lenovo')
            ? '/images/devices/lenovo-thinkpad.jpg'
            : data.brand.toLowerCase().includes('hp')
            ? '/images/devices/hp-elitebook.jpg'
            : (data.device_type === 'desktop' ? '/images/devices/default-desktop.jpg' : '/images/devices/default-laptop.jpg')
    );

    const archInfo = getDetectedArchitectureInfo(data);
    const fit = calculateWorkloadFit(data);

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

                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Register Hardware Asset
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Automated specification lookup with Gemini 4 Hydrogen and ITAM lifecycle tracking.
                        </p>
                    </div>
                </div>
            }
        >
            <Head title="Register Hardware Asset - ITFleet" />

            <div className="max-w-5xl mx-auto space-y-5">
                {/* 1. Clean Automated Asset Identification Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1 max-w-xl">
                            <div className="flex items-center gap-2">
                                <RiSparklingLine className="w-4 h-4 text-[#026eff] dark:text-sky-400" />
                                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    AI Specification Auto-Fill
                                </h2>
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[#026eff]/10 border border-[#026eff]/20 text-[#026eff] dark:text-sky-400 rounded-sm">
                                    Gemini 4 Hydrogen
                                </span>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Enter a device model to populate processor, RAM, storage, GPU tier, and matching photo.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                            <button
                                type="button"
                                onClick={() => setShowTemplatesDrawer(!showTemplatesDrawer)}
                                className={`shrink-0 px-3 py-2 rounded-sm border text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                    showTemplatesDrawer
                                        ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                }`}
                            >
                                <RiApps2Line className="w-3.5 h-3.5 text-[#026eff] dark:text-sky-400" />
                                <span>{showTemplatesDrawer ? 'Hide Presets' : '1-Click Presets'}</span>
                            </button>

                            <form onSubmit={(e) => handleAiIdentify(e)} className="flex gap-2 flex-1 sm:w-80">
                                <div className="relative flex-1">
                                    <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-3.5 h-3.5 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="e.g. Surface Laptop 7, M4 Pro..."
                                        className="w-full text-xs pl-8 pr-3 py-2 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:border-[#026eff] focus:ring-0 transition"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={identifying || searchQuery.trim().length < 2}
                                    className="shrink-0 px-3.5 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white text-xs font-medium disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
                                >
                                    {identifying ? (
                                        <>
                                            <RiLoader4Line className="animate-spin w-3.5 h-3.5" />
                                            <span>Identifying...</span>
                                        </>
                                    ) : (
                                        <>
                                            <RiSparklingLine className="w-3.5 h-3.5" />
                                            <span>Identify</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* 1-Click Presets Drawer */}
                    {showTemplatesDrawer && (
                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                    Enterprise Hardware Presets
                                </span>
                                <span className="text-[11px] text-zinc-400 font-mono">6 SKUs</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {fullHardwareTemplates.map((template, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3.5 rounded-sm bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-200/70 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                                                    {template.badge}
                                                </span>
                                                <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                                                    ₱{Number(template.data.purchase_cost).toLocaleString()}
                                                </span>
                                            </div>
                                            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{template.title}</h4>
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{template.subtitle}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleApplyTemplate(template)}
                                            className="mt-3 w-full py-1.5 px-2.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-[#026eff] hover:text-[#026eff] dark:hover:text-sky-400 text-zinc-700 dark:text-zinc-200 text-[11px] font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                            <RiCheckLine className="w-3.5 h-3.5" />
                                            <span>Apply Preset</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Architecture Quick-Fill Tabs */}
                    <div className="pt-3.5 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                                Quick examples by architecture
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                                {architectureQuickChips.map((arch) => (
                                    <button
                                        key={arch.id}
                                        type="button"
                                        onClick={() => setSelectedArchCategory(arch.id)}
                                        className={`px-2.5 py-1 rounded-sm border text-[11px] font-medium transition cursor-pointer ${
                                            selectedArchCategory === arch.id
                                                ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 text-white dark:text-zinc-900'
                                                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                        }`}
                                    >
                                        {arch.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {architectureQuickChips
                                .find((arch) => arch.id === selectedArchCategory)
                                ?.chips.map((chip, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        disabled={identifying}
                                        onClick={() => handleAiIdentify(null, chip.query)}
                                        className="px-2.5 py-1 rounded-sm bg-zinc-50 dark:bg-zinc-800/60 hover:border-[#026eff] border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 hover:text-[#026eff] dark:hover:text-sky-400 font-medium transition cursor-pointer disabled:opacity-50"
                                    >
                                        {chip.label}
                                    </button>
                                ))}
                        </div>
                    </div>

                    {apiError && (
                        <div className="p-3 rounded-sm bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
                            <span>{apiError}</span>
                            <button type="button" onClick={() => setApiError(null)} className="p-0.5 cursor-pointer">
                                <RiCloseLine className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {autoFilledNotice && (
                        <div className="p-3 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2">
                                <RiCheckLine className="w-4 h-4 shrink-0" />
                                <span>{autoFilledNotice}</span>
                                {aiSource && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-emerald-500/15 border border-emerald-500/20 rounded-sm">
                                        {aiSource}
                                    </span>
                                )}
                            </span>
                            <button type="button" onClick={() => setAutoFilledNotice(null)} className="p-0.5 cursor-pointer">
                                <RiCloseLine className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* 2. Main Enrollment Form */}
                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-6">
                    <form onSubmit={handleSubmit} className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {/* Section 1: Identification & Tagging */}
                        <div className="pb-6 space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    1. Identification &amp; Tagging
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Physical barcode tagging, serial identification, and site assignment
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                            Asset Tag <span className="text-rose-500">*</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={generateAssetTag}
                                            className="text-[11px] font-medium text-[#026eff] dark:text-sky-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                        >
                                            <RiMagicLine className="w-3 h-3" />
                                            <span>Auto</span>
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={data.asset_tag}
                                        onChange={(e) => setData('asset_tag', e.target.value.toUpperCase())}
                                        placeholder="e.g. LAP-042"
                                        className={`${inputClasses} font-mono uppercase`}
                                        required
                                    />
                                    {errors.asset_tag && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.asset_tag}</p>}
                                </div>

                                <div>
                                    <label className={labelClasses}>Serial Number</label>
                                    <input
                                        type="text"
                                        value={data.serial_number}
                                        onChange={(e) => setData('serial_number', e.target.value)}
                                        placeholder="e.g. C02G45XP19F3"
                                        className={`${inputClasses} font-mono`}
                                    />
                                    {errors.serial_number && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.serial_number}</p>}
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                            Barcode / QR Tag
                                        </label>
                                        <button
                                            type="button"
                                            onClick={generateBarcode}
                                            className="text-[11px] font-medium text-[#026eff] dark:text-sky-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                        >
                                            <RiBarcodeLine className="w-3 h-3" />
                                            <span>Auto</span>
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={data.barcode}
                                        onChange={(e) => setData('barcode', e.target.value)}
                                        placeholder="e.g. BC-LAP-042"
                                        className={`${inputClasses} font-mono`}
                                    />
                                    {errors.barcode && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.barcode}</p>}
                                </div>

                                <div>
                                    <label className={labelClasses}>Physical Location</label>
                                    <input
                                        type="text"
                                        value={data.location}
                                        onChange={(e) => setData('location', e.target.value)}
                                        placeholder="e.g. BGC HQ - Floor 12"
                                        className={inputClasses}
                                    />
                                    {errors.location && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.location}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Live Workload Fit Preview Strip (Compute Only) */}
                        {isCompute && (
                            <div className="py-5">
                                <div className="p-4 rounded-sm bg-zinc-50/70 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`px-2 py-0.5 rounded-sm border border-current/15 text-[11px] font-medium inline-flex items-center gap-1 ${archInfo.badgeColor}`}>
                                                <RiCpuLine className="w-3.5 h-3.5" />
                                                {archInfo.archLabel}
                                            </span>
                                            <span className="text-[11px] text-zinc-600 dark:text-zinc-300 inline-flex items-center gap-1">
                                                <RiShieldCheckLine className="w-3.5 h-3.5 text-emerald-500" />
                                                {archInfo.aiCertified}
                                            </span>
                                            <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                                                {archInfo.npu}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                            Estimated workload suitability based on current hardware specifications
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-5 shrink-0 tabular-nums">
                                        <div>
                                            <div className="text-[10px] font-medium text-zinc-400">Dev / Eng</div>
                                            <div className={`text-sm font-semibold ${fit.dev >= 80 ? 'text-emerald-600 dark:text-emerald-400' : fit.dev >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'}`}>
                                                {fit.dev}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-medium text-zinc-400">Creative / 3D</div>
                                            <div className={`text-sm font-semibold ${fit.design >= 75 ? 'text-emerald-600 dark:text-emerald-400' : fit.design >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'}`}>
                                                {fit.design}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-medium text-zinc-400">Productivity</div>
                                            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                {fit.admin}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section 2: Hardware Specifications & Media */}
                        <div className="py-6 space-y-5">
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    2. Hardware Specifications &amp; Media
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Processor, memory, storage architecture, graphics profile, and device image
                                </p>
                            </div>

                            {/* Media Row */}
                            <div className="p-4 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/50 flex flex-col md:flex-row items-start gap-4">
                                <div className="w-20 h-20 rounded-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                                    <HardwareImage
                                        src={data.image_url || previewImage}
                                        alt={data.model || 'Device clip preview'}
                                        deviceType={data.device_type}
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <div className="flex-1 w-full space-y-2.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                            Hardware Media URL
                                        </label>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => handleFetchHardwarePhoto('public_asset')}
                                                disabled={fetchingPhoto || (!data.brand && !data.model)}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-[#026eff] text-zinc-700 dark:text-zinc-200 text-[11px] font-medium transition disabled:opacity-40 cursor-pointer"
                                            >
                                                {fetchingPhoto ? (
                                                    <RiLoader4Line className="animate-spin w-3.5 h-3.5" />
                                                ) : (
                                                    <RiFolderImageLine className="w-3.5 h-3.5 text-[#026eff] dark:text-sky-400" />
                                                )}
                                                <span>Public Asset</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleFetchHardwarePhoto('google_search')}
                                                disabled={fetchingPhoto || (!data.brand && !data.model)}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-[#026eff] text-zinc-700 dark:text-zinc-200 text-[11px] font-medium transition disabled:opacity-40 cursor-pointer"
                                            >
                                                <RiGoogleFill className="w-3.5 h-3.5 text-amber-500" />
                                                <span>Google Image</span>
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        type="url"
                                        value={data.image_url}
                                        onChange={(e) => setData('image_url', e.target.value)}
                                        placeholder="/images/devices/... or custom URL"
                                        className={`${inputClasses} text-xs font-mono`}
                                    />
                                    {photoNotice && (
                                        <p className={`text-xs ${
                                            photoNotice.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                                            photoNotice.type === 'error' ? 'text-rose-600 dark:text-rose-400' :
                                            'text-amber-600 dark:text-amber-400'
                                        }`}>
                                            {photoNotice.message}
                                        </p>
                                    )}
                                    <FileUpload
                                        onImageSelect={(dataUrl) => {
                                            setData('image_url', dataUrl);
                                            setPhotoNotice({
                                                type: 'success',
                                                message: 'Hardware image attached from local upload.',
                                            });
                                        }}
                                    />
                                </div>
                            </div>

                            <datalist id="supported-brands">
                                {supportedBrands.map((b) => <option key={b} value={b} />)}
                            </datalist>
                            <datalist id="supported-models">
                                {supportedModels.map((m) => <option key={m} value={m} />)}
                            </datalist>
                            <datalist id="supported-cpus">
                                {supportedCpus.map((c) => <option key={c} value={c} />)}
                            </datalist>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClasses}>
                                        Device Type <span className="text-rose-500">*</span>
                                    </label>
                                    <CustomSelect
                                        value={data.device_type}
                                        onChange={(val) => setData('device_type', val)}
                                        options={deviceTypeOptions}
                                        placeholder="Select device type..."
                                        size="md"
                                    />
                                    {errors.device_type && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.device_type}</p>}
                                </div>

                                <div>
                                    <label className={labelClasses}>
                                        Brand <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="supported-brands"
                                        value={data.brand}
                                        onChange={(e) => setData('brand', e.target.value)}
                                        placeholder="e.g. Dell, Apple, Lenovo..."
                                        className={inputClasses}
                                        required
                                    />
                                    {errors.brand && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.brand}</p>}
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {['Apple', 'Dell', 'Lenovo', 'HP', 'Microsoft', 'ASUS', 'Acer'].map((brandName) => (
                                            <button
                                                key={brandName}
                                                type="button"
                                                onClick={() => setData('brand', brandName)}
                                                className={`px-2 py-0.5 rounded-sm border text-[10px] font-medium transition cursor-pointer ${
                                                    data.brand.toLowerCase() === brandName.toLowerCase()
                                                        ? 'bg-[#026eff] border-[#026eff] text-white'
                                                        : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                                }`}
                                            >
                                                {brandName}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClasses}>
                                        Model <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        list="supported-models"
                                        value={data.model}
                                        onChange={(e) => setData('model', e.target.value)}
                                        placeholder="e.g. ThinkPad T14s, Surface Laptop 7"
                                        className={inputClasses}
                                        required
                                    />
                                    {errors.model && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.model}</p>}
                                </div>

                                {isCompute ? (
                                    <>
                                        <div>
                                            <label className={labelClasses}>
                                                Processor (CPU) <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                list="supported-cpus"
                                                value={data.cpu}
                                                onChange={(e) => setData('cpu', e.target.value)}
                                                placeholder="e.g. Snapdragon X Elite, Apple M4"
                                                className={inputClasses}
                                                required
                                            />
                                            {errors.cpu && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.cpu}</p>}
                                        </div>

                                        <div>
                                            <label className={labelClasses}>
                                                CPU Tier <span className="text-rose-500">*</span>
                                            </label>
                                            <CustomSelect
                                                value={data.cpu_tier}
                                                onChange={(val) => setData('cpu_tier', val)}
                                                options={cpuTierOptions}
                                                placeholder="Select CPU tier..."
                                                size="md"
                                            />
                                            {errors.cpu_tier && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.cpu_tier}</p>}
                                        </div>

                                        <div>
                                            <label className={labelClasses}>
                                                RAM (GB) <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={data.ram_gb}
                                                onChange={(e) => setData('ram_gb', parseInt(e.target.value) || 0)}
                                                className={inputClasses}
                                                required
                                            />
                                            {errors.ram_gb && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.ram_gb}</p>}
                                        </div>

                                        <div className="flex gap-3">
                                            <div className="w-1/2">
                                                <label className={labelClasses}>
                                                    Storage (GB) <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={data.storage_gb}
                                                    onChange={(e) => setData('storage_gb', parseInt(e.target.value) || 0)}
                                                    className={inputClasses}
                                                    required
                                                />
                                            </div>
                                            <div className="w-1/2">
                                                <label className={labelClasses}>
                                                    Disk Type <span className="text-rose-500">*</span>
                                                </label>
                                                <CustomSelect
                                                    value={data.storage_type}
                                                    onChange={(val) => setData('storage_type', val)}
                                                    options={storageTypeOptions}
                                                    placeholder="Type..."
                                                    size="md"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelClasses}>Graphics (GPU)</label>
                                            <input
                                                type="text"
                                                value={data.gpu}
                                                onChange={(e) => setData('gpu', e.target.value)}
                                                placeholder="e.g. NVIDIA RTX 4070, Intel Iris Xe"
                                                className={inputClasses}
                                            />
                                        </div>

                                        <div>
                                            <label className={labelClasses}>
                                                GPU Tier <span className="text-rose-500">*</span>
                                            </label>
                                            <CustomSelect
                                                value={data.gpu_tier}
                                                onChange={(val) => setData('gpu_tier', val)}
                                                options={gpuTierOptions}
                                                placeholder="Select GPU tier..."
                                                size="md"
                                            />
                                        </div>
                                    </>
                                ) : data.device_type === 'monitor' ? (
                                    <>
                                        <div>
                                            <label className={labelClasses}>Screen Size</label>
                                            <input
                                                type="text"
                                                value={data.specifications?.screen_size || ''}
                                                onChange={(e) => updateSpecField('screen_size', e.target.value)}
                                                placeholder='e.g. 27" / 34" Ultrawide'
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Resolution</label>
                                            <input
                                                type="text"
                                                value={data.specifications?.resolution || ''}
                                                onChange={(e) => updateSpecField('resolution', e.target.value)}
                                                placeholder="e.g. 3840x2160 (4K UHD)"
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Panel &amp; Refresh Rate</label>
                                            <input
                                                type="text"
                                                value={data.specifications?.panel_type || ''}
                                                onChange={(e) => updateSpecField('panel_type', e.target.value)}
                                                placeholder="e.g. IPS 60Hz USB-C PD 90W"
                                                className={inputClasses}
                                            />
                                        </div>
                                    </>
                                ) : data.device_type === 'mobile' ? (
                                    <>
                                        <div>
                                            <label className={labelClasses}>Operating System</label>
                                            <input
                                                type="text"
                                                value={data.specifications?.os || ''}
                                                onChange={(e) => updateSpecField('os', e.target.value)}
                                                placeholder="e.g. iOS 18, Android 15"
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Internal Storage</label>
                                            <input
                                                type="text"
                                                value={data.specifications?.storage || ''}
                                                onChange={(e) => updateSpecField('storage', e.target.value)}
                                                placeholder="e.g. 256GB"
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>IMEI / Carrier</label>
                                            <input
                                                type="text"
                                                value={data.specifications?.carrier || ''}
                                                onChange={(e) => updateSpecField('carrier', e.target.value)}
                                                placeholder="e.g. Unlocked / Globe Enterprise"
                                                className={inputClasses}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className={labelClasses}>Peripheral Subtype</label>
                                            <input
                                                type="text"
                                                value={data.specifications?.subtype || ''}
                                                onChange={(e) => updateSpecField('subtype', e.target.value)}
                                                placeholder="e.g. Thunderbolt Dock, ANC Headset, Webcam"
                                                className={inputClasses}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Connectivity / Interface</label>
                                            <input
                                                type="text"
                                                value={data.specifications?.connectivity || ''}
                                                onChange={(e) => updateSpecField('connectivity', e.target.value)}
                                                placeholder="e.g. USB-C / Thunderbolt 4, Bluetooth 5.3"
                                                className={inputClasses}
                                            />
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className={labelClasses}>Acquisition Year</label>
                                    <input
                                        type="number"
                                        min="2010"
                                        max="2035"
                                        value={data.year_acquired}
                                        onChange={(e) => setData('year_acquired', parseInt(e.target.value) || new Date().getFullYear())}
                                        className={inputClasses}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Financial & Warranty */}
                        <div className="py-6 space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    3. Financial, Vendor &amp; Warranty Tracking
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Procurement investment, straight-line depreciation, and contractual SLAs
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className={labelClasses}>Purchase Cost (₱)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.purchase_cost}
                                        onChange={(e) => setData('purchase_cost', e.target.value)}
                                        placeholder="e.g. 75000.00"
                                        className={inputClasses}
                                    />
                                </div>

                                <div>
                                    <label className={labelClasses}>Purchase Date</label>
                                    <input
                                        type="date"
                                        value={data.purchase_date}
                                        onChange={(e) => setData('purchase_date', e.target.value)}
                                        className={inputClasses}
                                    />
                                </div>

                                <div>
                                    <label className={labelClasses}>Annual Depreciation (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={data.depreciation_rate_percent}
                                        onChange={(e) => setData('depreciation_rate_percent', e.target.value)}
                                        className={inputClasses}
                                    />
                                </div>

                                <div>
                                    <label className={labelClasses}>Vendor / Supplier</label>
                                    <input
                                        type="text"
                                        value={data.vendor}
                                        onChange={(e) => setData('vendor', e.target.value)}
                                        placeholder="e.g. Dell Direct, Apple"
                                        className={inputClasses}
                                    />
                                </div>

                                <div>
                                    <label className={labelClasses}>Warranty Start Date</label>
                                    <input
                                        type="date"
                                        value={data.warranty_start}
                                        onChange={(e) => setData('warranty_start', e.target.value)}
                                        className={inputClasses}
                                    />
                                </div>

                                <div>
                                    <label className={labelClasses}>Warranty Expiration Date</label>
                                    <input
                                        type="date"
                                        value={data.warranty_expiry}
                                        onChange={(e) => setData('warranty_expiry', e.target.value)}
                                        className={inputClasses}
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className={labelClasses}>Contractual SLA / Coverage Tier</label>
                                    <input
                                        type="text"
                                        value={data.contract_sla}
                                        onChange={(e) => setData('contract_sla', e.target.value)}
                                        placeholder="e.g. ProSupport Plus NBD Onsite, AppleCare+ Enterprise"
                                        className={inputClasses}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Lifecycle Stage & Operational State */}
                        <div className="py-6 space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    4. Lifecycle Stage &amp; Operational State
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Initial lifecycle positioning, physical health audit, and stock status
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClasses}>
                                        Lifecycle Stage <span className="text-rose-500">*</span>
                                    </label>
                                    <CustomSelect
                                        value={data.lifecycle_stage}
                                        onChange={(val) => setData('lifecycle_stage', val)}
                                        options={lifecycleStageOptions}
                                        placeholder="Select lifecycle stage..."
                                        size="md"
                                    />
                                </div>

                                <div>
                                    <label className={labelClasses}>
                                        Physical Condition <span className="text-rose-500">*</span>
                                    </label>
                                    <CustomSelect
                                        value={data.condition}
                                        onChange={(val) => setData('condition', val)}
                                        options={conditionOptions}
                                        placeholder="Select condition..."
                                        size="md"
                                    />
                                </div>

                                <div>
                                    <label className={labelClasses}>
                                        Fleet Availability Status <span className="text-rose-500">*</span>
                                    </label>
                                    <CustomSelect
                                        value={data.status}
                                        onChange={(val) => setData('status', val)}
                                        options={statusOptions}
                                        placeholder="Select status..."
                                        size="md"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={labelClasses}>Internal Audit Notes</label>
                                <textarea
                                    rows={3}
                                    value={data.notes}
                                    onChange={(e) => setData('notes', e.target.value)}
                                    placeholder="Peripheral serial numbers, BIOS configurations, or intake inspection notes..."
                                    className={inputClasses}
                                />
                            </div>
                        </div>

                        {/* Submit Footer */}
                        <div className="pt-5 flex flex-col sm:flex-row sm:items-center justify-end gap-2.5">
                            <Link
                                href={route('devices.index')}
                                className="px-4 py-2 rounded-sm border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-center"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className="px-5 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-xs font-medium text-white transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                {processing ? (
                                    <>
                                        <RiLoader4Line className="animate-spin w-3.5 h-3.5" />
                                        <span>Enrolling Asset...</span>
                                    </>
                                ) : (
                                    <>
                                        <RiCheckLine className="w-3.5 h-3.5" />
                                        <span>Enroll Asset into Fleet</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
