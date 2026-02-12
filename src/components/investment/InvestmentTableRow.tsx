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
        'KRX': { label: 'KOSPI', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
        'KOSDAQ': { label: 'KOSDAQ', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.1)' },
        'NASDAQ': { label: 'NASDAQ', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
        'NYSE': { label: 'NYSE', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
    };
    const upper = ex?.toUpperCase() || '';
    return map[upper] || { label: '기타', color: 'var(--muted)', bg: 'rgba(255, 255, 255, 0.05)' };
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
        return isUSD
            ? `$${price.toLocaleString(undefined, { minimumFractionDigits: price < 100 ? 4 : 2, maximumFractionDigits: price < 100 ? 4 : 2 })}`
            : Math.floor(price).toLocaleString();
    };

    return (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ padding: '0.25rem 0.45rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '800', color: ex.color, backgroundColor: ex.bg, border: `1px solid ${ex.color}33` }}>{ex.label}</span>
            </td>
            <td style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex-center" style={{ gap: '0.45rem' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.98rem' }}>{inv.name || inv.symbol}</div>
                    {(inv.category || inv.marketType) && (
                        <span style={{ fontSize: '0.62rem', padding: '1px 3px', borderRadius: '4px', border: '1px solid var(--border)', opacity: 0.6 }}>
                            {inv.category?.includes('Stock') ? '주식' : inv.category?.includes('Index') ? '지수' : '주식'}
                        </span>
                    )}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--primary)', opacity: 0.8, textAlign: 'center' }}>{inv.symbol}</div>
            </td>
            <td style={{ textAlign: 'right', paddingRight: '1.2rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                {formatPrice(inv.avgPrice)}
            </td>
            <td style={{ textAlign: 'right', paddingRight: '1.2rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontWeight: '500' }}>{formatPrice(currentPrice)}</div>
                {inv.change !== undefined && (
                    <div style={{ fontSize: '0.72rem', color: inv.change >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 'bold' }}>
                        {inv.change >= 0 ? '▲' : '▼'}{Math.abs(inv.change).toLocaleString(undefined, { maximumFractionDigits: isUSD ? 2 : 0 })} ({Math.abs(inv.changePercent || 0).toFixed(2)}%)
                    </div>
                )}
            </td>
            <td style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                {!isPrivate && inv.shares}
            </td>
            <td style={{ textAlign: 'right', paddingRight: '1.2rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                {!isPrivate && formatPrice(marketVal)}
            </td>
            <td style={{ textAlign: 'right', paddingRight: '1.8rem', color: plKRW >= 0 ? '#ef4444' : '#3b82f6', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
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
                    <button onClick={() => onDelete(inv.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                </div>
            </td>
        </tr>
    );
};
