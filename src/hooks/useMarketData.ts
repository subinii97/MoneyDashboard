import { useState, useEffect, useCallback, useRef } from 'react';

export interface MarketData {
    indices: any[];
    rates: any[];
    crypto: any[];
    commodities: any[];
}

export function useMarketData() {
    const [marketData, setMarketData] = useState<MarketData>({ indices: [], rates: [], crypto: [], commodities: [] });
    const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastFetched, setLastFetched] = useState<Date | null>(null);
    const fetchingRef = useRef(false);

    const fetchMarketData = useCallback(async (force = false) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
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
            fetchingRef.current = false;
        }
    }, []);

    const fetchSparklines = useCallback(async () => {
        try {
            const res = await fetch(`/api/market/sparkline?t=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setSparklines(data);
            }
        } catch (e) {
            console.error('Failed to fetch sparklines', e);
        }
    }, []);

    useEffect(() => {
        fetchMarketData();
        fetchSparklines();

        const interval = setInterval(() => {
            fetchMarketData();
        }, 5000);

        // Sparkline은 5분마다 갱신 (API에서 5분 캐시)
        const sparkInterval = setInterval(() => {
            fetchSparklines();
        }, 5 * 60 * 1000);

        return () => {
            clearInterval(interval);
            clearInterval(sparkInterval);
        };
    }, [fetchMarketData, fetchSparklines]);

    return { marketData, sparklines, loading, isRefreshing, lastFetched, fetchMarketData };
}
