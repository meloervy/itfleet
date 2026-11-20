import { RiArrowRightLine, RiComputerLine, RiSwapLine, RiUser3Line } from 'react-icons/ri';

const formatPct = (val) => {
    const num = Number(val ?? 0);
    return Math.round(num <= 1 ? num * 100 : num);
};

export default function BridgeSwapCascadeDiagram({ swap }) {
    if (!swap) return null;

    const bridge = swap.bridge_device;
    const donor = swap.donor_employee;
    const donorDevice = swap.donor_device;

    const donorFitPct = formatPct(swap.donor_score_on_bridge_device);
    const requesterFitPct = formatPct(swap.requester_score_on_donor_device);

    return (
        <div className="rounded-sm bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    <RiSwapLine className="w-3.5 h-3.5 text-[#0aceb3]" />
                    <span>2-Step Internal Reallocation Cascade</span>
                </div>
                {swap.same_location && (
                    <span className="px-2 py-0.5 rounded-sm border border-emerald-500/20 text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                        Same Office Location
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-11 gap-2 items-center">
                {/* Node 1: Bridge Stockroom Device */}
                <div className="md:col-span-3 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3">
                    <div className="flex items-center justify-between gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                        <span>Stockroom</span>
                        <span className="font-mono text-zinc-600 dark:text-zinc-300 tabular-nums">
                            {bridge?.asset_tag}
                        </span>
                    </div>
                    <div className="mt-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {bridge?.brand} {bridge?.model}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                        {bridge?.cpu_tier?.toUpperCase()} &bull; {bridge?.ram_gb}GB
                    </div>
                </div>

                {/* Step 1 Arrow */}
                <div className="md:col-span-1 flex md:flex-col items-center justify-center gap-1 text-zinc-400 dark:text-zinc-500 py-1">
                    <RiArrowRightLine className="w-4 h-4 rotate-90 md:rotate-0 text-[#0aceb3]" />
                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                        {donorFitPct}% fit
                    </span>
                </div>

                {/* Node 2: Donor Custodian */}
                <div className="md:col-span-3 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3">
                    <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                        <RiUser3Line className="w-3 h-3" />
                        <span>Donor Custodian</span>
                    </div>
                    <div className="mt-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {donor?.name}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {donor?.department} &bull; {donor?.role_profile?.name || 'Role matched'}
                    </div>
                </div>

                {/* Step 2 Arrow */}
                <div className="md:col-span-1 flex md:flex-col items-center justify-center gap-1 text-zinc-400 dark:text-zinc-500 py-1">
                    <RiArrowRightLine className="w-4 h-4 rotate-90 md:rotate-0 text-[#026eff]" />
                    <span className="text-[10px] font-medium text-[#026eff] dark:text-sky-400 tabular-nums whitespace-nowrap">
                        {requesterFitPct}% fit
                    </span>
                </div>

                {/* Node 3: Freed Donor Workstation */}
                <div className="md:col-span-3 rounded-sm bg-white dark:bg-zinc-900 border border-[#026eff]/40 p-3">
                    <div className="flex items-center justify-between gap-1 text-[10px] font-medium uppercase tracking-wider text-[#026eff] dark:text-sky-400">
                        <span className="inline-flex items-center gap-1">
                            <RiComputerLine className="w-3 h-3" />
                            <span>Freed Unit</span>
                        </span>
                        <span className="font-mono tabular-nums">{donorDevice?.asset_tag}</span>
                    </div>
                    <div className="mt-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {donorDevice?.brand} {donorDevice?.model}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                        {donorDevice?.cpu_tier?.toUpperCase()} &bull; {donorDevice?.ram_gb}GB
                    </div>
                </div>
            </div>
        </div>
    );
}
