import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';
import {
    RiAlertLine,
    RiCheckLine,
    RiSave3Line,
    RiLoader4Line,
} from 'react-icons/ri';

export default function UpdateProfileInformation({
    mustVerifyEmail,
    status,
    className = '',
}) {
    const user = usePage().props.auth.user;

    const { data, setData, patch, errors, processing, recentlySuccessful } =
        useForm({
            name: user.name,
            email: user.email,
        });

    const submit = (e) => {
        e.preventDefault();
        patch(route('profile.update'));
    };

    return (
        <section className={className}>
            <header className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Personal &amp; Contact Information
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Update your display name and email address associated with your ITFleet account.
                </p>
            </header>

            <form onSubmit={submit} className="mt-5 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-sm bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                        <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                            System Role
                        </div>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 truncate">
                            {user.role_title || 'IT Administrator'}
                        </div>
                    </div>

                    <div className="p-3.5 rounded-sm bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                        <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                            Assigned Department
                        </div>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 truncate">
                            {user.department || 'IT Infrastructure & Systems'}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <InputLabel htmlFor="name" value="Full Name" />
                        <TextInput
                            id="name"
                            className="block w-full text-xs sm:text-sm"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            required
                            autoComplete="name"
                            placeholder="Enter full name"
                        />
                        <InputError className="mt-1" message={errors.name} />
                    </div>

                    <div className="space-y-1.5">
                        <InputLabel htmlFor="email" value="Email Address" />
                        <TextInput
                            id="email"
                            type="email"
                            className="block w-full text-xs sm:text-sm"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            required
                            autoComplete="username"
                            placeholder="name@company.com"
                        />
                        <InputError className="mt-1" message={errors.email} />
                    </div>
                </div>

                {mustVerifyEmail && user.email_verified_at === null && (
                    <div className="rounded-sm bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3.5">
                        <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                            <RiAlertLine className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-medium">Your email address is unverified.</span>{' '}
                                <Link
                                    href={route('verification.send')}
                                    method="post"
                                    as="button"
                                    className="font-medium text-amber-700 dark:text-amber-300 underline cursor-pointer"
                                >
                                    Resend verification link
                                </Link>
                            </div>
                        </div>

                        {status === 'verification-link-sent' && (
                            <div className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                <RiCheckLine className="w-4 h-4" />
                                A fresh verification link has been sent to your email address.
                            </div>
                        )}
                    </div>
                )}

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
                                <span>Profile updated.</span>
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
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <RiSave3Line className="w-3.5 h-3.5" />
                                <span>Save Changes</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </section>
    );
}
