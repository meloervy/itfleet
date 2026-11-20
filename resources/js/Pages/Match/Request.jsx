import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Checkbox from '@/Components/Checkbox';
import CustomSelect from '@/Components/CustomSelect';
import HardwareImage from '@/Components/HardwareImage';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import BridgeSwapModal from '@/Components/Match/BridgeSwapModal';
import DeployableInventoryModal from '@/Components/Match/DeployableInventoryModal';
import GeminiDiagnosticModal from '@/Components/Match/GeminiDiagnosticModal';
import WorkloadTemplateModal from '@/Components/Match/WorkloadTemplateModal';
import {
    DEFAULT_TEMPLATES,
    matchCpuTierOptions,
    matchGpuTierOptions,
} from '@/Components/Match/matchConstants';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import {
    RiAddLine,
    RiAlertLine,
    RiArrowDownSLine,
    RiArrowRightUpLine,
    RiArrowUpSLine,
    RiBookmarkLine,
    RiCalculatorLine,
    RiCheckLine,
    RiCloseLine,
    RiComputerLine,
    RiErrorWarningLine,
    RiHistoryLine,
    RiLoader4Line,
    RiPulseLine,
    RiRefreshLine,
    RiSparkling2Line,
    RiStackLine,
    RiSwapLine,
} from 'react-icons/ri';

const DRAFT_STORAGE_KEY = 'itfleet_draft_requirements';
const TEMPLATE_STORAGE_KEY = 'itfleet_workload_templates';

const DEFAULT_REQUIREMENTS = {
    min_cpu_tier: 'mid',
    min_ram_gb: 16,
    min_storage_gb: 512,
    requires_gpu: false,
    min_gpu_tier: 'none',
    portability_required: true,
    weight_profile: 'balanced',
};

const formatPct = (val) => {
    const num = Number(val ?? 0);
    return Math.round(num <= 1 ? num * 100 : num);
};

const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const normalizeTemplate = (tpl, idx = 0) => ({
    id: tpl.id || `tpl_${idx}`,
    label: tpl.label || tpl.name || tpl.title || 'Workload Template',
    category: tpl.category || tpl.dept || tpl.badge || '',
    prompt: tpl.prompt || tpl.text || tpl.raw_input || tpl.description || '',
    requirements: tpl.requirements || null,
    custom: Boolean(tpl.custom),
});

