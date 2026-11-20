import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';
import {
    RiDeleteBin6Line,
    RiEyeLine,
    RiEyeOffLine,
    RiLoader4Line,
} from 'react-icons/ri';

export default function DeleteUserForm({ className = '' }) {
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const passwordInput = useRef();

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
    };

    const deleteUser = (e) => {
        e.preventDefault();

        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current?.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);
        clearErrors();
        reset();
    };

    return (
        <section className={`space-y-5 ${className}`}>
            <header className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Delete Account
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Permanently remove your user profile and revoke all access privileges.
                </p>
            </header>

            <div className="rounded-sm bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 p-4 space-y-3">
                <p className="text-xs text-rose-900 dark:text-rose-200 leading-relaxed">
                    Once your account is deleted, all authentication tokens, personalized preferences, and permissions are permanently removed. Ensure any pending hardware reviews have been handed off first.
                </p>

                <div>
                    <button
                        type="button"
                        onClick={confirmUserDeletion}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-rose-600 bg-rose-600 hover:bg-rose-700 hover:border-rose-700 text-white text-xs font-medium transition cursor-pointer"
                    >
                        <RiDeleteBin6Line className="w-3.5 h-3.5" />
                        <span>Delete Account</span>
                    </button>
                </div>
            </div>

            {/* Confirmation Modal */}
            <Modal show={confirmingUserDeletion} onClose={closeModal} maxWidth="md">
                <form onSubmit={deleteUser} className="p-6 space-y-4">
                    <div>
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                            Confirm Account Deletion
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                            Please enter your current password to permanently delete your account.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <InputLabel
                            htmlFor="delete_password"
                            value="Password"
                        />
                        <div className="relative">
                            <TextInput
                                id="delete_password"
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                ref={passwordInput}
                                value={data.password}
                                onChange={(e) =>
                                    setData('password', e.target.value)
                                }
                                className="block w-full pr-10 text-xs sm:text-sm"
                                isFocused
                                placeholder="Enter your current password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <RiEyeOffLine className="w-4 h-4" /> : <RiEyeLine className="w-4 h-4" />}
                            </button>
                        </div>

                        <InputError
                            message={errors.password}
                            className="mt-1"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                        <SecondaryButton onClick={closeModal} disabled={processing}>
                            Cancel
                        </SecondaryButton>

                        <button
                            type="submit"
                            disabled={processing || !data.password}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-rose-600 bg-rose-600 hover:bg-rose-700 hover:border-rose-700 text-white text-xs font-medium transition disabled:opacity-50 cursor-pointer"
                        >
                            {processing ? (
                                <>
                                    <RiLoader4Line className="w-3.5 h-3.5 animate-spin" />
                                    <span>Deleting...</span>
                                </>
                            ) : (
                                <>
                                    <RiDeleteBin6Line className="w-3.5 h-3.5" />
                                    <span>Permanently Delete</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
