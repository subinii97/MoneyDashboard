'use client';

import { useState } from 'react';
import { Eye, EyeOff, DollarSign } from 'lucide-react';
import { formatKRW, convertToKRW, toLocalDateStr } from '@/lib/utils';
import { useAssets } from '@/hooks/useAssets';
import { useMarketData } from '@/hooks/useMarketData';

// Components
import { HeroSection } from '@/components/dashboard/HeroSection';
import { MarketSection } from '@/components/dashboard/MarketSection';

export default function Home() {
    const { assets, history, loading, isRefreshing, rate, rateTime, lastUpdated, fetchData } = useAssets();
    const { marketData, sparklines, loading: marketLoading, lastFetched, fetchMarketData } = useMarketData();
    const [isPrivate, setIsPrivate] = useState(false);

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
    
    // Find the correct previous snapshot to calculate day-over-day change
    // If before 7AM (US market still open for 'yesterday'), treat 'today' as 'yesterday'
    const now = new Date();
    const currentTradingDate = new Date(now);
    if (now.getHours() < 7) {
        currentTradingDate.setDate(currentTradingDate.getDate() - 1);
    }
    const currentTradingDateStr = toLocalDateStr(currentTradingDate);
    
    // We compare with the most recent snapshot strictly BEFORE the current trading day
    const prevSnapshot = [...history].reverse().find(h => h.date < currentTradingDateStr);

    const change = prevSnapshot ? totalValue - (prevSnapshot.totalValue || 0) : 0;
    const changePercent = (prevSnapshot && prevSnapshot.totalValue > 0) ? (change / prevSnapshot.totalValue) * 100 : 0;

    const formatTime = (time: string | undefined) => {
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
                    <button onClick={() => setIsPrivate(!isPrivate)} className="glass flex-center" style={{ width: '42px', height: '42px', cursor: 'pointer', color: isPrivate ? 'var(--primary)' : 'var(--foreground)' }}>
                        {isPrivate ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>

                    {displayRate && (
                        <a 
                            href="https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="glass flex-center" 
                            style={{ padding: '0.3rem 0.6rem', gap: '0.4rem', borderRadius: '100px', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: '500', textDecoration: 'none', transition: 'all 0.2s' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--white-10)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                            {isRateLive && <span className="animate-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span>}
                            <DollarSign size={14} color="var(--primary)" />
                            <span>1 USD = <span style={{ color: 'var(--foreground)', fontWeight: '800' }}>{displayRate.toLocaleString()}</span> KRW</span>
                            <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>• {formatTime(displayRateTime)} {isRateLive ? 'Live' : ''}</span>
                        </a>
                    )}
                </div>
            </header>

            <div style={{ marginBottom: '5rem' }}>
                <HeroSection totalValueKRW={totalValue} change={change} changePercent={changePercent} isPrivate={isPrivate} />
            </div>

            <MarketSection data={marketData} sparklines={sparklines} loading={marketLoading} lastFetched={lastFetched} />
        </main>
    );
}
