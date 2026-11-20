export default function PrimaryButton({
    className = '',
    disabled,
    children,
    ...props
}) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center justify-center gap-1.5 rounded-sm border border-[#026eff] bg-[#026eff] px-3.5 py-2 text-xs font-medium text-white transition duration-150 ease-in-out hover:bg-[#0258d1] hover:border-[#0258d1] focus:outline-none active:bg-[#024eb8] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    disabled ? 'opacity-50' : ''
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
