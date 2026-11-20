import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import BridgeSwapCascadeDiagram from '@/Components/Match/BridgeSwapCascadeDiagram';
import { RiCheckLine, RiCloseLine, RiSwapLine } from 'react-icons/ri';

const formatPct = (val) => {
    const num = Number(val ?? 0);
    return Math.round(num <= 1 ? num * 100 : num);
};

const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

export default function BridgeSwapModal({
    show,
    swap,
    selectedEmployee,
    isExecutingSwap,
    onClose,
    onExecute,
}) {
    if (!swap) return null;

    return (
        <Modal show={show} onClose={onClose} maxWidth="2xl">
            <div className="p-6">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-[#0aceb3]/25 text-[11px] font-medium bg-[#0aceb3]/10 text-teal-700 dark:text-[#0aceb3] mb-1.5">
                            <RiSwapLine className="w-3 h-3" />
                            <span>Zero CapEx Internal Reallocation</span>
                        </div>
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                            Confirm 2-Step Bridge Swap
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Atomic database transfer reassigning surplus hardware to{' '}
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                {selectedEmployee?.name || 'selected employee'}
                            </span>
                            .
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isExecutingSwap}
                        className="p-1.5 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-40"
                        aria-label="Close modal"
                    >
                        <RiCloseLine className="w-4 h-4" />
                    </button>
                </div>

                {/* Key Numbers */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">CapEx Avoided</div>
                        <div className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(swap.capex_saved_php)}
                        </div>
                    </div>
                    <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Feasibility Score</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                            {formatPct(swap.feasibility_score)}%
                        </div>
                    </div>
                    <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Requester Fit</div>
                        <div className="mt-1 text-sm font-semibold text-[#026eff] dark:text-sky-400 tabular-nums">
                            {formatPct(swap.requester_score_on_donor_device)}%
                        </div>
                    </div>
                    <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3">
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Donor Bridge Fit</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                            {formatPct(swap.donor_score_on_bridge_device)}%
                        </div>
                    </div>
                </div>

                {/* Visual Cascade */}
                <div className="mt-4">
                    <BridgeSwapCascadeDiagram swap={swap} />
                </div>

                {/* Steps & Rationale */}
                <div className="mt-4 rounded-sm border border-zinc-200 dark:border-zinc-800 p-4 space-y-2.5">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Transaction Execution Plan
                    </div>
                    <div className="space-y-1.5">
                        {(swap.plan_steps || []).map((step, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                                <span className="mt-0.5 w-4 h-4 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0 text-[10px] font-semibold">
                                    {i + 1}
                                </span>
                                <span>{step}</span>
                            </div>
                        ))}
                    </div>
                    {swap.rationale && (
                        <p className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                            {swap.rationale}
                        </p>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                    <SecondaryButton type="button" onClick={onClose} disabled={isExecutingSwap}>
                        Cancel
                    </SecondaryButton>
                    <PrimaryButton type="button" onClick={onExecute} disabled={isExecutingSwap}>
                        <RiCheckLine className="w-3.5 h-3.5 mr-1.5" />
                        <span>{isExecutingSwap ? 'Executing Swap...' : 'Execute Bridge Swap'}</span>
                    </PrimaryButton>
                </div>
            </div>
        </Modal>
    );
}
