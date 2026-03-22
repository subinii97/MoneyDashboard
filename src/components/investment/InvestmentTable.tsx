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
    yesterdayRate?: number;
    isPrivate: boolean;
    onEdit: (inv: Investment) => void;
    onDelete: (id: string) => void;
    onTransaction: (inv: Investment) => void;
}

export const InvestmentTable: React.FC<InvestmentTableProps> = ({
    investments, transactions, title, rate, yesterdayRate, isPrivate, onEdit, onDelete, onTransaction
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

    const todayBuySymbols = new Set(
        transactions
            .filter(t => t.type === 'BUY')
            .map(t => t.symbol?.toUpperCase().trim())
            .filter(Boolean)
    );

    const getActiveChange = (s: Investment) => {
        const activePrice = getActivePrice(s);
        if (todayBuySymbols.has(s.symbol?.toUpperCase().trim())) {
            return activePrice - s.avgPrice;
        }
        return (s.isOverMarket && s.overMarketChange !== undefined) ? s.overMarketChange : (s.change || 0);
    };

    const getActiveChangePercent = (s: Investment) => {
        if (todayBuySymbols.has(s.symbol?.toUpperCase().trim())) {
            return s.avgPrice > 0 ? ((getActivePrice(s) - s.avgPrice) / s.avgPrice) * 100 : 0;
        }
        return (s.isOverMarket && s.overMarketChangePercent !== undefined) ? s.overMarketChangePercent : (s.changePercent || 0);
    };

    const subTotal = investments.reduce((acc, s) => {
        const val = getActivePrice(s) * s.shares;
        return acc + convertToKRW(val, s.currency || 'KRW', rate);
    }, 0);

    const isDomestic = title.includes('국내');
    const sellTransactions = transactions.filter(t => {
        if (t.type !== 'SELL' || !t.symbol || !t.shares || !t.price) return false;
        const matchingInv = investments.find(inv => inv.symbol.toUpperCase().trim() === t.symbol!.toUpperCase().trim());
        if (matchingInv) return true;
        return isDomestic ? (t.currency === 'KRW') : (t.currency === 'USD');
    });

    const realizedPL = sellTransactions.reduce((acc, t) => {
        const sellPrice = t.price!;
        const shares = t.shares!;
        let costBasis = t.costBasis;
        if (!costBasis) {
            const inv = investments.find(inv => inv.symbol.toUpperCase().trim() === t.symbol!.toUpperCase().trim());
            costBasis = inv?.avgPrice;
        }
        if (!costBasis) return acc;
        const pl = (sellPrice - costBasis) * shares;
        return acc + convertToKRW(pl, t.currency || 'KRW', rate);
    }, 0);

    const unrealizedPL = investments.reduce((acc, s) => {
        const pl = (getActivePrice(s) - s.avgPrice) * s.shares;
        return acc + convertToKRW(pl, s.currency || 'KRW', rate);
    }, 0);

    const totalPL = unrealizedPL + realizedPL;
    const totalCost = subTotal - unrealizedPL;
    const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

    // Pure USD return computation (original math, matches Investment tab's original USD identical percent)
    const dailyChangePureValue = investments.reduce((acc, s) => {
        const c = getActiveChange(s);
        const dailyProfitForCurrentHoldings = c * s.shares;
        return acc + convertToKRW(dailyProfitForCurrentHoldings, s.currency || 'KRW', rate);
    }, 0) + realizedPL;
    const pureUSDPercent = (subTotal - dailyChangePureValue) > 0 ? (dailyChangePureValue / (subTotal - dailyChangePureValue)) * 100 : 0;

    let dailyChangeDispValue = dailyChangePureValue;
    let dailyPercentDisp: number | { krw: number; usd: number } = pureUSDPercent;

    if (!isDomestic && yesterdayRate && yesterdayRate !== rate && investments.length > 0) {
        // Compute True KRW daily difference
        const prevSubTotalTrueKRW = investments.reduce((acc, s) => {
            const activePrice = getActivePrice(s);
            const activeChange = getActiveChange(s);
            const prevPrice = activePrice - activeChange;
            // Converting yesterday's USD principal into KRW using YESTERDAY'S exchange rate
            return acc + convertToKRW(prevPrice * s.shares, s.currency || 'KRW', yesterdayRate);
        }, 0);

        const currSubTotalTrueKRW = investments.reduce((acc, s) => {
            const activePrice = getActivePrice(s);
            // Converting today's USD principal into KRW using TODAY'S exchange rate
            return acc + convertToKRW(activePrice * s.shares, s.currency || 'KRW', rate);
        }, 0);

        const trueDailyChangeKRW = (currSubTotalTrueKRW - prevSubTotalTrueKRW) + realizedPL;
        const trueKRWPercent = prevSubTotalTrueKRW > 0 ? (trueDailyChangeKRW / prevSubTotalTrueKRW) * 100 : 0;

        dailyChangeDispValue = trueDailyChangeKRW;
        dailyPercentDisp = { krw: trueKRWPercent, usd: pureUSDPercent };
    }

    if (investments.length === 0) return null;

    const renderSummaryItem = (label: string, value: number, percent: number | { krw: number; usd: number }, isSubTotal = false) => {
        let percentEl;
        if (typeof percent === 'number') {
            percentEl = (
                <div style={{
                    fontSize: isPrivate ? '1.6rem' : '1.15rem',
                    fontWeight: '800',
                    color: value > 0 ? '#dc2626' : (value < 0 ? '#3b82f6' : 'var(--muted)'),
                }}>
                    {(value > 0 ? '▲' : (value < 0 ? '▼' : '')) + Math.abs(percent).toFixed(2) + '%'}
                </div>
            );
        } else {
            percentEl = (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem', marginTop: '0.2rem' }}>
                    <div style={{
                        fontSize: isPrivate ? '1.5rem' : '1.05rem',
                        fontWeight: '800',
                        color: percent.krw > 0 ? '#dc2626' : (percent.krw < 0 ? '#3b82f6' : 'var(--muted)'),
                    }}>
                        {(percent.krw > 0 ? '▲' : (percent.krw < 0 ? '▼' : '')) + Math.abs(percent.krw).toFixed(2) + '% '}<span style={{fontSize: '0.8em', opacity: 0.8}}>(원화)</span>
                    </div>
                    <div style={{
                        fontSize: isPrivate ? '1.35rem' : '0.95rem',
                        fontWeight: '700',
                        color: percent.usd > 0 ? '#dc2626' : (percent.usd < 0 ? '#3b82f6' : 'var(--muted)'),
                    }}>
                        {(percent.usd > 0 ? '▲' : (percent.usd < 0 ? '▼' : '')) + Math.abs(percent.usd).toFixed(2) + '% '}<span style={{fontSize: '0.8em', opacity: 0.8}}>(외화)</span>
                    </div>
                </div>
            );
        }

        return (
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
                {!isSubTotal && percentEl}
            </div>
        );
    };

    return (
        <div style={{ padding: '1.5rem' }}>
            <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <span className="section-label" style={{ color: 'var(--muted)', marginBottom: '0.5rem' }}>포트폴리오</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{title}</h3>
                </div>
                <div className="flex-center" style={{ gap: '3rem', alignItems: 'flex-start' }}>
                    {!isPrivate && renderSummaryItem('평가금액', subTotal, 0, true)}
                    {renderSummaryItem('일간 변동', dailyChangeDispValue, dailyPercentDisp)}
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
                            const getDailyPercent = (inv: Investment) => getActiveChangePercent(inv);

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
