import HardwareImage from '@/Components/HardwareImage';
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import { useMemo } from 'react';
import {
    RiArrowRightUpLine,
    RiCloseLine,
    RiComputerLine,
    RiSearchLine,
    RiSparkling2Line,
} from 'react-icons/ri';
import { Link } from '@inertiajs/react';

export default function DeployableInventoryModal({
    show,
    totalAvailable = 0,
    search = '',
    setSearch,
    typeFilter = 'all',
    setTypeFilter,
    devices = [],
    onClose,
    onSelectPrompt,
}) {
    const filteredDevices = useMemo(() => {
        return (devices || []).filter((dev) => {
            if (typeFilter !== 'all' && dev.device_type !== typeFilter) {
                return false;
            }
            if (search.trim()) {
                const q = search.toLowerCase();
                return (
                    dev.brand?.toLowerCase().includes(q) ||
                    dev.model?.toLowerCase().includes(q) ||
                    dev.asset_tag?.toLowerCase().includes(q) ||
                    dev.cpu?.toLowerCase().includes(q) ||
                    dev.cpu_tier?.toLowerCase().includes(q) ||
                    dev.location?.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [devices, search, typeFilter]);

    return (
        <Modal show={show} onClose={onClose} maxWidth="3xl">
            <div className="p-6">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                            Deployable Stockroom Inventory
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                            {totalAvailable} ready-to-deploy assets available for immediate matching.
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

                {/* Search + Type Filter */}
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="relative flex-1">
                        <RiSearchLine className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch?.(e.target.value)}
                            placeholder="Search brand, model, asset tag, CPU, location..."
                            className="w-full pl-9 pr-8 py-2 text-xs rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-[#026eff] focus:ring-0"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch?.('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <RiCloseLine className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 p-0.5 rounded-sm shrink-0">
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'laptop', label: 'Laptops' },
                            { id: 'desktop', label: 'Desktops' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setTypeFilter?.(tab.id)}
                                className={`px-3 py-1.5 rounded-sm border text-[11px] font-medium transition cursor-pointer ${
                                    typeFilter === tab.id
                                        ? 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                                        : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Devices List */}
                <div className="mt-4 max-h-[55vh] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 rounded-sm border border-zinc-200 dark:border-zinc-800">
                    {filteredDevices.length === 0 ? (
                        <div className="p-10 text-center">
                            <RiComputerLine className="w-7 h-7 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                No available units match
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Adjust your search term or form-factor filter.
                            </p>
                        </div>
                    ) : (
                        filteredDevices.map((dev) => (
                            <div
                                key={dev.id}
                                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-sm bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700">
                                        <HardwareImage
                                            src={dev.image_clip_url || dev.image_url}
                                            alt={`${dev.brand} ${dev.model}`}
                                            deviceType={dev.device_type}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={route('devices.show', dev.id)}
                                                className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-[#026eff] dark:hover:text-sky-400 truncate inline-flex items-center gap-1"
                                            >
                                                <span>
                                                    {dev.brand} {dev.model}
                                                </span>
                                                <RiArrowRightUpLine className="w-3 h-3 shrink-0" />
                                            </Link>
                                            <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0 tabular-nums">
                                                {dev.asset_tag}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate tabular-nums">
                                            <span className="uppercase font-mono">{dev.cpu_tier}</span> &bull; {dev.ram_gb}GB RAM &bull;{' '}
                                            {dev.storage_gb}GB {dev.storage_type || 'SSD'}
                                            {dev.gpu && dev.gpu !== 'Integrated' ? ` • ${dev.gpu}` : ''}
                                            {dev.location ? ` • ${dev.location}` : ''}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 sm:pl-2">
                                    <span className="px-2 py-0.5 rounded-sm border border-emerald-500/20 text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 capitalize">
                                        {dev.condition || 'Good'}
                                    </span>
                                    {onSelectPrompt && (
                                        <button
                                            type="button"
                                            onClick={() => onSelectPrompt(dev)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm border border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-medium hover:bg-zinc-800 dark:hover:bg-white transition cursor-pointer"
                                        >
                                            <RiSparkling2Line className="w-3 h-3" />
                                            <span>Target Spec</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                        Showing {filteredDevices.length} stockroom units
                    </span>
                    <SecondaryButton type="button" onClick={onClose}>
                        Close
                    </SecondaryButton>
                </div>
            </div>
        </Modal>
    );
}
