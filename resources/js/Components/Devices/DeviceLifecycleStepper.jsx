import { RiArrowRightLine, RiCheckLine } from 'react-icons/ri';

export default function DeviceLifecycleStepper({
    device,
    stages,
    currentStageIndex,
    onOpenTransition,
    canTransition = false,
}) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 px-5 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-3 gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Lifecycle Phase:</span>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
                        {device.lifecycle_stage}
                    </span>
                </div>
                {canTransition && (
                    <button
                        type="button"
                        onClick={onOpenTransition}
                        className="text-xs font-medium text-[#026eff] dark:text-sky-400 hover:underline inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                    >
                        <span>Transition Phase</span>
                        <RiArrowRightLine className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {stages.map((stage, idx) => {
                    const isCurrent = stage.key === device.lifecycle_stage;
                    const isPast = currentStageIndex > idx;
                    return (
                        <div
                            key={stage.key}
                            title={stage.desc}
                            className={`px-3 py-2 rounded-sm border transition ${
                                isCurrent
                                    ? 'bg-[#026eff]/5 dark:bg-[#026eff]/10 border-[#026eff]/40'
                                    : isPast
                                    ? 'bg-emerald-500/5 border-emerald-500/30'
                                    : 'bg-zinc-50/50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800 opacity-60'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className={`text-[10px] font-medium uppercase tracking-wider ${
                                    isCurrent ? 'text-[#026eff] dark:text-sky-400' : isPast ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'
                                }`}>
                                    0{idx + 1} &middot; {stage.label}
                                </span>
                                {isCurrent && <span className="w-1.5 h-1.5 rounded-sm bg-[#026eff] dark:bg-sky-400 shrink-0" />}
                                {isPast && <RiCheckLine className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
