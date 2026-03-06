export const formatKRW = (value: number) => {
    if (isNaN(value) || !isFinite(value)) return '₩0';
    const abs = Math.floor(Math.abs(value));
    return (value < 0 ? '-₩' : '₩') + abs.toLocaleString();
};


export const convertToKRW = (value: number, currency: string, rate: number) => {
    if (isNaN(value) || !isFinite(value)) return 0;

    if (currency === 'USD') {
        if (isNaN(rate) || !isFinite(rate)) return 0;
        return value * rate;
    }

    return value;
};

/**
 * Heuristic to determine if a symbol is domestic (KRX) or overseas.
 */
export const isDomesticSymbol = (symbol: string) => {
    const s = symbol.toUpperCase();
    return s.includes('.KS') || s.includes('.KQ') || /^\d{6}/.test(s);
};
