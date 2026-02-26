'use client';

import React from 'react';
import { formatKRW } from '@/lib/utils';
import { TrendingUp, TrendingDown, Calendar, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface RenderChangeProps {
    val: number;
    percent: number;
    showPercentOnly?: boolean;
    hidePercent?: boolean;
}

const RenderChange: React.FC<RenderChangeProps> = ({ val, percent, showPercentOnly = false, hidePercent = false }) => {
    if (val === 0 && percent === 0) return <span style={{ color: 'var(--muted)' }}>-</span>;
    const isUp = val > 0 || (percent > 0 && !hidePercent);
    const Icon = isUp ? TrendingUp : TrendingDown;
    const color = isUp ? '#ef4444' : '#3b82f6';

    if (showPercentOnly) {
        if (hidePercent) return null;
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem', color, fontWeight: '600' }}>
                <Icon size={12} />
                <span>{Math.abs(percent).toFixed(2)}%</span>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color, fontWeight: '600' }}>
                <Icon size={14} />
                <span>{formatKRW(Math.abs(val))}</span>
            </div>
            {!hidePercent && (
                <span style={{ fontSize: '0.75rem', color, opacity: 0.8 }}>
                    {isUp ? '+' : '-'}{Math.abs(percent).toFixed(2)}%
                </span>
            )}
        </div>
    );
};

export const DailySettlementTable = ({ dailyGroupedByMonth, getDayOfWeek, monthIndex, setMonthIndex }: any) => {
    const months = Object.keys(dailyGroupedByMonth).sort((a, b) => b.localeCompare(a));
    const currentMonth = months[monthIndex];
    const entries = dailyGroupedByMonth[currentMonth] || [];

    return (
        <section style={{ marginBottom: '4rem' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Calendar size={24} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>일별 정산</h2>
                </div>

                {months.length > 1 && (
                    <div className="glass flex-center" style={{ gap: '1rem', padding: '0.4rem 0.8rem' }}>
                        <button
                            onClick={() => monthIndex < months.length - 1 && setMonthIndex(monthIndex + 1)}
                            disabled={monthIndex >= months.length - 1}
                            className="flex-center"
                            style={{ background: 'none', border: 'none', color: monthIndex >= months.length - 1 ? 'var(--border)' : 'white', cursor: 'pointer' }}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', minWidth: '80px', textAlign: 'center' }}>
                            {currentMonth?.replace('-', '년 ')}월
                        </span>
                        <button
                            onClick={() => monthIndex > 0 && setMonthIndex(monthIndex - 1)}
                            disabled={monthIndex <= 0}
                            className="flex-center"
                            style={{ background: 'none', border: 'none', color: monthIndex <= 0 ? 'var(--border)' : 'white', cursor: 'pointer' }}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                )}
            </div>

            <div className="glass" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>날짜</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>현금/예금</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>국내투자</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>해외투자</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>합계</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>전일 대비</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((d: any) => (
                            <tr key={d.date} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontWeight: '600' }}>{d.date.substring(5)}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{getDayOfWeek(d.date)}요일</div>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatKRW(d.metrics.cash.current)}</div>
                                    <RenderChange val={d.metrics.cash.change} percent={d.metrics.cash.percent} hidePercent />
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatKRW(d.metrics.domestic.current)}</div>
                                    <RenderChange val={d.metrics.domestic.change} percent={d.metrics.domestic.percent} showPercentOnly />
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatKRW(d.metrics.overseas.current)}</div>
                                    <RenderChange val={d.metrics.overseas.change} percent={d.metrics.overseas.percent} showPercentOnly />
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    {formatKRW(d.totalValue)}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <RenderChange val={d.change} percent={d.changePercent} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export const MonthlySettlementTable = ({ monthlySettlements, setShowAddMonthly }: any) => {
    return (
        <section style={{ marginBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Calendar size={24} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>월별 정산</h2>
                </div>
                <button onClick={() => setShowAddMonthly(true)} className="glass" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer' }}>
                    과거 데이터 추가
                </button>
            </div>
            <div className="glass" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>월</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>현금/예금</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>국내투자</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>해외투자</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>합계</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>전월 대비</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monthlySettlements.map((m: any) => (
                            <tr key={m.month} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem', fontWeight: '600', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{m.month}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{formatKRW(m.cashSavings)}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{formatKRW(m.domestic)}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{formatKRW(m.overseas)}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{formatKRW(m.value)}</td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <RenderChange val={m.change} percent={m.changePercent} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export const WeeklySettlementTable = ({ weeklySettlements }: any) => {
    return (
        <section style={{ marginBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <ArrowLeftRight size={24} color="var(--primary)" />
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>주별 정산 (월~토)</h2>
            </div>
            <div className="glass" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>기간</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>현금/예금</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>국내투자</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>해외투자</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>합계</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>전주 대비</th>
                        </tr>
                    </thead>
                    <tbody>
                        {weeklySettlements.map((w: any) => (
                            <tr key={w.period} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem', fontWeight: '600', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{w.period}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatKRW(w.metrics.cash.current)}</div>
                                    <RenderChange val={w.metrics.cash.change} percent={w.metrics.cash.percent} hidePercent />
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatKRW(w.metrics.domestic.current)}</div>
                                    <RenderChange val={w.metrics.domestic.change} percent={w.metrics.domestic.percent} showPercentOnly />
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatKRW(w.metrics.overseas.current)}</div>
                                    <RenderChange val={w.metrics.overseas.change} percent={w.metrics.overseas.percent} showPercentOnly />
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{formatKRW(w.value)}</td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <RenderChange val={w.change} percent={w.changePercent} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};
