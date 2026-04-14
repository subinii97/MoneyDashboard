// ── Number / Currency ────────────────────────────────────────────────────────

export const formatKRW = (value: number): string => {
    if (isNaN(value) || !isFinite(value)) return '₩0';
    const abs = Math.floor(Math.abs(value));
    return (value < 0 ? '-₩' : '₩') + abs.toLocaleString();
};

export const formatUSD = (value: number): string => {
    if (isNaN(value) || !isFinite(value)) return '$0.00';
    const sign = value < 0 ? '-' : '';
    return sign + '$' + Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatPrice = (value: number, currency: string = 'KRW'): string => {
    if (currency === 'USD') return formatUSD(value);
    return formatKRW(value);
};

export const convertToKRW = (value: number, currency: string, rate: number): number => {
    if (isNaN(value) || !isFinite(value)) return 0;
    if (currency === 'USD') {
        if (isNaN(rate) || !isFinite(rate)) return 0;
        return value * rate;
    }
    return value;
};

export const formatPercent = (value: number, fractionDigits = 2): string => {
    if (isNaN(value) || !isFinite(value)) return '0.00%';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(fractionDigits)}%`;
};

export const formatChange = (value: number): string => {
    if (isNaN(value) || !isFinite(value)) return '₩0';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${formatKRW(value)}`;
};

// ── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Returns "YYYY-MM-DD" for a given Date (in local timezone).
 */
export const toLocalDateStr = (d: Date = new Date()): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/**
 * Returns the date string for N days before the given date.
 */
export const daysAgo = (n: number, from: Date = new Date()): string => {
    const d = new Date(from);
    d.setDate(d.getDate() - n);
    return toLocalDateStr(d);
};

// ── Symbol classification ────────────────────────────────────────────────────

/**
 * Heuristic: determine if a symbol is domestic (KRX) or overseas.
 */
export const isDomesticSymbol = (symbol: string): boolean => {
    const s = symbol.toUpperCase();
    return s.includes('.KS') || s.includes('.KQ') || /^\d{6}/.test(s);
};