export default function MatchRequest({
    employees = [],
    role_profiles = [],
    recent_requests = [],
    selected_employee_id,
    deployable_summary = {},
}) {
    const [employeeId, setEmployeeId] = useState(
        selected_employee_id ? String(selected_employee_id) : ''
    );
    const [rawInput, setRawInput] = useState('');
    const [requirements, setRequirements] = useState(DEFAULT_REQUIREMENTS);
    const [extractionMeta, setExtractionMeta] = useState(null);

    const [isExtracting, setIsExtracting] = useState(false);
    const [isRanking, setIsRanking] = useState(false);
    const [assigningDeviceId, setAssigningDeviceId] = useState(null);
    const [errorBanner, setErrorBanner] = useState('');

    // Results & Advisory state
    const [rankingResponse, setRankingResponse] = useState(null);
    const [recoFilter, setRecoFilter] = useState('top'); // 'top' | 'stockroom' | 'all' | 'disqualified'
    const [showAllInTop, setShowAllInTop] = useState(false);
    const [showSecondarySwaps, setShowSecondarySwaps] = useState(false);
    const [expandedSubscores, setExpandedSubscores] = useState({});

    // Templates
    const [templates, setTemplates] = useState(() => {
        try {
            const saved = localStorage.getItem(TEMPLATE_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map((t, idx) => normalizeTemplate(t, idx));
                }
            }
        } catch {
            // fallback cleanly to default templates
        }
        return (DEFAULT_TEMPLATES || []).map((t, idx) => normalizeTemplate(t, idx));
    });
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templateForm, setTemplateForm] = useState({
        label: '',
        category: '',
        prompt: '',
    });

    // Simulator
    const [showSimulator, setShowSimulator] = useState(false);
    const [simQuantity, setSimQuantity] = useState(5);
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationResult, setSimulationResult] = useState(null);

    // Modals
    const [showDeployableModal, setShowDeployableModal] = useState(false);
    const [deployableSearch, setDeployableSearch] = useState('');
    const [deployableTypeFilter, setDeployableTypeFilter] = useState('all');

    const [activeBridgeSwap, setActiveBridgeSwap] = useState(null);
    const [showBridgeModal, setShowBridgeModal] = useState(false);
    const [isExecutingSwap, setIsExecutingSwap] = useState(false);

    const [isTestingGemini, setIsTestingGemini] = useState(false);
    const [geminiDiagnostic, setGeminiDiagnostic] = useState(null);
    const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

    // Restore sessionStorage draft on initial load
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
            if (raw) {
                const draft = JSON.parse(raw);
                if (!selected_employee_id && draft.employeeId) {
                    setEmployeeId(String(draft.employeeId));
                }
                if (draft.rawInput) setRawInput(draft.rawInput);
                if (draft.requirements) {
                    setRequirements((prev) => ({ ...prev, ...draft.requirements }));
                }
            }
        } catch {
            // ignore corrupted storage
        }
    }, []);

    useEffect(() => {
        try {
            sessionStorage.setItem(
                DRAFT_STORAGE_KEY,
                JSON.stringify({ employeeId, rawInput, requirements })
            );
        } catch {
            // ignore quota issues
        }
    }, [employeeId, rawInput, requirements]);

    useEffect(() => {
        if (selected_employee_id) {
            setEmployeeId(String(selected_employee_id));
        }
    }, [selected_employee_id]);

    const selectedEmployee = useMemo(
        () => employees.find((e) => String(e.id) === String(employeeId)) || null,
        [employees, employeeId]
    );

    const handleApplyEmployeeRole = (emp) => {
        const target = emp || selectedEmployee;
        if (!target?.role_profile) return;
        const rp = target.role_profile;
        const nextReqs = {
            ...requirements,
            min_cpu_tier: rp.min_cpu_tier || 'mid',
            min_ram_gb: rp.min_ram_gb || 16,
            min_storage_gb: rp.min_storage_gb || 512,
            requires_gpu: Boolean(rp.requires_gpu),
            min_gpu_tier: rp.min_gpu_tier || 'none',
            portability_required: Boolean(rp.portability_required),
        };
        setRequirements(nextReqs);
        if (!rawInput.trim()) {
            setRawInput(
                `${rp.name} role for ${target.name} (${target.department}): ${rp.description || `${rp.min_cpu_tier} CPU, ${rp.min_ram_gb}GB RAM, ${rp.min_storage_gb}GB storage`}`
            );
        }
        handleRank(nextReqs);
    };

    const handleRank = async (reqsToUse = requirements) => {
        setErrorBanner('');
        setIsRanking(true);
        try {
            const payload = {
                requirements: {
                    min_cpu_tier: reqsToUse.min_cpu_tier || 'entry',
                    min_ram_gb: Number(reqsToUse.min_ram_gb) || 8,
                    min_storage_gb: Number(reqsToUse.min_storage_gb) || 256,
                    requires_gpu: Boolean(reqsToUse.requires_gpu),
                    min_gpu_tier: reqsToUse.requires_gpu
                        ? reqsToUse.min_gpu_tier || 'dedicated-entry'
                        : 'none',
                    portability_required: Boolean(reqsToUse.portability_required),
                },
                employee_id: employeeId ? Number(employeeId) : null,
            };

            const { data } = await window.axios.post(route('match.rank'), payload);
            setRankingResponse(data);
            setShowAllInTop(false);
        } catch (err) {
            setErrorBanner(
                err?.response?.data?.message || 'Unable to rank hardware inventory. Please verify thresholds.'
            );
        } finally {
            setIsRanking(false);
        }
    };

    const handleExtractAndRank = async (e) => {
        e?.preventDefault();
        if (!rawInput.trim() || rawInput.trim().length < 3) {
            setErrorBanner('Enter at least a short workload description to extract requirements.');
            return;
        }
        setErrorBanner('');
        setIsExtracting(true);
        try {
            const { data } = await window.axios.post(route('match.extract'), {
                raw_input: rawInput.trim(),
                employee_id: employeeId ? Number(employeeId) : null,
            });

            if (data?.requirements) {
                const extracted = {
                    ...DEFAULT_REQUIREMENTS,
                    ...data.requirements,
                    requires_gpu: Boolean(data.requirements.requires_gpu),
                    portability_required: Boolean(data.requirements.portability_required),
                };
                setRequirements(extracted);
                setExtractionMeta({
                    source: data.requirements.source,
                    reasoning: data.requirements.reasoning,
                    fallback_reason: data.requirements.fallback_reason,
                });
                await handleRank(extracted);
            }
        } catch (err) {
            setErrorBanner(
                err?.response?.data?.message || 'Requirement extraction failed. Try adjusting the description.'
            );
        } finally {
            setIsExtracting(false);
        }
    };

    const handleAssign = (cand) => {
        if (!employeeId) {
            setErrorBanner('Select a recipient employee in Step 1 before finalizing hardware assignment.');
            return;
        }
        setErrorBanner('');
        router.post(
            route('match.assign'),
            {
                device_id: cand.device.id,
                employee_id: Number(employeeId),
                assignment_source: 'ai_recommended',
                match_score: cand.score,
            },
            {
                preserveScroll: true,
                onStart: () => setAssigningDeviceId(cand.device.id),
                onFinish: () => setAssigningDeviceId(null),
                onSuccess: () => {
                    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
                },
            }
        );
    };

    const handleExecuteBridgeSwap = () => {
        if (!activeBridgeSwap || !employeeId) {
            setErrorBanner('Select a target employee in Step 1 before executing a Bridge Swap.');
            return;
        }
        setErrorBanner('');
        router.post(
            route('match.bridge-swap'),
            {
                bridge_device_id: activeBridgeSwap.bridge_device.id,
                donor_employee_id: activeBridgeSwap.donor_employee.id,
                requester_employee_id: Number(employeeId),
                donor_device_id: activeBridgeSwap.donor_device.id,
            },
            {
                preserveScroll: true,
                onStart: () => setIsExecutingSwap(true),
                onFinish: () => setIsExecutingSwap(false),
                onSuccess: () => {
                    setShowBridgeModal(false);
                    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
                },
            }
        );
    };

    const handleSimulate = async (e) => {
        e?.preventDefault();
        setIsSimulating(true);
        setErrorBanner('');
        try {
            const { data } = await window.axios.post(route('match.simulate'), {
                requirements: {
                    min_cpu_tier: requirements.min_cpu_tier || 'entry',
                    min_ram_gb: Number(requirements.min_ram_gb) || 8,
                    min_storage_gb: Number(requirements.min_storage_gb) || 256,
                    requires_gpu: Boolean(requirements.requires_gpu),
                    min_gpu_tier: requirements.requires_gpu
                        ? requirements.min_gpu_tier || 'dedicated-entry'
                        : 'none',
                    portability_required: Boolean(requirements.portability_required),
                },
                quantity: Math.max(1, Math.min(50, Number(simQuantity) || 1)),
            });
            setSimulationResult(data);
        } catch (err) {
            setErrorBanner(
                err?.response?.data?.message || 'Headcount simulation failed. Verify inputs.'
            );
        } finally {
            setIsSimulating(false);
        }
    };

    const handleTestGemini = async () => {
        setIsTestingGemini(true);
        try {
            const { data } = await window.axios.post(route('match.test-gemini'));
            setGeminiDiagnostic(data);
            setShowDiagnosticModal(true);
        } catch (err) {
            setGeminiDiagnostic({
                success: false,
                message: err?.response?.data?.message || 'Failed to contact diagnostic endpoint.',
            });
            setShowDiagnosticModal(true);
        } finally {
            setIsTestingGemini(false);
        }
    };

    const handleSelectTemplate = (tpl) => {
        const promptText = tpl.prompt || '';
        setRawInput(promptText);
        if (tpl.requirements) {
            const nextReqs = { ...DEFAULT_REQUIREMENTS, ...tpl.requirements };
            setRequirements(nextReqs);
        }
    };

    const handleSaveTemplate = (e) => {
        e.preventDefault();
        const label = (templateForm.label || templateForm.name || '').trim();
        const prompt = (templateForm.prompt || templateForm.text || '').trim();
        if (!label || !prompt) return;

        const next = [
            ...templates,
            normalizeTemplate(
                {
                    id: `custom_${Date.now()}`,
                    label,
                    category: (templateForm.category || templateForm.dept || '').trim(),
                    prompt,
                    custom: true,
                },
                templates.length
            ),
        ];
        setTemplates(next);
        try {
            localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore
        }
        setShowTemplateModal(false);
        setTemplateForm({ label: '', category: '', prompt: '' });
    };

    const handleRemoveCustomTemplate = (tplId, e) => {
        e.stopPropagation();
        const next = templates.filter((t) => t.id !== tplId);
        setTemplates(next);
        try {
            localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore
        }
    };

    const handleSelectInventoryPrompt = (dev) => {
        const prompt = `Need a ${dev.device_type === 'laptop' ? 'portable laptop' : 'workstation desktop'} similar to ${dev.brand} ${dev.model} with at least ${dev.cpu_tier} CPU tier, ${dev.ram_gb}GB RAM, and ${dev.storage_gb}GB storage.`;
        setRawInput(prompt);
        const nextReqs = {
            ...requirements,
            min_cpu_tier: dev.cpu_tier || 'mid',
            min_ram_gb: dev.ram_gb || 16,
            min_storage_gb: dev.storage_gb || 512,
            requires_gpu: dev.gpu_tier && !['none', 'integrated'].includes(dev.gpu_tier),
            min_gpu_tier: dev.gpu_tier || 'none',
            portability_required: dev.device_type === 'laptop',
        };
        setRequirements(nextReqs);
        setShowDeployableModal(false);
        handleRank(nextReqs);
    };

    // Derive ranked subsets cleanly
    const allResults = rankingResponse?.results || [];
    const qualifiedResults = useMemo(
        () => allResults.filter((c) => !c.disqualified && c.passes_threshold),
        [allResults]
    );
    const stockroomResults = useMemo(
        () => allResults.filter((c) => !c.disqualified && c.is_available_for_deployment),
        [allResults]
    );
    const disqualifiedResults = useMemo(
        () => allResults.filter((c) => c.disqualified || !c.passes_threshold),
        [allResults]
    );

    const displayedResults = useMemo(() => {
        if (recoFilter === 'top') {
            return showAllInTop ? qualifiedResults : qualifiedResults.slice(0, 3);
        }
        if (recoFilter === 'stockroom') return stockroomResults;
        if (recoFilter === 'disqualified') return disqualifiedResults;
        return allResults;
    }, [recoFilter, showAllInTop, qualifiedResults, stockroomResults, disqualifiedResults, allResults]);

    const bridgeSwaps = rankingResponse?.bridge_swaps || [];
    const bestBridgeSwap = bridgeSwaps[0] || null;
    const topDirectCandidate = rankingResponse?.top_candidate || null;
    const hasQualifiedDirect = qualifiedResults.length > 0;
    const procurementRecommended = Boolean(rankingResponse?.procurement_recommended);
    const procurementAdvisory = rankingResponse?.procurement_advisory;
    const alternativeComparisons = rankingResponse?.alternative_comparisons || {};

    const isBridgeMeaningfullyBetter = Boolean(
        bestBridgeSwap &&
            topDirectCandidate &&
            (bestBridgeSwap.requester_score_on_donor_device ?? 0) - (topDirectCandidate.score ?? 0) >= 0.08
    );
    const promoteBridgeHero = Boolean(
        rankingResponse && bestBridgeSwap && (!hasQualifiedDirect || isBridgeMeaningfullyBetter)
    );

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Smart Match &amp; Provisioning
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            AI requirement extraction, multi-factor hardware ranking, and zero-CapEx Bridge Swaps.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowDeployableModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer tabular-nums"
                        >
                            <RiStackLine className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Stockroom ({deployable_summary?.total_available ?? 0})</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleTestGemini}
                            disabled={isTestingGemini}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
                        >
                            {isTestingGemini ? (
                                <RiLoader4Line className="w-3.5 h-3.5 animate-spin text-[#026eff]" />
                            ) : (
                                <RiPulseLine className="w-3.5 h-3.5 text-[#026eff]" />
                            )}
                            <span>AI Health</span>
                        </button>
                    </div>
                </div>
            }
        >
            <Head title="Smart Match - ITFleet" />

            {/* Quiet Stockroom Context Strip */}
            <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-4 text-zinc-600 dark:text-zinc-300 tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {deployable_summary?.total_available ?? 0}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400">Ready units</span>
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">|</span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                        Laptops: <strong className="text-zinc-900 dark:text-zinc-100">{deployable_summary?.laptops_count ?? 0}</strong>
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                        Desktops: <strong className="text-zinc-900 dark:text-zinc-100">{deployable_summary?.desktops_count ?? 0}</strong>
                    </span>
                    <span className="hidden md:inline text-zinc-300 dark:text-zinc-700">|</span>
                    <span className="hidden md:inline text-zinc-500 dark:text-zinc-400">
                        High/Workstation Tier:{' '}
                        <strong className="text-zinc-900 dark:text-zinc-100">
                            {(deployable_summary?.tiers?.high ?? 0) + (deployable_summary?.tiers?.workstation ?? 0)}
                        </strong>
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => setShowDeployableModal(true)}
                    className="text-[11px] font-medium text-[#026eff] dark:text-sky-400 hover:underline cursor-pointer"
                >
                    Browse ready units &rarr;
                </button>
            </div>

            {errorBanner && (
                <div className="mb-5 rounded-sm bg-rose-500/10 border border-rose-500/20 px-4 py-3 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-300">
                    <div className="flex items-center gap-2">
                        <RiErrorWarningLine className="w-4 h-4 shrink-0" />
                        <span>{errorBanner}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setErrorBanner('')}
                        className="p-1 rounded-sm border border-transparent hover:border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
                    >
                        <RiCloseLine className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* LEFT COLUMN: Input & Controls */}
                <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
                    {/* Step 1: Request Form */}
                    <form
                        onSubmit={handleExtractAndRank}
                        className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded-sm border border-[#026eff]/25 bg-[#026eff]/10 text-[#026eff] dark:text-sky-400 font-mono text-[10px] font-semibold">
                                    01
                                </span>
                                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    Employee &amp; Request Input
                                </h2>
                            </div>
                            {rawInput && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRawInput('');
                                        setExtractionMeta(null);
                                    }}
                                    className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                >
                                    Clear text
                                </button>
                            )}
                        </div>

                        {/* Recipient Employee */}
                        <div>
                            <InputLabel htmlFor="match_employee" value="Target Employee" />
                            <div className="mt-1.5">
                                <CustomSelect
                                    value={employeeId}
                                    onChange={setEmployeeId}
                                    placeholder="Select employee (optional for dry run)..."
                                    options={[
                                        { value: '', label: 'Select recipient employee...' },
                                        ...employees.map((emp) => ({
                                            value: String(emp.id),
                                            label: `${emp.name} — ${emp.department}${emp.active_assignment?.device ? ' (Has device)' : ' (Unassigned)'}`,
                                        })),
                                    ]}
                                />
                            </div>

                            {selectedEmployee && (
                                <div className="mt-2 p-2.5 rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 text-[11px]">
                                    <div className="min-w-0">
                                        <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                            {selectedEmployee.role_profile?.name || 'No role profile'}
                                        </div>
                                        <div className="text-zinc-500 dark:text-zinc-400 truncate">
                                            {selectedEmployee.active_assignment?.device
                                                ? `Current: ${selectedEmployee.active_assignment.device.brand} ${selectedEmployee.active_assignment.device.model}`
                                                : 'Currently awaiting hardware'}
                                        </div>
                                    </div>
                                    {selectedEmployee.role_profile && (
                                        <button
                                            type="button"
                                            onClick={() => handleApplyEmployeeRole(selectedEmployee)}
                                            className="px-2 py-1 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-[10px] font-medium text-[#026eff] dark:text-sky-400 hover:border-[#026eff] transition shrink-0 cursor-pointer"
                                        >
                                            Use Role Baseline
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Workload Request Textarea */}
                        <div>
                            <InputLabel htmlFor="match_raw_input" value="Workload Description *" />
                            <textarea
                                id="match_raw_input"
                                rows={4}
                                value={rawInput}
                                onChange={(e) => setRawInput(e.target.value)}
                                placeholder="e.g. Senior React & Docker developer running local Kubernetes clusters who travels weekly between client offices..."
                                className="mt-1.5 block w-full rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 py-2.5 px-3 focus:outline-none focus:ring-0 focus:border-[#026eff]"
                            />
                        </div>

                        {/* Templates */}
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                    Quick Workload Presets
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTemplateForm({
                                            label: '',
                                            category: selectedEmployee?.department || '',
                                            prompt: rawInput,
                                        });
                                        setShowTemplateModal(true);
                                    }}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#026eff] dark:text-sky-400 hover:underline cursor-pointer"
                                >
                                    <RiBookmarkLine className="w-3 h-3" />
                                    <span>Save current</span>
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {templates.map((tpl) => (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        onClick={() => handleSelectTemplate(tpl)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 transition cursor-pointer"
                                    >
                                        <span>{tpl.label}</span>
                                        {tpl.custom && (
                                            <span
                                                onClick={(e) => handleRemoveCustomTemplate(tpl.id, e)}
                                                className="text-zinc-400 hover:text-rose-500 ml-0.5"
                                                title="Delete custom template"
                                            >
                                                <RiCloseLine className="w-3 h-3" />
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Recent Requests */}
                        {recent_requests.length > 0 && (
                            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5">
                                    <RiHistoryLine className="w-3 h-3" />
                                    <span>Recent Prompts</span>
                                </div>
                                <div className="space-y-1">
                                    {recent_requests.slice(0, 3).map((req) => (
                                        <button
                                            key={req.id}
                                            type="button"
                                            onClick={() => setRawInput(req.raw_input)}
                                            className="w-full text-left px-2.5 py-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300 truncate transition cursor-pointer"
                                        >
                                            {req.raw_input}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isExtracting || isRanking}
                            className="w-full py-2.5 px-4 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {isExtracting ? (
                                <>
                                    <RiLoader4Line className="w-4 h-4 animate-spin" />
                                    <span>Extracting Requirements...</span>
                                </>
                            ) : (
                                <>
                                    <RiSparkling2Line className="w-4 h-4" />
                                    <span>Extract &amp; Rank Hardware</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Step 2: Structured Spec & Thresholds */}
                    <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] font-semibold">
                                    02
                                </span>
                                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    Deterministic Parameters
                                </h2>
                            </div>
                            {extractionMeta?.source && (
                                <span className="px-2 py-0.5 rounded-sm border border-[#026eff]/25 text-[10px] font-medium bg-[#026eff]/10 text-[#026eff] dark:text-sky-400">
                                    {extractionMeta.source.replace(/_/g, ' ')}
                                </span>
                            )}
                        </div>

                        {extractionMeta?.reasoning && (
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-sm p-2.5 leading-relaxed">
                                {extractionMeta.reasoning}
                            </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <InputLabel value="CPU Tier" />
                                <div className="mt-1">
                                    <CustomSelect
                                        value={requirements.min_cpu_tier}
                                        onChange={(val) =>
                                            setRequirements((prev) => ({ ...prev, min_cpu_tier: val }))
                                        }
                                        options={matchCpuTierOptions}
                                    />
                                </div>
                            </div>
                            <div>
                                <InputLabel value="Min RAM (GB)" />
                                <TextInput
                                    type="number"
                                    min="4"
                                    value={requirements.min_ram_gb}
                                    onChange={(e) =>
                                        setRequirements((prev) => ({
                                            ...prev,
                                            min_ram_gb: Number(e.target.value),
                                        }))
                                    }
                                    className="mt-1 block w-full text-xs font-mono tabular-nums"
                                />
                            </div>
                            <div>
                                <InputLabel value="Storage (GB)" />
                                <TextInput
                                    type="number"
                                    min="64"
                                    value={requirements.min_storage_gb}
                                    onChange={(e) =>
                                        setRequirements((prev) => ({
                                            ...prev,
                                            min_storage_gb: Number(e.target.value),
                                        }))
                                    }
                                    className="mt-1 block w-full text-xs font-mono tabular-nums"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <label className="flex items-center gap-2 p-2.5 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 cursor-pointer text-xs text-zinc-800 dark:text-zinc-200">
                                <Checkbox
                                    checked={Boolean(requirements.portability_required)}
                                    onChange={(e) =>
                                        setRequirements((prev) => ({
                                            ...prev,
                                            portability_required: e.target.checked,
                                        }))
                                    }
                                />
                                <span>Portable (Laptop)</span>
                            </label>

                            <label className="flex items-center gap-2 p-2.5 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 cursor-pointer text-xs text-zinc-800 dark:text-zinc-200">
                                <Checkbox
                                    checked={Boolean(requirements.requires_gpu)}
                                    onChange={(e) =>
                                        setRequirements((prev) => ({
                                            ...prev,
                                            requires_gpu: e.target.checked,
                                            min_gpu_tier: e.target.checked
                                                ? prev.min_gpu_tier === 'none'
                                                    ? 'dedicated-entry'
                                                    : prev.min_gpu_tier
                                                : 'none',
                                        }))
                                    }
                                />
                                <span>Dedicated GPU</span>
                            </label>
                        </div>

                        {requirements.requires_gpu && (
                            <div>
                                <InputLabel value="Minimum GPU Tier" />
                                <div className="mt-1">
                                    <CustomSelect
                                        value={requirements.min_gpu_tier || 'dedicated-entry'}
                                        onChange={(val) =>
                                            setRequirements((prev) => ({ ...prev, min_gpu_tier: val }))
                                        }
                                        options={matchGpuTierOptions}
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => handleRank(requirements)}
                            disabled={isRanking}
                            className="w-full py-2 px-3 rounded-sm border border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <RiRefreshLine className={`w-3.5 h-3.5 ${isRanking ? 'animate-spin' : ''}`} />
                            <span>{isRanking ? 'Scoring Inventory...' : 'Run Deterministic Ranking'}</span>
                        </button>

                        {/* Collapsible Simulator */}
                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setShowSimulator((prev) => !prev)}
                                className="w-full flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:text-[#026eff] dark:hover:text-sky-400 transition cursor-pointer"
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <RiCalculatorLine className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Bulk Headcount &amp; CapEx Simulator</span>
                                </span>
                                {showSimulator ? (
                                    <RiArrowUpSLine className="w-4 h-4 text-zinc-400" />
                                ) : (
                                    <RiArrowDownSLine className="w-4 h-4 text-zinc-400" />
                                )}
                            </button>

                            {showSimulator && (
                                <div className="mt-3 space-y-3 pt-2">
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <InputLabel value="Simulated Team Size (Seats)" />
                                            <TextInput
                                                type="number"
                                                min="1"
                                                max="50"
                                                value={simQuantity}
                                                onChange={(e) => setSimQuantity(e.target.value)}
                                                className="mt-1 block w-full text-xs font-mono tabular-nums"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSimulate}
                                            disabled={isSimulating}
                                            className="py-2 px-3.5 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white text-xs font-medium transition cursor-pointer disabled:opacity-50"
                                        >
                                            {isSimulating ? 'Running...' : 'Simulate'}
                                        </button>
                                    </div>

                                    {simulationResult && (
                                        <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3.5 space-y-2.5 text-xs">
                                            <div className="grid grid-cols-3 gap-2 tabular-nums">
                                                <div>
                                                    <div className="text-[10px] text-zinc-400">Stock Coverage</div>
                                                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                                                        {simulationResult.covered_count}/{simulationResult.quantity_requested} ({simulationResult.coverage_percentage}%)
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-zinc-400">CapEx Avoided</div>
                                                    <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                        {formatCurrency(simulationResult.capex_avoided_php)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-zinc-400">Budget Needed</div>
                                                    <div
                                                        className={`font-semibold mt-0.5 ${
                                                            simulationResult.procurement_needed
                                                                ? 'text-amber-600 dark:text-amber-400'
                                                                : 'text-zinc-500 dark:text-zinc-400'
                                                        }`}
                                                    >
                                                        {formatCurrency(simulationResult.capex_required_php)}
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                                                {simulationResult.summary}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Ranked Recommendations & Bridge Swaps */}
                <div className="lg:col-span-7 space-y-4">
                    {!rankingResponse ? (
                        <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-10 text-center">
                            <div className="w-11 h-11 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-[#026eff] flex items-center justify-center mx-auto mb-3">
                                <RiSparkling2Line className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                Ready to Match Inventory
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                                Describe a workload or pick a preset on the left to extract hardware thresholds, rank available fleet stock, and detect zero-CapEx Bridge Swap opportunities.
                            </p>
                            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleRank(requirements)}
                                    className="px-3.5 py-2 rounded-sm border border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white transition cursor-pointer"
                                >
                                    Rank with Current Specs
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowDeployableModal(true)}
                                    className="px-3.5 py-2 rounded-sm border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                                >
                                    Inspect {deployable_summary?.total_available ?? 0} Available Units
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Procurement Advisory Banner */}
                            {procurementAdvisory && (
                                <div
                                    className={`rounded-sm border p-4 flex items-start gap-3 text-xs ${
                                        procurementRecommended
                                            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                                            : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                                    }`}
                                >
                                    {procurementRecommended ? (
                                        <RiAlertLine className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    ) : (
                                        <RiCheckLine className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold">
                                            {procurementAdvisory.inventory_status}
                                        </div>
                                        <p className="mt-0.5 text-[11px] opacity-90 leading-relaxed">
                                            {procurementAdvisory.recommendation_summary}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Bridge Swap Callout (Promoted when stockroom has deficit or bridge outperforms direct pick) */}
                            {promoteBridgeHero && bestBridgeSwap && (
                                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-[#0aceb3]/45 p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-[#0aceb3]/30 text-[11px] font-medium bg-[#0aceb3]/10 text-teal-700 dark:text-[#0aceb3] mb-1.5">
                                                <RiSwapLine className="w-3.5 h-3.5" />
                                                <span>Zero-CapEx Bridge Swap Opportunity</span>
                                            </div>
                                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                                Reassign {bestBridgeSwap.donor_device?.brand} {bestBridgeSwap.donor_device?.model} via{' '}
                                                {bestBridgeSwap.donor_employee?.name}
                                            </h3>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                Deploy idle stockroom <span className="font-mono">{bestBridgeSwap.bridge_device?.asset_tag}</span> to{' '}
                                                {bestBridgeSwap.donor_employee?.name}, freeing <span className="font-mono">{bestBridgeSwap.donor_device?.asset_tag}</span> with{' '}
                                                <span className="font-semibold text-[#026eff] dark:text-sky-400 tabular-nums">
                                                    {formatPct(bestBridgeSwap.requester_score_on_donor_device)}% fit
                                                </span>
                                                .
                                            </p>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <div className="text-[10px] text-zinc-400">Avoided CapEx</div>
                                            <div className="text-base font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                {formatCurrency(bestBridgeSwap.capex_saved_php)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                                        {bridgeSwaps.length > 1 ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowSecondarySwaps((prev) => !prev)}
                                                className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                                            >
                                                {showSecondarySwaps
                                                    ? 'Hide alternate swaps'
                                                    : `View ${bridgeSwaps.length - 1} more swap options`}
                                            </button>
                                        ) : (
                                            <span className="text-[11px] text-zinc-400 tabular-nums">
                                                Composite Feasibility: {formatPct(bestBridgeSwap.feasibility_score)}%
                                            </span>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveBridgeSwap(bestBridgeSwap);
                                                setShowBridgeModal(true);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm border border-[#0aceb3] bg-[#0aceb3] hover:bg-[#09b59e] text-zinc-950 text-xs font-semibold transition cursor-pointer"
                                        >
                                            <RiSwapLine className="w-3.5 h-3.5" />
                                            <span>Preview &amp; Execute Swap</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Filter Segmented Control Header */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] font-semibold">
                                        03
                                    </span>
                                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                        Ranked Hardware Candidates
                                    </h2>
                                </div>

                                <div className="flex items-center border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 p-0.5 rounded-sm">
                                    {[
                                        { id: 'top', label: `Top Fits (${qualifiedResults.length})` },
                                        { id: 'stockroom', label: `Ready (${stockroomResults.length})` },
                                        { id: 'all', label: `All (${allResults.length})` },
                                        { id: 'disqualified', label: `Flagged (${disqualifiedResults.length})` },
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setRecoFilter(tab.id)}
                                            className={`px-2.5 py-1 rounded-sm text-[11px] font-medium transition cursor-pointer tabular-nums ${
                                                recoFilter === tab.id
                                                    ? 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                                                    : 'border border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Ranked List */}
                            {displayedResults.length === 0 ? (
                                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-10 text-center">
                                    <RiComputerLine className="w-7 h-7 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                        No hardware units in this filter tab
                                    </p>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                                        Switch to &ldquo;All&rdquo; or &ldquo;Flagged&rdquo; to inspect lower-scoring or disqualified units.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {displayedResults.map((cand, index) => {
                                        const dev = cand.device;
                                        const scorePct = formatPct(cand.score);
                                        const isTopPick =
                                            topDirectCandidate && dev.id === topDirectCandidate.device?.id;
                                        const whyNot = alternativeComparisons[dev.id]?.why_not_reasons || [];

                                        return (
                                            <div
                                                key={dev.id}
                                                className={`bg-white dark:bg-zinc-900 rounded-sm border p-5 ${
                                                    isTopPick
                                                        ? 'border-[#026eff]/45 dark:border-[#026eff]/50'
                                                        : 'border-zinc-200/80 dark:border-zinc-800'
                                                }`}
                                            >
                                                {/* Header Row */}
                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <div className="w-12 h-12 rounded-sm bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700">
                                                            <HardwareImage
                                                                src={dev.image_clip_url || dev.image_url}
                                                                alt={`${dev.brand} ${dev.model}`}
                                                                deviceType={dev.device_type}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="font-mono text-[10px] font-semibold text-zinc-400 tabular-nums">
                                                                    #{index + 1}
                                                                </span>
                                                                <Link
                                                                    href={route('devices.show', dev.id)}
                                                                    className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 hover:text-[#026eff] dark:hover:text-sky-400 transition truncate inline-flex items-center gap-1"
                                                                >
                                                                    <span>
                                                                        {dev.brand} {dev.model}
                                                                    </span>
                                                                    <RiArrowRightUpLine className="w-3.5 h-3.5 shrink-0" />
                                                                </Link>
                                                                {isTopPick && (
                                                                    <span className="px-2 py-0.5 rounded-sm border border-[#026eff]/25 text-[10px] font-medium bg-[#026eff]/10 text-[#026eff] dark:text-sky-400">
                                                                        Recommended Pick
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                                                                <span className="font-mono tabular-nums">{dev.asset_tag}</span>
                                                                <span>&bull;</span>
                                                                <span className="capitalize">{dev.device_type}</span>
                                                                <span>&bull;</span>
                                                                <span className="capitalize">{dev.condition || 'Good'}</span>
                                                                {dev.location && (
                                                                    <>
                                                                        <span>&bull;</span>
                                                                        <span>{dev.location}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                                                        <div
                                                            className={`text-xl font-semibold tracking-tight tabular-nums ${
                                                                cand.disqualified
                                                                    ? 'text-rose-600 dark:text-rose-400'
                                                                    : cand.passes_threshold
                                                                    ? 'text-zinc-900 dark:text-zinc-50'
                                                                    : 'text-amber-600 dark:text-amber-400'
                                                            }`}
                                                        >
                                                            {scorePct}%
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px]">
                                                            <span className="px-2 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                                                                {cand.fit_grade || 'Evaluated'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Specs Strip */}
                                                <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] tabular-nums">
                                                    <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 px-2.5 py-2">
                                                        <div className="text-[10px] text-zinc-400">CPU</div>
                                                        <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                                            {dev.cpu_tier?.toUpperCase()} &bull; {dev.cpu}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 px-2.5 py-2">
                                                        <div className="text-[10px] text-zinc-400">Memory</div>
                                                        <div className="font-medium text-zinc-800 dark:text-zinc-200">
                                                            {dev.ram_gb} GB RAM
                                                        </div>
                                                    </div>
                                                    <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 px-2.5 py-2">
                                                        <div className="text-[10px] text-zinc-400">Storage</div>
                                                        <div className="font-medium text-zinc-800 dark:text-zinc-200">
                                                            {dev.storage_gb} GB {dev.storage_type || 'SSD'}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 px-2.5 py-2">
                                                        <div className="text-[10px] text-zinc-400">Graphics</div>
                                                        <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                                            {dev.gpu || dev.gpu_tier}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Subscore Progress Bars (Expanded on Recommended Pick, toggleable on others) */}
                                                {cand.subscores && (() => {
                                                    const isSubscoresOpen = expandedSubscores[dev.id] ?? isTopPick;
                                                    return (
                                                        <div className="mt-3">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setExpandedSubscores((prev) => ({
                                                                        ...prev,
                                                                        [dev.id]: !isSubscoresOpen,
                                                                    }))
                                                                }
                                                                className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                                                            >
                                                                <span>{isSubscoresOpen ? 'Hide score breakdown' : 'Score breakdown'}</span>
                                                                {isSubscoresOpen ? (
                                                                    <RiArrowUpSLine className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <RiArrowDownSLine className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>

                                                            {isSubscoresOpen && (
                                                                <div className="mt-2 grid grid-cols-5 gap-2">
                                                                    {[
                                                                        { key: 'cpu', label: 'CPU' },
                                                                        { key: 'ram', label: 'RAM' },
                                                                        { key: 'storage', label: 'Disk' },
                                                                        { key: 'gpu', label: 'GPU' },
                                                                        { key: 'portability', label: 'Form' },
                                                                    ].map((dim) => {
                                                                        const pct = formatPct(cand.subscores[dim.key]);
                                                                        return (
                                                                            <div key={dim.key}>
                                                                                <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums mb-1">
                                                                                    <span>{dim.label}</span>
                                                                                    <span>{pct}%</span>
                                                                                </div>
                                                                                <div className="h-1 rounded-sm bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                                                                    <div
                                                                                        className={`h-full rounded-sm ${
                                                                                            pct >= 80
                                                                                                ? 'bg-[#026eff]'
                                                                                                : pct >= 50
                                                                                                ? 'bg-zinc-500 dark:bg-zinc-400'
                                                                                                : 'bg-amber-500'
                                                                                        }`}
                                                                                        style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}

                                                {/* Rationale / Disqualification / Trade-offs */}
                                                {(cand.rationale || cand.disqualification_reason || whyNot.length > 0) && (
                                                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5 text-[11px] leading-relaxed">
                                                        {cand.disqualified && cand.disqualification_reason && (
                                                            <div className="font-medium text-rose-600 dark:text-rose-400">
                                                                Disqualified: {cand.disqualification_reason}
                                                            </div>
                                                        )}
                                                        {cand.rationale && (
                                                            <div className="text-zinc-600 dark:text-zinc-300">
                                                                {cand.rationale}
                                                            </div>
                                                        )}
                                                        {whyNot.length > 0 && (
                                                            <div className="text-zinc-400 dark:text-zinc-500">
                                                                vs Top Pick: {whyNot.join(' • ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Card Actions */}
                                                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                                                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                                                        {cand.capex_saved_php > 0 && (
                                                            <span>
                                                                Avoided CapEx:{' '}
                                                                <strong className="text-emerald-600 dark:text-emerald-400">
                                                                    {formatCurrency(cand.capex_saved_php)}
                                                                </strong>
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 ml-auto">
                                                        <Link
                                                            href={route('devices.show', dev.id)}
                                                            className="px-3 py-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                                                        >
                                                            Inspect Device
                                                        </Link>

                                                        {cand.is_available_for_deployment && !cand.disqualified && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAssign(cand)}
                                                                disabled={assigningDeviceId === dev.id}
                                                                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm border text-[11px] font-medium transition cursor-pointer disabled:opacity-50 ${
                                                                    isTopPick
                                                                        ? 'border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white'
                                                                        : 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900'
                                                                }`}
                                                            >
                                                                <RiCheckLine className="w-3.5 h-3.5" />
                                                                <span>
                                                                    {assigningDeviceId === dev.id
                                                                        ? 'Assigning...'
                                                                        : selectedEmployee
                                                                        ? `Assign to ${selectedEmployee.name.split(' ')[0]}`
                                                                        : 'Assign Device'}
                                                                </span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {recoFilter === 'top' && qualifiedResults.length > 3 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAllInTop((prev) => !prev)}
                                            className="w-full py-2.5 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer tabular-nums"
                                        >
                                            {showAllInTop
                                                ? 'Show top 3 fits only'
                                                : `Show all ${qualifiedResults.length} qualified matches`}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Secondary Bridge Swaps List (when not promoted or expanded) */}
                            {bridgeSwaps.length > 0 && (!promoteBridgeHero || showSecondarySwaps) && (
                                <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                            <RiSwapLine className="w-4 h-4 text-[#0aceb3]" />
                                            <span>Available Bridge Swap Pathways ({bridgeSwaps.length})</span>
                                        </div>
                                        <span className="text-[11px] text-zinc-400">
                                            2-step internal redistribution
                                        </span>
                                    </div>

                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {bridgeSwaps.map((swap, i) => (
                                            <div
                                                key={`${swap.donor_employee?.id}-${swap.donor_device?.id}-${i}`}
                                                className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                            >
                                                <div className="min-w-0">
                                                    <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                        {swap.donor_device?.brand} {swap.donor_device?.model} (
                                                        <span className="font-mono">{swap.donor_device?.asset_tag}</span>) via{' '}
                                                        {swap.donor_employee?.name}
                                                    </div>
                                                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                                                        Requester Fit: {formatPct(swap.requester_score_on_donor_device)}% &bull; Bridge:{' '}
                                                        <span className="font-mono">{swap.bridge_device?.asset_tag}</span> &bull; Saves{' '}
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                                            {formatCurrency(swap.capex_saved_php)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveBridgeSwap(swap);
                                                        setShowBridgeModal(true);
                                                    }}
                                                    className="px-3 py-1.5 rounded-sm border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:border-[#0aceb3] hover:text-teal-700 dark:hover:text-[#0aceb3] transition shrink-0 cursor-pointer"
                                                >
                                                    Review Cascade
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}
            <BridgeSwapModal
                show={showBridgeModal}
                swap={activeBridgeSwap}
                selectedEmployee={selectedEmployee}
                isExecutingSwap={isExecutingSwap}
                onClose={() => setShowBridgeModal(false)}
                onExecute={handleExecuteBridgeSwap}
            />

            <WorkloadTemplateModal
                show={showTemplateModal}
                form={templateForm}
                setForm={setTemplateForm}
                onClose={() => setShowTemplateModal(false)}
                onSubmit={handleSaveTemplate}
            />

            <GeminiDiagnosticModal
                show={showDiagnosticModal}
                result={geminiDiagnostic}
                onClose={() => setShowDiagnosticModal(false)}
            />

            <DeployableInventoryModal
                show={showDeployableModal}
                totalAvailable={deployable_summary?.total_available ?? 0}
                search={deployableSearch}
                setSearch={setDeployableSearch}
                typeFilter={deployableTypeFilter}
                setTypeFilter={setDeployableTypeFilter}
                devices={deployable_summary?.preview_devices || []}
                onClose={() => setShowDeployableModal(false)}
                onSelectPrompt={handleSelectInventoryPrompt}
            />
        </AuthenticatedLayout>
    );
}
