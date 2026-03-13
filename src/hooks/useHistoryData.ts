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
import { getCategoryValue, calculateTWRMultipliers, getSummaryMetrics } from '@/lib/settlement';
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
                                            return {
                                                ...h,
                                                currentPrice: activePrice,
                                                marketStatus: info.marketStatus,
                                                isOverMarket: info.isOverMarket,
                                                overMarketPrice: info.overMarketPrice,
                                                overMarketSession: info.overMarketSession
                                            };
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

    const twrDom = useMemo(() => calculateTWRMultipliers(history, 'Domestic', rate, transactions), [history, rate, transactions]);
    const twrOs = useMemo(() => calculateTWRMultipliers(history, 'Overseas', rate, transactions), [history, rate, transactions]);

    const dailySettlements = useMemo((): DailySettlement[] => {
        const filtered = history.filter(entry => entry.holdings && entry.holdings.length > 0);

        return filtered.map((entry, index, arr) => {
            const prevEntry = index > 0 ? arr[index - 1] : null;
            const r = entry.exchangeRate || rate;
            const currM = getSummaryMetrics(entry, r);
            const prevM = prevEntry ? getSummaryMetrics(prevEntry, prevEntry.exchangeRate || rate) : null;

            // TWR: 당일 수익률 = 누적 배수 비율 - 1
            const prevTwrDomMult = prevEntry ? (twrDom[prevEntry.date] ?? 1) : 1;
            const currTwrDomMult = twrDom[entry.date] ?? 1;
            const domDayReturn = prevTwrDomMult > 0 ? currTwrDomMult / prevTwrDomMult - 1 : 0;

            const prevTwrOsMult = prevEntry ? (twrOs[prevEntry.date] ?? 1) : 1;
            const currTwrOsMult = twrOs[entry.date] ?? 1;
            const osDayReturn = prevTwrOsMult > 0 ? currTwrOsMult / prevTwrOsMult - 1 : 0;

            const domChange = (prevM?.domestic || 0) * domDayReturn;
            const osChange = (prevM?.overseas || 0) * osDayReturn;

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
                    domStock: { current: currM.domStock, change: 0, percent: 0 }, // Individual market changes are now simplified
                    domIndex: { current: currM.domIndex, change: 0, percent: 0 },
                    domBond: { current: currM.domBond, change: 0, percent: 0 },
                    osStock: { current: currM.osStock, change: 0, percent: 0 },
                    osIndex: { current: currM.osIndex, change: 0, percent: 0 },
                    osBond: { current: currM.osBond, change: 0, percent: 0 },
                    domestic: { current: currM.domestic, change: domChange, percent: domDayReturn * 100 },
                    overseas: { current: currM.overseas, change: osChange, percent: osDayReturn * 100 }
                }
            };

            ds.change = prevEntry ? (entry.totalValue - prevEntry.totalValue) : 0;
            ds.changePercent = (prevEntry && prevEntry.totalValue > 0) ? (ds.change / prevEntry.totalValue) * 100 : 0;

            return ds;
        }).reverse();
    }, [history, rate, twrDom, twrOs]);

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
            const filtered = history.filter(e => e.holdings && e.holdings.length > 0);

            // 주별 TWR: 일별과 동일한 누적 배수 맵 재사용
            // const twrDom = calculateTWRMultipliers(filtered, 'Domestic', rate); // Removed, using outer twrDom
            // const twrOs = calculateTWRMultipliers(filtered, 'Overseas', rate); // Removed, using outer twrOs

            const symbolMap: Record<string, string> = {};
            history.forEach(h => {
                if (h.holdings) {
                    h.holdings.forEach(inv => {
                        if (inv.symbol && inv.name && !symbolMap[inv.symbol]) {
                            symbolMap[inv.symbol] = inv.name;
                        }
                    });
                }
            });

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
                const currM = getSummaryMetrics(entry, r);
                const prevM = prev ? getSummaryMetrics(prev, prev.exchangeRate || rate) : null;

                // 주간 TWR = 이번 주 말 누적 배수 / 지난 주 말 누적 배수 - 1
                const prevTwrDomMult = prev ? (twrDom[prev.date] ?? 1) : 1;
                const currTwrDomMult = twrDom[entry.date] ?? 1;
                const weekDomReturn = prevTwrDomMult > 0 ? currTwrDomMult / prevTwrDomMult - 1 : 0;

                const prevTwrOsMult = prev ? (twrOs[prev.date] ?? 1) : 1;
                const currTwrOsMult = twrOs[entry.date] ?? 1;
                const weekOsReturn = prevTwrOsMult > 0 ? currTwrOsMult / prevTwrOsMult - 1 : 0;

                const domChange = (prevM?.domestic || 0) * weekDomReturn;
                const osChange = (prevM?.overseas || 0) * weekOsReturn;

                const startDate = new Date(new Date(key).setDate(new Date(key).getDate() - 5)).toISOString().substring(0, 10);
                const endDate = key;
                const weeklyTx = transactions.filter((t: any) => t.date >= startDate && t.date <= endDate).map(t => ({
                    ...t,
                    name: t.symbol ? symbolMap[t.symbol] : undefined
                }));

                settlements.push({
                    period: `${startDate.substring(2)} ~ ${endDate.substring(2)}`,
                    startDate,
                    endDate,
                    transactions: weeklyTx,
                    value: entry.totalValue,
                    change: prev ? entry.totalValue - prev.totalValue : 0,
                    changePercent: (prev && prev.totalValue > 0) ? ((entry.totalValue - prev.totalValue) / prev.totalValue) * 100 : 0,
                    metrics: {
                        cash: { current: currM.cash, change: prevM ? currM.cash - prevM.cash : 0, percent: 0 },
                        domStock: { current: currM.domStock, change: 0, percent: 0 },
                        domIndex: { current: currM.domIndex, change: 0, percent: 0 },
                        domBond: { current: currM.domBond, change: 0, percent: 0 },
                        osStock: { current: currM.osStock, change: 0, percent: 0 },
                        osIndex: { current: currM.osIndex, change: 0, percent: 0 },
                        osBond: { current: currM.osBond, change: 0, percent: 0 },
                        domestic: { current: currM.domestic, change: domChange, percent: weekDomReturn * 100 },
                        overseas: { current: currM.overseas, change: osChange, percent: weekOsReturn * 100 }
                    }
                });
            });
            settlements.reverse();
        }
        return settlements;
    }, [history, rate, twrDom, twrOs, transactions]);

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
            const currM = getSummaryMetrics(entry, r);
            const prevM = prev ? getSummaryMetrics(prev, prev.exchangeRate || rate) : null;

            // 월간 TWR = 이번 달 말 누적 배수 / 지난 달 말 누적 배수 - 1
            const prevTwrDomMult = prev ? (twrDom[prev.date] ?? 1) : 1;
            const currTwrDomMult = twrDom[entry.date] ?? 1;
            const monDomReturn = prevTwrDomMult > 0 ? currTwrDomMult / prevTwrDomMult - 1 : 0;

            const prevTwrOsMult = prev ? (twrOs[prev.date] ?? 1) : 1;
            const currTwrOsMult = twrOs[entry.date] ?? 1;
            const monOsReturn = prevTwrOsMult > 0 ? currTwrOsMult / prevTwrOsMult - 1 : 0;

            const domChange = (prevM?.domestic || 0) * monDomReturn;
            const osChange = (prevM?.overseas || 0) * monOsReturn;

            return {
                month: m,
                value: entry.totalValue,
                change: prev ? entry.totalValue - prev.totalValue : 0,
                changePercent: (prev && prev.totalValue > 0) ? ((entry.totalValue - prev.totalValue) / prev.totalValue) * 100 : 0,
                metrics: {
                    cash: { current: currM.cash, change: prevM ? currM.cash - prevM.cash : 0, percent: 0 },
                    domStock: { current: currM.domStock, change: 0, percent: 0 },
                    domIndex: { current: currM.domIndex, change: 0, percent: 0 },
                    domBond: { current: currM.domBond, change: 0, percent: 0 },
                    osStock: { current: currM.osStock, change: 0, percent: 0 },
                    osIndex: { current: currM.osIndex, change: 0, percent: 0 },
                    osBond: { current: currM.osBond, change: 0, percent: 0 },
                    domestic: { current: currM.domestic, change: domChange, percent: monDomReturn * 100 },
                    overseas: { current: currM.overseas, change: osChange, percent: monOsReturn * 100 }
                },
                isManual: !entry.holdings || entry.holdings.length === 0
            };
        }).reverse();
    }, [history, rate, twrDom, twrOs]);

    const refreshTransactions = async () => {
        try {
            const txRes = await fetch('/api/transactions?t=' + Date.now());
            if (txRes.ok) {
                const txData = await txRes.json();
                setTransactions(Array.isArray(txData) ? txData : []);
            }
        } catch (e) {
            console.error('Failed to refetch transactions', e);
        }
    };

    return {
        dailySettlements,
        dailyGroupedByMonth,
        weeklySettlements,
        monthlySettlements,
        loading,
        rate,
        setHistory,
        refreshTransactions
    };
}
