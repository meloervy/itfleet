import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';
import {
    RiEyeLine,
    RiEyeOffLine,
    RiCheckLine,
    RiCloseLine,
    RiSave3Line,
    RiLoader4Line,
} from 'react-icons/ri';

export default function UpdatePasswordForm({ className = '' }) {
    const passwordInput = useRef();
    const currentPasswordInput = useRef();

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const {
        data,
        setData,
        errors,
        put,
        reset,
        processing,
        recentlySuccessful,
    } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current?.focus();
                }

                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current?.focus();
                }
            },
        });
    };

    // Password criteria helpers
    const hasMinLength = data.password.length >= 8;
    const hasConfirmationMatch =
        data.password.length > 0 &&
        data.password === data.password_confirmation;

    return (
        <section className={className}>
            <header className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Password &amp; Authentication
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Use a long, unique passphrase to keep your account secure.
                </p>
            </header>

            <form onSubmit={updatePassword} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                    <InputLabel
                        htmlFor="current_password"
                        value="Current Password"
                    />
                    <div className="relative">
                        <TextInput
                            id="current_password"
                            ref={currentPasswordInput}
                            value={data.current_password}
                            onChange={(e) =>
                                setData('current_password', e.target.value)
                            }
                            type={showCurrentPassword ? 'text' : 'password'}
                            className="block w-full pr-10 text-xs sm:text-sm"
                            autoComplete="current-password"
                            placeholder="Enter current password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowCurrentPassword((prev) => !prev)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer"
                            aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                        >
                            {showCurrentPassword ? <RiEyeOffLine className="w-4 h-4" /> : <RiEyeLine className="w-4 h-4" />}
                        </button>
                    </div>
                    <InputError
                        message={errors.current_password}
                        className="mt-1"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <InputLabel
                            htmlFor="password"
                            value="New Password"
                        />
                        <div className="relative">
                            <TextInput
                                id="password"
                                ref={passwordInput}
                                value={data.password}
                                onChange={(e) =>
                                    setData('password', e.target.value)
                                }
                                type={showNewPassword ? 'text' : 'password'}
                                className="block w-full pr-10 text-xs sm:text-sm"
                                autoComplete="new-password"
                                placeholder="Enter new password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword((prev) => !prev)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer"
                                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                            >
                                {showNewPassword ? <RiEyeOffLine className="w-4 h-4" /> : <RiEyeLine className="w-4 h-4" />}
                            </button>
                        </div>
                        <InputError message={errors.password} className="mt-1" />
                    </div>

                    <div className="space-y-1.5">
                        <InputLabel
                            htmlFor="password_confirmation"
                            value="Confirm New Password"
                        />
                        <div className="relative">
                            <TextInput
                                id="password_confirmation"
                                value={data.password_confirmation}
                                onChange={(e) =>
                                    setData('password_confirmation', e.target.value)
                                }
                                type={showConfirmPassword ? 'text' : 'password'}
                                className="block w-full pr-10 text-xs sm:text-sm"
                                autoComplete="new-password"
                                placeholder="Repeat new password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword((prev) => !prev)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer"
                                aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                            >
                                {showConfirmPassword ? <RiEyeOffLine className="w-4 h-4" /> : <RiEyeLine className="w-4 h-4" />}
                            </button>
                        </div>
                        <InputError
                            message={errors.password_confirmation}
                            className="mt-1"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                    <span className={`inline-flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                        {hasMinLength ? <RiCheckLine className="w-3.5 h-3.5" /> : <RiCloseLine className="w-3.5 h-3.5" />}
                        Minimum 8 characters
                    </span>
                    <span className={`inline-flex items-center gap-1.5 ${hasConfirmationMatch ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                        {hasConfirmationMatch ? <RiCheckLine className="w-3.5 h-3.5" /> : <RiCloseLine className="w-3.5 h-3.5" />}
                        Passwords match
                    </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Transition
                            show={recentlySuccessful}
                            enter="transition ease-out duration-200"
                            enterFrom="opacity-0"
                            enterTo="opacity-100"
                            leave="transition ease-in duration-150"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                <RiCheckLine className="w-4 h-4" />
                                <span>Password updated.</span>
                            </div>
                        </Transition>
                    </div>

                    <button
                        type="submit"
                        disabled={processing}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] hover:border-[#0258d1] text-white text-xs font-medium transition disabled:opacity-50 cursor-pointer"
                    >
                        {processing ? (
                            <>
                                <RiLoader4Line className="w-3.5 h-3.5 animate-spin" />
                                <span>Updating...</span>
                            </>
                        ) : (
                            <>
                                <RiSave3Line className="w-3.5 h-3.5" />
                                <span>Update Password</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </section>
    );
}
