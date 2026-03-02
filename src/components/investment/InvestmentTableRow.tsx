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


    return (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                <span style={{ padding: '0.25rem 0.45rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '800', color: ex.color, backgroundColor: ex.bg, border: `1px solid ${ex.color}33` }}>{ex.label}</span>
            </td>
            <td style={{ borderRight: '1px solid var(--border)', paddingLeft: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{inv.name || inv.symbol}</div>
                    {(inv.category || inv.marketType) && (
                        <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '4px', border: '1px solid var(--border)', opacity: 0.55, flexShrink: 0 }}>
                            {inv.category?.includes('Stock') ? '주식' : inv.category?.includes('Index') ? '지수' : '주식'}
                        </span>
                    )}
                </div>
                <div style={{ marginTop: '0.15rem' }}>
                    <span style={{
                        fontFamily: 'monospace',
                        fontSize: '0.68rem',
                        fontWeight: '600',
                        letterSpacing: '0.03em',
                        color: 'var(--muted)',
                        opacity: 0.75,
                    }}>
                        {inv.symbol}
                    </span>
                </div>
            </td>

            <td style={{ textAlign: 'right', paddingRight: '1.2rem', borderRight: '1px solid var(--border)' }}>
                {formatPrice(inv.avgPrice)}
            </td>
            <td style={{ textAlign: 'right', paddingRight: '1.2rem', borderRight: '1px solid var(--border)' }}>
                <div style={{ fontWeight: '500' }}>{formatPrice(currentPrice)}</div>
                {inv.change !== undefined && (
                    <div style={{ fontSize: '0.72rem', color: inv.change >= 0 ? '#dc2626' : '#2563eb', fontWeight: 'bold' }}>
                        {inv.change >= 0 ? '▲' : '▼'}{Math.abs(inv.change).toLocaleString(undefined, { maximumFractionDigits: isUSD ? 2 : 0 })} ({Math.abs(inv.changePercent || 0).toFixed(2)}%)
                    </div>
                )}
            </td>
            <td style={{ textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                {!isPrivate && inv.shares}
            </td>
            <td style={{ textAlign: 'right', paddingRight: '1.2rem', borderRight: '1px solid var(--border)' }}>
                {!isPrivate && formatPrice(marketVal)}
            </td>
            <td style={{ textAlign: 'right', paddingRight: '1.8rem', color: plKRW >= 0 ? '#dc2626' : '#2563eb', borderRight: '1px solid var(--border)' }}>
                <div className="flex-col" style={{ alignItems: 'flex-end' }}>
                    {!isPrivate && (
                        <div style={{ fontSize: '0.98rem', fontWeight: '700' }}>
                            {pl >= 0 ? '+' : ''}{formatPrice(pl)}
                        </div>
                    )}
                    <div style={{ fontSize: isPrivate ? '1.1rem' : '0.82rem', fontWeight: isPrivate ? '600' : 'normal' }}>
                        {plPercent >= 0 ? '▲' : '▼'} {Math.abs(plPercent).toFixed(2)}%
                    </div>
                </div>
            </td>
            <td>
                <div className="flex-center" style={{ gap: '0.5rem' }}>
                    <button onClick={() => onTransaction(inv)} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}><ArrowUpRight size={18} /></button>
                    <button onClick={() => onEdit(inv)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 size={18} /></button>
                    <button onClick={() => onDelete(inv.id)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                </div>
            </td>
        </tr>
    );
};
