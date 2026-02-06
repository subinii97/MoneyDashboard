import { useState, useEffect, useCallback } from 'react';
import { Assets, Investment, HistoryEntry } from '@/lib/types';

export function useAssets() {
    const [assets, setAssets] = useState<Assets>({ investments: [], allocations: [] });
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState<number>(1350);
    const [rateTime, setRateTime] = useState<string>('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchData = useCallback(async (force = false) => {
        setIsRefreshing(true);
        try {
            // Fetch assets with cache: 'no-store' to bypass Next.js cache
            const res = await fetch(`/api/assets?t=${Date.now()}`, { cache: 'no-store' });
            const data = await res.json();

            const investmentsRaw = data.investments || data.stocks || [];
            const allocationsRaw = data.allocations || data.others || [];

            // Always fetch stock API to get at least the exchange rate
            // Pass refresh=true if force is true to bypass server-side cache
            const symbols = Array.from(new Set(investmentsRaw.map((s: Investment) => s.symbol))).join(',');
            const priceRes = await fetch(`/api/stock?symbols=${symbols}&t=${Date.now()}${force ? '&refresh=true' : ''}`, { cache: 'no-store' });
            const priceData = await priceRes.json();

            if (priceData.exchangeRate) {
                if (typeof priceData.exchangeRate === 'object') {
                    setRate(priceData.exchangeRate.rate);
                    setRateTime(priceData.exchangeRate.time);
                } else {
                    setRate(priceData.exchangeRate);
                }
            }

            const updatedInvestments = investmentsRaw.map((inv: Investment) => {
                const info = priceData.results?.find((r: any) => r.symbol === inv.symbol);
                return {
                    ...inv,
                    currentPrice: info?.price || inv.avgPrice,
                    currency: info?.currency || inv.currency || (inv.symbol.includes('.') ? 'KRW' : 'USD'),
                    exchange: inv.exchange || info?.exchange,
                    name: inv.name || info?.name,
                    change: info?.change,
                    changePercent: info?.changePercent,
                    marketType: inv.marketType || (inv.symbol.includes('.') || (info && info.exchange === 'KRX') ? 'Domestic' : 'Overseas')
                };
            });
            setAssets({ investments: updatedInvestments, allocations: allocationsRaw });

            const historyRes = await fetch(`/api/snapshot?includeHoldings=true&t=${Date.now()}`, { cache: 'no-store' });
            if (historyRes.ok) {
                const historyData = await historyRes.json();
                setHistory(historyData);
            }

            // Also trigger auto-snapshot on every data fetch/refresh
            fetch('/api/snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto: true })
            }).catch(() => { });

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

    return { assets, history, loading, isRefreshing, rate, rateTime, fetchData, setAssets };
}
