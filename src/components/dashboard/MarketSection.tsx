'use client';

import { SpotlightCard } from '@/components/common/SpotlightCard';
import { TrendingUp, TrendingDown, Globe, Landmark } from 'lucide-react';

interface MarketSectionProps {
    data: {
        indices: any[];
        rates: any[];
        crypto?: any[];
        commodities?: any[];
    };
    loading: boolean;
    lastFetched: Date | null;
}

export function MarketSection({ data, loading, lastFetched }: MarketSectionProps) {
    const renderStatusTime = (item: any, isAlwaysLive = false) => {
        let isLive = isAlwaysLive;
        let displayTime = '';

        if (item.time) {
            const date = new Date(item.time);
            if (!isNaN(date.getTime())) {
                const now = new Date();
                const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();

                displayTime = isToday
                    ? date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
                    : `${date.getMonth() + 1}.${date.getDate()} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

                if (!isAlwaysLive) {
                    if (item.status === 'OPEN') {
                        isLive = true;
                    } else if (item.status === 'CLOSE') {
                        isLive = false;
                    } else {
                        const diffMins = (now.getTime() - date.getTime()) / 60000;
                        isLive = diffMins < 5;
                    }
                }
            }
        } else if (item.status === 'OPEN') {
            isLive = true;
        }

        const statusText = isLive ? '실시간' : '장마감';
        const color = isLive ? '#16a34a' : 'var(--muted)';
        const dot = isLive ? '●' : '○';

        return (
            <div style={{ fontSize: '0.8rem', color, fontWeight: '500', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '0.3rem' }}>{dot}</span>
                {statusText}
                {displayTime && (
                    <span style={{ opacity: 0.8, fontSize: '0.75rem', marginLeft: '0.3rem' }}>
                        ({displayTime})
                    </span>
                )}
            </div>
        );
    };

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.2rem 0',
        borderBottom: '1px solid var(--white-10)',
        height: '80px' // Fixed height for consistency
    };

    if (loading && (!data.indices.length || !data.rates.length)) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
                <SpotlightCard style={{ padding: '2rem', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: 'var(--muted)' }}>시장 지수 로딩 중...</p>
                </SpotlightCard>
                <SpotlightCard style={{ padding: '2rem', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: 'var(--muted)' }}>환율 정보 로딩 중...</p>
                </SpotlightCard>
                <SpotlightCard style={{ padding: '2rem', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: 'var(--muted)' }}>가상화폐 시세 로딩 중...</p>
                </SpotlightCard>
                <SpotlightCard style={{ padding: '2rem', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: 'var(--muted)' }}>현물 로딩 중...</p>
                </SpotlightCard>
            </div>
        );
    }

    const renderPriceInfo = (item: any, prefix = '', suffix = '') => (
        <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--foreground)' }}>
                {prefix}{item.price?.toLocaleString(undefined, { minimumFractionDigits: item.id?.includes('EURUSD') ? 4 : 2, maximumFractionDigits: item.id?.includes('EURUSD') ? 4 : 2 })}{suffix}
            </div>
            <div style={{
                fontSize: '0.9rem',
                fontWeight: '700',
                color: (item.change || 0) > 0 ? '#ff4d4d' : (item.change || 0) < 0 ? '#3399ff' : 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.25rem',
                marginTop: '0.2rem'
            }}>
                {(item.change || 0) > 0 ? <TrendingUp size={14} strokeWidth={3} /> : (item.change || 0) < 0 ? <TrendingDown size={14} strokeWidth={3} /> : null}
                {prefix}{Math.abs(item.change || 0).toLocaleString(undefined, { minimumFractionDigits: item.id?.includes('EURUSD') ? 4 : 2 })}{suffix}
                <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                    ({(item.changePercent || 0) > 0 ? '+' : ''}{(item.changePercent || 0).toFixed(2)}%)
                </span>
            </div>
        </div>
    );

    const getLatestTime = (items: any[]) => {
        if (!items || items.length === 0) return '';
        const times = items.map(i => i.time).filter(Boolean);
        if (times.length === 0) return '';
        return times.sort().reverse()[0];
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2.5rem', marginBottom: '4rem' }}>
            {/* Indices */}
            <SpotlightCard style={{ padding: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--foreground)' }}>
                        <Globe size={24} color="var(--primary)" /> 주요 지수
                    </h2>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'right' }}>
                        <div>자동 갱신 중</div>
                        <div style={{ fontWeight: '600' }}>{lastFetched ? lastFetched.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '조회 중'}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {data.indices.map((idx: any) => (
                        <div key={idx.id} style={rowStyle}>
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--foreground)', marginBottom: '0.2rem' }}>{idx.name || idx.id}</div>
                                {renderStatusTime(idx)}
                            </div>
                            {renderPriceInfo(idx)}
                        </div>
                    ))}
                </div>
            </SpotlightCard>

            {/* Exchange Rates */}
            <SpotlightCard style={{ padding: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--foreground)' }}>
                        <Landmark size={24} color="var(--accent)" /> 실시간 환율
                    </h2>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'right' }}>
                        <div>자동 갱신 중</div>
                        <div style={{ fontWeight: '600' }}>{lastFetched ? lastFetched.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '조회 중'}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {data.rates.map((rate: any) => (
                        <div key={rate.id} style={rowStyle}>
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--foreground)', marginBottom: '0.2rem' }}>{rate.name || rate.id}</div>
                                {renderStatusTime(rate)}
                            </div>
                            {renderPriceInfo(rate)}
                        </div>
                    ))}
                </div>
            </SpotlightCard>

            {/* Crypto */}
            <SpotlightCard style={{ padding: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--foreground)' }}>
                        <Globe size={24} color="#f59e0b" /> 가상화폐 시장
                    </h2>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'right' }}>
                        <div>자동 갱신 중</div>
                        <div style={{ fontWeight: '600' }}>{lastFetched ? lastFetched.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '조회 중'}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(data.crypto || []).map((coin: any) => (
                        <div key={coin.id} style={rowStyle}>
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--foreground)', marginBottom: '0.2rem' }}>{coin.name || coin.id}</div>
                                {renderStatusTime(coin, true)}
                            </div>
                            {renderPriceInfo(coin, '$')}
                        </div>
                    ))}
                </div>
            </SpotlightCard>

            {/* Commodities */}
            <SpotlightCard style={{ padding: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--foreground)' }}>
                        <TrendingUp size={24} color="#ec4899" /> 실물 자산 및 원유
                    </h2>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'right' }}>
                        <div>자동 갱신 중</div>
                        <div style={{ fontWeight: '600' }}>{lastFetched ? lastFetched.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '조회 중'}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(data.commodities || []).map((com: any) => (
                        <div key={com.id} style={rowStyle}>
                            <div>
                                <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--foreground)', marginBottom: '0.2rem' }}>{com.name || com.id}</div>
                                {renderStatusTime(com, true)}
                            </div>
                            {renderPriceInfo(com, '$')}
                        </div>
                    ))}
                </div>
            </SpotlightCard>
        </div>
    );
}
