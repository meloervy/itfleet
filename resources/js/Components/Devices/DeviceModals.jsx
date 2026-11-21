import Checkbox from '@/Components/Checkbox';
import CustomSelect from '@/Components/CustomSelect';
import { Link } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { RiAlertLine, RiCheckLine, RiCloseLine, RiExchangeLine, RiSparklingLine } from 'react-icons/ri';

const inputClasses =
    'mt-1.5 w-full text-xs rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 py-2 px-3 focus:outline-none focus:border-[#026eff] focus:ring-0 transition';

const labelClasses = 'block text-xs font-medium text-zinc-700 dark:text-zinc-300';

export function TransitionLifecycleModal({
    show,
    data,
    setData,
    processing,
    onClose,
    onSubmit,
}) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-sm max-w-md w-full p-6 border border-zinc-300 dark:border-zinc-700 text-xs">
                <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-800">
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Transition Lifecycle Phase</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer p-1 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                        <RiCloseLine className="w-4 h-4" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="mt-4 space-y-4">
                    <div>
                        <label className={`${labelClasses} mb-1.5`}>Target Lifecycle Stage</label>
                        <CustomSelect
                            value={data.to_stage}
                            onChange={(val) => setData('to_stage', val)}
                            options={[
                                { value: 'acquisition', label: 'Acquisition (Intake / Staging)' },
                                { value: 'deployment', label: 'Deployment (Active In-Service)' },
                                { value: 'reclaimed', label: 'Reclaimed (Sanitized in Pool)' },
                                { value: 'maintenance', label: 'Maintenance (Servicing / In-Repair)' },
                                { value: 'retirement', label: 'Retirement (Decommissioned)' },
                            ]}
                        />
                    </div>
                    <div>
                        <label className={labelClasses}>Audit Notes / Reason</label>
                        <textarea
                            rows={3}
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                            placeholder="Reason for phase transition..."
                            className={inputClasses}
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-2 rounded-sm border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-4 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white font-medium transition cursor-pointer disabled:opacity-50"
                        >
                            {processing ? 'Transitioning...' : 'Confirm'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function LogMaintenanceModal({
    show,
    data,
    setData,
    processing,
    canViewFinancials = true,
    onClose,
    onSubmit,
}) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-sm max-w-lg w-full p-6 border border-zinc-300 dark:border-zinc-700 text-xs">
                <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-800">
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Log Maintenance / Servicing</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer p-1 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                        <RiCloseLine className="w-4 h-4" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
                    <div className={`grid gap-3 ${canViewFinancials ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <div>
                            <label className={`${labelClasses} mb-1.5`}>Activity Type</label>
                            <CustomSelect
                                value={data.type}
                                onChange={(val) => setData('type', val)}
                                options={[
                                    { value: 'repair', label: 'Repair' },
                                    { value: 'upgrade', label: 'Hardware Upgrade' },
                                    { value: 'preventive', label: 'Preventive Servicing' },
                                    { value: 'inspection', label: 'Inspection / Audit' },
                                    { value: 'replacement', label: 'Component Replacement' },
                                ]}
                            />
                        </div>
                        {canViewFinancials && (
                            <div>
                                <label className={labelClasses}>Cost (₱)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.cost}
                                    onChange={(e) => setData('cost', e.target.value)}
                                    className={inputClasses}
                                    required
                                />
                            </div>
                        )}
                    </div>
                    <div>
                        <label className={labelClasses}>Title</label>
                        <input
                            type="text"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            placeholder="e.g. Battery replacement & thermal repaste"
                            className={inputClasses}
                            required
                        />
                    </div>
                    <div>
                        <label className={labelClasses}>Technician / Vendor</label>
                        <input
                            type="text"
                            value={data.performed_by}
                            onChange={(e) => setData('performed_by', e.target.value)}
                            placeholder="e.g. Internal IT Support, Apex Tech"
                            className={inputClasses}
                        />
                    </div>
                    <div>
                        <label className={labelClasses}>Description of Work</label>
                        <textarea
                            rows={2}
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Work performed, components changed..."
                            className={inputClasses}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3 items-center">
                        <div>
                            <label className={`${labelClasses} mb-1.5`}>Status</label>
                            <CustomSelect
                                value={data.status}
                                onChange={(val) => setData('status', val)}
                                options={[
                                    { value: 'in_progress', label: 'In Progress' },
                                    { value: 'scheduled', label: 'Scheduled' },
                                    { value: 'completed', label: 'Completed' },
                                ]}
                            />
                        </div>
                        <div className="mt-5">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-700 dark:text-zinc-300">
                                <input
                                    type="checkbox"
                                    checked={data.send_to_maintenance_stage}
                                    onChange={(e) => setData('send_to_maintenance_stage', e.target.checked)}
                                    className="h-4 w-4 rounded-sm border border-zinc-300 dark:border-zinc-700 text-[#026eff] focus:outline-none focus:ring-0"
                                />
                                <span>Set to Maintenance Phase</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-2 rounded-sm border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-4 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white font-medium transition cursor-pointer disabled:opacity-50"
                        >
                            {processing ? 'Logging...' : 'Record Log'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function UpdateMaintenanceLogModal({
    selectedLog,
    data,
    setData,
    processing,
    canViewFinancials = true,
    onClose,
    onSubmit,
}) {
    if (!selectedLog) return null;

    return (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-sm max-w-lg w-full p-6 border border-zinc-300 dark:border-zinc-700 text-xs">
                <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Assess &amp; Close Servicing</h3>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{selectedLog.title}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer p-1 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                        <RiCloseLine className="w-4 h-4" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
                    <div className={`grid gap-3 ${canViewFinancials ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {canViewFinancials && (
                            <div>
                                <label className={labelClasses}>Final Cost (₱)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.cost}
                                    onChange={(e) => setData('cost', e.target.value)}
                                    className={inputClasses}
                                    required
                                />
                            </div>
                        )}
                        <div>
                            <label className={labelClasses}>Completion Date</label>
                            <input
                                type="date"
                                value={data.completed_at}
                                onChange={(e) => setData('completed_at', e.target.value)}
                                className={inputClasses}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClasses}>Performance Assessment *</label>
                        <textarea
                            rows={3}
                            value={data.performance_assessment}
                            onChange={(e) => setData('performance_assessment', e.target.value)}
                            placeholder="Empirical performance impact post-servicing (e.g. thermal drops, stress test passed)..."
                            className={inputClasses}
                            required
                        />
                    </div>
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-sm">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-800 dark:text-zinc-200">
                            <input
                                type="checkbox"
                                checked={data.restore_to_available}
                                onChange={(e) => setData('restore_to_available', e.target.checked)}
                                className="h-4 w-4 rounded-sm border border-zinc-300 dark:border-zinc-700 text-[#026eff] focus:outline-none focus:ring-0"
                            />
                            <span>Restore asset back to Active Deployment Phase</span>
                        </label>
                    </div>
                    <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-2 rounded-sm border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-4 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white font-medium transition cursor-pointer disabled:opacity-50"
                        >
                            {processing ? 'Saving...' : 'Complete & Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function ReclaimDeviceModal({ show, device, onClose, onSuccess }) {
    const defaultCondition = device?.condition && device.condition !== 'retired' ? device.condition : 'good';
    const [reason, setReason] = useState('hardware_upgrade');
    const [condition, setCondition] = useState(defaultCondition);
    const [wipeConfirmed, setWipeConfirmed] = useState(true);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (show) {
            setReason('hardware_upgrade');
            setCondition(device?.condition && device.condition !== 'retired' ? device.condition : 'good');
            setWipeConfirmed(true);
            setNotes('');
            setError(null);
            setResult(null);
        }
    }, [show, device?.id]);

    if (!show) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await axios.post(
                route('devices.reclaim', device.id),
                {
                    reason,
                    condition,
                    wipe_confirmed: wipeConfirmed,
                    notes,
                },
                { headers: { Accept: 'application/json' } }
            );
            setResult(res.data);
            if (onSuccess) {
                onSuccess(res.data);
            }
        } catch (err) {
            const msg =
                err.response?.data?.message ||
                Object.values(err.response?.data?.errors || {})[0]?.[0] ||
                'Failed to reclaim asset.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-sm max-w-lg w-full p-6 border border-zinc-300 dark:border-zinc-700 text-xs">
                <div className="flex items-start justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-800 gap-3">
                    <div>
                        <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <RiExchangeLine className="w-4 h-4 text-amber-500" />
                            <span>Reclaim &amp; Sanitize Asset</span>
                        </h3>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {device.asset_tag} &bull; {device.brand} {device.model}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer p-1 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                        <RiCloseLine className="w-4 h-4" />
                    </button>
                </div>

                {!result ? (
                    <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={`${labelClasses} mb-1.5`}>Reclamation Reason</label>
                                <CustomSelect
                                    value={reason}
                                    onChange={setReason}
                                    options={[
                                        { value: 'hardware_upgrade', label: 'Hardware Upgrade' },
                                        { value: 'resignation', label: 'Employee Resignation' },
                                        { value: 'role_transition', label: 'Role Transition' },
                                        { value: 'contract_end', label: 'Contract End' },
                                        { value: 'other', label: 'Other' },
                                    ]}
                                />
                            </div>
                            <div>
                                <label className={`${labelClasses} mb-1.5`}>Returned Condition</label>
                                <CustomSelect
                                    value={condition}
                                    onChange={setCondition}
                                    options={[
                                        { value: 'excellent', label: 'Excellent' },
                                        { value: 'good', label: 'Good' },
                                        { value: 'fair', label: 'Fair' },
                                        { value: 'needs_repair', label: 'Needs Repair' },
                                    ]}
                                />
                            </div>
                        </div>

                        {condition === 'needs_repair' && (
                            <div className="p-2.5 rounded-sm border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-start gap-2">
                                <RiAlertLine className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>
                                    Unit will be placed in <span className="font-semibold">Maintenance</span> stage with status{' '}
                                    <span className="font-mono">in_repair</span>.
                                </span>
                            </div>
                        )}

                        <div className="p-2.5 rounded-sm bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-700 dark:text-zinc-200">
                                <Checkbox checked={wipeConfirmed} onChange={(e) => setWipeConfirmed(e.target.checked)} />
                                <span>Data wipe &amp; sanitization verified</span>
                            </label>
                        </div>

                        <div>
                            <label className={labelClasses}>Audit Notes</label>
                            <textarea
                                rows={2}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Accessories verified, charger included, wipe ticket..."
                                className={inputClasses}
                            />
                        </div>

                        {error && (
                            <div className="p-2.5 rounded-sm border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-3.5 py-2 rounded-sm border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-4 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white font-medium transition cursor-pointer disabled:opacity-50"
                            >
                                {submitting ? 'Reclaiming...' : 'Confirm Reclamation'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="mt-4 space-y-4">
                        <div className="p-3 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                            <RiCheckLine className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                            <div>
                                <div className="font-semibold">Asset Reclaimed</div>
                                <div className="mt-0.5">{result.message}</div>
                            </div>
                        </div>

                        {result.device && (
                            <div className="p-2.5 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex items-center justify-between gap-2">
                                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                                    {result.device.asset_tag}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <span className="capitalize px-2 py-0.5 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">
                                        {result.device.lifecycle_stage}
                                    </span>
                                    <span className="capitalize px-2 py-0.5 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-[10px]">
                                        {String(result.device.status || '').replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                        )}

                        {(result.circulation_matches?.length || 0) > 0 && (
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                                    Recirculation Opportunities
                                </div>
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-sm max-h-48 overflow-y-auto">
                                    {result.circulation_matches.map((m) => (
                                        <div key={m.employee_id} className="p-2.5 flex items-center justify-between gap-2 bg-white dark:bg-zinc-950/40">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                                    {m.name}
                                                </div>
                                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                                    {m.department} &bull; {m.role_name}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="px-1.5 py-0.5 rounded-sm bg-[#026eff]/10 border border-[#026eff]/20 text-[#026eff] dark:text-sky-400 text-[10px] font-semibold tabular-nums">
                                                    {Math.round(m.match_score * 100)}% fit
                                                </span>
                                                <Link
                                                    href={route('match.index', { employee_id: m.employee_id })}
                                                    onClick={onClose}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-[#026eff] hover:bg-[#0258d1] text-white text-[11px] font-medium transition"
                                                >
                                                    <RiSparklingLine className="w-3 h-3" />
                                                    <span>Reassign via Match</span>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white font-medium transition cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
