/**
 * Format an ISO timestamp or YYYY-MM-DD date string safely without timezone shifts.
 */
export function formatDisplayDate(value, fallback = '—') {
    if (!value) {
        return fallback;
    }

    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    const date = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

/**
 * Normalize an ISO timestamp or date string into YYYY-MM-DD for HTML date inputs.
 */
export function toDateInputValue(value) {
    if (!value) {
        return '';
    }

    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);

    return match ? match[1] : '';
}

/**
 * Format Philippine Peso currency amounts consistently.
 */
export function formatPhp(amount, fallback = '—') {
    if (amount === null || amount === undefined || amount === '') {
        return fallback;
    }

    const numeric = Number(amount);
    if (Number.isNaN(numeric)) {
        return fallback;
    }

    return `₱${numeric.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/**
 * Format signed day countdown into a concise human-readable label.
 */
export function formatRelativeDays(days) {
    if (days === null || days === undefined) {
        return null;
    }

    const n = Number(days);
    if (Number.isNaN(n)) {
        return null;
    }

    if (n === 0) {
        return 'Due today';
    }

    if (n > 0) {
        return n === 1 ? '1 day left' : `${n} days left`;
    }

    const overdue = Math.abs(n);

    return overdue === 1 ? '1d overdue' : `${overdue}d overdue`;
}
