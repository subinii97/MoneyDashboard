import { useState, useEffect, useCallback } from 'react';

export interface MarketData {
    indices: any[];
    rates: any[];
}

export function useMarketData() {
    const [marketData, setMarketData] = useState<MarketData>({ indices: [], rates: [] });
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastFetched, setLastFetched] = useState<Date | null>(null);

    const fetchMarketData = useCallback(async (force = false) => {
        setIsRefreshing(true);
        try {
            const res = await fetch(`/api/market?t=${Date.now()}${force ? '&refresh=true' : ''}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setMarketData(data);
                setLastFetched(new Date());
            }
        } catch (e) {
            console.error('Failed to fetch market data', e);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchMarketData();
        const interval = setInterval(() => {
            fetchMarketData();
        }, 30000); // 30 seconds
        return () => clearInterval(interval);
    }, [fetchMarketData]);

    return { marketData, loading, isRefreshing, lastFetched, fetchMarketData };
}
