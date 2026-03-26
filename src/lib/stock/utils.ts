/**
 * Common utilities for parsing stock data from various sources.
 */

export const extractNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const text = String(val).replace(/,/g, '').trim();
    const match = text.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (!match) return 0;

    const valString = match[0];
    const num = parseFloat(valString);

    if (valString.length >= 2 && !valString.includes('.') && valString.length % 2 === 0) {
        const half = valString.length / 2;
        if (valString.substring(0, half) === valString.substring(half)) return parseFloat(valString.substring(0, half));
    }
    return num;
};

export const parseTradingValue = (val: any): number => {
    if (!val) return 0;
    const text = String(val).replace(/,/g, '');
    let num = extractNumber(text);
    if (text.includes('백만')) num *= 1_000_000;
    else if (text.includes('억')) num *= 100_000_000;
    return num;
};

export const formatYmd = (ymd: string): string => {
    if (!ymd || ymd.length < 8) return ymd;
    return `${ymd.substring(0, 4)}-${ymd.substring(4, 6)}-${ymd.substring(6, 8)}`;
};

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
export const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1';
