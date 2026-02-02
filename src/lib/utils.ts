export const formatKRW = (value: number) => {
    return '₩' + Math.floor(value).toLocaleString();
};

export const convertToKRW = (value: number, currency: string, rate: number) => {
    if (currency === 'USD') return value * rate;
    return value;
};
