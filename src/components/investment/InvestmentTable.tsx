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
                    {!isPrivate && (
                        <div style={{ textAlign: 'left' }}>
                            <span className="section-label" style={{ marginBottom: '0.2rem' }}>Sub Total</span>
                            <div className="hero-value" style={{ fontSize: '1.75rem' }}>{formatKRW(subTotal)}</div>
                        </div>
                    )}
                    <div style={{ textAlign: 'left' }}>
                        <span className="section-label" style={{ marginBottom: '0.2rem' }}>Daily Change</span>
                        {!isPrivate && (
                            <div style={{ fontSize: '1.2rem', color: dailyChange > 0 ? '#ef4444' : (dailyChange < 0 ? '#60a5fa' : 'var(--muted)'), fontWeight: '800' }}>
                                {dailyChange > 0 ? '+' : ''}{formatKRW(dailyChange)}
                            </div>
                        )}
                        <div style={{ fontSize: '1.1rem', color: dailyChange > 0 ? '#ef4444' : (dailyChange < 0 ? '#60a5fa' : 'var(--muted)'), fontWeight: '700', padding: isPrivate ? '0.5rem 0' : '0' }}>
                            {dailyChange > 0 ? '▲' : (dailyChange < 0 ? '▼' : '')}{Math.abs(dailyChangePercent).toFixed(2)}%
                        </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <span className="section-label" style={{ marginBottom: '0.2rem' }}>Total Gain/Loss</span>
                        {!isPrivate && (
                            <div style={{ fontSize: '1.2rem', color: totalPL > 0 ? '#ef4444' : (totalPL < 0 ? '#60a5fa' : 'var(--muted)'), fontWeight: '800' }}>
                                {totalPL > 0 ? '+' : ''}{formatKRW(totalPL)}
                            </div>
                        )}
                        <div style={{ fontSize: '1.1rem', color: totalPL > 0 ? '#ef4444' : (totalPL < 0 ? '#60a5fa' : 'var(--muted)'), fontWeight: '700', padding: isPrivate ? '0.5rem 0' : '0' }}>
                            {totalPL > 0 ? '▲' : (totalPL < 0 ? '▼' : '')}{Math.abs(totalPLPercent).toFixed(2)}%
                        </div>
                    </div>
                </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px', tableLayout: 'fixed' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: '0.875rem' }}>
                            <th style={{ padding: '0.85rem', width: '90px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>거래소</th>
                            <th style={{ width: 'auto', paddingLeft: '0.85rem', paddingRight: '0.85rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>종목 정보</th>
                            <th style={{ width: '150px', paddingRight: '1.2rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>평단가</th>
                            <th style={{ width: '150px', paddingRight: '1.2rem', paddingLeft: '0.8rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>현재가</th>
                            <th style={{ width: '75px', padding: '0.85rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>수량</th>
                            <th style={{ width: '150px', paddingRight: '1.2rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>평가액</th>
                            <th style={{ width: '150px', paddingRight: '1.2rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>수익</th>
                            <th style={{ width: '85px', padding: '0.85rem', textAlign: 'center' }}>작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        {investments.map((inv) => {
                            const isUSD = inv.currency === 'USD';
                            const currentPrice = inv.currentPrice || inv.avgPrice;

                            // Raw values (in original currency)
                            const marketVal = currentPrice * inv.shares;
                            const costBasis = inv.avgPrice * inv.shares;
                            const pl = marketVal - costBasis;
                            const plPercent = costBasis > 0 ? ((marketVal / costBasis) - 1) * 100 : 0;

                            // KRW values for sorting/aggregation if needed (though aggregation is done in parent)
                            const marketValKRW = convertToKRW(marketVal, inv.currency || 'KRW', rate);
                            const plKRW = marketValKRW - convertToKRW(costBasis, inv.currency || 'KRW', rate); // Approx for summary consistency

                            const ex = getExchangeStyle(inv.exchange || '');

                            return (
                                <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem 0.85rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                        <span style={{ padding: '0.25rem 0.45rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '800', color: ex.color, backgroundColor: ex.bg, border: `1px solid ${ex.color}33` }}>{ex.label}</span>
                                    </td>
                                    <td style={{ paddingLeft: '0.85rem', paddingRight: '0.85rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'center' }}>
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
                                    <td style={{ fontSize: '0.98rem', textAlign: 'right', paddingRight: '1.2rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                        {isUSD
                                            ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem' }}>
                                                ${inv.avgPrice.toLocaleString(undefined, { minimumFractionDigits: inv.avgPrice < 100 ? 4 : 2, maximumFractionDigits: inv.avgPrice < 100 ? 4 : 2 })}
                                            </div>
                                            : Math.floor(inv.avgPrice).toLocaleString()}
                                    </td>
                                    <td style={{ fontSize: '0.98rem', fontWeight: '500', textAlign: 'right', paddingRight: '1.2rem', paddingLeft: '0.8rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div>
                                            {isUSD
                                                ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem' }}>
                                                    ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: currentPrice < 100 ? 4 : 2, maximumFractionDigits: currentPrice < 100 ? 4 : 2 })}
                                                </div>
                                                : Math.floor(currentPrice).toLocaleString()}
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
                                    <td style={{ textAlign: 'center', padding: '0.85rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                        {!isPrivate && inv.shares}
                                    </td>
                                    <td style={{ fontWeight: '600', fontSize: '0.98rem', textAlign: 'right', paddingRight: '1.2rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                        {!isPrivate && (isUSD
                                            ? `$${marketVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                            : Math.floor(marketVal).toLocaleString()
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right', paddingRight: '1.8rem', color: plKRW >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 'bold', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                                            {!isPrivate && (
                                                <div style={{ fontSize: '0.98rem', fontWeight: '700', opacity: 1 }}>
                                                    {pl >= 0 ? '+' : ''}
                                                    {isUSD
                                                        ? `$${pl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                        : Math.floor(pl).toLocaleString()
                                                    }
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
                                    <td style={{ textAlign: 'center', padding: '0.85rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
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
        </div >
    );
};
