import { Link } from '@inertiajs/react';

/**
 * Clean minimal pagination bar shared across paginated directory & inventory views.
 */
export default function Pagination({ links = [], from, to, total, label = 'records' }) {
    if (!links || links.length <= 3) {
        return null;
    }

    return (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-2 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="tabular-nums">
                Showing <span className="font-medium text-zinc-900 dark:text-zinc-100">{from}</span> to{' '}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{to}</span> of{' '}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{total}</span> {label}
            </div>
            <div className="flex flex-wrap items-center gap-1">
                {links.map((link, idx) => (
                    <Link
                        key={idx}
                        href={link.url || '#'}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                        className={`px-2.5 py-1.5 text-xs rounded-sm font-medium tabular-nums border transition ${
                            link.active
                                ? 'bg-[#026eff] border-[#026eff] text-white'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        } ${!link.url ? 'opacity-40 pointer-events-none' : ''}`}
                    />
                ))}
            </div>
        </div>
    );
}
