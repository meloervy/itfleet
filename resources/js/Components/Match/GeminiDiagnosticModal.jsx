import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import {
    RiCheckboxCircleLine,
    RiCloseLine,
    RiErrorWarningLine,
    RiSparkling2Line,
} from 'react-icons/ri';

export default function GeminiDiagnosticModal({ show, result, onClose }) {
    if (!result) return null;

    const isOnline = Boolean(result.success);

    return (
        <Modal show={show} onClose={onClose} maxWidth="md">
            <div className="p-6">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2.5">
                        <div
                            className={`w-8 h-8 rounded-sm border flex items-center justify-center shrink-0 ${
                                isOnline
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                            }`}
                        >
                            {isOnline ? (
                                <RiCheckboxCircleLine className="w-4 h-4" />
                            ) : (
                                <RiErrorWarningLine className="w-4 h-4" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                AI Extraction Engine Diagnostic
                            </h2>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Live connectivity check to Google Gemini API
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                        aria-label="Close modal"
                    >
                        <RiCloseLine className="w-4 h-4" />
                    </button>
                </div>

                <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2.5">
                        <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3">
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Status</div>
                            <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                <span
                                    className={`w-1.5 h-1.5 rounded-sm ${
                                        isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                />
                                <span>{isOnline ? 'Online' : 'Fallback'}</span>
                            </div>
                        </div>

                        <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3">
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Latency</div>
                            <div className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                                {result.latency_ms ?? 0} ms
                            </div>
                        </div>

                        <div className="rounded-sm bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-3">
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Model</div>
                            <div className="mt-1 text-[11px] font-mono font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                {result.model || 'gemini-4-hydrogen'}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-sm border border-zinc-200 dark:border-zinc-800 p-3.5 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                            <RiSparkling2Line className="w-3.5 h-3.5 text-[#026eff]" />
                            <span>Diagnostic Summary</span>
                        </div>
                        <p>{result.message}</p>
                        {result.details && (
                            <p className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 break-words">
                                {result.details}
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-5 flex justify-end">
                    <SecondaryButton type="button" onClick={onClose}>
                        Close
                    </SecondaryButton>
                </div>
            </div>
        </Modal>
    );
}
