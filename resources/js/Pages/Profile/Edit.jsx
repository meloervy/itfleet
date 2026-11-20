import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import {
    RiUser3Line,
    RiLockPasswordLine,
    RiAlertLine,
    RiBuildingLine,
    RiCalendarLine,
    RiMailLine,
    RiSparklingLine,
    RiComputerLine,
    RiTeamLine,
    RiLockLine,
    RiInformationLine,
    RiCheckLine,
    RiArrowRightSLine,
} from 'react-icons/ri';

export default function Edit({ mustVerifyEmail, status }) {
    const user = usePage().props.auth.user;
    const [activeTab, setActiveTab] = useState('general'); // 'general' | 'security' | 'danger'

    const formattedJoinDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
          })
        : 'Active Member';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 mb-1">
                            <Link
                                href={route('dashboard')}
                                className="hover:text-zinc-700 dark:hover:text-zinc-200 transition"
                            >
                                Dashboard
                            </Link>
                            <RiArrowRightSLine className="w-3.5 h-3.5" />
                            <span>Settings</span>
                            <RiArrowRightSLine className="w-3.5 h-3.5" />
                            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                                Profile &amp; Security
                            </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Profile &amp; Account Settings
                        </h1>
                    </div>
                </div>
            }
        >
            <Head title="Profile Settings" />

            <div className="space-y-6">
                {/* Clean Profile Summary Card */}
                <div className="rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-lg font-semibold shrink-0">
                                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                            </div>

                            <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight truncate">
                                        {user.name}
                                    </h2>
                                    <span className="px-2 py-0.5 rounded-sm border border-[#026eff]/20 text-[11px] font-medium bg-[#026eff]/10 text-[#026eff] dark:text-sky-400">
                                        {user.role_title || (user.role ? user.role.toUpperCase() : 'IT Administrator')}
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    <span className="inline-flex items-center gap-1.5">
                                        <RiMailLine className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                        <span>{user.email}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <RiBuildingLine className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                        <span>{user.department || 'IT Infrastructure & Systems'}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <RiCalendarLine className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                        <span>Joined {formattedJoinDate}</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-zinc-100 dark:border-zinc-800 text-xs">
                            <div>
                                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">Verification</span>
                                <span className="font-medium text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-1 mt-0.5">
                                    {user.email_verified_at ? (
                                        <>
                                            <RiCheckLine className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-emerald-600 dark:text-emerald-400">Verified</span>
                                        </>
                                    ) : (
                                        <>
                                            <RiAlertLine className="w-3.5 h-3.5 text-amber-500" />
                                            <span className="text-amber-600 dark:text-amber-400">Pending</span>
                                        </>
                                    )}
                                </span>
                            </div>
                            <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />
                            <div>
                                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">Authority Tier</span>
                                <span className="font-medium text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                                    {user.role === 'admin' ? 'Level 1 Superadmin' : user.role === 'manager' ? 'Level 2 Asset Mgr' : 'Level 3 Operator'}
                                </span>
                            </div>
                            <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />
                            <div>
                                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">Session Protocol</span>
                                <span className="font-medium text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                                    TLS 1.3 Protected
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Minimal Underline Tab Navigation */}
                <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('general')}
                        className={`inline-flex items-center gap-2 pb-2.5 text-xs font-medium border-b transition cursor-pointer shrink-0 ${
                            activeTab === 'general'
                                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                        }`}
                    >
                        <RiUser3Line className="w-3.5 h-3.5" />
                        <span>General Profile</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('security')}
                        className={`inline-flex items-center gap-2 pb-2.5 text-xs font-medium border-b transition cursor-pointer shrink-0 ${
                            activeTab === 'security'
                                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                        }`}
                    >
                        <RiLockPasswordLine className="w-3.5 h-3.5" />
                        <span>Security &amp; Password</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('danger')}
                        className={`inline-flex items-center gap-2 pb-2.5 text-xs font-medium border-b transition cursor-pointer shrink-0 ${
                            activeTab === 'danger'
                                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                        }`}
                    >
                        <RiAlertLine className="w-3.5 h-3.5" />
                        <span>Danger Zone</span>
                    </button>
                </div>

                {/* Tab Content Panels */}
                <div>
                    {activeTab === 'general' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-8 bg-white dark:bg-zinc-900 p-6 rounded-sm border border-zinc-200 dark:border-zinc-800">
                                <UpdateProfileInformationForm
                                    mustVerifyEmail={mustVerifyEmail}
                                    status={status}
                                />
                            </div>

                            <div className="lg:col-span-4 space-y-4">
                                <div className="bg-white dark:bg-zinc-900 p-5 rounded-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
                                    <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
                                        <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                            Role Capabilities
                                        </h3>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            Assigned access scope
                                        </p>
                                    </div>

                                    <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
                                        <div className="flex items-start gap-2.5">
                                            <RiSparklingLine className="w-4 h-4 text-[#026eff] dark:text-sky-400 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-medium text-zinc-800 dark:text-zinc-200 block">AI Matching Pipeline</span>
                                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Execute heuristic matching &amp; bridge swaps</span>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2.5">
                                            <RiComputerLine className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-medium text-zinc-800 dark:text-zinc-200 block">Fleet &amp; Inventory Ops</span>
                                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Provision devices, adjust lifecycle &amp; maintenance</span>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2.5">
                                            <RiTeamLine className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-medium text-zinc-800 dark:text-zinc-200 block">Employee &amp; Role Benchmarks</span>
                                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Map staff role profiles &amp; manage reassignments</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-8 bg-white dark:bg-zinc-900 p-6 rounded-sm border border-zinc-200 dark:border-zinc-800">
                                <UpdatePasswordForm />
                            </div>

                            <div className="lg:col-span-4 space-y-4">
                                <div className="bg-white dark:bg-zinc-900 p-5 rounded-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
                                    <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
                                        <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                            Security Guidelines
                                        </h3>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            Admin credential standards
                                        </p>
                                    </div>

                                    <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
                                        <div className="flex items-start gap-2.5">
                                            <RiCheckLine className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-medium text-zinc-800 dark:text-zinc-200 block">Complex Passphrase</span>
                                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Use a mixture of uppercase, lowercase, numbers, and symbols.</span>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2.5">
                                            <RiLockLine className="w-4 h-4 text-[#026eff] dark:text-sky-400 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-medium text-zinc-800 dark:text-zinc-200 block">Dedicated Credentials</span>
                                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Never share administrative passwords across personal services.</span>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2.5">
                                            <RiInformationLine className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-medium text-zinc-800 dark:text-zinc-200 block">Session Expiration</span>
                                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Sessions automatically invalidate after idle timeout.</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'danger' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-8 bg-white dark:bg-zinc-900 p-6 rounded-sm border border-rose-200 dark:border-rose-900/60">
                                <DeleteUserForm />
                            </div>

                            <div className="lg:col-span-4 space-y-4">
                                <div className="bg-white dark:bg-zinc-900 p-5 rounded-sm border border-zinc-200 dark:border-zinc-800 space-y-3">
                                    <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
                                        <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                            Audit Safeguards
                                        </h3>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            Data governance notice
                                        </p>
                                    </div>

                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                        Prior activity logs, maintenance records, and match executions previously performed will retain an anonymized audit footprint for regulatory IT compliance.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
