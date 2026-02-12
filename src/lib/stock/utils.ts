/**
 * Common utilities for parsing stock data from various sources.
 */

export const extractNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const text = String(val);
    const cleaned = text.replace(/,/g, '').trim();
    const match = cleaned.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (!match) return 0;

    const valString = match[0];

    // Naver Double Fix: if the string is like "65006500" or "4.114.11"
    if (valString.length >= 2 && valString.indexOf('.') === -1 && valString.length % 2 === 0) {
        const half = valString.length / 2;
        const firstHalf = valString.substring(0, half);
        const secondHalf = valString.substring(half);
        if (firstHalf === secondHalf) {
            return parseFloat(firstHalf);
        }
    }
    return parseFloat(valString);
};

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
export const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1';
