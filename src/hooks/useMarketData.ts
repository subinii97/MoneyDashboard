'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface MarketItem {
    id: string;
    code?: string;
    name?: string;
    price: number;
    change: number;
    changePercent: number;
    time?: string;
    status?: string;
}

export interface MarketData {
    indices: MarketItem[];
    rates: MarketItem[];
    crypto: MarketItem[];
    commodities: MarketItem[];
}

const EMPTY_MARKET_DATA: MarketData = {
    indices: [],
    rates: [],
    crypto: [],
    commodities: [],
};

const MARKET_REFRESH_MS = 5_000;
const SPARKLINE_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export function useMarketData() {
    const [marketData, setMarketData] = useState<MarketData>(EMPTY_MARKET_DATA);
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
            const res = await fetch(
                `/api/market?t=${Date.now()}${force ? '&refresh=true' : ''}`,
                { cache: 'no-store' }
            );
            if (res.ok) {
                const data: MarketData = await res.json();
                setMarketData(data);
                setLastFetched(new Date());
            }
        } catch (err) {
            console.error('useMarketData: market fetch failed:', err);
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
                const data: Record<string, number[]> = await res.json();
                setSparklines(data);
            }
        } catch (err) {
            console.error('useMarketData: sparkline fetch failed:', err);
        }
    }, []);

    useEffect(() => {
        fetchMarketData();
        fetchSparklines();

        const marketTimer = setInterval(fetchMarketData, MARKET_REFRESH_MS);
        const sparklineTimer = setInterval(fetchSparklines, SPARKLINE_REFRESH_MS);

        return () => {
            clearInterval(marketTimer);
            clearInterval(sparklineTimer);
        };
    }, [fetchMarketData, fetchSparklines]);

    return { marketData, sparklines, loading, isRefreshing, lastFetched, fetchMarketData };
}
