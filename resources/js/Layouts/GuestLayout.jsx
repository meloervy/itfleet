import ITFleetLogo from '@/Components/ITFleetLogo';
import { Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { RiMoonLine, RiSunLine } from 'react-icons/ri';

export default function GuestLayout({
    children,
    maxWidth = 'max-w-md',
}) {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (storedTheme === 'dark' || (!storedTheme && systemPrefersDark) || document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.add('dark');
            setIsDark(true);
        }
    }, []);

    const toggleTheme = () => {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setIsDark(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setIsDark(true);
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-between bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-4 sm:p-6">
            {/* Top Bar: Logo + Theme Toggle */}
            <div className="flex items-center justify-between w-full max-w-5xl mx-auto shrink-0">
                <Link href="/" className="inline-flex items-center">
                    <ITFleetLogo variant="full" size={24} showBadge={false} textClassName="dark:text-white" />
                </Link>
                <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label="Toggle Theme"
                    className="p-2 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/60 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                    {isDark ? <RiSunLine className="w-4 h-4" /> : <RiMoonLine className="w-4 h-4" />}
                </button>
            </div>

            {/* Center: Form Container */}
            <div className="flex flex-col items-center justify-center my-auto py-8">
                <div className={`w-full ${maxWidth} bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-7 rounded-sm`}>
                    {children}
                </div>
            </div>

            {/* Bottom: Clean Footer */}
            <div className="text-center text-[11px] text-zinc-400 dark:text-zinc-500 pt-2 shrink-0">
                &copy; {new Date().getFullYear()} ITFleet Enterprise ITAM
            </div>
        </div>
    );
}
