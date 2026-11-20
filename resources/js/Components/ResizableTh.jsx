import {
    RiArrowUpDownLine,
    RiArrowUpLine,
    RiArrowDownLine,
} from 'react-icons/ri';

export default function ResizableTh({
    colKey,
    width,
    onResizeStart,
    onAutoExpand,
    className = '',
    align = 'left',
    isResizing = false,
    resizable = true,
    sortable = false,
    sortKey,
    currentSort,
    sortDirection = 'asc',
    onSort,
    children,
}) {
    const isSortable = sortable || Boolean(onSort);
    const activeSortKey = sortKey || colKey;
    const isActiveSort = isSortable && currentSort === activeSortKey;

    const handleSortClick = (e) => {
        if (isSortable && onSort) {
            onSort(activeSortKey);
        }
    };

    return (
        <th
            style={{ width: `${width}px`, minWidth: `${width}px` }}
            className={`py-2.5 px-4 relative select-none font-medium uppercase tracking-wider text-[11px] whitespace-nowrap text-zinc-500 dark:text-zinc-400 group ${
                align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
            } ${isResizing ? 'bg-[#026eff]/5 dark:bg-[#026eff]/15' : ''} ${className}`}
        >
            <div
                onClick={handleSortClick}
                className={`inline-flex items-center gap-1.5 ${
                    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
                } whitespace-nowrap ${isSortable ? 'cursor-pointer' : ''}`}
                title={isSortable ? `Sort by ${typeof children === 'string' ? children : activeSortKey}` : undefined}
            >
                <span className={`whitespace-nowrap transition-colors ${
                    isActiveSort
                        ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                        : 'group-hover:text-zinc-900 dark:group-hover:text-zinc-100'
                }`}>
                    {children}
                </span>
                {isSortable && (
                    <span className="inline-flex items-center shrink-0 transition-colors">
                        {isActiveSort ? (
                            sortDirection === 'desc' ? (
                                <RiArrowDownLine className="w-3.5 h-3.5 text-[#026eff] dark:text-sky-400" />
                            ) : (
                                <RiArrowUpLine className="w-3.5 h-3.5 text-[#026eff] dark:text-sky-400" />
                            )
                        ) : (
                            <RiArrowUpDownLine className="w-3 h-3 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                    </span>
                )}
            </div>

            {resizable && (
                <div
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        onResizeStart(colKey, e);
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        onAutoExpand && onAutoExpand(colKey);
                    }}
                    title="Drag to resize column • Double-click to expand"
                    className={`absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize flex items-center justify-center transition-colors z-20 ${
                        isResizing ? 'bg-[#026eff]/15' : 'hover:bg-[#026eff]/10'
                    }`}
                >
                    <div
                        className={`w-px rounded-sm transition-all ${
                            isResizing
                                ? 'bg-[#026eff] h-full'
                                : 'h-3.5 bg-zinc-200 dark:bg-zinc-700 opacity-0 group-hover:opacity-100 group-hover:bg-zinc-400 dark:group-hover:bg-zinc-500'
                        }`}
                    />
                </div>
            )}
        </th>
    );
}
