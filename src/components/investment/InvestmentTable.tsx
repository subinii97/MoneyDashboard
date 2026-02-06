import React from 'react';
import { Investment, AssetCategory } from '@/lib/types';
import { formatKRW, convertToKRW } from '@/lib/utils';
import { Edit2, Trash2, ArrowUpRight } from 'lucide-react';

interface InvestmentTableProps {
    investments: Investment[];
    title: string;
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

export const InvestmentTable: React.FC<InvestmentTableProps> = ({
    investments,
    title,
    rate,
    isPrivate,
    onEdit,
    onDelete,
    onTransaction
}) => {
    const calculateTotalValue = (list: Investment[]) => list.reduce((acc: number, s: Investment) => {
        const val = (s.currentPrice || s.avgPrice) * s.shares;
        return acc + convertToKRW(val, s.currency || 'KRW', rate);
    }, 0);

    const subTotal = calculateTotalValue(investments);

    const totalPL = investments.reduce((acc, s) => {
        const currentPrice = s.currentPrice || s.avgPrice;
        const pl = (currentPrice - s.avgPrice) * s.shares;
        return acc + convertToKRW(pl, s.currency || 'KRW', rate);
    }, 0);
    const totalPLPercent = (subTotal - totalPL) > 0 ? (totalPL / (subTotal - totalPL)) * 100 : 0;

    const dailyChange = investments.reduce((acc, s) => {
        const changeAmount = (s.change || 0) * s.shares;
        return acc + convertToKRW(changeAmount, s.currency || 'KRW', rate);
    }, 0);
    const dailyChangePercent = (subTotal - dailyChange) > 0 ? (dailyChange / (subTotal - dailyChange)) * 100 : 0;

    if (investments.length === 0) return null;

    return (
        <div style={{ padding: '1.5rem', marginBottom: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <span className="section-label" style={{ color: 'var(--muted)', marginBottom: '0.5rem' }}>Portfolio</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.01em' }}>{title}</h3>
                </div>
                <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
                    <div style={{ textAlign: 'left' }}>
                        <span className="section-label" style={{ marginBottom: '0.2rem' }}>Sub Total</span>
                        <div className="hero-value" style={{ fontSize: '1.75rem', filter: isPrivate ? 'blur(10px)' : 'none' }}>{formatKRW(subTotal)}</div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <span className="section-label" style={{ marginBottom: '0.2rem' }}>Daily Change</span>
                        <div style={{ fontSize: '1.2rem', color: dailyChange > 0 ? '#ef4444' : (dailyChange < 0 ? '#60a5fa' : 'var(--muted)'), fontWeight: '800', filter: isPrivate ? 'blur(8px)' : 'none' }}>
                            {dailyChange > 0 ? '+' : ''}{formatKRW(dailyChange)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: dailyChange > 0 ? '#ef4444' : (dailyChange < 0 ? '#60a5fa' : 'var(--muted)'), fontWeight: '600', opacity: 0.8 }}>
                            {dailyChange > 0 ? '▲' : (dailyChange < 0 ? '▼' : '')}{Math.abs(dailyChangePercent).toFixed(2)}%
                        </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <span className="section-label" style={{ marginBottom: '0.2rem' }}>Total Gain/Loss</span>
                        <div style={{ fontSize: '1.2rem', color: totalPL > 0 ? '#ef4444' : (totalPL < 0 ? '#60a5fa' : 'var(--muted)'), fontWeight: '800', filter: isPrivate ? 'blur(8px)' : 'none' }}>
                            {totalPL > 0 ? '+' : ''}{formatKRW(totalPL)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: totalPL > 0 ? '#ef4444' : (totalPL < 0 ? '#60a5fa' : 'var(--muted)'), fontWeight: '600', opacity: 0.8 }}>
                            {totalPL > 0 ? '▲' : (totalPL < 0 ? '▼' : '')}{Math.abs(totalPLPercent).toFixed(2)}%
                        </div>
                    </div>
                </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px', tableLayout: 'fixed' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: '0.875rem' }}>
                            <th style={{ padding: '0.85rem', width: '95px', textAlign: 'center' }}>시장</th>
                            <th style={{ width: 'auto', paddingLeft: '0.85rem', paddingRight: '0.85rem' }}>항목 정보</th>
                            <th style={{ width: '120px', textAlign: 'right', paddingRight: '1.2rem' }}>평단가</th>
                            <th style={{ width: '120px', textAlign: 'right', paddingRight: '1.2rem', paddingLeft: '0.8rem' }}>현재가</th>
                            <th style={{ width: '90px', textAlign: 'right', paddingRight: '1.2rem' }}>수량</th>
                            <th style={{ width: '150px', textAlign: 'right', paddingRight: '1.2rem' }}>평가액 (KRW)</th>
                            <th style={{ width: '190px', textAlign: 'right', paddingRight: '1.8rem' }}>수익률 (평가손익)</th>
                            <th style={{ textAlign: 'right', width: '90px', paddingRight: '1.2rem' }}>작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        {investments.map((inv) => {
                            const isUSD = inv.currency === 'USD';
                            const currentPrice = inv.currentPrice || inv.avgPrice;
                            const marketValRaw = currentPrice * inv.shares;
                            const marketValKRW = convertToKRW(marketValRaw, inv.currency || 'KRW', rate);
                            const costBasisKRW = convertToKRW(inv.avgPrice * inv.shares, inv.currency || 'KRW', rate);
                            const plKRW = marketValKRW - costBasisKRW;
                            const plPercent = costBasisKRW > 0 ? ((marketValKRW / costBasisKRW) - 1) * 100 : 0;
                            const ex = getExchangeStyle(inv.exchange || '');

                            return (
                                <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem 0.85rem', textAlign: 'center' }}>
                                        <span style={{ padding: '0.25rem 0.45rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '800', color: ex.color, backgroundColor: ex.bg, border: `1px solid ${ex.color}33` }}>{ex.label}</span>
                                    </td>
                                    <td style={{ paddingLeft: '0.85rem', paddingRight: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.98rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.name || inv.symbol}</div>
                                            {(inv.category || inv.marketType) && (
                                                <span style={{ fontSize: '0.62rem', padding: '1px 3px', borderRadius: '4px', border: '1px solid var(--border)', opacity: 0.6, fontWeight: 'bold' }}>
                                                    {inv.category
                                                        ? (inv.category.includes('Stock') ? '주식' : inv.category.includes('Index') ? '지수' : inv.category.includes('Bond') ? '채권' : '기타')
                                                        : '주식'
                                                    }
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--primary)', opacity: 0.8 }}>{inv.symbol}</div>
                                    </td>
                                    <td style={{ fontSize: '0.98rem', textAlign: 'right', paddingRight: '1.2rem' }}>
                                        {isUSD
                                            ? `$${inv.avgPrice.toLocaleString(undefined, { minimumFractionDigits: inv.avgPrice < 100 ? 4 : 2, maximumFractionDigits: inv.avgPrice < 100 ? 4 : 2 })}`
                                            : formatKRW(inv.avgPrice)}
                                    </td>
                                    <td style={{ fontSize: '0.98rem', fontWeight: '500', textAlign: 'right', paddingRight: '1.2rem', paddingLeft: '0.8rem' }}>
                                        <div>
                                            {isUSD
                                                ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: currentPrice < 100 ? 4 : 2, maximumFractionDigits: currentPrice < 100 ? 4 : 2 })}`
                                                : formatKRW(currentPrice)}
                                        </div>
                                        {inv.change !== undefined && (
                                            <div style={{ fontSize: '0.72rem', color: inv.change >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 'bold' }}>
                                                {inv.change >= 0 ? '▲' : '▼'}{Math.abs(inv.change).toLocaleString(undefined, {
                                                    minimumFractionDigits: isUSD ? 2 : 0,
                                                    maximumFractionDigits: isUSD ? 2 : 0
                                                })}
                                                ({Math.abs(inv.changePercent || 0).toFixed(2)}%)
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right', paddingRight: '1.2rem', filter: isPrivate ? 'blur(8px)' : 'none', userSelect: isPrivate ? 'none' : 'auto', pointerEvents: isPrivate ? 'none' : 'auto' }}>
                                        {inv.shares}
                                    </td>
                                    <td style={{ fontWeight: '600', fontSize: '0.98rem', textAlign: 'right', paddingRight: '1.2rem', filter: isPrivate ? 'blur(8px)' : 'none', userSelect: isPrivate ? 'none' : 'auto', pointerEvents: isPrivate ? 'none' : 'auto' }}>
                                        {formatKRW(marketValKRW)}
                                    </td>
                                    <td style={{ textAlign: 'right', paddingRight: '1.8rem', color: plKRW >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 'bold' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                                            {!isPrivate && (
                                                <div style={{ fontSize: '0.98rem', fontWeight: '700', opacity: 1 }}>
                                                    {plKRW >= 0 ? '+' : ''}{formatKRW(plKRW)}
                                                </div>
                                            )}
                                            <div style={{
                                                fontSize: isPrivate ? '1.1rem' : '0.82rem',
                                                opacity: isPrivate ? 0.9 : 0.8,
                                                fontWeight: isPrivate ? '600' : 'normal',
                                            }}>
                                                {plPercent >= 0 ? '▲' : '▼'} {Math.abs(plPercent).toFixed(2)}%
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => onTransaction(inv)}
                                                style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                                                title="거래 기록"
                                            >
                                                <ArrowUpRight size={18} />
                                            </button>
                                            <button onClick={() => onEdit(inv)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 size={18} /></button>
                                            <button onClick={() => onDelete(inv.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
