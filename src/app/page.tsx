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

export default function Home() {
    const { assets, history, loading, isRefreshing, rate, rateTime, lastUpdated, fetchData } = useAssets();
    const [isPrivate, setIsPrivate] = useState(false);

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
                    <button onClick={() => fetchData(true)} disabled={isRefreshing} className="glass" style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isRefreshing ? 'not-allowed' : 'pointer', color: 'white', opacity: isRefreshing ? 0.7 : 1 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2.5rem', marginBottom: '5rem' }}>
                <HeroSection totalValueKRW={totalValue} change={change} changePercent={changePercent} isPrivate={isPrivate} />

                <SpotlightCard style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>자산별 비중</h2>
                        <Activity size={24} color="var(--accent)" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[...new Set([...assets.allocations.map(a => a.category), ...assets.investments.map(s => s.category).filter(Boolean)])].map(cat => {
                            let val = 0;
                            if (cat?.includes('Stock') || cat?.includes('Index') || cat?.includes('Bond')) {
                                val = assets.investments.filter(s => s.category === cat).reduce((sum, s) => sum + convertToKRW((s.currentPrice || s.avgPrice) * s.shares, s.currency || 'KRW', rate), 0);
                            } else {
                                const a = assets.allocations.find(al => al.category === cat);
                                if (a) val = (a.details?.length ? a.details.reduce((s, d: any) => s + convertToKRW(d.value, d.currency, rate), 0) : convertToKRW(a.value, a.currency || 'KRW', rate)) || 0;
                            }
                            if (val === 0) return null;

                            return (
                                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ color: 'var(--muted)' }}>{CATEGORY_MAP[cat as keyof typeof CATEGORY_MAP] || cat}</span>
                                    <span style={{ fontWeight: '600' }}>
                                        <span style={{ filter: isPrivate ? 'blur(8px)' : 'none' }}>{formatKRW(val)}</span>
                                        <span style={{ marginLeft: '4px', fontSize: '0.85rem', opacity: 0.7 }}>({totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : 0}%)</span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </SpotlightCard>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                <Link href="/portfolio" style={{ textDecoration: 'none' }}>
                    <SpotlightCard style={{ padding: '2rem', transition: 'transform 0.2s', cursor: 'pointer' }}>
                        <BarChart2 size={32} color="var(--accent)" style={{ marginBottom: '1.5rem' }} />
                        <h3 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.75rem' }}>포트폴리오 비중 관리</h3>
                        <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>자산군별 목표 비중을 설정하고 효율적인 자산 배분 전략을 확인하세요.</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>이동하기 <ArrowRight size={18} /></div>
                    </SpotlightCard>
                </Link>

                <Link href="/investment" style={{ textDecoration: 'none' }}>
                    <SpotlightCard style={{ padding: '2rem', transition: 'transform 0.2s', cursor: 'pointer' }}>
                        <Briefcase size={32} color="var(--primary)" style={{ marginBottom: '1.5rem' }} />
                        <h3 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.75rem' }}>종목별 상세 관리</h3>
                        <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>개별 주식 종목의 단가, 수량, 수익률을 확인하고 신규 종목을 추가하세요.</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>이동하기 <ArrowRight size={18} /></div>
                    </SpotlightCard>
                </Link>
            </div>
        </main>
    );
}
