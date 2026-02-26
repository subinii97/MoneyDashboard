import { useState, useEffect, useMemo } from 'react';
import { HistoryEntry, AssetCategory } from '@/lib/types';
import { getCategoryValue } from '@/lib/settlement';
import { convertToKRW } from '@/lib/utils';

export interface DailySettlement extends HistoryEntry {
    change: number;
    changePercent: number;
    metrics: {
        cash: { current: number; change: number; percent: number };
        domStock: { current: number; change: number; percent: number };
        domIndex: { current: number; change: number; percent: number };
        domBond: { current: number; change: number; percent: number };
        osStock: { current: number; change: number; percent: number };
        osIndex: { current: number; change: number; percent: number };
        osBond: { current: number; change: number; percent: number };
        domestic: { current: number; change: number; percent: number };
        overseas: { current: number; change: number; percent: number };
    };
}

export interface WeeklySettlement {
    period: string;
    value: number;
    change: number;
    changePercent: number;
    metrics: {
        cash: { current: number; change: number; percent: number };
        domStock: { current: number; change: number; percent: number };
        domIndex: { current: number; change: number; percent: number };
        domBond: { current: number; change: number; percent: number };
        osStock: { current: number; change: number; percent: number };
        osIndex: { current: number; change: number; percent: number };
        osBond: { current: number; change: number; percent: number };
        domestic: { current: number; change: number; percent: number };
        overseas: { current: number; change: number; percent: number };
    };
}

export interface MonthlySettlement {
    month: string;
    value: number;
    cashSavings: number;
    domestic: number;
    overseas: number;
    change: number;
    changePercent: number;
    metrics: {
        cash: number;
        domStock: number;
        domIndex: number;
        domBond: number;
        osStock: number;
        osIndex: number;
        osBond: number;
    };
    isManual?: boolean;
}

