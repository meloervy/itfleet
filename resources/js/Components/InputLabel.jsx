export default function InputLabel({
    value,
    className = '',
    required = false,
    children,
    ...props
}) {
    return (
        <label
            {...props}
            className={
                `block text-xs font-medium text-zinc-700 dark:text-zinc-300 ` +
                className
            }
        >
            {value ? value : children}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
    );
}
