import { Link } from '@inertiajs/react';

export default function NavLink({
    active = false,
    className = '',
    prefetch = true,
    children,
    ...props
}) {
    return (
        <Link
            prefetch={prefetch}
            {...props}
            className={
                'inline-flex items-center px-2 xl:px-2.5 py-1.5 rounded-sm text-xs xl:text-[13px] font-medium whitespace-nowrap border transition-colors duration-150 focus:outline-none shrink-0 ' +
                'inline-flex items-center px-2 py-1.5 rounded-sm text-xs font-medium whitespace-nowrap border transition-colors duration-150 focus:outline-none shrink-0 ' +
                (active
                    ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 '
                    : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/50 ') +
                className
            }
        >
            {children}
        </Link>
    );
}
