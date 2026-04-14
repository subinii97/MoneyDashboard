import { useState, useEffect, useMemo, useRef } from 'react';
import { HistoryEntry, DailySettlement, WeeklySettlement, MonthlySettlement, INVESTMENT_CATEGORIES } from '@/lib/types';
import { processHistoryData } from '@/lib/settlement-processor';
import { toLocalDateStr } from '@/lib/utils';

const recalcAllocations = (a: any[], h: any[], r: number) => a.map(al => {
    if (!INVESTMENT_CATEGORIES.includes(al.category)) return al;
    const v = h.filter(x => x.category === al.category).reduce((s, x) => {
        const val = (x.currentPrice || x.avgPrice) * x.shares;
        return s + (x.currency === 'USD' ? val * r : val);
    }, 0);
    return { ...al, value: v / (al.currency === 'USD' ? r : 1) };
});

/**
 * 오늘로부터 N일 전 날짜 문자열 (YYYY-MM-DD) 반환
 */
function daysBeforeToday(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toLocalDateStr(d);
}

export function useHistoryData() {
    // 전체 히스토리 캐시 (초기 1회 full-load 후 보관)
    const historyCache = useRef<Map<string, HistoryEntry>>(new Map());
    const initialLoaded = useRef(false);

    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState(1350);

    /** 최신 실시간 주가를 반영한 오늘 entry를 업데이트 */
    const applyLivePrice = async (entry: HistoryEntry, liveEntry: any): Promise<HistoryEntry> => {
        if (!liveEntry?.success || !liveEntry.entry) return entry;
        const live = liveEntry.entry;
        if (!live.isLive || !live.holdings?.length) return live;

        const symbols = [...new Set(live.holdings.map((h: any) => h.symbol))].join(',');
        try {
            const pRes = await fetch(`/api/stock?symbols=${symbols}&t=${Date.now()}`);
            const pData = await pRes.json();
            if (pData.exchangeRate) {
                const r = pData.exchangeRate.rate || pData.exchangeRate;
                live.exchangeRate = r;
            }
            if (pData.results) {
                live.holdings = live.holdings.map((h: any) => {
                    const i = pData.results.find((r: any) => r.symbol.trim().toUpperCase() === h.symbol.trim().toUpperCase());
                    if (i) {
                        const pr = (i.isOverMarket && i.overMarketPrice !== undefined) ? i.overMarketPrice : i.price;
                        return { ...h, currentPrice: pr, change: i.change, isOverMarket: i.isOverMarket, overMarketPrice: i.overMarketPrice, overMarketSession: i.overMarketSession };
                    }
                    return h;
                });
                if (live.allocations) live.allocations = recalcAllocations(live.allocations, live.holdings, live.exchangeRate);
                live.totalValue = live.holdings.reduce((s: number, h: any) =>
                    s + (h.currentPrice || h.avgPrice) * h.shares * (h.currency === 'USD' ? live.exchangeRate : 1), 0)
                    + (live.allocations || []).filter((a: any) => !INVESTMENT_CATEGORIES.includes(a.category))
                        .reduce((s: number, a: any) => s + (a.currency === 'USD' ? a.value * live.exchangeRate : a.value), 0);
            }
        } catch (e) { console.error(e); }
        return live;
    };

    /** 첫 로드: 전체 히스토리 + 거래내역 한 번에 fetch */
    const initialLoad = async () => {
        try {
            const [hRes, lRes, tRes] = await Promise.all([
                fetch('/api/snapshot?includeHoldings=true'),
                fetch('/api/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auto: true }) }),
                fetch('/api/transactions')
            ]);
            const rawHistory: HistoryEntry[] = await hRes.json();
            const liveEntry = await lRes.json();
            const txs = await tRes.json();

            setTransactions(Array.isArray(txs) ? txs : []);

            // 전체 히스토리를 캐시에 저장
            const map = new Map<string, HistoryEntry>();
            rawHistory.forEach(e => map.set(e.date, e));

            // 오늘 live 데이터 merge
            if (liveEntry?.success && liveEntry.entry) {
                const enriched = await applyLivePrice(liveEntry.entry, liveEntry);
                if (enriched.exchangeRate) setRate(enriched.exchangeRate);
                map.set(enriched.date, enriched);
            }

            historyCache.current = map;
            initialLoaded.current = true;

            const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
            setHistory(sorted);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * 인터벌 업데이트: 오늘 + 어제만 fresh fetch (2일 이전은 이미 확정)
     * - "2일 이전"은 정산 완료 데이터이므로 다시 불러올 필요 없음
     */
    const incrementalUpdate = async () => {
        const cutoff = daysBeforeToday(2); // 이 날짜보다 오래된 건 캐시 사용
        try {
            const lRes = await fetch('/api/snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto: true })
            });
            const liveEntry = await lRes.json();

            if (liveEntry?.success && liveEntry.entry) {
                const enriched = await applyLivePrice(liveEntry.entry, liveEntry);
                if (enriched.exchangeRate) setRate(enriched.exchangeRate);

                const map = historyCache.current;
                map.set(enriched.date, enriched);

                const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
                setHistory(sorted);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        initialLoad();
        // 첫 로드 이후 5초마다 최신 2일치만 업데이트
        const i = setInterval(() => {
            if (initialLoaded.current) incrementalUpdate();
        }, 5000);
        return () => clearInterval(i);
    }, []);

    const { daily, weekly, monthly, grouped } = useMemo(
        () => processHistoryData(history, transactions, rate),
        [history, transactions, rate]
    );

    return {
        dailySettlements: daily,
        dailyGroupedByMonth: grouped,
        weeklySettlements: weekly,
        monthlySettlements: monthly,
        loading,
        rate,
        history,
        transactions,
        setHistory,
        refreshTransactions: async () => {
            const r = await fetch('/api/transactions?t=' + Date.now());
            if (r.ok) setTransactions(await r.json());
        },
        deleteHistoryEntry: async (date: string) => {
            if (confirm(`${date} 삭제?`)) {
                const r = await fetch('/api/snapshot', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date })
                });
                if (r.ok) {
                    historyCache.current.delete(date);
                    setHistory(prev => prev.filter(h => h.date !== date));
                }
            }
        }
    };
}
