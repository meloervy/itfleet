import Dropdown from '@/Components/Dropdown';
import NavLink from '@/Components/NavLink';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import ITFleetLogo from '@/Components/ITFleetLogo';
import { Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';

const GeminiFleetAssistant = lazy(() => import('@/Components/GeminiFleetAssistant'));
import {
    RiDashboard3Line,
    RiComputerLine,
    RiKey2Line,
    RiToolsLine,
    RiShieldUserLine,
    RiTeamLine,
    RiSparklingLine,
    RiAlertLine,
    RiSunLine,
    RiMoonLine,
    RiUserLine,
    RiLogoutBoxRLine,
    RiArrowDownSLine,
    RiLoginBoxLine,
    RiRefreshLine,
    RiLoader4Line,
} from 'react-icons/ri';

export default function AuthenticatedLayout({ header, children, maxWidth = 'max-w-[1600px]' }) {
    const page = usePage();
    const { auth, flash, demo } = page.props;
    const user = auth.user;
    const isAdminOrManager = ['admin', 'manager'].includes(user?.role);

    const pageContext = useMemo(() => {
        const ctx = {
            path: page.url || null,
            component: page.component || null,
            active_preset: demo?.active_preset || null,
        };

        if (page.component === 'Devices/Show' && page.props?.device?.id) {
            const dev = page.props.device;
            ctx.entity_type = 'device';
            ctx.entity_id = dev.id;
            ctx.entity_label = `${dev.asset_tag} (${dev.brand} ${dev.model})`;
        }

        if (page.props?.filters && typeof page.props.filters === 'object') {
            const nonEmptyFilters = Object.fromEntries(
                Object.entries(page.props.filters).filter(([, v]) => v !== null && v !== undefined && v !== '')
            );
            if (Object.keys(nonEmptyFilters).length > 0) {
                ctx.filters = nonEmptyFilters;
            }
        }

        return ctx;
    }, [page.url, page.component, page.props?.device, page.props?.filters, demo?.active_preset]);

    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [hasOpenedAssistant, setHasOpenedAssistant] = useState(false);
    const [sessionExpiredNotice, setSessionExpiredNotice] = useState(null);
    const [demoBusy, setDemoBusy] = useState(null);

    const openAssistant = () => {
        setHasOpenedAssistant(true);
        setIsAssistantOpen(true);
    };

    const demoPresets = demo?.presets || [];
    const activePresetMeta = demoPresets.find((p) => p.key === demo?.active_preset) || demoPresets[0] || null;
    const demoRoles = [
        { key: 'admin', label: 'Admin' },
        { key: 'manager', label: 'Manager' },
        { key: 'technician', label: 'Tech' },
        { key: 'viewer', label: 'Auditor' },
    ];

    const handleSwitchPreset = (presetKey) => {
        if (demoBusy || presetKey === demo?.active_preset) {
            return;
        }
        setDemoBusy('preset');
        router.post(
            route('demo.switch-preset'),
            { preset: presetKey },
            {
                preserveScroll: true,
                onFinish: () => setDemoBusy(null),
            }
        );
    };

    const handleSwitchRole = (roleKey) => {
        if (demoBusy || roleKey === user?.role) {
            return;
        }
        setDemoBusy('role');
        router.post(
            route('demo.switch-role'),
            { role: roleKey },
            {
                preserveScroll: true,
                onFinish: () => setDemoBusy(null),
            }
        );
    };

    const handleResetDemo = () => {
        if (demoBusy) {
            return;
        }
        setDemoBusy('reset');
        router.post(
            route('demo.reset'),
            {},
            {
                preserveScroll: true,
                onFinish: () => setDemoBusy(null),
            }
        );
    };

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setHasOpenedAssistant(true);
                setIsAssistantOpen((prev) => !prev);
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    useEffect(() => {
        const hasDarkClass = document.documentElement.classList.contains('dark');
        const storedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (storedTheme === 'dark' || (!storedTheme && systemPrefersDark) || hasDarkClass) {
            document.documentElement.classList.add('dark');
            setIsDark(true);
        } else {
            document.documentElement.classList.remove('dark');
            setIsDark(false);
        }
    }, []);

    useEffect(() => {
        // Keep-alive heartbeat every 10 minutes while tab is active
        let lastPing = Date.now();
        const pingSession = async () => {
            if (document.visibilityState === 'visible') {
                try {
                    const res = await axios.get(route('session.keepalive'));
                    lastPing = Date.now();
                    if (res.data?.authenticated === false) {
                        setSessionExpiredNotice({
                            message: 'Your session has expired due to inactivity. Please log in again to continue.',
                            loginUrl: '/login',
                        });
                    } else if (sessionExpiredNotice) {
                        setSessionExpiredNotice(null);
                    }
                } catch (e) {}
            }
        };

        const interval = setInterval(pingSession, 10 * 60 * 1000);

        const onFocus = () => {
            if (Date.now() - lastPing > 5 * 60 * 1000) {
                pingSession();
            }
        };
        window.addEventListener('focus', onFocus);

        const onSessionExpired = (e) => {
            setSessionExpiredNotice({
                message: e.detail?.message || 'Your session has expired due to inactivity. Please log in again to continue.',
                loginUrl: e.detail?.loginUrl || '/login',
            });
        };
        window.addEventListener('itfleet:session-expired', onSessionExpired);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('itfleet:session-expired', onSessionExpired);
        };
    }, []);

    const setThemeMode = (mode) => {
        if (mode === 'dark') {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setIsDark(true);
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setIsDark(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-150 font-sans">
            {/* Top Navigation Bar */}
            <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-30">
                <div className={`mx-auto ${maxWidth} px-4 sm:px-6 lg:px-8`}>
                    <div className="flex h-14 justify-between items-center gap-3">
                        <div className="flex items-center gap-3 2xl:gap-5 min-w-0 flex-1">
                            <Link href="/dashboard" className="flex items-center shrink-0">
                                <ITFleetLogo variant="full" size={22} showBadge={false} textClassName="dark:text-white" />
                            </Link>

                            <div className="hidden lg:flex items-center gap-0.5 2xl:gap-1 min-w-0">
                                <NavLink href={route('dashboard')} active={route().current('dashboard')}>
                                    <RiDashboard3Line className="hidden 2xl:inline-block w-3.5 h-3.5 mr-1.5 opacity-75 shrink-0" />
                                    Dashboard
                                </NavLink>
                                <NavLink href={route('devices.index')} active={route().current('devices.*')}>
                                    <RiComputerLine className="hidden 2xl:inline-block w-3.5 h-3.5 mr-1.5 opacity-75 shrink-0" />
                                    Inventory
                                </NavLink>
                                <NavLink href={route('licenses.index')} active={route().current('licenses.*')}>
                                    <RiKey2Line className="hidden 2xl:inline-block w-3.5 h-3.5 mr-1.5 opacity-75 shrink-0" />
                                    Licenses
                                </NavLink>
                                <NavLink href={route('maintenance.index')} active={route().current('maintenance.*')}>
                                    <RiToolsLine className="hidden 2xl:inline-block w-3.5 h-3.5 mr-1.5 opacity-75 shrink-0" />
                                    Maintenance
                                </NavLink>
                                <NavLink href={route('role-profiles.index')} active={route().current('role-profiles.*')}>
                                    <RiShieldUserLine className="hidden 2xl:inline-block w-3.5 h-3.5 mr-1.5 opacity-75 shrink-0" />
                                    Role Profiles
                                </NavLink>
                                <NavLink href={route('employees.index')} active={route().current('employees.*')}>
                                    <RiTeamLine className="hidden 2xl:inline-block w-3.5 h-3.5 mr-1.5 opacity-75 shrink-0" />
                                    Employees
                                </NavLink>
                                {isAdminOrManager && (
                                    <NavLink href={route('match.index')} active={route().current('match.*')}>
                                        <RiSparklingLine className="hidden 2xl:inline-block w-3.5 h-3.5 mr-1.5 opacity-75 shrink-0" />
                                        AI Match
                                    </NavLink>
                                )}
                                <NavLink href={route('mismatches.index')} active={route().current('mismatches.*')}>
                                    <RiAlertLine className="hidden 2xl:inline-block w-3.5 h-3.5 mr-1.5 opacity-75 shrink-0" />
                                    Mismatches
                                </NavLink>
                            </div>
                        </div>

                        <div className="hidden lg:flex lg:items-center lg:gap-1.5 shrink-0">
                            <button
                                type="button"
                                onClick={openAssistant}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 transition cursor-pointer"
                                title="Open Fleet Assistant (Ctrl+K)"
                            >
                                <RiSparklingLine className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                                <span>Ask AI</span>
                                <kbd className="hidden xl:inline text-[10px] font-mono px-1 py-0.2 rounded-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400">
                                    ⌘K
                                </kbd>
                            </button>

                            <button
                                type="button"
                                onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
                                className="p-2 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 transition cursor-pointer"
                                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                                aria-label="Toggle theme"
                            >
                                {isDark ? <RiSunLine className="w-4 h-4" /> : <RiMoonLine className="w-4 h-4" />}
                            </button>

                            {/* Profile Dropdown */}
                            <Dropdown>
                                <Dropdown.Trigger>
                                    <button
                                        type="button"
                                        className="group inline-flex items-center gap-2 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition shrink-0 cursor-pointer"
                                    >
                                        <div className="w-5 h-5 rounded-sm overflow-hidden bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-[10px] font-semibold shrink-0">
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{user.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <span className="font-medium text-zinc-800 dark:text-zinc-200 max-w-[88px] xl:max-w-[120px] truncate">{user.name}</span>
                                        <RiArrowDownSLine className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition shrink-0" />
                                    </button>
                                </Dropdown.Trigger>

                                <Dropdown.Content width="56">
                                    <div className="px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 text-xs">
                                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{user.name}</div>
                                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{user.email}</div>
                                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                            <span className="inline-block px-1.5 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                                                {user.role_title || (user.role === 'admin' ? 'IT Administrator' : user.role === 'manager' ? 'IT Manager' : user.role === 'technician' ? 'Technician' : 'IT Auditor')}
                                            </span>
                                            {(user.department || user.job_title) && (
                                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                                                    {user.department || user.job_title}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-1 space-y-0.5">
                                        <Dropdown.Link href={route('profile.edit')} icon={RiUserLine}>
                                            Profile Settings
                                        </Dropdown.Link>
                                        <Dropdown.Link href={route('logout')} method="post" as="button" icon={RiLogoutBoxRLine} variant="danger">
                                            Log Out
                                        </Dropdown.Link>
                                    </div>
                                </Dropdown.Content>
                            </Dropdown>
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="flex items-center gap-1.5 lg:hidden">
                            <button
                                type="button"
                                onClick={openAssistant}
                                className="p-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                                aria-label="Open Fleet Assistant"
                            >
                                <RiSparklingLine className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
                                className="p-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                                aria-label="Toggle theme"
                            >
                                {isDark ? <RiSunLine className="w-4 h-4" /> : <RiMoonLine className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => setShowingNavigationDropdown((prev) => !prev)}
                                className="p-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                                aria-label="Toggle navigation"
                            >
                                <svg className="h-5 w-5" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="1.75"
                                        d={!showingNavigationDropdown ? 'M4 6h16M4 12h16M4 18h16' : 'M6 18L18 6M6 6l12 12'}
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Dropdown */}
                {showingNavigationDropdown && (
                    <div className="lg:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 space-y-1">
                        <div className="flex items-center gap-3 px-2.5 py-2 mb-2 rounded-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                            <div className="w-8 h-8 rounded-sm overflow-hidden bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-xs font-semibold shrink-0">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span>{user.name.charAt(0)}</span>
                                )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 leading-tight">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 truncate">{user.name}</span>
                                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 shrink-0">
                                        {user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Manager' : user.role === 'technician' ? 'Tech' : (user.role_title || 'IT Auditor')}
                                    </span>
                                </div>
                                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{user.email}</span>
                            </div>
                        </div>

                        <ResponsiveNavLink href={route('dashboard')} active={route().current('dashboard')}>
                            <span className="flex items-center gap-2">
                                <RiDashboard3Line className="w-4 h-4 opacity-75 shrink-0" />
                                Dashboard
                            </span>
                        </ResponsiveNavLink>
                        <ResponsiveNavLink href={route('devices.index')} active={route().current('devices.*')}>
                            <span className="flex items-center gap-2">
                                <RiComputerLine className="w-4 h-4 opacity-75 shrink-0" />
                                Inventory
                            </span>
                        </ResponsiveNavLink>
                        <ResponsiveNavLink href={route('licenses.index')} active={route().current('licenses.*')}>
                            <span className="flex items-center gap-2">
                                <RiKey2Line className="w-4 h-4 opacity-75 shrink-0" />
                                Licenses
                            </span>
                        </ResponsiveNavLink>
                        <ResponsiveNavLink href={route('maintenance.index')} active={route().current('maintenance.*')}>
                            <span className="flex items-center gap-2">
                                <RiToolsLine className="w-4 h-4 opacity-75 shrink-0" />
                                Maintenance
                            </span>
                        </ResponsiveNavLink>
                        <ResponsiveNavLink href={route('role-profiles.index')} active={route().current('role-profiles.*')}>
                            <span className="flex items-center gap-2">
                                <RiShieldUserLine className="w-4 h-4 opacity-75 shrink-0" />
                                Role Profiles
                            </span>
                        </ResponsiveNavLink>
                        <ResponsiveNavLink href={route('employees.index')} active={route().current('employees.*')}>
                            <span className="flex items-center gap-2">
                                <RiTeamLine className="w-4 h-4 opacity-75 shrink-0" />
                                Employees
                            </span>
                        </ResponsiveNavLink>
                        {isAdminOrManager && (
                            <ResponsiveNavLink href={route('match.index')} active={route().current('match.*')}>
                                <span className="flex items-center gap-2">
                                    <RiSparklingLine className="w-4 h-4 opacity-75 shrink-0" />
                                    AI Match
                                </span>
                            </ResponsiveNavLink>
                        )}
                        <ResponsiveNavLink href={route('mismatches.index')} active={route().current('mismatches.*')}>
                            <span className="flex items-center gap-2">
                                <RiAlertLine className="w-4 h-4 opacity-75 shrink-0" />
                                Mismatches
                            </span>
                        </ResponsiveNavLink>

                        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 mt-2 space-y-1">
                            <ResponsiveNavLink href={route('profile.edit')}>
                                <span className="flex items-center gap-2">
                                    <RiUserLine className="w-4 h-4 opacity-75 shrink-0" />
                                    Profile Settings
                                </span>
                            </ResponsiveNavLink>
                            <ResponsiveNavLink method="post" href={route('logout')} as="button">
                                <span className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                    <RiLogoutBoxRLine className="w-4 h-4 shrink-0" />
                                    Log Out
                                </span>
                            </ResponsiveNavLink>
                        </div>
                    </div>
                )}

                {/* Instant Demo Mode Control Strip */}
                {demo?.enabled && (
                    <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/95 dark:bg-zinc-900/95">
                        <div className={`mx-auto ${maxWidth} px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]`}>
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-[#026eff]/30 bg-[#026eff]/10 text-[#026eff] dark:text-sky-400 font-semibold tracking-wide text-[10px] shrink-0">
                                    DEMO
                                </span>
                                {activePresetMeta && (
                                    <span className="font-medium text-zinc-700 dark:text-zinc-200 truncate">
                                        {activePresetMeta.company_name}
                                        <span className="hidden xl:inline font-normal text-zinc-400 dark:text-zinc-500 ml-1.5">
                                            · {activePresetMeta.subtitle}
                                        </span>
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Company Scale Selector */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-medium hidden sm:inline">
                                        Company:
                                    </span>
                                    <div className="inline-flex rounded-sm overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950">
                                        {demoPresets.map((preset) => {
                                            const active = preset.key === demo.active_preset;
                                            return (
                                                <button
                                                    key={preset.key}
                                                    type="button"
                                                    disabled={Boolean(demoBusy)}
                                                    onClick={() => handleSwitchPreset(preset.key)}
                                                    title={preset.subtitle}
                                                    className={`px-2 py-0.5 text-[11px] font-medium transition cursor-pointer disabled:opacity-60 border-r last:border-r-0 border-zinc-200 dark:border-zinc-700 ${
                                                        active
                                                            ? 'bg-[#026eff] text-white'
                                                            : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                    }`}
                                                >
                                                    {preset.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Role Switcher */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-medium hidden sm:inline">
                                        Role:
                                    </span>
                                    <div className="inline-flex rounded-sm overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950">
                                        {demoRoles.map((r) => {
                                            const active = r.key === user?.role;
                                            return (
                                                <button
                                                    key={r.key}
                                                    type="button"
                                                    disabled={Boolean(demoBusy)}
                                                    onClick={() => handleSwitchRole(r.key)}
                                                    className={`px-2 py-0.5 text-[11px] font-medium transition cursor-pointer disabled:opacity-60 border-r last:border-r-0 border-zinc-200 dark:border-zinc-700 ${
                                                        active
                                                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                                            : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                    }`}
                                                >
                                                    {r.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Reset Demo Data */}
                                <button
                                    type="button"
                                    disabled={Boolean(demoBusy)}
                                    onClick={handleResetDemo}
                                    title="Restore current company preset back to clean seeded state"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 text-[11px] font-medium transition cursor-pointer disabled:opacity-60"
                                >
                                    {demoBusy ? (
                                        <RiLoader4Line className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <RiRefreshLine className="w-3 h-3" />
                                    )}
                                    <span>{demoBusy === 'preset' ? 'Seeding...' : demoBusy === 'reset' ? 'Resetting...' : 'Reset Data'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* Flash Alerts */}
            {flash?.success && (
                <div className={`mx-auto ${maxWidth} px-4 sm:px-6 lg:px-8 pt-4`}>
                    <div className="rounded-sm bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs">
                        <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500 shrink-0" />
                        <span>{flash.success}</span>
                    </div>
                </div>
            )}
            {flash?.error && (
                <div className={`mx-auto ${maxWidth} px-4 sm:px-6 lg:px-8 pt-4`}>
                    <div className="rounded-sm bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-3.5 py-2.5 flex items-center gap-2.5 text-rose-800 dark:text-rose-300 text-xs">
                        <span className="w-1.5 h-1.5 rounded-sm bg-rose-500 shrink-0" />
                        <span>{flash.error}</span>
                    </div>
                </div>
            )}

            {/* Open Minimal Page Header & Main Content */}
            <main className="pb-12">
                <div className={`mx-auto ${maxWidth} px-4 sm:px-6 lg:px-8`}>
                    {header && (
                        <header className="pt-7 pb-5">
                            {header}
                        </header>
                    )}
                    <div className={header ? '' : 'pt-7'}>
                        {children}
                    </div>
                </div>
            </main>

            {/* Gemini Fleet Assistant Copilot (Lazy-Loaded on First Open) */}
            {hasOpenedAssistant && (
                <Suspense fallback={null}>
                    <GeminiFleetAssistant
                        isOpen={isAssistantOpen}
                        showFloatingTrigger={false}
                        onClose={() => setIsAssistantOpen(false)}
                        onOpen={openAssistant}
                        pageContext={pageContext}
                    />
                </Suspense>
            )}

            {/* Session Expiry Recovery Modal */}
            {sessionExpiredNotice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
                    <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-sm border border-zinc-300 dark:border-zinc-700 p-6">
                        <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-sm border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <RiShieldUserLine className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                        Session Timed Out
                                    </h3>
                                    <span className="text-[11px] px-2 py-0.5 rounded-sm border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                                        Paused
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                                    {sessionExpiredNotice.message}
                                </p>
                                <div className="mt-3 p-2.5 rounded-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500 shrink-0" />
                                    <span>Pending forms and drafts are preserved in browser cache.</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-col sm:flex-row gap-2">
                            <a
                                href={sessionExpiredNotice.loginUrl}
                                className="flex-1 py-2 px-3.5 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white font-medium text-center text-xs transition flex items-center justify-center gap-1.5"
                            >
                                <RiLoginBoxLine className="w-4 h-4" />
                                <span>Log In to Reconnect</span>
                            </a>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        const res = await axios.get(route('session.keepalive'));
                                        if (res.data?.authenticated) {
                                            setSessionExpiredNotice(null);
                                        } else {
                                            window.location.href = sessionExpiredNotice.loginUrl;
                                        }
                                    } catch (e) {
                                        window.location.href = sessionExpiredNotice.loginUrl;
                                    }
                                }}
                                className="py-2 px-3.5 rounded-sm border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-center text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <RiRefreshLine className="w-3.5 h-3.5" />
                                <span>Verify Reconnection</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
