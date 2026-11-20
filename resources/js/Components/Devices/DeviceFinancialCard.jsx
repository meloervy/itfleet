import { formatDisplayDate, formatPhp, formatRelativeDays } from '@/lib/formatters';
import { RiMoneyDollarCircleLine, RiShieldCheckLine } from 'react-icons/ri';

export default function DeviceFinancialCard({
    device,
    purchaseCost,
    bookValue,
    deprPercent,
    retainedPercent,
}) {
    const hasRecordedCost =
        device.purchase_cost !== null &&
        device.purchase_cost !== undefined &&
        device.purchase_cost !== '';

    const expiryCountdown = formatRelativeDays(device.days_until_warranty_expiry);

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-800 mb-4 gap-2">
                <div className="flex items-center gap-2">
                    <RiMoneyDollarCircleLine className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            Financial Valuation &amp; Warranty
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Amortization timeline, net book value, and vendor coverage
                        </p>
                    </div>
                </div>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-sm border font-medium capitalize self-start sm:self-auto ${
                    device.warranty_status === 'active'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        : device.warranty_status === 'expiring_soon'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
                }`}>
                    Warranty: {device.warranty_status ? device.warranty_status.replace('_', ' ') : 'Not Recorded'}
                </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                    <dt className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">Purchase Cost</dt>
                    <dd className="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 mt-0.5">
                        {hasRecordedCost ? formatPhp(purchaseCost) : 'Not Recorded'}
                    </dd>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block mt-0.5 tabular-nums">
                        {device.purchase_date
                            ? `Purchased ${formatDisplayDate(device.purchase_date)}`
                            : `Acquired: ${device.year_acquired || '—'}`}
                    </span>
                </div>

                <div>
                    <dt className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">Current Book Value</dt>
                    <dd className="text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {hasRecordedCost || bookValue > 0 ? formatPhp(bookValue) : '—'}
                    </dd>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block mt-0.5 tabular-nums">
                        Depr: {device.depreciation_rate_percent || 20}%/yr
                    </span>
                </div>

                <div>
                    <dt className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">Vendor &amp; Sourcing</dt>
                    <dd className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-1 truncate">
                        {device.vendor || 'Direct Purchase'}
                    </dd>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate block mt-0.5">
                        {device.contract_sla ? 'SLA Covered' : 'Standard Warranty'}
                    </span>
                </div>

                <div>
                    <dt className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">Warranty Expiration</dt>
                    <dd className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">
                        {formatDisplayDate(device.warranty_expiry, 'Not Recorded')}
                    </dd>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block mt-0.5 tabular-nums">
                        {expiryCountdown || 'No date on record'}
                    </span>
                </div>
            </div>

            {hasRecordedCost && (
                <div className="pt-3.5 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-600 dark:text-zinc-300">Amortization &amp; Residual Ratio</span>
                        <span className="font-mono text-zinc-500 dark:text-zinc-400 text-[11px] tabular-nums">
                            {deprPercent}% Depreciated &middot; {retainedPercent}% Retained
                        </span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-sm h-1.5 overflow-hidden flex">
                        <div
                            style={{ width: `${retainedPercent}%` }}
                            className="bg-emerald-500 h-full transition-all duration-500"
                            title={`Retained Book Value: ${retainedPercent}%`}
                        />
                        <div
                            style={{ width: `${deprPercent}%` }}
                            className="bg-zinc-300 dark:bg-zinc-600 h-full transition-all duration-500"
                            title={`Depreciated: ${deprPercent}%`}
                        />
                    </div>
                </div>
            )}

            {device.contract_sla && (
                <div className="mt-3.5 px-3 py-2 rounded-sm bg-[#026eff]/5 dark:bg-[#026eff]/10 border border-[#026eff]/20 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <RiShieldCheckLine className="w-4 h-4 text-[#026eff] dark:text-sky-400 shrink-0" />
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{device.contract_sla}</span>
                    </div>
                    <span className="text-[11px] font-medium text-[#026eff] dark:text-sky-400 hidden sm:inline">Active SLA</span>
                </div>
            )}
        </div>
    );
}
