'use client';

import React from 'react';
import { Investment } from '@/lib/types';
import { formatKRW, convertToKRW } from '@/lib/utils';
import { Edit2, Trash2, ArrowUpRight } from 'lucide-react';

interface InvestmentTableRowProps {
    inv: Investment;
    rate: number;
    isPrivate: boolean;
    onEdit: (inv: Investment) => void;
    onDelete: (id: string) => void;
    onTransaction: (inv: Investment) => void;
}

const getExchangeStyle = (ex: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
        'KRX': { label: 'KOSPI', color: '#2563eb', bg: 'rgba(59, 130, 246, 0.1)' },
        'KOSDAQ': { label: 'KOSDAQ', color: '#3b82f6', bg: 'rgba(96, 165, 250, 0.1)' },
        'NASDAQ': { label: 'NASDAQ', color: '#059669', bg: 'rgba(16, 185, 129, 0.1)' },
        'NYSE': { label: 'NYSE', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
    };
    const upper = ex?.toUpperCase() || '';
    return map[upper] || { label: '기타', color: 'var(--muted)', bg: 'var(--border)' };
};

export const InvestmentTableRow: React.FC<InvestmentTableRowProps> = ({
    inv, rate, isPrivate, onEdit, onDelete, onTransaction
}) => {
    const isUSD = inv.currency === 'USD';
    const currentPrice = inv.currentPrice || inv.avgPrice;
    const marketVal = currentPrice * inv.shares;
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
                <div style={{ marginTop: '0.1rem', fontFamily: 'monospace', fontSize: '0.66rem', fontWeight: '600', color: 'var(--muted)', opacity: 0.7, letterSpacing: '0.03em' }}>
                    {inv.symbol}
                </div>
            </td>

            {/* ── 가격 (현재가 + 변동\n평단가) ── */}
            <td style={{ textAlign: 'right', padding: '0.75rem 0.75rem', borderRight: '1px solid var(--border)' }}>
                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{formatPrice(currentPrice)}</div>
                {inv.change !== undefined && (
                    <div style={{ fontSize: '0.68rem', color: inv.change >= 0 ? '#dc2626' : '#2563eb', fontWeight: '600' }}>
                        {inv.change >= 0 ? '▲' : '▼'}{Math.abs(inv.change).toLocaleString(undefined, { maximumFractionDigits: isUSD ? 2 : 0 })} ({Math.abs(inv.changePercent || 0).toFixed(2)}%)
                    </div>
                )}
                <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: '0.1rem', opacity: 0.7 }}>
                    평단 {formatPrice(inv.avgPrice)}
                </div>
            </td>

            {/* ── 수량 ── */}
            <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', borderRight: '1px solid var(--border)', fontSize: '0.88rem' }}>
                {!isPrivate && inv.shares}
            </td>

            {/* ── 평가 / 손익 ── */}
            <td style={{ textAlign: 'right', padding: '0.75rem 0.75rem', borderRight: '1px solid var(--border)', color: plColor }}>
                {!isPrivate && (
                    <div style={{ fontSize: '0.88rem', fontWeight: '600' }}>{formatPrice(marketVal)}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                    {!isPrivate && (
                        <span style={{ fontSize: '0.72rem', fontWeight: '600' }}>
                            {pl >= 0 ? '+' : ''}{formatPrice(pl)}
                        </span>
                    )}
                    <span style={{ fontSize: isPrivate ? '1rem' : '0.7rem', fontWeight: '700' }}>
                        {plPercent >= 0 ? '▲' : '▼'} {Math.abs(plPercent).toFixed(2)}%
                    </span>
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
        </tr>
    );
};
