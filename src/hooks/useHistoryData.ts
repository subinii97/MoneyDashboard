import { useState, useEffect, useMemo } from 'react';
import { HistoryEntry, DailySettlement, WeeklySettlement, MonthlySettlement, INVESTMENT_CATEGORIES } from '@/lib/types';
import { processHistoryData } from '@/lib/settlement-processor';

const recalcAllocations = (a: any[], h: any[], r: number) => a.map(al => {
    if (!INVESTMENT_CATEGORIES.includes(al.category)) return al;
    const v = h.filter(x => x.category === al.category).reduce((s, x) => {
        const val = (x.currentPrice || x.avgPrice) * x.shares;
        return s + (x.currency === 'USD' ? val * r : val);
    }, 0);
    return { ...al, value: v / (al.currency === 'USD' ? r : 1) };
});

export function useHistoryData() {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState(1350);

    const fetchData = async () => {
        try {
            const [hRes, lRes, tRes] = await Promise.all([fetch('/api/snapshot?includeHoldings=true'), fetch('/api/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auto: true }) }), fetch('/api/transactions')]);
            let finalH = await hRes.json(), live = await lRes.json(), txs = await tRes.json();
            setTransactions(Array.isArray(txs) ? txs : []);
            if (live?.success && live.entry) {
                const entry = live.entry; if (!live.isSettled) entry.isLive = true;
                if (entry.isLive && entry.holdings?.length > 0) {
                    const symbols = [...new Set(entry.holdings.map((h: any) => h.symbol))].join(',');
                    try {
                        const pRes = await fetch(`/api/stock?symbols=${symbols}&t=${Date.now()}`);
                        const pData = await pRes.json();
                        if (pData.exchangeRate) { const r = pData.exchangeRate.rate || pData.exchangeRate; setRate(r); entry.exchangeRate = r; }
                        if (pData.results) {
                            entry.holdings = entry.holdings.map((h: any) => {
                                const i = pData.results.find((r: any) => r.symbol.trim().toUpperCase() === h.symbol.trim().toUpperCase());
                                if (i) { const pr = (i.isOverMarket && i.overMarketPrice !== undefined) ? i.overMarketPrice : i.price; return { ...h, currentPrice: pr, change: i.change, isOverMarket: i.isOverMarket, overMarketPrice: i.overMarketPrice, overMarketSession: i.overMarketSession }; }
                                return h;
                            });
                            if (entry.allocations) entry.allocations = recalcAllocations(entry.allocations, entry.holdings, entry.exchangeRate);
                            entry.totalValue = entry.holdings.reduce((s: number, h: any) => s + (h.currentPrice || h.avgPrice) * h.shares * (h.currency === 'USD' ? entry.exchangeRate : 1), 0) + (entry.allocations || []).filter((a: any) => !INVESTMENT_CATEGORIES.includes(a.category)).reduce((s: number, a: any) => s + (a.currency === 'USD' ? a.value * entry.exchangeRate : a.value), 0);
                        }
                    } catch (e) { console.error(e); }
                }
                const idx = finalH.findIndex((e: any) => e.date === entry.date); if (idx >= 0) finalH[idx] = entry; else finalH.push(entry);
            }
            setHistory(finalH.sort((a: HistoryEntry, b: HistoryEntry) => a.date.localeCompare(b.date)));
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); const i = setInterval(fetchData, 60000); return () => clearInterval(i); }, []);

    const { daily, weekly, monthly, grouped } = useMemo(() => processHistoryData(history, transactions, rate), [history, transactions, rate]);

    return {
        dailySettlements: daily, dailyGroupedByMonth: grouped, weeklySettlements: weekly, monthlySettlements: monthly,
        loading, rate, history, transactions, setHistory, 
        refreshTransactions: async () => { const r = await fetch('/api/transactions?t=' + Date.now()); if (r.ok) setTransactions(await r.json()); },
        deleteHistoryEntry: async (date: string) => { if (confirm(`${date} 삭제?`)) { const r = await fetch('/api/snapshot', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date }) }); if (r.ok) setHistory(p => p.filter(h => h.date !== date)); } }
    };
}
