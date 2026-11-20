import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { RiCloseLine } from 'react-icons/ri';

export default function WorkloadTemplateModal({ show, form = {}, setForm, onClose, onSubmit }) {
    return (
        <Modal show={show} onClose={onClose} maxWidth="md">
            <form onSubmit={onSubmit} className="p-6">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                            Save Custom Workload Template
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Store reusable hardware request prompts locally in your browser.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-sm border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                        aria-label="Close modal"
                    >
                        <RiCloseLine className="w-4 h-4" />
                    </button>
                </div>

                <div className="mt-4 space-y-4">
                    <div>
                        <InputLabel htmlFor="tpl_name" value="Template Name *" />
                        <TextInput
                            id="tpl_name"
                            type="text"
                            value={form.label ?? form.name ?? ''}
                            onChange={(e) =>
                                setForm?.((prev) => ({
                                    ...prev,
                                    label: e.target.value,
                                    name: e.target.value,
                                }))
                            }
                            placeholder="e.g. Kubernetes Platform Eng"
                            className="mt-1.5 block w-full text-xs"
                            required
                        />
                    </div>

                    <div>
                        <InputLabel htmlFor="tpl_category" value="Category / Department" />
                        <TextInput
                            id="tpl_category"
                            type="text"
                            value={form.category ?? form.dept ?? ''}
                            onChange={(e) =>
                                setForm?.((prev) => ({
                                    ...prev,
                                    category: e.target.value,
                                    dept: e.target.value,
                                }))
                            }
                            placeholder="e.g. Engineering, Design, Operations"
                            className="mt-1.5 block w-full text-xs"
                        />
                    </div>

                    <div>
                        <InputLabel htmlFor="tpl_prompt" value="Request Description *" />
                        <textarea
                            id="tpl_prompt"
                            rows={4}
                            value={form.prompt ?? form.text ?? ''}
                            onChange={(e) =>
                                setForm?.((prev) => ({
                                    ...prev,
                                    prompt: e.target.value,
                                    text: e.target.value,
                                }))
                            }
                            placeholder="Describe target workload, software stack, memory needs, and portability..."
                            className="mt-1.5 block w-full rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 py-2 px-3 focus:outline-none focus:border-[#026eff] focus:ring-0"
                            required
                        />
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                    <SecondaryButton type="button" onClick={onClose}>
                        Cancel
                    </SecondaryButton>
                    <PrimaryButton type="submit">Save Template</PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}
