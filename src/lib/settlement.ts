import { HistoryEntry, AssetCategory, MarketType, DEFAULT_EXCHANGE_RATE } from './types';
import { convertToKRW, isDomesticSymbol, toLocalDateStr } from './utils';

export const HISTORY_CATEGORIES: AssetCategory[] = [
    'Cash', 'Savings', 'Domestic Stock', 'Domestic Index', 'Domestic Bond',
    'Overseas Stock', 'Overseas Index', 'Overseas Bond',
];

export const INVESTMENT_CATEGORIES: AssetCategory[] = [
    'Domestic Stock', 'Domestic Index', 'Domestic Bond',
    'Overseas Stock', 'Overseas Index', 'Overseas Bond',
];

/**
 * Get the total KRW value for a specific category in a history entry.
 */
export const getCategoryValue = (entry: HistoryEntry, cat: AssetCategory, fallbackRate = DEFAULT_EXCHANGE_RATE): number => {
    const allocation = entry.allocations?.find(a => a.category === cat);
    const entryRate = entry.exchangeRate || fallbackRate;
    const allocationValue = allocation ? convertToKRW(allocation.value, allocation.currency, entryRate) : 0;

    if (cat === 'Cash') {
        if (allocationValue > 0) return allocationValue;
        const others = HISTORY_CATEGORIES.filter(c => c !== 'Cash');
        const totalOthers = others.reduce((sum, c) => sum + getCategoryValue(entry, c, entryRate), 0);
        return Math.max(0, entry.totalValue - totalOthers);
    }

    if (INVESTMENT_CATEGORIES.includes(cat)) {
        if (allocationValue > 0) return allocationValue;

        const categoryInvestments = entry.holdings?.filter((h: any) => {
            if (h.category) return h.category === cat;
            // Fallback categorization logic
            if (cat === 'Domestic Stock') return h.marketType === 'Domestic' || isDomesticSymbol(h.symbol);
            if (cat === 'Overseas Stock') return h.marketType === 'Overseas' || !isDomesticSymbol(h.symbol);
            return false;
        });

        return categoryInvestments?.reduce((sum: number, h: any) => {
            const currency = h.currency || (h.marketType === 'Domestic' ? 'KRW' : 'USD');
            const price = h.currentPrice ?? h.avgPrice;
            return sum + convertToKRW(price * h.shares, currency, entryRate);
        }, 0) || 0;
    }

    return allocationValue;
};

/**
 * Get summary metrics for a history entry: Cash (Cash+Savings), Domestic, and Overseas totals.
 */
export const getSummaryMetrics = (entry: HistoryEntry, rate = DEFAULT_EXCHANGE_RATE) => {
    const r = entry.exchangeRate || rate;
    const cash = getCategoryValue(entry, 'Cash', r) + getCategoryValue(entry, 'Savings', r);
    const domStock = getCategoryValue(entry, 'Domestic Stock', r);
    const domIndex = getCategoryValue(entry, 'Domestic Index', r);
    const domBond = getCategoryValue(entry, 'Domestic Bond', r);
    const osStock = getCategoryValue(entry, 'Overseas Stock', r);
    const osIndex = getCategoryValue(entry, 'Overseas Index', r);
    const osBond = getCategoryValue(entry, 'Overseas Bond', r);

    return {
        cash,
        domStock, domIndex, domBond,
        osStock, osIndex, osBond,
        domestic: domStock + domIndex + domBond,
        overseas: osStock + osIndex + osBond,
        total: cash + domStock + domIndex + domBond + osStock + osIndex + osBond
    };
};

/**
 * Safely parse holdings — handles both pre-parsed arrays and JSON strings.
 */
const parseHoldings = (raw: any): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
};

/**
 * Filter holdings by market type.
 */
const filterByMarketType = (holdings: any[], type: MarketType): any[] =>
    holdings.filter((h: any) =>
        h.marketType === type ||
        h.category?.startsWith(type) ||
        h.category?.includes(type)
    );

/**
 * Calculate Time-Weighted Return (TWR) multipliers for a series of history entries.
 * TWR removes the impact of external cash inflows/outflows.
 */
