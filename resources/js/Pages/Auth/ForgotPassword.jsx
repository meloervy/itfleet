import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { RiArrowLeftLine } from 'react-icons/ri';

export default function ForgotPassword({ status }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('password.email'));
    };

    return (
        <GuestLayout>
            <Head title="Forgot Password" />

            <div className="mb-4">
                <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Reset your password
                </h1>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Enter your email address and we will send you a password reset link.
                </p>
            </div>

            {status && (
                <div className="mb-4 rounded-sm bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <InputLabel htmlFor="email" value="Email Address" />
                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1.5 block w-full text-xs sm:text-sm"
                        placeholder="name@company.ph"
                        isFocused={true}
                        onChange={(e) => setData('email', e.target.value)}
                    />
                    <InputError message={errors.email} className="mt-1" />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <Link
                        href={route('login')}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    >
                        <RiArrowLeftLine className="w-3.5 h-3.5" />
                        <span>Back to sign in</span>
                    </Link>

                    <PrimaryButton disabled={processing}>
                        Email Reset Link
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}
