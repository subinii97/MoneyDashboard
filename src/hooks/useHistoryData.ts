import { useState, useEffect, useMemo } from 'react';
import {
    HistoryEntry,
    AssetCategory,
    DailySettlement,
    WeeklySettlement,
    MonthlySettlement,
    FullSettlementMetrics,
    SettlementMetric,
} from '@/lib/types';
import { getCategoryValue } from '@/lib/settlement';
import { convertToKRW } from '@/lib/utils';

export type { DailySettlement, WeeklySettlement, MonthlySettlement };

export function useHistoryData() {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState(1350);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch history + trigger live snapshot + transactions
                const [historyRes, liveRes, txRes] = await Promise.all([
                    fetch('/api/snapshot?includeHoldings=true'),
                    fetch('/api/snapshot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ auto: true })
                    }).catch(() => null),
                    fetch('/api/transactions').catch(() => null)
                ]);
                const historyData = await historyRes.json();
                let liveData = null;
                if (liveRes && liveRes.ok) {
                    try {
                        liveData = await liveRes.json();
                    } catch (e) { }
                }

                let txData = [];
                if (txRes && txRes.ok) {
                    try {
                        txData = await txRes.json();
                    } catch (e) { }
                }
                setTransactions(Array.isArray(txData) ? txData : []);

                let finalHistory = Array.isArray(historyData) ? historyData : [];

                if (liveData && liveData.success && liveData.entry) {
                    const entry = liveData.entry;
                    if (!liveData.isSettled) {
                        entry.isLive = true;
                    }

                    // 2. Fetch real-time prices from /api/stock (same source as investment page)
                    //    and apply them to the live entry's holdings for consistency
                    if (entry.isLive && entry.holdings && entry.holdings.length > 0) {
                        const symbols = [...new Set(entry.holdings.map((h: any) => h.symbol))].join(',');
                        try {
                            const priceRes = await fetch(`/api/stock?symbols=${symbols}&t=${Date.now()}`, { cache: 'no-store' });
                            const priceData = await priceRes.json();

                            if (priceData.exchangeRate) {
                                const r = typeof priceData.exchangeRate === 'object' ? priceData.exchangeRate.rate : priceData.exchangeRate;
                                setRate(r);
                                entry.exchangeRate = r;
                            }

                            if (priceData.results) {
                                entry.holdings = entry.holdings.map((h: any) => {
                                    const info = priceData.results.find((r: any) =>
                                        r.symbol.trim().toUpperCase() === h.symbol.trim().toUpperCase()
                                    );
                                    if (info) {
                                        const activePrice = (info.isOverMarket && info.overMarketPrice !== undefined) ? info.overMarketPrice : info.price;
                                        if (activePrice) {
                                            return { ...h, currentPrice: activePrice };
                                        }
                                    }
                                    return h;
                                });

                                // Recalculate totalValue with updated prices
                                const invValue = entry.holdings.reduce((acc: number, h: any) => {
                                    const val = (h.currentPrice || h.avgPrice) * h.shares;
                                    return acc + (h.currency === 'USD' ? val * entry.exchangeRate : val);
                                }, 0);

                                // Add non-investment allocation values
                                const nonInvValue = (entry.allocations || [])
                                    .filter((a: any) => !['Domestic Stock', 'Overseas Stock', 'Domestic Index', 'Overseas Index', 'Domestic Bond', 'Overseas Bond'].includes(a.category))
                                    .reduce((acc: number, a: any) => acc + (a.currency === 'USD' ? a.value * entry.exchangeRate : a.value), 0);

                                // 3. Sync entry.allocations so tables show updated values
                                if (entry.allocations) {
                                    entry.allocations = entry.allocations.map((alc: any) => {
                                        const isInvCat = ['Domestic Stock', 'Overseas Stock', 'Domestic Index', 'Overseas Index', 'Domestic Bond', 'Overseas Bond'].includes(alc.category);
                                        if (isInvCat) {
                                            const categoryValue = entry.holdings
                                                .filter((h: any) => h.category === alc.category)
                                                .reduce((sum: number, h: any) => {
                                                    const val = (h.currentPrice || h.avgPrice) * h.shares;
                                                    return sum + (h.currency === 'USD' ? val * entry.exchangeRate : val);
                                                }, 0);
                                            return { ...alc, value: categoryValue / (alc.currency === 'USD' ? entry.exchangeRate : 1) };
                                        }
                                        return alc;
                                    });
                                }

                                entry.totalValue = invValue + nonInvValue;
                            }
                        } catch (e) {
                            console.error('Failed to sync live prices', e);
                        }
                    }

                    const existingIndex = finalHistory.findIndex((e: any) => e.date === entry.date);
                    if (existingIndex >= 0) {
                        finalHistory[existingIndex] = entry;
                    } else {
                        finalHistory.push(entry);
                    }
                }
                finalHistory.sort((a, b) => a.date.localeCompare(b.date));

                setHistory(finalHistory);
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

    const calcMarketChange = (currM: any, prevM: any, key: string) => {
        const currTotal = currM[key] as number;
        if (!prevM) return { current: currTotal, change: 0, percent: 0 };
        return { current: currTotal, change: 0, percent: 0 }; // Calculated globally via cash-flow instead
    };

    const dailySettlements = useMemo((): DailySettlement[] => {
        const filtered = history.filter(entry => entry.holdings && entry.holdings.length > 0);
        return filtered.map((entry, index, arr) => {
            const prevEntry = index > 0 ? arr[index - 1] : null;
            const r = entry.exchangeRate || rate;
            const currM = getFullMetrics(entry, r);
            const prevM = prevEntry ? getFullMetrics(prevEntry, prevEntry.exchangeRate || rate) : null;

            const domStockRes = calcMarketChange(currM, prevM, 'domStock');
            const domIndexRes = calcMarketChange(currM, prevM, 'domIndex');
            const domBondRes = calcMarketChange(currM, prevM, 'domBond');
            const osStockRes = calcMarketChange(currM, prevM, 'osStock');
            const osIndexRes = calcMarketChange(currM, prevM, 'osIndex');
            const osBondRes = calcMarketChange(currM, prevM, 'osBond');

            const domTotal = domStockRes.current + domIndexRes.current + domBondRes.current;
            const prevDomTotal = prevM ? prevM.domStock + prevM.domIndex + prevM.domBond : 0;

            const osTotal = osStockRes.current + osIndexRes.current + osBondRes.current;
            const prevOsTotal = prevM ? prevM.osStock + prevM.osIndex + prevM.osBond : 0;

            // Compute precise Dom/Os change using Net Cash Flow
            // Net Additions = BUYS - SELLS
            let domNetAdditions = 0;
            let osNetAdditions = 0;

            const dailyTxs = transactions.filter(t => t.date === entry.date && (t.type === 'BUY' || t.type === 'SELL'));
            dailyTxs.forEach(t => {
                const isDom = t.symbol?.includes('.KS') || t.symbol?.includes('.KQ') || /^\d{6}/.test(t.symbol) || t.currency === 'KRW';
                const txValueKRW = convertToKRW(t.amount || (t.price * t.shares), t.currency || (isDom ? 'KRW' : 'USD'), r);

                if (t.type === 'BUY') {
                    if (isDom) domNetAdditions += txValueKRW;
                    else osNetAdditions += txValueKRW;
                } else if (t.type === 'SELL') {
                    if (isDom) domNetAdditions -= txValueKRW;
                    else osNetAdditions -= txValueKRW;
                }
            });

            // True Market Profit = Ending - Starting - NetAdditions
            const domChange = prevM ? (domTotal - prevDomTotal - domNetAdditions) : 0;
            const osChange = prevM ? (osTotal - prevOsTotal - osNetAdditions) : 0;

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

            // Main change is now the sum of market performance (excluding capital flow)
            ds.change = ds.metrics.domestic.change + ds.metrics.overseas.change;
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

                const domStockRes = calcMarketChange(currM, prevM, 'domStock');
                const domIndexRes = calcMarketChange(currM, prevM, 'domIndex');
                const domBondRes = calcMarketChange(currM, prevM, 'domBond');
                const osStockRes = calcMarketChange(currM, prevM, 'osStock');
                const osIndexRes = calcMarketChange(currM, prevM, 'osIndex');
                const osBondRes = calcMarketChange(currM, prevM, 'osBond');

                const domTotal = currM.domStock + currM.domIndex + currM.domBond;
                const prevDomTotal = prevM ? prevM.domStock + prevM.domIndex + prevM.domBond : 0;

                const osTotal = currM.osStock + currM.osIndex + currM.osBond;
                const prevOsTotal = prevM ? prevM.osStock + prevM.osIndex + prevM.osBond : 0;

                // Compute precise Dom/Os change using Net Cash Flow over the week
                let domNetAdditions = 0;
                let osNetAdditions = 0;

                const startDate = prev ? prev.date : '2000-01-01';
                const endDate = key; // usually entry.date but we use 'key' which is the closest Friday that was settled

                const weekTxs = transactions.filter(t => t.date > startDate && t.date <= entry.date && (t.type === 'BUY' || t.type === 'SELL'));
                weekTxs.forEach(t => {
                    const isDom = t.symbol?.includes('.KS') || t.symbol?.includes('.KQ') || /^\d{6}/.test(t.symbol) || t.currency === 'KRW';
                    const txValueKRW = convertToKRW(t.amount || (t.price * t.shares), t.currency || (isDom ? 'KRW' : 'USD'), r);

                    if (t.type === 'BUY') {
                        if (isDom) domNetAdditions += txValueKRW;
                        else osNetAdditions += txValueKRW;
                    } else if (t.type === 'SELL') {
                        if (isDom) domNetAdditions -= txValueKRW;
                        else osNetAdditions -= txValueKRW;
                    }
                });

                const domChange = prevM ? (domTotal - prevDomTotal - domNetAdditions) : 0;
                const osChange = prevM ? (osTotal - prevOsTotal - osNetAdditions) : 0;

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
