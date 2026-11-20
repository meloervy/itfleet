export default function DangerButton({
    className = '',
    disabled,
    children,
    ...props
}) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center justify-center gap-1.5 rounded-sm border border-rose-600 bg-rose-600 px-3.5 py-2 text-xs font-medium text-white transition duration-150 ease-in-out hover:bg-rose-700 hover:border-rose-700 focus:outline-none active:bg-rose-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    disabled ? 'opacity-50' : ''
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
