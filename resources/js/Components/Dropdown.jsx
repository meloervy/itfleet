import { Transition } from '@headlessui/react';
import { Link } from '@inertiajs/react';
import { createContext, useContext, useState } from 'react';

const DropDownContext = createContext();

const Dropdown = ({ children }) => {
    const [open, setOpen] = useState(false);

    const toggleOpen = () => {
        setOpen((previousState) => !previousState);
    };

    return (
        <DropDownContext.Provider value={{ open, setOpen, toggleOpen }}>
            <div className="relative">{children}</div>
        </DropDownContext.Provider>
    );
};

const Trigger = ({ children }) => {
    const { open, setOpen, toggleOpen } = useContext(DropDownContext);

    return (
        <>
            <div onClick={toggleOpen} className="cursor-pointer">{children}</div>

            {open && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setOpen(false)}
                ></div>
            )}
        </>
    );
};

const Content = ({
    align = 'right',
    width = '56',
    placement = 'bottom',
    contentClasses = 'p-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700',
    children,
}) => {
    const { open, setOpen } = useContext(DropDownContext);

    const isTop = placement === 'top' || align.startsWith('top');

    let alignmentClasses = isTop ? 'origin-bottom' : 'origin-top';
    let positionClasses = isTop ? 'bottom-full mb-2' : 'mt-2';

    if (align === 'left' || align === 'top-left') {
        alignmentClasses = isTop
            ? 'ltr:origin-bottom-left rtl:origin-bottom-right start-0'
            : 'ltr:origin-top-left rtl:origin-top-right start-0';
    } else if (align === 'right' || align === 'top-right') {
        alignmentClasses = isTop
            ? 'ltr:origin-bottom-right rtl:origin-bottom-left end-0'
            : 'ltr:origin-top-right rtl:origin-top-left end-0';
    } else if (align === 'top' || align === 'center') {
        alignmentClasses = isTop ? 'origin-bottom start-0 end-0' : 'origin-top start-0 end-0';
    }

    let widthClasses = 'w-56';

    if (width === '48') {
        widthClasses = 'w-48';
    } else if (width === '60') {
        widthClasses = 'w-60';
    } else if (width === '64') {
        widthClasses = 'w-64';
    } else if (width === '72') {
        widthClasses = 'w-72';
    } else if (width === '80') {
        widthClasses = 'w-80';
    } else if (width === 'full') {
        widthClasses = 'w-full';
    }

    return (
        <Transition
            show={open}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 scale-95 -translate-y-1"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 scale-100 translate-y-0"
            leaveTo="opacity-0 scale-95 -translate-y-1"
        >
            <div
                className={`absolute z-50 ${positionClasses} rounded-sm ${alignmentClasses} ${widthClasses}`}
                onClick={() => setOpen(false)}
            >
                <div className={`rounded-sm overflow-hidden ${contentClasses}`}>
                    {children}
                </div>
            </div>
        </Transition>
    );
};

const DropdownHeader = ({ title, subtitle, badge, children, className = '' }) => {
    if (children) {
        return <div className={`px-3 py-2 text-xs ${className}`}>{children}</div>;
    }

    return (
        <div className={`px-2.5 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1 ${className}`}>
            <div className="flex items-center justify-between gap-2">
                {title && (
                    <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        {title}
                    </div>
                )}
                {badge && <div>{badge}</div>}
            </div>
            {subtitle && (
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {subtitle}
                </div>
            )}
        </div>
    );
};

const DropdownDivider = ({ className = '' }) => {
    return (
        <div className={`my-1 border-t border-zinc-100 dark:border-zinc-800 ${className}`} />
    );
};

const DropdownLink = ({
    className = '',
    icon: Icon,
    iconClassName = '',
    badge,
    description,
    variant = 'default',
    active = false,
    children,
    ...props
}) => {
    let variantStyles = 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80';

    if (variant === 'danger') {
        variantStyles = 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40';
    } else if (variant === 'primary') {
        variantStyles = 'text-[#026eff] dark:text-sky-400 hover:bg-[#026eff]/10 dark:hover:bg-[#026eff]/15';
    }

    if (active) {
        variantStyles += ' bg-zinc-100 dark:bg-zinc-800 font-medium';
    }

    return (
        <Link
            {...props}
            className={
                'group flex items-center justify-between gap-2 w-full px-2.5 py-1.5 text-start text-xs font-medium rounded-sm transition duration-150 ease-in-out focus:outline-none cursor-pointer ' +
                variantStyles +
                ' ' +
                className
            }
        >
            <div className="flex items-center gap-2 min-w-0 flex-1">
                {Icon && (
                    <Icon className={`w-3.5 h-3.5 shrink-0 opacity-75 ${iconClassName}`} />
                )}
                <div className="min-w-0 flex-1">
                    <div className="truncate leading-tight">{children}</div>
                    {description && (
                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                            {description}
                        </div>
                    )}
                </div>
            </div>
            {badge && (
                <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                    {badge}
                </span>
            )}
        </Link>
    );
};

const DropdownButton = ({
    className = '',
    icon: Icon,
    iconClassName = '',
    badge,
    description,
    variant = 'default',
    active = false,
    children,
    onClick,
    ...props
}) => {
    let variantStyles = 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80';

    if (variant === 'danger') {
        variantStyles = 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40';
    } else if (variant === 'primary') {
        variantStyles = 'text-[#026eff] dark:text-sky-400 hover:bg-[#026eff]/10 dark:hover:bg-[#026eff]/15';
    }

    if (active) {
        variantStyles += ' bg-zinc-100 dark:bg-zinc-800 font-medium';
    }

    return (
        <button
            type="button"
            onClick={onClick}
            {...props}
            className={
                'group flex items-center justify-between gap-2 w-full px-2.5 py-1.5 text-start text-xs font-medium rounded-sm transition duration-150 ease-in-out focus:outline-none cursor-pointer ' +
                variantStyles +
                ' ' +
                className
            }
        >
            <div className="flex items-center gap-2 min-w-0 flex-1">
                {Icon && (
                    <Icon className={`w-3.5 h-3.5 shrink-0 opacity-75 ${iconClassName}`} />
                )}
                <div className="min-w-0 flex-1">
                    <div className="truncate leading-tight">{children}</div>
                    {description && (
                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                            {description}
                        </div>
                    )}
                </div>
            </div>
            {badge && (
                <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                    {badge}
                </span>
            )}
        </button>
    );
};

Dropdown.Trigger = Trigger;
Dropdown.Content = Content;
Dropdown.Link = DropdownLink;
Dropdown.Button = DropdownButton;
Dropdown.Header = DropdownHeader;
Dropdown.Divider = DropdownDivider;

export default Dropdown;
