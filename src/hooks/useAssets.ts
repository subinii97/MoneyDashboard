import { useState, useEffect, useCallback } from 'react';
import { Assets, Investment, HistoryEntry } from '@/lib/types';
import { mapInvestmentWithPrice, extractExchangeRate } from '@/lib/assets';

export function useAssets() {
    const [assets, setAssets] = useState<Assets>({ investments: [], allocations: [] });
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState<number>(1350);
    const [rateTime, setRateTime] = useState<string>('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const fetchData = useCallback(async (force = false) => {
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

            const priceRes = await fetch(`/api/stock?symbols=${symbols}&t=${timestamp}${force ? '&refresh=true' : ''}`, { cache: 'no-store' });
            const priceData = await priceRes.json();

            const { rate: newRate, time: newRateTime } = extractExchangeRate(priceData);
            setRate(newRate);
            setRateTime(newRateTime);

            const updatedInvestments = investmentsRaw.map((inv: Investment) => mapInvestmentWithPrice(inv, priceData));
            setAssets({ investments: updatedInvestments, allocations: assetData.allocations || assetData.others || [] });

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
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { assets, history, loading, isRefreshing, rate, rateTime, lastUpdated, fetchData, setAssets };
}
