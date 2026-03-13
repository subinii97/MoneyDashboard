import { useState, useEffect, useCallback, useRef } from 'react';
import { Assets, Investment, HistoryEntry } from '@/lib/types';
import { mapInvestmentWithPrice, extractExchangeRate } from '@/lib/assets';

export function useAssets(paused = false) {
    const pausedRef = useRef(paused);
    const fetchingRef = useRef(false);
    useEffect(() => { pausedRef.current = paused; }, [paused]);
    const [assets, setAssets] = useState<Assets>({ investments: [], allocations: [] });
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState<number>(1350);
    const [rateTime, setRateTime] = useState<string>('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const fetchData = useCallback(async (force = false) => {
        if (fetchingRef.current) return; // 이전 요청 진행 중이면 스킵
        fetchingRef.current = true;
        setIsRefreshing(true);
        try {
            const timestamp = Date.now();
            const [assetRes, historyRes] = await Promise.all([
                fetch(`/api/assets?t=${timestamp}`, { cache: 'no-store' }),
                fetch(`/api/snapshot?includeHoldings=true&t=${timestamp}`, { cache: 'no-store' })
            ]);

            const assetData = await assetRes.json();
            const historyData = await historyRes.json();
            setHistory(historyData);

            const investmentsRaw = assetData.investments || assetData.stocks || [];
            const symbols = Array.from(new Set(investmentsRaw.map((s: Investment) => s.symbol))).join(',');

            if (symbols) {
                try {
                    const priceRes = await fetch(`/api/stock?symbols=${symbols}&t=${timestamp}${force ? '&refresh=true' : ''}`, { cache: 'no-store' });
                    const priceData = await priceRes.json();

                    const { rate: newRate, time: newRateTime } = extractExchangeRate(priceData);
                    setRate(newRate);
                    setRateTime(newRateTime);

                    const updatedInvestments = investmentsRaw.map((inv: Investment) => mapInvestmentWithPrice(inv, priceData));
                    setAssets({ investments: updatedInvestments, allocations: assetData.allocations || assetData.others || [] });
                } catch (e) {
                    console.error('Failed to fetch stock prices', e);
                    // 가격 조회 실패 시에도 기존 자산 데이터는 반영
                    setAssets({ investments: investmentsRaw, allocations: assetData.allocations || assetData.others || [] });
                }
            } else {
                setAssets({ investments: investmentsRaw, allocations: assetData.allocations || assetData.others || [] });
            }

            // Auto-snapshot
            fetch('/api/snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto: true })
            }).catch(() => { });

            setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
        } catch (e) {
            console.error('Failed to fetch data', e);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            fetchingRef.current = false;
        }
    }, []);

    useEffect(() => {
        fetchData(true);
        const interval = setInterval(() => {
            if (!pausedRef.current) fetchData(true);
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchData]);

    return { assets, history, loading, isRefreshing, rate, rateTime, lastUpdated, fetchData, setAssets };
}
