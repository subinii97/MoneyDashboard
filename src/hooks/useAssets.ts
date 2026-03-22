'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Assets, Investment, HistoryEntry } from '@/lib/types';
import { mapInvestmentWithPrice, extractExchangeRate } from '@/lib/assets';

const REFRESH_INTERVAL_MS = 5_000;

export function useAssets(paused = false) {
    const pausedRef = useRef(paused);
    const fetchingRef = useRef(false);
    useEffect(() => { pausedRef.current = paused; }, [paused]);

    const [assets, setAssets] = useState<Assets>({ investments: [], allocations: [] });
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState<number>(1350);
    const [yesterdayRate, setYesterdayRate] = useState<number>(1350);
    const [rateTime, setRateTime] = useState<string>('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const fetchData = useCallback(async (force = false) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setIsRefreshing(true);

        try {
            const ts = Date.now();
            const [assetRes, historyRes] = await Promise.all([
                fetch(`/api/assets?t=${ts}`, { cache: 'no-store' }),
                fetch(`/api/snapshot?includeHoldings=true&t=${ts}`, { cache: 'no-store' }),
            ]);

            if (!assetRes.ok || !historyRes.ok) {
                throw new Error(`Initial fetch failed: asset=${assetRes.status}, history=${historyRes.status}`);
            }

            const [assetData, historyData] = await Promise.all([
                assetRes.json(),
                historyRes.json(),
            ]);

            setHistory(Array.isArray(historyData) ? historyData : []);

            const investmentsRaw: Investment[] = assetData.investments || assetData.stocks || [];
            const allocations = assetData.allocations || assetData.others || [];

            const uniqueSymbols = Array.from(
                new Set(investmentsRaw.map(s => s.symbol).filter(Boolean))
            ) as string[];

            if (uniqueSymbols.length > 0) {
                try {
                    const priceRes = await fetch(
                        `/api/stock?symbols=${encodeURIComponent(uniqueSymbols.join(','))}&t=${ts}${force ? '&refresh=true' : ''}`,
                        { cache: 'no-store' }
                    );
                    if (!priceRes.ok) throw new Error(`Stock API returned ${priceRes.status}`);

                    const priceData = await priceRes.json();
                    const extractedRates = extractExchangeRate(priceData);
                    setRate(extractedRates.rate);
                    setYesterdayRate(extractedRates.yesterdayRate);
                    setRateTime(extractedRates.time);

                    const updatedInvestments = investmentsRaw.map(inv => mapInvestmentWithPrice(inv, priceData));
                    setAssets({ investments: updatedInvestments, allocations });
                } catch (err) {
                    console.warn('Stock price fetch failed, using raw data:', err);
                    setAssets({ investments: investmentsRaw, allocations });
                }
            } else {
                setAssets({ investments: investmentsRaw, allocations });
            }

            fetch('/api/snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto: true }),
            }).catch(() => { /* non-critical */ });

            setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour12: false }));
        } catch (err) {
            console.error('useAssets.fetchData failed:', err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            fetchingRef.current = false;
        }
    }, []);

    useEffect(() => {
        fetchData(true);
        const timer = setInterval(() => {
            if (!pausedRef.current) fetchData(true);
        }, REFRESH_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [fetchData]);

    return { assets, history, loading, isRefreshing, rate, yesterdayRate, rateTime, lastUpdated, fetchData, setAssets };
}
