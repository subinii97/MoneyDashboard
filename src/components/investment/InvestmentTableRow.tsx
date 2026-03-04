'use client';

import React from 'react';
import { Investment } from '@/lib/types';
import { formatKRW, convertToKRW } from '@/lib/utils';
import { Edit2, Trash2, ArrowUpRight } from 'lucide-react';

interface InvestmentTableRowProps {
    inv: Investment;
    rate: number;
    isPrivate: boolean;
    subTotal: number;
    onEdit: (inv: Investment) => void;
    onDelete: (id: string) => void;
    onTransaction: (inv: Investment) => void;
}

const getExchangeStyle = (ex: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
        'KRX': { label: 'KOSPI', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)' },
        'KOSDAQ': { label: 'KOSDAQ', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
        'NASDAQ': { label: 'NASDAQ', color: '#059669', bg: 'rgba(16, 185, 129, 0.1)' },
        'NYSE': { label: 'NYSE', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
        'AMEX': { label: 'AMEX', color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' },
    };
    const upper = ex?.toUpperCase() || '';
    return map[upper] || { label: '기타', color: 'var(--muted)', bg: 'var(--border)' };
};

export const InvestmentTableRow: React.FC<InvestmentTableRowProps> = ({
    inv, rate, isPrivate, subTotal, onEdit, onDelete, onTransaction
}) => {
    const isUSD = inv.currency === 'USD';
    const isOverActive = inv.isOverMarket && inv.overMarketPrice !== undefined;
    const currentPriceActive = isOverActive ? inv.overMarketPrice! : (inv.currentPrice || inv.avgPrice);
    const activeChange = isOverActive ? (inv.overMarketChange ?? inv.change) : inv.change;
    const activeChangePercent = isOverActive ? (inv.overMarketChangePercent ?? inv.changePercent) : inv.changePercent;

    const marketVal = currentPriceActive * inv.shares;
    const marketValKRW = convertToKRW(marketVal, inv.currency || 'KRW', rate);
    const weight = subTotal > 0 ? (marketValKRW / subTotal) * 100 : 0;
    const costBasis = inv.avgPrice * inv.shares;
    const pl = marketVal - costBasis;
    const plPercent = costBasis > 0 ? ((marketVal / costBasis) - 1) * 100 : 0;
    const plKRW = convertToKRW(marketVal, inv.currency || 'KRW', rate) - convertToKRW(costBasis, inv.currency || 'KRW', rate);
    const ex = getExchangeStyle(inv.exchange || '');

    const formatPrice = (price: number) => {
        const abs = Math.abs(price);
        const sign = price < 0 ? '-' : '';
        if (isUSD) {
            const digits = abs < 100 ? 4 : 2;
            return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
        }
        return `${sign}${Math.floor(abs).toLocaleString()}`;
    };

    const plColor = plKRW >= 0 ? '#dc2626' : '#2563eb';

    return (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>

            {/* ── 종목 (거래소 배지 + 이름 + 티커) ── */}
            <td style={{ borderRight: '1px solid var(--border)', padding: '0.75rem 0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{
                        padding: '1px 5px', borderRadius: '4px',
                        fontSize: '0.62rem', fontWeight: '800',
                        color: ex.color, backgroundColor: ex.bg,
                        border: `1px solid ${ex.color}33`, flexShrink: 0,
                    }}>{ex.label}</span>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{inv.name || inv.symbol}</span>
                    {(inv.category || inv.marketType) && (
                        <span style={{ fontSize: '0.58rem', padding: '1px 3px', borderRadius: '4px', border: '1px solid var(--border)', opacity: 0.5, flexShrink: 0 }}>
                            {inv.category?.includes('Stock') ? '주식' : inv.category?.includes('Index') ? '지수' : '주식'}
                        </span>
                    )}
                </div>
                <div style={{ marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.66rem', fontWeight: '600', color: 'var(--muted)', opacity: 0.7, letterSpacing: '0.03em' }}>
                        {inv.symbol}
                    </span>
                    {inv.tags && inv.tags.length > 0 && inv.tags.map(tag => (
                        <span key={tag} style={{
                            padding: '0px 4px', borderRadius: '8px', fontSize: '0.58rem',
                            background: 'var(--primary-glow)', color: 'var(--primary)',
                            fontWeight: '700', border: '1px solid var(--primary)',
                        }}>
                            {tag}
                        </span>
                    ))}
                </div>
            </td>

            {/* ── 가격 3행: 현재가 / 전일대비 / 평단가 ── */}
            <td style={{ textAlign: 'right', padding: '0.6rem 0.6rem', borderRight: '1px solid var(--border)' }}>
                <div style={{ fontWeight: '700', fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    {isOverActive && (
                        <span style={{ fontSize: '0.55rem', padding: '1px 3px', borderRadius: '4px', background: 'var(--accent)', color: 'white', fontWeight: '800' }}>
                            {inv.overMarketSession === 'PRE_MARKET' ? 'PRE' : 'POST'}
                        </span>
                    )}
                    {formatPrice(currentPriceActive)}
                </div>
                {activeChange !== undefined ? (
                    <div style={{ fontSize: '0.75rem', color: activeChange >= 0 ? '#dc2626' : '#2563eb', fontWeight: '600', marginTop: '0.15rem' }}>
                        {activeChange >= 0 ? '▲' : '▼'}{Math.abs(activeChange).toLocaleString(undefined, { maximumFractionDigits: isUSD ? 2 : 0 })} ({Math.abs(activeChangePercent || 0).toFixed(2)}%)
                    </div>
                ) : <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>—</div>}

                {!isPrivate && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.2rem', opacity: 0.8, fontWeight: '500' }}>
                        평단 {formatPrice(inv.avgPrice)}
                    </div>
                )}
            </td>

            {/* ── 수량 ── */}
            <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', borderRight: '1px solid var(--border)', fontSize: '1rem', fontWeight: '500' }}>
                {!isPrivate && inv.shares}
            </td>

            {/* ── 평가 / 변동 ── */}
            <td style={{ textAlign: 'right', padding: '0.6rem 0.6rem', borderRight: '1px solid var(--border)', color: plColor }}>
                {!isPrivate && (
                    <div style={{ fontSize: '1.05rem', fontWeight: '700' }}>{formatPrice(marketVal)}</div>
                )}
                <div style={{ fontSize: isPrivate ? '1.15rem' : '0.75rem', fontWeight: '700', marginTop: '0.15rem' }}>
                    {!isPrivate && <>{pl >= 0 ? '+' : ''}{formatPrice(pl)} </>}
                    {!isPrivate ? `(${plPercent >= 0 ? '+' : ''}${Math.abs(plPercent).toFixed(2)}%)` : `${plPercent >= 0 ? '+' : ''}${Math.abs(plPercent).toFixed(2)}%`}
                </div>
            </td>


            {/* ── 비중 ── */}
            <td style={{ textAlign: 'center', padding: '0.6rem 0.4rem', borderRight: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>
                    {weight.toFixed(1)}%
                </div>
            </td>

            {/* ── 작업 ── */}
            <td style={{ padding: '0.75rem 0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                    <button onClick={() => onTransaction(inv)} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}><ArrowUpRight size={16} /></button>
                    <button onClick={() => onEdit(inv)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}><Edit2 size={16} /></button>
                    <button onClick={() => onDelete(inv.id)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}><Trash2 size={16} /></button>
                </div>
            </td>
        </tr >
    );
};
