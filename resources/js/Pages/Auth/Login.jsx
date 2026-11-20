import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { RiArrowRightLine, RiCheckLine, RiEyeLine, RiEyeOffLine, RiLoader4Line } from 'react-icons/ri';

export default function Login({ status, canResetPassword, showDemoLogin = false }) {
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e) => {
        e?.preventDefault();

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    const [quickLoggingIn, setQuickLoggingIn] = useState(false);

    const handleQuickLogin = (email, password = 'password') => {
        setQuickLoggingIn(true);
        setData((prev) => ({
            ...prev,
            email,
            password,
            remember: true,
        }));

        router.post(
            route('login'),
            { email, password, remember: true },
            {
                onFinish: () => {
                    setQuickLoggingIn(false);
                    reset('password');
                },
            }
        );
    };

    return (
        <GuestLayout>
            <Head title="Sign In - ITFleet ITAM" />

            {/* Header Area */}
            <div className="mb-5">
                <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Sign in to ITFleet
                </h1>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Hardware lifecycle and intelligent specification matching
                </p>
            </div>

            {/* 1-Click Demo Sign-In Cards (Local Environment Only) */}
            {showDemoLogin && (
                <>
                    <div className="mb-4 rounded-sm bg-zinc-50 dark:bg-zinc-800/40 p-2.5 border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-2 px-0.5">
                            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                Quick demo access
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                                pw: password
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {[
                                { label: 'IT Admin', role: 'Full Control', email: 'admin@itfleet.local' },
                                { label: 'Manager', role: 'Fleet Life', email: 'manager@itfleet.local' },
                                { label: 'Technician', role: 'Diagnostics', email: 'tech@itfleet.local' },
                                { label: 'Auditor', role: 'Read-Only', email: 'auditor@itfleet.local' },
                            ].map((demo) => (
                                <button
                                    key={demo.email}
                                    type="button"
                                    disabled={processing || quickLoggingIn}
                                    onClick={() => handleQuickLogin(demo.email, 'password')}
                                    className="flex flex-col items-center justify-center py-2 px-1.5 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-[#026eff] dark:hover:border-sky-400 transition-colors group text-center cursor-pointer disabled:opacity-50"
                                >
                                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-[#026eff] dark:group-hover:text-sky-400">
                                        {demo.label}
                                    </span>
                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-full">
                                        {demo.role}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                        </div>
                        <div className="relative flex justify-center text-[11px]">
                            <span className="bg-white dark:bg-zinc-900 px-2.5 text-zinc-400 dark:text-zinc-500">
                                or sign in with email
                            </span>
                        </div>
                    </div>
                </>
            )}

            {status && (
                <div className="mb-4 text-xs font-medium text-emerald-700 dark:text-emerald-400 rounded-sm bg-emerald-500/10 px-3 py-2 border border-emerald-500/20 flex items-center gap-2">
                    <RiCheckLine className="w-4 h-4 shrink-0" />
                    <span>{status}</span>
                </div>
            )}

            {/* Form */}
            <form onSubmit={submit} className="space-y-4">
                <div>
                    <InputLabel htmlFor="email" value="Enterprise Email" />
                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1.5 block w-full text-xs sm:text-sm"
                        autoComplete="username"
                        placeholder="admin@itfleet.local"
                        isFocused={true}
                        onChange={(e) => setData('email', e.target.value)}
                    />
                    <InputError message={errors.email} className="mt-1" />
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <InputLabel htmlFor="password" value="Password" />
                        {canResetPassword && (
                            <Link
                                href={route('password.request')}
                                className="text-xs font-medium text-[#026eff] dark:text-sky-400 hover:underline transition"
                            >
                                Forgot password?
                            </Link>
                        )}
                    </div>

                    <div className="relative mt-1.5">
                        <TextInput
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            value={data.password}
                            className="block w-full pr-9 text-xs sm:text-sm"
                            autoComplete="current-password"
                            placeholder="••••••••"
                            onChange={(e) => setData('password', e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer transition-colors"
                        >
                            {showPassword ? <RiEyeOffLine className="w-4 h-4" /> : <RiEyeLine className="w-4 h-4" />}
                        </button>
                    </div>

                    <InputError message={errors.password} className="mt-1" />
                </div>

                <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer group">
                        <Checkbox
                            name="remember"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                        />
                        <span className="ms-2 text-xs text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition-colors">
                            Remember session
                        </span>
                    </label>
                </div>

                <div className="pt-1">
                    <button
                        type="submit"
                        disabled={processing}
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-sm border border-[#026eff] text-xs sm:text-[13px] font-medium text-white bg-[#026eff] hover:bg-[#0258d1] hover:border-[#0258d1] transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {processing ? (
                            <>
                                <RiLoader4Line className="animate-spin h-4 w-4" />
                                <span>Signing in...</span>
                            </>
                        ) : (
                            <>
                                <span>Sign In</span>
                                <RiArrowRightLine className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>

                <div className="pt-3 text-center border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                    Need a staff profile?{' '}
                    <Link
                        href={route('register')}
                        className="font-medium text-[#026eff] dark:text-sky-400 hover:underline transition-colors"
                    >
                        Create account
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
