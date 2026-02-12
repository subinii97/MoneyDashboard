import { useState, useEffect, useMemo } from 'react';
import { HistoryEntry, AssetCategory } from '@/lib/types';
import { getCategoryValue } from '@/lib/settlement';

interface DailySettlement extends HistoryEntry {
    change: number;
    changePercent: number;
    metrics: {
        cash: { current: number, change: number, percent: number };
        domestic: { current: number, change: number, percent: number };
        overseas: { current: number, change: number, percent: number };
    };
}

interface WeeklySettlement {
    period: string;
    value: number;
    change: number;
    changePercent: number;
}

interface MonthlySettlement {
    month: string;
    value: number;
    cashSavings: number;
    domestic: number;
    overseas: number;
    change: number;
    changePercent: number;
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

                setHistory(historyData);
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

    const dailySettlements = useMemo((): DailySettlement[] => {
        return history
            .filter(entry => entry.holdings && entry.holdings.length > 0)
            .map((entry, index, arr) => {
                const prevEntry = index > 0 ? arr[index - 1] : null;

                const getMetrics = (e: HistoryEntry) => {
                    const cash = getCategoryValue(e, 'Cash', rate) + getCategoryValue(e, 'Savings', rate);
                    const domestic = getCategoryValue(e, 'Domestic Stock', rate) + getCategoryValue(e, 'Domestic Index', rate) + getCategoryValue(e, 'Domestic Bond', rate);
                    const overseas = getCategoryValue(e, 'Overseas Stock', rate) + getCategoryValue(e, 'Overseas Index', rate) + getCategoryValue(e, 'Overseas Bond', rate);
                    return { cash, domestic, overseas };
                };

                const currM = getMetrics(entry);
                const prevM = prevEntry ? getMetrics(prevEntry) : { cash: 0, domestic: 0, overseas: 0 };

                const calcChange = (cur: number, prev: number) => ({
                    current: cur,
                    change: prev > 0 ? cur - prev : 0,
                    percent: prev > 0 ? ((cur - prev) / prev) * 100 : 0
                });

                const change = prevEntry ? entry.totalValue - prevEntry.totalValue : 0;
                const changePercent = prevEntry && prevEntry.totalValue !== 0 ? (change / prevEntry.totalValue) * 100 : 0;

                return {
                    ...entry,
                    change,
                    changePercent,
                    metrics: {
                        cash: calcChange(currM.cash, prevM.cash),
                        domestic: calcChange(currM.domestic, prevM.domestic),
                        overseas: calcChange(currM.overseas, prevM.overseas)
                    }
                };
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

            const weekKeys = Object.keys(grouped).sort();
            weekKeys.forEach((key, index) => {
                const entry = grouped[key];
                const prevWeek = index > 0 ? grouped[weekKeys[index - 1]] : null;
                const change = prevWeek ? entry.totalValue - prevWeek.totalValue : 0;
                const changePercent = prevWeek && prevWeek.totalValue !== 0 ? (change / prevWeek.totalValue) * 100 : 0;

                const d = new Date(key);
                const startStr = new Date(d.setDate(d.getDate() - 5)).toISOString().substring(2, 10);
                settlements.push({
                    period: `${startStr} ~ ${key.substring(2)}`,
                    value: entry.totalValue,
                    change,
                    changePercent
                });
            });
            settlements.reverse();
        }
        return settlements;
    }, [history]);

    const monthlyMap = useMemo(() => {
        const map: Record<string, MonthlySettlement & { lastDate: string }> = {};
        history.forEach(entry => {
            const month = entry.date.substring(0, 7);
            if (!map[month] || entry.date >= map[month].lastDate) {
                const cashSavings = getCategoryValue(entry, 'Cash', rate) + getCategoryValue(entry, 'Savings', rate);
                const domestic = getCategoryValue(entry, 'Domestic Stock', rate) + getCategoryValue(entry, 'Domestic Index', rate) + getCategoryValue(entry, 'Domestic Bond', rate);
                const overseas = getCategoryValue(entry, 'Overseas Stock', rate) + getCategoryValue(entry, 'Overseas Index', rate) + getCategoryValue(entry, 'Overseas Bond', rate);

                map[month] = {
                    month,
                    value: entry.totalValue,
                    cashSavings,
                    domestic,
                    overseas,
                    change: 0,
                    changePercent: 0,
                    lastDate: entry.date,
                    isManual: !entry.holdings || entry.holdings.length === 0
                };
            }
        });
        return map;
    }, [history, rate]);

    const monthlySettlements = useMemo((): MonthlySettlement[] => {
        const monthKeys = Object.keys(monthlyMap).sort();
        return monthKeys.map((month, index) => {
            const entry = monthlyMap[month];
            const prevMonth = index > 0 ? monthKeys[index - 1] : null;
            const prevEntry = prevMonth ? monthlyMap[prevMonth] : null;
            const change = prevEntry ? entry.value - prevEntry.value : 0;
            const changePercent = prevEntry && prevEntry.value !== 0 ? (change / prevEntry.value) * 100 : 0;
            return { ...entry, change, changePercent };
        }).reverse();
    }, [monthlyMap]);

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
