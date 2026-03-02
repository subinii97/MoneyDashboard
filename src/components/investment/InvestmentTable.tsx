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
                            <th style={{ textAlign: 'center', width: '36%' }}>종목</th>
                            <th style={{ textAlign: 'center', width: '20%' }}>{!isPrivate ? '현재가 / 전일대비 / 평단가' : '현재가 / 전일대비'}</th>
                            <th style={{ textAlign: 'center', width: '8%' }}>수량</th>
                            <th style={{ textAlign: 'center', width: '16%' }}>평가 / 변동</th>
                            <th style={{ textAlign: 'center', width: '20%' }}>거래 / 수정 / 삭제</th>



                        </tr>
                    </thead>
                    <tbody>
                        {[...investments].sort((a, b) => {
                            const getRate = (inv: Investment) => {
                                const curr = inv.currentPrice || inv.avgPrice;
                                return inv.avgPrice > 0 ? ((curr - inv.avgPrice) / inv.avgPrice) : 0;
                            };
                            return getRate(b) - getRate(a);
                        }).map((inv) => (
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
