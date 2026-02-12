import { HistoryEntry, AssetCategory } from './types';
import { convertToKRW } from './utils';

export const HISTORY_CATEGORIES: AssetCategory[] = [
    'Cash', 'Savings', 'Domestic Stock', 'Domestic Index', 'Domestic Bond',
    'Overseas Stock', 'Overseas Index', 'Overseas Bond',
];

/**
 * Get the total KRW value for a specific category in a history entry.
 */
export const getCategoryValue = (entry: HistoryEntry, cat: AssetCategory, fallbackRate = 1350): number => {
    const allocation = entry.allocations?.find(a => a.category === cat);
    const entryRate = entry.exchangeRate || fallbackRate;
    const allocationValue = allocation ? convertToKRW(allocation.value, allocation.currency, entryRate) : 0;

    if (cat === 'Cash') {
        if (allocationValue > 0) return allocationValue;
        const others = HISTORY_CATEGORIES.filter(c => c !== 'Cash');
        const totalOthers = others.reduce((sum, c) => sum + getCategoryValue(entry, c, entryRate), 0);
        return Math.max(0, entry.totalValue - totalOthers);
    }

    if (['Domestic Stock', 'Overseas Stock', 'Domestic Index', 'Overseas Index', 'Domestic Bond', 'Overseas Bond'].includes(cat)) {
        if (allocationValue > 0) return allocationValue;

        const categoryInvestments = entry.holdings?.filter((h: any) => {
            if (h.category) return h.category === cat;
            if (cat === 'Domestic Stock') return h.marketType === 'Domestic' || h.symbol.includes('.KS') || h.symbol.includes('.KQ') || /^\d{6}/.test(h.symbol);
            if (cat === 'Overseas Stock') return h.marketType === 'Overseas' || (!h.symbol.includes('.KS') && !h.symbol.includes('.KQ') && !/^\d{6}/.test(h.symbol));
            return false;
        });

        return categoryInvestments?.reduce((sum: number, h: any) =>
            sum + convertToKRW((h.currentPrice || h.avgPrice) * h.shares, h.currency || (h.marketType === 'Domestic' ? 'KRW' : 'USD'), entryRate), 0) || 0;
    }

    return allocationValue;
};

/**
 * Calculate Time-Weighted Return (TWR) multipliers for a series of history entries.
 * TWR removes the impact of cash inflows/outflows.
 */
export const calculateTWRMultipliers = (allRows: HistoryEntry[], type: 'Domestic' | 'Overseas', fallbackRate = 1350) => {
    let cumReturn = 1;
    const multipliersMap: Record<string, number> = {};

    for (let i = 0; i < allRows.length; i++) {
        const today = allRows[i];
        if (i === 0) {
            multipliersMap[today.date] = 1;
            continue;
        }

        const yesterday = allRows[i - 1];
        const prevHoldings = (yesterday.holdings ? JSON.parse(typeof yesterday.holdings === 'string' ? yesterday.holdings : JSON.stringify(yesterday.holdings)) : [])
            .filter((h: any) => h.marketType === type || h.category?.startsWith(type) || h.category?.includes(type));

        const currHoldings = (today.holdings ? JSON.parse(typeof today.holdings === 'string' ? today.holdings : JSON.stringify(today.holdings)) : []);

        if (prevHoldings.length === 0) {
            multipliersMap[today.date] = cumReturn;
            continue;
        }

        let prevMarketValue = 0;
        let projectedMarketValue = 0;
        const ratePrev = yesterday.exchangeRate || fallbackRate;
        const rateCurr = today.exchangeRate || fallbackRate;

        prevHoldings.forEach((ph: any) => {
            const pPrice = ph.currentPrice || ph.avgPrice;
            const pVal = pPrice * ph.shares;
            const pValKRW = convertToKRW(pVal, ph.currency || (type === 'Domestic' ? 'KRW' : 'USD'), ratePrev);
            prevMarketValue += pValKRW;

            const ch = currHoldings.find((h: any) => h.symbol === ph.symbol);
            const cPrice = ch ? (ch.currentPrice || ch.avgPrice) : pPrice;
            const cVal = cPrice * ph.shares;
            const cValKRW = convertToKRW(cVal, ph.currency || (type === 'Domestic' ? 'KRW' : 'USD'), rateCurr);
            projectedMarketValue += cValKRW;
        });

        const dayReturn = prevMarketValue > 0 ? (projectedMarketValue / prevMarketValue) : 1;
        cumReturn *= dayReturn;
        multipliersMap[today.date] = cumReturn;
    }
    return multipliersMap;
};

/**
 * Sync Friday overseas returns with Saturday morning data point for US markets.
 */
export const syncOverseasFriday = (date: string, multipliers: Record<string, number>) => {
    let val = multipliers[date] || 1;
    const dObj = new Date(date + 'T00:00:00');
    if (dObj.getDay() === 5) { // Friday
        const sat = new Date(dObj);
        sat.setDate(sat.getDate() + 1);
        const satStr = sat.toISOString().substring(0, 10);
        if (multipliers[satStr] !== undefined) {
            val = multipliers[satStr];
        }
    }
    return val;
};
