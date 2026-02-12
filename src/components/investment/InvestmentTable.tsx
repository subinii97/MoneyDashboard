'use client';

import React from 'react';
import { Investment } from '@/lib/types';
import { formatKRW, convertToKRW } from '@/lib/utils';
import { InvestmentTableRow } from './InvestmentTableRow';

interface InvestmentTableProps {
    investments: Investment[];
    title: string;
    rate: number;
    isPrivate: boolean;
    onEdit: (inv: Investment) => void;
    onDelete: (id: string) => void;
    onTransaction: (inv: Investment) => void;
}

export const InvestmentTable: React.FC<InvestmentTableProps> = ({
    investments, title, rate, isPrivate, onEdit, onDelete, onTransaction
}) => {
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
        return acc + convertToKRW((s.change || 0) * s.shares, s.currency || 'KRW', rate);
    }, 0);
    const dailyChangePercent = (subTotal - dailyChange) > 0 ? (dailyChange / (subTotal - dailyChange)) * 100 : 0;

    if (investments.length === 0) return null;

    const renderSummaryItem = (label: string, value: number, percent: number, isSubTotal = false) => (
        <div style={{ textAlign: 'left' }}>
            <span className="section-label" style={{ marginBottom: '0.2rem' }}>{label}</span>
            {(!isPrivate || isSubTotal === false) && (
                <div style={{
                    fontSize: isSubTotal ? '1.75rem' : '1.2rem',
                    fontWeight: '800',
                    color: !isSubTotal ? (value > 0 ? '#ef4444' : (value < 0 ? '#60a5fa' : 'var(--muted)')) : 'inherit'
                }}>
                    {!isPrivate && (value > 0 && !isSubTotal ? '+' : '') + formatKRW(value)}
                </div>
            )}
            <div style={{
                fontSize: '1.1rem',
                fontWeight: '700',
                color: value > 0 ? '#ef4444' : (value < 0 ? '#60a5fa' : 'var(--muted)'),
                padding: isPrivate && !isSubTotal ? '0.5rem 0' : '0'
            }}>
                {!isSubTotal && (value > 0 ? '▲' : (value < 0 ? '▼' : '')) + Math.abs(percent).toFixed(2) + '%'}
            </div>
        </div>
    );

    return (
        <div style={{ padding: '1.5rem' }}>
            <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <span className="section-label" style={{ color: 'var(--muted)', marginBottom: '0.5rem' }}>Portfolio</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{title}</h3>
                </div>
                <div className="flex-center" style={{ gap: '3rem', alignItems: 'flex-start' }}>
                    {renderSummaryItem('Sub Total', subTotal, 0, true)}
                    {renderSummaryItem('Daily Change', dailyChange, dailyChangePercent)}
                    {renderSummaryItem('Total Gain/Loss', totalPL, totalPLPercent)}
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="dashboard-table" style={{ tableLayout: 'fixed', minWidth: '800px' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '90px', textAlign: 'center' }}>거래소</th>
                            <th style={{ width: 'auto', textAlign: 'center' }}>종목 정보</th>
                            <th style={{ width: '150px', textAlign: 'center' }}>평단가</th>
                            <th style={{ width: '150px', textAlign: 'center' }}>현재가</th>
                            <th style={{ width: '75px', textAlign: 'center' }}>수량</th>
                            <th style={{ width: '150px', textAlign: 'center' }}>평가액</th>
                            <th style={{ width: '150px', textAlign: 'center' }}>수익</th>
                            <th style={{ width: '85px', textAlign: 'center' }}>작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        {investments.map((inv) => (
                            <InvestmentTableRow
                                key={inv.id}
                                inv={inv}
                                rate={rate}
                                isPrivate={isPrivate}
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
