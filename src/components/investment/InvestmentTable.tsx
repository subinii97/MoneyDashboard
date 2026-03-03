'use client';

import React, { useState } from 'react';
import { Investment, Transaction } from '@/lib/types';
import { formatKRW, convertToKRW } from '@/lib/utils';
import { InvestmentTableRow } from './InvestmentTableRow';

interface InvestmentTableProps {
    investments: Investment[];
    transactions: Transaction[];
    title: string;
    rate: number;
    isPrivate: boolean;
    onEdit: (inv: Investment) => void;
    onDelete: (id: string) => void;
    onTransaction: (inv: Investment) => void;
}

export const InvestmentTable: React.FC<InvestmentTableProps> = ({
    investments, transactions, title, rate, isPrivate, onEdit, onDelete, onTransaction
}) => {
    const [sortKey, setSortKey] = useState<'rate' | 'weight'>('rate');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const toggleSort = (key: 'rate' | 'weight') => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };
    const subTotal = investments.reduce((acc, s) => {
        const val = (s.currentPrice || s.avgPrice) * s.shares;
        return acc + convertToKRW(val, s.currency || 'KRW', rate);
    }, 0);

    const totalPL = investments.reduce((acc, s) => {
        const pl = ((s.currentPrice || s.avgPrice) - s.avgPrice) * s.shares;
        return acc + convertToKRW(pl, s.currency || 'KRW', rate);
    }, 0);
    const totalPLPercent = (subTotal - totalPL) > 0 ? (totalPL / (subTotal - totalPL)) * 100 : 0;

    const dailyChange = investments.reduce((acc, s) => {
        const symbolTransactions = (transactions || []).filter(tx => tx.symbol === s.symbol);

        let netBoughtShares = 0;
        let txProfit = 0;
        const prevClose = (s.currentPrice || s.avgPrice) - (s.change || 0);

        symbolTransactions.forEach(tx => {
            const txShares = tx.shares || 0;
            const txPrice = tx.price || 0;
            if (tx.type === 'BUY') {
                netBoughtShares += txShares;
                txProfit += ((s.currentPrice || s.avgPrice) - txPrice) * txShares;
            } else if (tx.type === 'SELL') {
                netBoughtShares -= txShares;
                txProfit += (txPrice - prevClose) * txShares;
            }
        });

        // Shares held since yesterday
        const initialShares = s.shares - netBoughtShares;
        const initialSharesProfit = (s.change || 0) * initialShares;

        const totalAdjustedProfit = initialSharesProfit + txProfit;
        return acc + convertToKRW(totalAdjustedProfit, s.currency || 'KRW', rate);
    }, 0);
    const dailyChangePercent = (subTotal - dailyChange) > 0 ? (dailyChange / (subTotal - dailyChange)) * 100 : 0;

    if (investments.length === 0) return null;

    const renderSummaryItem = (label: string, value: number, percent: number, isSubTotal = false) => (
        <div style={{ textAlign: 'left' }}>
            <span className="section-label" style={{ marginBottom: '0.2rem' }}>{label}</span>
            {!isPrivate && (
                <div style={{
                    fontSize: isSubTotal ? '1.75rem' : '1.2rem',
                    fontWeight: '800',
                    color: !isSubTotal ? (value > 0 ? '#dc2626' : (value < 0 ? '#3b82f6' : 'var(--muted)')) : 'inherit'
                }}>
                    {(value > 0 && !isSubTotal ? '+' : '') + formatKRW(value)}
                </div>
            )}
            {!isSubTotal && (
                <div style={{
                    fontSize: isPrivate ? '1.6rem' : '1.15rem',
                    fontWeight: '800',
                    color: value > 0 ? '#dc2626' : (value < 0 ? '#3b82f6' : 'var(--muted)'),
                }}>
                    {(value > 0 ? '▲' : (value < 0 ? '▼' : '')) + Math.abs(percent).toFixed(2) + '%'}
                </div>
            )}
        </div>
    );


    return (
        <div style={{ padding: '1.5rem' }}>
            <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <span className="section-label" style={{ color: 'var(--muted)', marginBottom: '0.5rem' }}>포트폴리오</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{title}</h3>
                </div>
                <div className="flex-center" style={{ gap: '3rem', alignItems: 'flex-start' }}>
                    {!isPrivate && renderSummaryItem('평가금액', subTotal, 0, true)}
                    {renderSummaryItem('일간 변동', dailyChange, dailyChangePercent)}
                    {renderSummaryItem('총 손익', totalPL, totalPLPercent)}
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="dashboard-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'center', width: '38%' }}>종목</th>
                            <th style={{ textAlign: 'center', width: '16%' }}>{!isPrivate ? '현재가 / 전일대비 / 평단가' : '현재가 / 전일대비'}</th>
                            <th style={{ textAlign: 'center', width: '8%' }}>수량</th>
                            <th style={{ textAlign: 'center', width: '16%', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('rate')}>
                                평가 / 변동 {sortKey === 'rate' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th style={{ textAlign: 'center', width: '10%', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('weight')}>
                                매입 비중 {sortKey === 'weight' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th style={{ textAlign: 'center', width: '12%' }}>거래 / 수정 / 삭제</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...investments].sort((a, b) => {
                            const getRate = (inv: Investment) => {
                                const curr = inv.currentPrice || inv.avgPrice;
                                return inv.avgPrice > 0 ? ((curr - inv.avgPrice) / inv.avgPrice) : 0;
                            };
                            const getWeight = (inv: Investment) => {
                                const val = (inv.currentPrice || inv.avgPrice) * inv.shares;
                                return subTotal > 0 ? convertToKRW(val, inv.currency || 'KRW', rate) / subTotal : 0;
                            };
                            const valA = sortKey === 'rate' ? getRate(a) : getWeight(a);
                            const valB = sortKey === 'rate' ? getRate(b) : getWeight(b);
                            return sortDir === 'desc' ? valB - valA : valA - valB;
                        }).map((inv) => (
                            <InvestmentTableRow
                                key={inv.id}
                                inv={inv}
                                rate={rate}
                                isPrivate={isPrivate}
                                subTotal={subTotal}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onTransaction={onTransaction}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
