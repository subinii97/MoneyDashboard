'use client';

import { useState } from 'react';
import { Eye, EyeOff, RefreshCw, DollarSign } from 'lucide-react';
import { formatKRW, convertToKRW } from '@/lib/utils';
import { useAssets } from '@/hooks/useAssets';
import { useMarketData } from '@/hooks/useMarketData';

// Components
import { HeroSection } from '@/components/dashboard/HeroSection';
import { MarketSection } from '@/components/dashboard/MarketSection';

export default function Home() {
    const { assets, history, loading, isRefreshing, rate, rateTime, lastUpdated, fetchData } = useAssets();
    const { marketData, loading: marketLoading, lastFetched, fetchMarketData } = useMarketData();
    const [isPrivate, setIsPrivate] = useState(false);

    const handleRefresh = async () => {
        await Promise.all([fetchData(true), fetchMarketData(true)]);
    };

    if (loading) return <div className="flex-center" style={{ padding: '2rem' }}>Loading...</div>;

    // Unified Exchange Rate
    const liveUSD = marketData.rates.find(r => r.code === 'FX_USDKRW' || r.id === 'USDKRW');
    const displayRate = liveUSD ? liveUSD.price : (rate || 1400);
    const displayRateTime = liveUSD ? liveUSD.time : (rateTime || lastUpdated);

    const isRateLive = (() => {
        if (!liveUSD || !liveUSD.time) return false;
        try {
            return (new Date().getTime() - new Date(liveUSD.time).getTime()) < 5 * 60 * 1000;
        } catch { return false; }
    })();

    // Aggregations
    const calculateTotal = () => {
        const invTotal = assets.investments.reduce((acc, s) => {
            const val = (s.currentPrice || s.avgPrice || 0) * (s.shares || 0);
            return acc + convertToKRW(val, s.currency || 'KRW', displayRate);
        }, 0);

        const allocTotal = assets.allocations.reduce((acc, a) => {
            const val = (a.details && a.details.length > 0)
                ? a.details.reduce((sum, d: any) => sum + convertToKRW(d.value || 0, d.currency || 'KRW', displayRate), 0)
                : convertToKRW(a.value || 0, a.currency || 'KRW', displayRate);
            return acc + (val || 0);
        }, 0);

        return invTotal + allocTotal;
    };

    const totalValue = calculateTotal();
    const lastSnapshot = history[history.length - 1];
    const change = lastSnapshot ? totalValue - (lastSnapshot.totalValue || 0) : 0;
    const changePercent = (lastSnapshot && lastSnapshot.totalValue > 0) ? (change / lastSnapshot.totalValue) * 100 : 0;

    const formatTime = (time: string) => {
        if (!time) return '';
        const date = new Date(time);
        return isNaN(date.getTime()) ? time : date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    };

    return (
        <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
                <span className="section-label">Overview</span>
                <h1 className="gradient-text" style={{ fontSize: '3rem', fontWeight: '900', marginBottom: '1rem', letterSpacing: '-0.03em' }}>Dashboard</h1>

                <div className="flex-center" style={{ gap: '1rem', marginTop: '1rem' }}>
                    <button onClick={() => setIsPrivate(!isPrivate)} className="glass flex-center" style={{ width: '42px', height: '42px', cursor: 'pointer', color: isPrivate ? 'var(--primary)' : 'white' }}>
                        {isPrivate ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button onClick={handleRefresh} disabled={isRefreshing} className="glass flex-center" style={{ width: '42px', height: '42px', cursor: isRefreshing ? 'not-allowed' : 'pointer', color: 'white', opacity: isRefreshing ? 0.7 : 1 }}>
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>

                    {displayRate && (
                        <div className="glass flex-center" style={{ padding: '0.3rem 0.6rem', gap: '0.4rem', borderRadius: '100px', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: '500' }}>
                            {isRateLive && <span className="animate-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>}
                            <DollarSign size={14} color="var(--primary)" />
                            <span>1 USD = <span style={{ color: 'white', fontWeight: '800' }}>{displayRate.toLocaleString()}</span> KRW</span>
                            <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>• {formatTime(displayRateTime)} {isRateLive ? 'Live' : ''}</span>
                        </div>
                    )}
                </div>
            </header>

            <div style={{ marginBottom: '5rem' }}>
                <HeroSection totalValueKRW={totalValue} change={change} changePercent={changePercent} isPrivate={isPrivate} />
            </div>

            <MarketSection data={marketData} loading={marketLoading} lastFetched={lastFetched} />
        </main>
    );
}
