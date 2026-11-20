export default function Checkbox({ className = '', ...props }) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'h-4 w-4 rounded-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[#026eff] focus:outline-none focus:ring-0 focus:ring-offset-0 cursor-pointer ' +
                className
            }
        />
    );
}
