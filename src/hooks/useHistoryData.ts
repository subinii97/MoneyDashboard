import { useState, useEffect, useMemo } from 'react';
import {
    HistoryEntry,
    AssetCategory,
    DailySettlement,
    WeeklySettlement,
    MonthlySettlement,
    FullSettlementMetrics,
} from '@/lib/types';
import { getCategoryValue, calculateTWRMultipliers, getSummaryMetrics, syncOverseasFriday } from '@/lib/settlement';
import { convertToKRW } from '@/lib/utils';

// ── Local helpers ─────────────────────────────────────────────────────────────

/** Recalculate investment-category allocations from updated holdings prices. */
function recalcAllocations(
    allocations: any[],
    holdings: any[],
    exchangeRate: number
): any[] {
    const INVESTMENT_CATS: AssetCategory[] = [
        'Domestic Stock', 'Overseas Stock',
        'Domestic Index', 'Overseas Index',
        'Domestic Bond', 'Overseas Bond',
    ];
    return allocations.map((alc: any) => {
        if (!INVESTMENT_CATS.includes(alc.category)) return alc;
        const categoryValue = holdings
            .filter((h: any) => h.category === alc.category)
            .reduce((sum: number, h: any) => {
                const val = (h.currentPrice || h.avgPrice) * h.shares;
                return sum + (h.currency === 'USD' ? val * exchangeRate : val);
            }, 0);
        return { ...alc, value: categoryValue / (alc.currency === 'USD' ? exchangeRate : 1) };
    });
}


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
                                                change: info.change,
                                                changePercent: info.changePercent,
                                                marketStatus: info.marketStatus,
                                                isOverMarket: info.isOverMarket,
                                                overMarketPrice: info.overMarketPrice,
                                                overMarketChange: info.overMarketChange,
                                                overMarketChangePercent: info.overMarketChangePercent,
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
                                    .filter((a: any) => ![
                                        'Domestic Stock', 'Overseas Stock',
                                        'Domestic Index', 'Overseas Index',
                                        'Domestic Bond', 'Overseas Bond',
                                    ].includes(a.category))
                                    .reduce((acc: number, a: any) =>
                                        acc + (a.currency === 'USD' ? a.value * entry.exchangeRate : a.value), 0);

                                // Sync allocations to reflect updated holding prices
                                if (entry.allocations) {
                                    entry.allocations = recalcAllocations(
                                        entry.allocations,
                                        entry.holdings,
                                        entry.exchangeRate
                                    );
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
            const r = entry.exchangeRate || rate;
            let currM = getSummaryMetrics(entry, r);
            let dsTotalValue = entry.totalValue;

            const dObj = new Date(entry.date + 'T00:00:00');
            const isFri = dObj.getDay() === 5;
            const isSat = dObj.getDay() === 6;
            const isSun = dObj.getDay() === 0;

            let fridayOsPercentOverride: number | null = null;

            // Lookahead: If Friday, borrow Saturday's overseas value if it exists
            if (isFri && index > 0) {
                const lookaheadEntry = index < arr.length - 1 ? arr[index + 1] : null;
                if (lookaheadEntry && new Date(lookaheadEntry.date + 'T00:00:00').getDay() === 6) {
                    const satM = getSummaryMetrics(lookaheadEntry, lookaheadEntry.exchangeRate || rate);
                    const diff = satM.overseas - currM.overseas;
                    currM.overseas = satM.overseas;
                    dsTotalValue += diff;

                    // Attempt to calculate pure api-based market variation (-7%) from live entry or lookahead
                    let osMarketLoss = 0; let osMarketCurrent = 0;
                    
                    // If we are looking at the most recent Friday (index is within 3 days of the end)
                    // and there is a live entry, its API 'change' fields hold the exact Friday close data!
                    const liveEntry = arr.find(e => e.isLive);
                    const sourceEntry = (liveEntry && index >= arr.length - 3) ? liveEntry : lookaheadEntry;

                    if (sourceEntry && sourceEntry.holdings) {
                        let parsedH = Array.isArray(sourceEntry.holdings) ? sourceEntry.holdings : [];
                        if (typeof sourceEntry.holdings === 'string') {
                            try { parsedH = JSON.parse(sourceEntry.holdings); } catch(e) {}
                        }
                        parsedH.forEach((h: any) => {
                            if (h.marketType === 'Overseas' || (h.category && h.category.startsWith('Overseas')) || (!h.marketType && h.symbol && !h.symbol.match(/^[0-9]+$/))) {
                                const activeChange = (h.isOverMarket && h.overMarketChange !== undefined) ? h.overMarketChange : (h.change || 0);
                                const activePrice = (h.isOverMarket && h.overMarketPrice !== undefined) ? h.overMarketPrice : (h.currentPrice || h.avgPrice);
                                osMarketLoss += convertToKRW(activeChange * h.shares, h.currency || 'USD', sourceEntry.exchangeRate || rate);
                                osMarketCurrent += convertToKRW(activePrice * h.shares, h.currency || 'USD', sourceEntry.exchangeRate || rate);
                            }
                        });
                    }
                    if (osMarketLoss !== 0) {
                        fridayOsPercentOverride = (osMarketCurrent - osMarketLoss) > 0 ? (osMarketLoss / (osMarketCurrent - osMarketLoss)) * 100 : 0;
                    }
                }
            }

            const prevEntry = index > 0 ? arr[index - 1] : null;
            let prevM = prevEntry ? getSummaryMetrics(prevEntry, prevEntry.exchangeRate || rate) : null;
            let prevTotalValue = prevEntry ? prevEntry.totalValue : 0;

            if (prevEntry) {
                const pObj = new Date(prevEntry.date + 'T00:00:00');
                if (pObj.getDay() === 5) {
                    const satLookahead = index <= arr.length - 1 ? arr[index] : null;
                    if (satLookahead && new Date(satLookahead.date + 'T00:00:00').getDay() === 6) {
                        const satM = getSummaryMetrics(satLookahead, satLookahead.exchangeRate || rate);
                        if (prevM) {
                            const diff = satM.overseas - prevM.overseas;
                            prevM.overseas = satM.overseas;
                            prevTotalValue += diff;
                        }
                    }
                }
            }

            const prevTwrDomMult = prevEntry ? (twrDom[prevEntry.date] ?? 1) : 1;
            const currTwrDomMult = twrDom[entry.date] ?? 1;
            const domDayReturn = prevTwrDomMult > 0 ? currTwrDomMult / prevTwrDomMult - 1 : 0;

            const prevTwrOsMult = prevEntry ? syncOverseasFriday(prevEntry.date, twrOs) : 1;
            const currTwrOsMult = syncOverseasFriday(entry.date, twrOs);
            const osDayReturn = prevTwrOsMult > 0 ? currTwrOsMult / prevTwrOsMult - 1 : 0;

            const domChange = prevM ? currM.domestic - prevM.domestic : 0;
            const osChange = prevM ? currM.overseas - prevM.overseas : 0;

            const isWeekend = isSat || isSun;

            let finalOsPercent = isWeekend ? 0 : (prevM && prevM.overseas > 0 ? (osChange / prevM.overseas) * 100 : 0);
            let finalDomPercent = isWeekend ? 0 : (prevM && prevM.domestic > 0 ? (domChange / prevM.domestic) * 100 : 0);

            if (isFri && fridayOsPercentOverride !== null) {
                finalOsPercent = fridayOsPercentOverride;
            }

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
                    domStock: { current: currM.domStock, change: 0, percent: 0 },
                    domIndex: { current: currM.domIndex, change: 0, percent: 0 },
                    domBond: { current: currM.domBond, change: 0, percent: 0 },
                    osStock: { current: currM.osStock, change: 0, percent: 0 },
                    osIndex: { current: currM.osIndex, change: 0, percent: 0 },
                    osBond: { current: currM.osBond, change: 0, percent: 0 },
                    domestic: { current: currM.domestic, change: domChange, percent: finalDomPercent },
                    overseas: { current: currM.overseas, change: osChange, percent: finalOsPercent }
                }
            };

            ds.change = prevEntry ? (dsTotalValue - prevTotalValue) : 0;
            ds.changePercent = (prevEntry && prevTotalValue > 0) ? (ds.change / prevTotalValue) * 100 : 0;
            ds.totalValue = dsTotalValue;

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

                const prevTwrOsMult = prev ? syncOverseasFriday(prev.date, twrOs) : 1;
                const currTwrOsMult = syncOverseasFriday(entry.date, twrOs);
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

            const prevTwrOsMult = prev ? syncOverseasFriday(prev.date, twrOs) : 1;
            const currTwrOsMult = syncOverseasFriday(entry.date, twrOs);
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