export const calculateTWRMultipliers = (
    allRows: HistoryEntry[],
    type: MarketType,
    fallbackRate = DEFAULT_EXCHANGE_RATE,
    transactions?: any[]
): Record<string, number> => {
    let cumReturn = 1;
    const multipliersMap: Record<string, number> = {};

    // Build sell-transaction lookup by date for accurate price at sell time
    const sellTxByDate: Record<string, any[]> = {};
    if (transactions) {
        transactions
            .filter((t: any) => t.type === 'SELL' && t.symbol && t.price)
            .forEach((t: any) => {
                if (!sellTxByDate[t.date]) sellTxByDate[t.date] = [];
                sellTxByDate[t.date].push(t);
            });
    }

    for (let i = 0; i < allRows.length; i++) {
        const today = allRows[i];
        if (i === 0) {
            multipliersMap[today.date] = 1;
            continue;
        }

        const yesterday = allRows[i - 1];
        const prevHoldings = filterByMarketType(parseHoldings(yesterday.holdings), type);
        const currHoldings = filterByMarketType(parseHoldings(today.holdings), type);

        if (prevHoldings.length === 0 && currHoldings.length === 0) {
            multipliersMap[today.date] = cumReturn;
            continue;
        }

        let prevMarketValue = 0;
        let projectedMarketValue = 0;
        const ratePrev = yesterday.exchangeRate || fallbackRate;
        const rateCurr = today.exchangeRate || fallbackRate;
        const todaySellTxs = sellTxByDate[today.date] || [];
        const defaultCurrency = type === 'Domestic' ? 'KRW' : 'USD';

        // Helper to calibrate previous price for live tracking
        const getCalibratedPrevPrice = (ph: any, ch: any) => {
            let price = ph.currentPrice || ph.avgPrice;
            if (today.isLive && ch && ch.currentPrice !== undefined) {
                const dObj = new Date(today.date + 'T00:00:00');
                const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
                if (!isWeekend) {
                    const activeChange = (ch.isOverMarket && ch.overMarketChange !== undefined) ? ch.overMarketChange : ch.change;
                    if (activeChange !== undefined) {
                        price = ch.currentPrice - activeChange;
                    }
                }
            }
            return price;
        };

        // Price each previous holding at today's price (or sell price if sold today)
        prevHoldings.forEach((ph: any) => {
            const ch = currHoldings.find((h: any) => h.symbol === ph.symbol);
            const pPrice = getCalibratedPrevPrice(ph, ch);
            const currency = ph.currency || defaultCurrency;

            prevMarketValue += convertToKRW(pPrice * ph.shares, currency, ratePrev);

            let cPrice: number;
            if (ch) {
                cPrice = ch.currentPrice || ch.avgPrice;
            } else {
                const sellTx = todaySellTxs.find((t: any) =>
                    t.symbol?.toUpperCase().trim() === ph.symbol?.toUpperCase().trim()
                );
                cPrice = sellTx ? sellTx.price : pPrice;
            }
            projectedMarketValue += convertToKRW(cPrice * ph.shares, currency, rateCurr);
        });

        // Account for new positions opened today (adjust for cash flow neutrality)
        currHoldings.forEach((ch: any) => {
            const ph = prevHoldings.find((h: any) => h.symbol === ch.symbol);
            const prevShares = ph ? ph.shares : 0;

            if (ch.shares > prevShares) {
                const newShares = ch.shares - prevShares;
                const cPrice = ch.currentPrice || ch.avgPrice;
                const currency = ch.currency || defaultCurrency;

                const prevCost = ph ? ph.shares * ph.avgPrice : 0;
                const currCost = ch.shares * ch.avgPrice;
                const costOfNewShares = currCost - prevCost;

                // Add new cost to previous value (neutral to TWR)
                prevMarketValue += convertToKRW(costOfNewShares, currency, rateCurr);
                projectedMarketValue += convertToKRW(newShares * cPrice, currency, rateCurr);
            }
        });

        const dayReturn = prevMarketValue > 0 ? (projectedMarketValue / prevMarketValue) : 1;
        cumReturn *= dayReturn;
        multipliersMap[today.date] = cumReturn;
    }
    return multipliersMap;
};

/**
 * Sync overseas returns with their actual trading session dates.
 * US markets close late KST (the following morning).
 * For example, Monday US trading finishes on Tuesday morning KST.
 * This function shifts the multiplier from the capture date back to the session date.
 */
export const syncOverseasReturn = (date: string, multipliers: Record<string, number>): number => {
    let val = multipliers[date] || 1;
    const dObj = new Date(date + 'T00:00:00');
    
    // US trading days: Mon(23rd) close = Tue(24th) KST morning.
    // If the next day's data point exists and it's a Tue-Sat morning KST,
    // that data point contains the return for Mon-Fri US sessions.
    const dates = Object.keys(multipliers).sort();
    const idx = dates.indexOf(date);
    if (idx !== -1 && idx < dates.length - 1) {
        const nextDate = dates[idx + 1];
        const nObj = new Date(nextDate + 'T00:00:00');
        const nextDayKST = nObj.getDay(); // 0: Sun, 1: Mon... 2: Tue (Fri US close=Sat KST=6)

        // Mon-Fri US Close => Tue-Sat KST mornings (days 2, 3, 4, 5, 6)
        if (nextDayKST >= 2 && nextDayKST <= 6) {
            val = multipliers[nextDate];
        }
    }
    return val;
};

// Compatibility Alias
export const syncOverseasFriday = syncOverseasReturn;
