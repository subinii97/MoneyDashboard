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
    const formatMarketTime = (timeStr: string) => {
        if (!timeStr) return '실시간';
        try {
            const date = new Date(timeStr);
            if (isNaN(date.getTime())) return timeStr;

            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);

            // If update within last 5 mins, show "Just now" or current time
            if (diffMins < 5) return '실시간';

            const isToday = date.getDate() === now.getDate() &&
                date.getMonth() === now.getMonth() &&
                date.getFullYear() === now.getFullYear();

            if (isToday) {
                return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            } else {
                return `${date.getMonth() + 1}.${date.getDate()} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
            }
        } catch (e) {
            return timeStr;
        }
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
                                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: '500' }}>
                                    {idx.status === 'OPEN' ? <span style={{ color: '#16a34a' }}>● 장중</span> : (idx.status === 'CLOSE' ? <span>○ 장마감</span> : <span>○ {formatMarketTime(idx.time)}</span>)}
                                </div>
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
                    {data.rates.map((rate: any) => {
                        const timeStatus = formatMarketTime(rate.time);
                        const isLive = timeStatus === '실시간';
                        return (
                            <div key={rate.id} style={rowStyle}>
                                <div>
                                    <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--foreground)', marginBottom: '0.2rem' }}>{rate.name || rate.id}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: '500' }}>
                                        <span style={{ color: isLive ? '#16a34a' : 'var(--muted)', marginRight: '0.3rem' }}>{isLive ? '●' : '○'}</span>
                                        {isLive ? '실시간' : timeStatus}
                                        {isLive && rate.time && (
                                            <span style={{ opacity: 0.6, fontSize: '0.75rem', marginLeft: '0.2rem' }}>
                                                ({new Date(rate.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {renderPriceInfo(rate)}
                            </div>
                        );
                    })}
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
                                <div style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: '500' }}>● 실시간 (Binance)</div>
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
                                <div style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: '500' }}>● 실시간 (Investing)</div>
                            </div>
                            {renderPriceInfo(com, '$')}
                        </div>
                    ))}
                </div>
            </SpotlightCard>
        </div>
    );
}
