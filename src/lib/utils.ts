export const formatKRW = (value: number) => {
    if (isNaN(value) || !isFinite(value)) return '₩0';
    return '₩' + Math.floor(value).toLocaleString();
};

export const convertToKRW = (value: number, currency: string, rate: number) => {
    if (isNaN(value) || !isFinite(value)) return 0;

    if (currency === 'USD') {
        if (isNaN(rate) || !isFinite(rate)) return 0;
        return value * rate;
    }

    return value;
};
