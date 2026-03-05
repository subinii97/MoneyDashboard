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
    const [sortKey, setSortKey] = useState<'value' | 'plPercent' | 'dailyPercent' | 'weight'>('value');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const toggleSort = (key: 'value' | 'plPercent' | 'dailyPercent' | 'weight') => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };
    const getActivePrice = (s: Investment) => (s.isOverMarket && s.overMarketPrice !== undefined) ? s.overMarketPrice : (s.currentPrice || s.avgPrice);
    const getActiveChange = (s: Investment) => (s.isOverMarket && s.overMarketChange !== undefined) ? s.overMarketChange : (s.change || 0);

    const subTotal = investments.reduce((acc, s) => {
        const val = getActivePrice(s) * s.shares;
        return acc + convertToKRW(val, s.currency || 'KRW', rate);
    }, 0);

    const totalPL = investments.reduce((acc, s) => {
        const pl = (getActivePrice(s) - s.avgPrice) * s.shares;
        return acc + convertToKRW(pl, s.currency || 'KRW', rate);
    }, 0);
    const totalPLPercent = (subTotal - totalPL) > 0 ? (totalPL / (subTotal - totalPL)) * 100 : 0;

    const dailyChange = investments.reduce((acc, s) => {
        const c = getActiveChange(s);
        const dailyProfitForCurrentHoldings = c * s.shares;
        return acc + convertToKRW(dailyProfitForCurrentHoldings, s.currency || 'KRW', rate);
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
                            <th style={{ textAlign: 'center', width: '16%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    <span>현재가 /</span>
                                    <span style={{ cursor: 'pointer', transition: 'color 0.2s', color: sortKey === 'dailyPercent' ? 'var(--primary)' : 'inherit' }} onClick={() => toggleSort('dailyPercent')} title="일간 변동률 기준 정렬">
                                        전일대비{sortKey === 'dailyPercent' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
                                    </span>
                                    {!isPrivate && <span>/ 평단가</span>}
                                </div>
                            </th>
                            <th style={{ textAlign: 'center', width: '8%' }}>수량</th>
                            <th style={{ textAlign: 'center', width: '16%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <span style={{ cursor: 'pointer', transition: 'color 0.2s', color: sortKey === 'value' ? 'var(--primary)' : 'inherit' }} onClick={() => toggleSort('value')} title="평가액 기준 정렬">
                                        평가액{sortKey === 'value' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
                                    </span>
                                    <span style={{ opacity: 0.5 }}>|</span>
                                    <span style={{ cursor: 'pointer', transition: 'color 0.2s', color: sortKey === 'plPercent' ? 'var(--primary)' : 'inherit' }} onClick={() => toggleSort('plPercent')} title="총 수익률 기준 정렬">
                                        변동률{sortKey === 'plPercent' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
                                    </span>
                                </div>
                            </th>
                            <th style={{ textAlign: 'center', width: '10%', cursor: 'pointer', userSelect: 'none', color: sortKey === 'weight' ? 'var(--primary)' : 'inherit' }} onClick={() => toggleSort('weight')}>
                                매입 비중 {sortKey === 'weight' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th style={{ textAlign: 'center', width: '12%' }}>거래 / 수정 / 삭제</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...investments].sort((a, b) => {
                            const getVal = (inv: Investment) => getActivePrice(inv) * inv.shares;
                            const getPlPercent = (inv: Investment) => inv.avgPrice > 0 ? ((getActivePrice(inv) - inv.avgPrice) / inv.avgPrice) : 0;
                            const getDailyPercent = (inv: Investment) => (inv.isOverMarket && inv.overMarketChangePercent !== undefined) ? inv.overMarketChangePercent : (inv.changePercent || 0);

                            let valA = 0, valB = 0;
                            if (sortKey === 'value' || sortKey === 'weight') {
                                valA = getVal(a);
                                valB = getVal(b);
                            } else if (sortKey === 'plPercent') {
                                valA = getPlPercent(a);
                                valB = getPlPercent(b);
                            } else if (sortKey === 'dailyPercent') {
                                valA = getDailyPercent(a);
                                valB = getDailyPercent(b);
                            }

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
                        ))
                        }
                    </tbody>
                </table>
            </div>
        </div>
    );
};
