import CustomSelect from '@/Components/CustomSelect';
import { RiCloseLine } from 'react-icons/ri';

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
                    <div className="grid grid-cols-2 gap-3">
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
                    <div className="grid grid-cols-2 gap-3">
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