export function useHistoryData() {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState(1350);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [historyRes, stockRes] = await Promise.all([
                    fetch('/api/snapshot?includeHoldings=true'),
                    fetch('/api/stock?symbols=AAPL'),
                ]);
                const historyData = await historyRes.json();
                const stockData = await stockRes.json();

                setHistory(Array.isArray(historyData) ? historyData : []);
                if (stockData.exchangeRate) {
                    const r = typeof stockData.exchangeRate === 'object' ? stockData.exchangeRate.rate : stockData.exchangeRate;
                    setRate(r);
                }
            } catch (err) {
                console.error('Failed to fetch initial data', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const getFullMetrics = (e: HistoryEntry, r: number) => {
        const cash = getCategoryValue(e, 'Cash', r) + getCategoryValue(e, 'Savings', r);
        const domStock = getCategoryValue(e, 'Domestic Stock', r);
        const domIndex = getCategoryValue(e, 'Domestic Index', r);
        const domBond = getCategoryValue(e, 'Domestic Bond', r);
        const osStock = getCategoryValue(e, 'Overseas Stock', r);
        const osIndex = getCategoryValue(e, 'Overseas Index', r);
        const osBond = getCategoryValue(e, 'Overseas Bond', r);

        const getHoldings = (cat: AssetCategory) => {
            return e.holdings?.filter((h: any) => {
                if (h.category) return h.category === cat;
                if (cat === 'Domestic Stock') return h.marketType === 'Domestic' || h.symbol.includes('.KS') || h.symbol.includes('.KQ') || /^\d{6}/.test(h.symbol);
                if (cat === 'Overseas Stock') return h.marketType === 'Overseas' || (!h.symbol.includes('.KS') && !h.symbol.includes('.KQ') && !/^\d{6}/.test(h.symbol));
                return false;
            }) || [];
        };

        return {
            cash, domStock, domIndex, domBond, osStock, osIndex, osBond,
            holdingsMap: {
                domStock: getHoldings('Domestic Stock'),
                domIndex: getHoldings('Domestic Index'),
                domBond: getHoldings('Domestic Bond'),
                osStock: getHoldings('Overseas Stock'),
                osIndex: getHoldings('Overseas Index'),
                osBond: getHoldings('Overseas Bond')
            }
        };
    };

    const calcMarketChange = (currM: any, prevM: any, key: string, type: 'Domestic' | 'Overseas', currentRate: number) => {
        const currTotal = currM[key] as number;
        if (!prevM) return { current: currTotal, change: 0, percent: 0 };

        const prevTotal = prevM[key] as number;
        const prevHoldings = prevM.holdingsMap[key] || [];
        const currHoldings = currM.holdingsMap[key] || [];

        if (prevTotal <= 0 && currTotal <= 0) {
            return { current: 0, change: 0, percent: 0 };
        }

        let projectedValue = 0;
        prevHoldings.forEach((ph: any) => {
            const ch = currHoldings.find((h: any) => h.symbol === ph.symbol);
            const cPrice = ch ? (ch.currentPrice || ch.avgPrice) : (ph.currentPrice || ph.avgPrice);
            const cValKRW = convertToKRW(cPrice * ph.shares, ph.currency || (type === 'Domestic' ? 'KRW' : 'USD'), currentRate);
            projectedValue += cValKRW;
        });

        let change = projectedValue - prevTotal;

        // Add profit of new shares bought today
        currHoldings.forEach((ch: any) => {
            const ph = prevHoldings.find((h: any) => h.symbol === ch.symbol);
            const prevShares = ph ? ph.shares : 0;

            if (ch.shares > prevShares) {
                const newShares = ch.shares - prevShares;
                const cPrice = ch.currentPrice || ch.avgPrice;
                const currency = ch.currency || (type === 'Domestic' ? 'KRW' : 'USD');

                const prevCost = ph ? ph.shares * ph.avgPrice : 0;
                const currCost = ch.shares * ch.avgPrice;
                const costOfNewShares = currCost - prevCost;

                const costOfNewSharesKRW = convertToKRW(costOfNewShares, currency, currentRate);
                const currentValueOfNewSharesKRW = convertToKRW(newShares * cPrice, currency, currentRate);

                change += (currentValueOfNewSharesKRW - costOfNewSharesKRW);
            }
        });

        const percent = prevTotal > 0 ? (change / prevTotal) * 100 : 0;

        return { current: currTotal, change, percent };
    };

    const dailySettlements = useMemo((): DailySettlement[] => {
        const filtered = history.filter(entry => entry.holdings && entry.holdings.length > 0);
        return filtered.map((entry, index, arr) => {
            const prevEntry = index > 0 ? arr[index - 1] : null;
            const r = entry.exchangeRate || rate;
            const currM = getFullMetrics(entry, r);
            const prevM = prevEntry ? getFullMetrics(prevEntry, prevEntry.exchangeRate || rate) : null;

            const domStockRes = calcMarketChange(currM, prevM, 'domStock', 'Domestic', r);
            const domIndexRes = calcMarketChange(currM, prevM, 'domIndex', 'Domestic', r);
            const domBondRes = calcMarketChange(currM, prevM, 'domBond', 'Domestic', r);
            const osStockRes = calcMarketChange(currM, prevM, 'osStock', 'Overseas', r);
            const osIndexRes = calcMarketChange(currM, prevM, 'osIndex', 'Overseas', r);
            const osBondRes = calcMarketChange(currM, prevM, 'osBond', 'Overseas', r);

            const domTotal = domStockRes.current + domIndexRes.current + domBondRes.current;
            const prevDomTotal = prevM ? prevM.domStock + prevM.domIndex + prevM.domBond : 0;
            const domChange = domStockRes.change + domIndexRes.change + domBondRes.change;

            const osTotal = osStockRes.current + osIndexRes.current + osBondRes.current;
            const prevOsTotal = prevM ? prevM.osStock + prevM.osIndex + prevM.osBond : 0;
            const osChange = osStockRes.change + osIndexRes.change + osBondRes.change;

            const ds: DailySettlement = {
                ...entry,
                change: 0,
                changePercent: 0,
                metrics: {
                    cash: {
                        current: currM.cash,
                        change: prevM ? currM.cash - prevM.cash : 0,
                        percent: (prevM && prevM.cash > 0) ? ((currM.cash - prevM.cash) / prevM.cash) * 100 : 0
                    },
                    domStock: domStockRes,
                    domIndex: domIndexRes,
                    domBond: domBondRes,
                    osStock: osStockRes,
                    osIndex: osIndexRes,
                    osBond: osBondRes,
                    domestic: {
                        current: domTotal,
                        change: domChange,
                        percent: prevDomTotal > 0 ? (domChange / prevDomTotal) * 100 : 0
                    },
                    overseas: {
                        current: osTotal,
                        change: osChange,
                        percent: prevOsTotal > 0 ? (osChange / prevOsTotal) * 100 : 0
                    }
                }
            };

            ds.change = prevEntry ? entry.totalValue - prevEntry.totalValue : 0;
            ds.changePercent = (prevEntry && prevEntry.totalValue > 0) ? (ds.change / prevEntry.totalValue) * 100 : 0;

            return ds;
        }).reverse();
    }, [history, rate]);

    const dailyGroupedByMonth = useMemo(() => {
        const grouped: Record<string, DailySettlement[]> = {};
        dailySettlements.forEach(d => {
            const month = d.date.substring(0, 7);
            if (!grouped[month]) grouped[month] = [];
            grouped[month].push(d);
        });
        return grouped;
    }, [dailySettlements]);

    const weeklySettlements = useMemo((): WeeklySettlement[] => {
        const settlements: WeeklySettlement[] = [];
        if (history.length > 0) {
            const grouped: Record<string, HistoryEntry> = {};
            history.forEach(entry => {
                const d = new Date(entry.date);
                const day = d.getDay();
                if (day >= 1 && day <= 6) {
                    const startOfWeek = new Date(d);
                    startOfWeek.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
                    const endOfWeek = new Date(startOfWeek);
                    endOfWeek.setDate(startOfWeek.getDate() + 5);
                    const key = `${endOfWeek.toISOString().substring(0, 10)}`;
                    if (!grouped[key] || entry.date > grouped[key].date) grouped[key] = entry;
                }
            });

            const keys = Object.keys(grouped).sort();
            keys.forEach((key, index) => {
                const entry = grouped[key];
                const prev = index > 0 ? grouped[keys[index - 1]] : null;
                const r = entry.exchangeRate || rate;
                const currM = getFullMetrics(entry, r);
                const prevM = prev ? getFullMetrics(prev, prev.exchangeRate || rate) : null;

                const domStockRes = calcMarketChange(currM, prevM, 'domStock', 'Domestic', r);
                const domIndexRes = calcMarketChange(currM, prevM, 'domIndex', 'Domestic', r);
                const domBondRes = calcMarketChange(currM, prevM, 'domBond', 'Domestic', r);
                const osStockRes = calcMarketChange(currM, prevM, 'osStock', 'Overseas', r);
                const osIndexRes = calcMarketChange(currM, prevM, 'osIndex', 'Overseas', r);
                const osBondRes = calcMarketChange(currM, prevM, 'osBond', 'Overseas', r);

                const domTotal = currM.domStock + currM.domIndex + currM.domBond;
                const prevDomTotal = prevM ? prevM.domStock + prevM.domIndex + prevM.domBond : 0;
                const domChange = domStockRes.change + domIndexRes.change + domBondRes.change;

                const osTotal = currM.osStock + currM.osIndex + currM.osBond;
                const prevOsTotal = prevM ? prevM.osStock + prevM.osIndex + prevM.osBond : 0;
                const osChange = osStockRes.change + osIndexRes.change + osBondRes.change;

                settlements.push({
                    period: `${new Date(new Date(key).setDate(new Date(key).getDate() - 5)).toISOString().substring(2, 10)} ~ ${key.substring(2)}`,
                    value: entry.totalValue,
                    change: prev ? entry.totalValue - prev.totalValue : 0,
                    changePercent: (prev && prev.totalValue > 0) ? ((entry.totalValue - prev.totalValue) / prev.totalValue) * 100 : 0,
                    metrics: {
                        cash: { current: currM.cash, change: prevM ? currM.cash - prevM.cash : 0, percent: 0 },
                        domStock: domStockRes,
                        domIndex: domIndexRes,
                        domBond: domBondRes,
                        osStock: osStockRes,
                        osIndex: osIndexRes,
                        osBond: osBondRes,
                        domestic: { current: domTotal, change: domChange, percent: prevDomTotal > 0 ? (domChange / prevDomTotal) * 100 : 0 },
                        overseas: { current: osTotal, change: osChange, percent: prevOsTotal > 0 ? (osChange / prevOsTotal) * 100 : 0 }
                    }
                });
            });
            settlements.reverse();
        }
        return settlements;
    }, [history, rate]);

    const monthlySettlements = useMemo((): MonthlySettlement[] => {
        const map: Record<string, HistoryEntry> = {};
        history.forEach(entry => {
            const m = entry.date.substring(0, 7);
            if (!map[m] || entry.date >= map[m].date) map[m] = entry;
        });

        const keys = Object.keys(map).sort();
        return keys.map((m, index) => {
            const entry = map[m];
            const prev = index > 0 ? map[keys[index - 1]] : null;
            const r = entry.exchangeRate || rate;
            const currM = getFullMetrics(entry, r);

            return {
                month: m,
                value: entry.totalValue,
                cashSavings: currM.cash,
                domestic: currM.domStock + currM.domIndex + currM.domBond,
                overseas: currM.osStock + currM.osIndex + currM.osBond,
                change: prev ? entry.totalValue - prev.totalValue : 0,
                changePercent: (prev && prev.totalValue > 0) ? ((entry.totalValue - prev.totalValue) / prev.totalValue) * 100 : 0,
                metrics: {
                    cash: currM.cash,
                    domStock: currM.domStock,
                    domIndex: currM.domIndex,
                    domBond: currM.domBond,
                    osStock: currM.osStock,
                    osIndex: currM.osIndex,
                    osBond: currM.osBond,
                },
                isManual: !entry.holdings || entry.holdings.length === 0
            };
        }).reverse();
    }, [history, rate]);

    return {
        dailySettlements,
        dailyGroupedByMonth,
        weeklySettlements,
        monthlySettlements,
        loading,
        rate,
        setHistory
    };
}
