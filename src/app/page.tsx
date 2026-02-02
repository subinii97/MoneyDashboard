'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Wallet,
    Activity,
    Briefcase,
    BarChart2,
    TrendingUp,
    ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { Assets, HistoryEntry, CATEGORY_MAP } from '@/lib/types';
import { formatKRW, convertToKRW } from '@/lib/utils';

export default function Home() {
    const [assets, setAssets] = useState<Assets>({ investments: [], allocations: [] });
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState<number>(1350); // Default fallback

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/assets');
            const data = await res.json();

            // Migration check: if old 'others' exists, move to 'allocations'
            const rawAllocations = data.allocations || data.others || [];
            const rawInvestments = data.investments || data.stocks || [];

            if (rawInvestments.length > 0) {
                const symbols = Array.from(new Set(rawInvestments.map((s: any) => s.symbol))).join(',');
                const priceRes = await fetch(`/api/stock?symbols=${symbols}&t=${Date.now()}`);
                const priceData = await priceRes.json();

                if (priceData.exchangeRate) {
                    if (typeof priceData.exchangeRate === 'object' && priceData.exchangeRate !== null) {
                        setRate(priceData.exchangeRate.rate);
                    } else {
                        setRate(priceData.exchangeRate);
                    }
                }

                const updatedInvestments = rawInvestments.map((inv: any) => {
                    const info = priceData.results?.find((r: any) => r.symbol === inv.symbol);
                    return {
                        ...inv,
                        currentPrice: info?.price || inv.avgPrice,
                        currency: info?.currency || (inv.symbol.includes('.') ? 'KRW' : 'USD'),
                        name: info?.name,
                        marketType: inv.marketType || (inv.symbol.includes('.') || (info && info.exchange === 'KRX') ? 'Domestic' : 'Overseas')
                    };
                });
                setAssets({ investments: updatedInvestments, allocations: rawAllocations });
            } else {
                setAssets({ investments: [], allocations: rawAllocations });
            }

            const historyRes = await fetch('/api/snapshot');
            if (historyRes.ok) {
                const historyData = await historyRes.json();
                setHistory(historyData);

                // Auto-snapshot trigger: check if today is missing
                const d = new Date();
                const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                if (!historyData.some((h: any) => h.date === todayStr)) {
                    fetch('/api/snapshot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ auto: true })
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success && data.entry) {
                                setHistory(prev => [...prev.filter(h => h.date !== data.entry.date), data.entry].sort((a, b) => a.date.localeCompare(b.date)));
                            }
                        })
                        .catch(err => console.error('Auto-snapshot failed', err));
                }
            }
        } catch (e) {
            console.error('Failed to fetch data', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Total investment value calculated once
    const totalInvestmentValueKRW = assets.investments.reduce((acc, s) => {
        const price = s.currentPrice || s.avgPrice || 0;
        const val = price * (s.shares || 0);
        return acc + convertToKRW(val, s.currency || (s.marketType === 'Domestic' ? 'KRW' : 'USD'), rate);
    }, 0);

    const totalNonInvestmentValueKRW = assets.allocations
        .filter(a => !a.category.includes('Stock') && !a.category.includes('Index') && !a.category.includes('Bond'))
        .reduce((acc, a) => {
            const val = (a.details && a.details.length > 0)
                ? a.details.reduce((sum, d) => sum + convertToKRW(d.value || 0, d.currency || 'KRW', rate), 0)
                : convertToKRW(a.value || 0, a.currency || 'KRW', rate);
            return acc + (val || 0);
        }, 0);

    const totalValueKRW = (totalInvestmentValueKRW + totalNonInvestmentValueKRW) || 0;

    const lastSnapshot = (history && history.length > 1) ? history[history.length - 2] : null;
    const change = lastSnapshot ? totalValueKRW - (lastSnapshot.totalValue || 0) : 0;
    const changePercent = (lastSnapshot && (lastSnapshot.totalValue || 0) > 0) ? (change / (lastSnapshot.totalValue || 0)) * 100 : 0;

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

    return (
        <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                <h1 className="gradient-text" style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '1rem' }}>
                    안녕하세요!
                </h1>
                <p style={{ color: 'var(--muted)', fontSize: '1.2rem' }}>현재 자산 현황을 한눈에 확인하세요</p>
                {rate && <p style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.5rem' }}>실시간 환율: 1 USD = {rate.toLocaleString()} KRW</p>}
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
                <div className="glass" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                    <Wallet size={48} color="var(--primary)" style={{ margin: '0 auto 1.5rem' }} />
                    <h2 style={{ fontSize: '1.1rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>총 순자산</h2>
                    <p style={{ fontSize: '3rem', fontWeight: 'bold', margin: '1rem 0' }}>{formatKRW(totalValueKRW)}</p>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', color: change >= 0 ? '#ef4444' : '#3b82f6' }}>
                        {change >= 0 ? <TrendingUp size={20} /> : <TrendingUp size={20} style={{ transform: 'rotate(180deg)' }} />}
                        {change >= 0 ? '+' : ''}{changePercent.toFixed(2)}% ({formatKRW(Math.abs(change))})
                    </div>
                </div>

                <div className="glass" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>자산별 비중</h2>
                        <Activity size={24} color="var(--accent)" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {(() => {
                            // Collect all possible categories from allocations and investments
                            const allocationCats = assets.allocations.map(a => a.category);
                            const investmentCats = Array.from(new Set(assets.investments.map(s => s.category).filter(Boolean))) as string[];
                            const allCategories = Array.from(new Set([...allocationCats, ...investmentCats]));

                            return allCategories.map(cat => {
                                let valKRW = 0;
                                const isInvestmentCategory = cat.includes('Stock') || cat.includes('Index') || cat.includes('Bond');

                                if (isInvestmentCategory) {
                                    valKRW = assets.investments
                                        .filter(s => {
                                            if (s.category) return s.category === cat;
                                            if (cat === 'Domestic Stock') return s.marketType === 'Domestic';
                                            if (cat === 'Overseas Stock') return s.marketType === 'Overseas';
                                            return false;
                                        })
                                        .reduce((sum, s) => {
                                            const price = s.currentPrice || s.avgPrice || 0;
                                            return sum + convertToKRW(price * (s.shares || 0), s.currency || (s.marketType === 'Domestic' ? 'KRW' : 'USD'), rate);
                                        }, 0);
                                } else {
                                    const alloc = assets.allocations.find(a => a.category === cat);
                                    if (alloc) {
                                        valKRW = (alloc.details && alloc.details.length > 0)
                                            ? alloc.details.reduce((sum, d) => sum + convertToKRW(d.value || 0, d.currency || 'KRW', rate), 0)
                                            : convertToKRW(alloc.value || 0, alloc.currency || 'KRW', rate);
                                    }
                                }

                                if (valKRW === 0) {
                                    const alloc = assets.allocations.find(a => a.category === cat);
                                    if (!alloc || (alloc.targetWeight || 0) === 0) return null;
                                }

                                return (
                                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ color: 'var(--muted)' }}>{CATEGORY_MAP[cat as keyof typeof CATEGORY_MAP] || cat}</span>
                                        <span style={{ fontWeight: '600' }}>{formatKRW(valKRW || 0)} ({totalValueKRW > 0 ? (((valKRW || 0) / totalValueKRW) * 100).toFixed(1) : 0}%)</span>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                <Link href="/portfolio" style={{ textDecoration: 'none' }}>
                    <div className="glass" style={{ padding: '2rem', transition: 'transform 0.2s', cursor: 'pointer' }}>
                        <BarChart2 size={32} color="var(--accent)" style={{ marginBottom: '1.5rem' }} />
                        <h3 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.75rem' }}>포트폴리오 비중 관리</h3>
                        <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>자산군별 목표 비중을 설정하고 효율적인 자산 배분 전략을 확인하세요.</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
                            이동하기 <ArrowRight size={18} />
                        </div>
                    </div>
                </Link>

                <Link href="/investment" style={{ textDecoration: 'none' }}>
                    <div className="glass" style={{ padding: '2rem', transition: 'transform 0.2s', cursor: 'pointer' }}>
                        <Briefcase size={32} color="var(--primary)" style={{ marginBottom: '1.5rem' }} />
                        <h3 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.75rem' }}>종목별 상세 관리</h3>
                        <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>개별 주식 종목의 단가, 수량, 수익률을 확인하고 신규 종목을 추가하세요.</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                            이동하기 <ArrowRight size={18} />
                        </div>
                    </div>
                </Link>
            </div>
        </main>
    );
}
