'use client';

import { useState } from 'react';
import { Activity, Briefcase, BarChart2, ArrowRight, Eye, EyeOff, RefreshCw, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { CATEGORY_MAP } from '@/lib/types';
import { formatKRW, convertToKRW } from '@/lib/utils';
import { useAssets } from '@/hooks/useAssets';

// Components
import { HeroSection } from '@/components/dashboard/HeroSection';
import { SpotlightCard } from '@/components/common/SpotlightCard';
import { useMarketData } from '@/hooks/useMarketData';
import { MarketSection } from '@/components/dashboard/MarketSection';

export default function Home() {
    const { assets, history, loading, isRefreshing, rate, rateTime, lastUpdated, fetchData } = useAssets();
    const { marketData, loading: marketLoading, fetchMarketData } = useMarketData();
    const [isPrivate, setIsPrivate] = useState(false);

    const handleRefresh = async () => {
        await Promise.all([
            fetchData(true),
            fetchMarketData(true)
        ]);
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

    // Calculations
    const totalInvVal = assets.investments.reduce((acc, s) => {
        const val = (s.currentPrice || s.avgPrice || 0) * (s.shares || 0);
        return acc + convertToKRW(val, s.currency || 'KRW', rate);
    }, 0);

    const totalNonInvVal = assets.allocations.reduce((acc, a) => {
        const val = (a.details && a.details.length > 0)
            ? a.details.reduce((sum, d: any) => sum + convertToKRW(d.value || 0, d.currency || 'KRW', rate), 0)
            : convertToKRW(a.value || 0, a.currency || 'KRW', rate);
        return acc + (val || 0);
    }, 0);

    const totalValue = totalInvVal + totalNonInvVal;
    const lastSnapshot = history[history.length - 1];
    const change = lastSnapshot ? totalValue - (lastSnapshot.totalValue || 0) : 0;
    const changePercent = (lastSnapshot && lastSnapshot.totalValue > 0) ? (change / lastSnapshot.totalValue) * 100 : 0;

    return (
        <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
                <span className="section-label">Overview</span>
                <h1 className="gradient-text" style={{ fontSize: '3rem', fontWeight: '900', marginBottom: '1rem', letterSpacing: '-0.03em' }}>Dashboard</h1>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
                    <button onClick={() => setIsPrivate(!isPrivate)} className="glass" style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isPrivate ? 'var(--primary)' : 'white' }}>
                        {isPrivate ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button onClick={handleRefresh} disabled={isRefreshing} className="glass" style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isRefreshing ? 'not-allowed' : 'pointer', color: 'white', opacity: isRefreshing ? 0.7 : 1 }}>
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    {rate && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <DollarSign size={14} /> 1 USD = <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{rate.toLocaleString()}</span> KRW
                            {lastUpdated && <span style={{ opacity: 0.8 }}>• {lastUpdated} 갱신</span>}
                        </p>
                    )}
                </div>
            </header>

            <div style={{ marginBottom: '5rem' }}>
                <HeroSection totalValueKRW={totalValue} change={change} changePercent={changePercent} isPrivate={isPrivate} />
            </div>

            <MarketSection data={marketData} loading={marketLoading} />
        </main>
    );
}
