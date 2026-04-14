'use client';

import React, { useState } from 'react';
import { formatKRW } from '@/lib/utils';
import { Calendar, ArrowLeftRight, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { RenderChange, formatValue } from './SettlementUtils';

// --- Shared Table Layout ---
interface SettlementTableProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    headerAction?: React.ReactNode;
    columns: string[];
}

const SettlementTableBase: React.FC<SettlementTableProps> = ({ title, icon, children, headerAction, columns }) => (
    <section style={{ marginBottom: '4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {icon}
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{title}</h2>
            </div>
            {headerAction}
        </div>
        <div className="glass" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
                        {columns.map((col, idx) => (
                            <th key={idx} style={{ 
                                padding: '1rem', textAlign: 'center', 
                                borderRight: idx < columns.length - 1 ? '1px solid var(--border)' : 'none' 
                            }}>{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    </section>
);

// --- Shared Metric Cell ---
const MetricCell = ({ current, change, percent, isPrivate, showPercentOnly, hidePercent }: any) => (
    <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
        <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatValue(current, isPrivate)}</div>
        <RenderChange val={change} percent={percent} showPercentOnly={showPercentOnly} hidePercent={hidePercent} isPrivate={isPrivate} />
    </td>
);

// --- 1. Daily Settlement Table ---
export const DailySettlementTable = ({ dailyGroupedByMonth, getDayOfWeek, monthIndex, setMonthIndex, isPrivate, onDelete }: any) => {
    const months = Object.keys(dailyGroupedByMonth).sort((a, b) => b.localeCompare(a));
    const currentMonth = months[monthIndex];
    const entries = dailyGroupedByMonth[currentMonth] || [];

    const monthSelector = months.length > 1 && (
        <div className="glass flex-center" style={{ gap: '1rem', padding: '0.4rem 0.8rem' }}>
            <button onClick={() => monthIndex < months.length - 1 && setMonthIndex(monthIndex + 1)} disabled={monthIndex >= months.length - 1} className="nav-btn"><ChevronLeft size={18} /></button>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', minWidth: '80px', textAlign: 'center' }}>{currentMonth?.replace('-', '년 ')}월</span>
            <button onClick={() => monthIndex > 0 && setMonthIndex(monthIndex - 1)} disabled={monthIndex <= 0} className="nav-btn"><ChevronRight size={18} /></button>
        </div>
    );

    return (
        <SettlementTableBase title="일별 정산" icon={<Calendar size={24} color="var(--primary)" />} headerAction={monthSelector} columns={['날짜', '현금/예금', '국내투자', '해외투자', '합계', '전일 대비', '관리']}>
            {entries.map((d: any) => (
                <tr key={d.date} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: '600' }}>{d.date.substring(5)}</div>
                        <div style={{ fontSize: '0.75rem', color: d.isLive ? 'var(--primary)' : 'var(--muted)', fontWeight: d.isLive ? '600' : 'normal' }}>
                            {(d.isLive && !d.isWeekendSettled) ? '미정' : `${getDayOfWeek(d.date)}요일`}
                        </div>
                    </td>
                    <MetricCell current={d.metrics.cash.current} change={d.metrics.cash.change} percent={d.metrics.cash.percent} isPrivate={isPrivate} hidePercent />
                    <MetricCell current={d.metrics.domestic.current} change={d.metrics.domestic.change} percent={d.metrics.domestic.percent} isPrivate={isPrivate} showPercentOnly />
                    <MetricCell current={d.metrics.overseas.current} change={d.metrics.overseas.change} percent={d.metrics.overseas.percent} isPrivate={isPrivate} showPercentOnly />
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', borderRight: '1px solid var(--border)' }}>{formatValue(d.totalValue, isPrivate)}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid var(--border)' }}><RenderChange val={d.change} percent={d.changePercent} isPrivate={isPrivate} /></td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <button onClick={() => onDelete?.(d.date)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.6 }} title="기록 삭제"><Trash2 size={16} /></button>
                    </td>
                </tr>
            ))}
        </SettlementTableBase>
    );
};

// --- 2. Monthly Settlement Table ---
export const MonthlySettlementTable = ({ monthlySettlements, setShowAddMonthly, isPrivate, onDelete }: any) => (
    <SettlementTableBase title="월별 정산" icon={<Calendar size={24} color="var(--primary)" />} columns={['월', '현금/예금', '국내투자', '해외투자', '합계', '전월 대비', '관리']}
        headerAction={<button onClick={() => setShowAddMonthly(true)} className="glass" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer' }}>과거 데이터 추가</button>}>
        {monthlySettlements.map((m: any) => (
            <tr key={m.month} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem', fontWeight: '600', textAlign: 'center', borderRight: '1px solid var(--border)' }}>{m.month}</td>
                <MetricCell current={m.metrics.cash.current} change={m.metrics.cash.change} percent={m.metrics.cash.percent} isPrivate={isPrivate} hidePercent />
                <MetricCell current={m.metrics.domestic.current} change={m.metrics.domestic.change} percent={m.metrics.domestic.percent} isPrivate={isPrivate} showPercentOnly />
                <MetricCell current={m.metrics.overseas.current} change={m.metrics.overseas.change} percent={m.metrics.overseas.percent} isPrivate={isPrivate} showPercentOnly />
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', borderRight: '1px solid var(--border)' }}>{formatValue(m.value, isPrivate)}</td>
                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid var(--border)' }}><RenderChange val={m.change} percent={m.changePercent} isPrivate={isPrivate} /></td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button onClick={() => onDelete?.(m.date)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.6 }} title="기록 삭제"><Trash2 size={16} /></button>
                </td>
            </tr>
        ))}
    </SettlementTableBase>
);

// --- 3. Weekly Settlement Table (with Expanded Transactions) ---
export const WeeklySettlementTable = ({ weeklySettlements, refreshTransactions, isPrivate }: any) => {
    const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
    const [editingTx, setEditingTx] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const toggleWeek = (period: string) => {
        setExpandedWeeks(prev => {
            const next = new Set(prev);
            if (next.has(period)) next.delete(period); else next.add(period);
            return next;
        });
    };

    const handleSaveTx = async () => {
        if (!editingTx) return; setIsSaving(true);
        try {
            const res = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingTx) });
            if (res.ok) { setEditingTx(null); if (refreshTransactions) await refreshTransactions(); } else alert('저장에 실패했습니다.');
        } catch (e) { console.error(e); alert('오류가 발생했습니다.'); } finally { setIsSaving(false); }
    };

    const handleDeleteTx = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return; setDeletingId(id);
        try {
            const res = await fetch('/api/transactions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
            if (res.ok) { if (refreshTransactions) await refreshTransactions(); } else alert('삭제에 실패했습니다.');
        } catch (e) { console.error(e); alert('오류가 발생했습니다.'); } finally { setDeletingId(null); }
    };

    return (
        <SettlementTableBase title="주별 정산 (월~토)" icon={<ArrowLeftRight size={24} color="var(--primary)" />} columns={['기간', '현금/예금', '국내투자', '해외투자', '합계', '전주 대비']}>
            {weeklySettlements.map((w: any) => {
                const hasTx = w.transactions && w.transactions.length > 0;
                const isExpanded = expandedWeeks.has(w.period);
                return (
                    <React.Fragment key={w.period}>
                        <tr onClick={() => hasTx && toggleWeek(w.period)} style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border)', cursor: hasTx ? 'pointer' : 'default', backgroundColor: isExpanded ? 'var(--white-5)' : 'transparent' }} className={hasTx ? 'hover-bg' : ''}>
                            <td style={{ padding: '1rem', fontWeight: '600', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                    {w.period} {hasTx && <span className="tx-count">{w.transactions.length}건 {isExpanded ? '▲' : '▼'}</span>}
                                </div>
                            </td>
                            <MetricCell current={w.metrics.cash.current} change={w.metrics.cash.change} percent={w.metrics.cash.percent} isPrivate={isPrivate} hidePercent />
                            <MetricCell current={w.metrics.domestic.current} change={w.metrics.domestic.change} percent={w.metrics.domestic.percent} isPrivate={isPrivate} showPercentOnly />
                            <MetricCell current={w.metrics.overseas.current} change={w.metrics.overseas.change} percent={w.metrics.overseas.percent} isPrivate={isPrivate} showPercentOnly />
                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', borderRight: '1px solid var(--border)' }}>{formatValue(w.value, isPrivate)}</td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}><RenderChange val={w.change} percent={w.changePercent} isPrivate={isPrivate} /></td>
                        </tr>
                        {isExpanded && hasTx && (
                            <tr style={{ backgroundColor: 'var(--white-5)' }}>
                                <td colSpan={6} style={{ padding: '1rem 2rem 2rem 2rem' }}>
                                    <div className="tx-details-pane">
                                        <div style={{ fontWeight: '700', marginBottom: '0.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <ArrowLeftRight size={16} /> 주간 거래 상세내역
                                        </div>
                                        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--muted)' }}>
                                                    {['날짜', '내용', '분류', '수량', '단가', '금액', '관리'].map((h, i) => (
                                                        <th key={i} style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)', textAlign: i >= 3 && i <= 5 ? 'right' : 'center' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {w.transactions.map((tx: any) => {
                                                    const isEditing = editingTx?.id === tx.id;
                                                    if (isEditing) return (
                                                        <tr key={tx.id}>
                                                            <td style={{ padding: '0.6rem' }}><input type="date" value={editingTx.date} onChange={e => setEditingTx({ ...editingTx, date: e.target.value })} className="tx-input" /></td>
                                                            <td style={{ padding: '0.6rem' }}><input type="text" value={editingTx.symbol || ''} onChange={e => setEditingTx({ ...editingTx, symbol: e.target.value })} className="tx-input" /></td>
                                                            <td style={{ padding: '0.6rem' }}>
                                                                <select value={editingTx.type} onChange={e => setEditingTx({ ...editingTx, type: e.target.value })} className="tx-input">
                                                                    <option value="BUY">매수</option><option value="SELL">매도</option><option value="DEPOSIT">입금</option><option value="WITHDRAW">출금</option>
                                                                </select>
                                                            </td>
                                                            <td style={{ padding: '0.6rem' }}><input type="number" value={editingTx.shares || ''} onChange={e => setEditingTx({ ...editingTx, shares: parseFloat(e.target.value) })} className="tx-input tr" /></td>
                                                            <td style={{ padding: '0.6rem' }}><input type="number" value={editingTx.price || ''} onChange={e => { const p = parseFloat(e.target.value); setEditingTx({ ...editingTx, price: p, amount: (editingTx.shares || 0) * p }); }} className="tx-input tr" /></td>
                                                            <td style={{ padding: '0.6rem' }}><input type="number" value={editingTx.amount || ''} onChange={e => setEditingTx({ ...editingTx, amount: parseFloat(e.target.value) })} className="tx-input tr" /></td>
                                                            <td style={{ padding: '0.3rem', textAlign: 'center' }}>
                                                                <button disabled={isSaving} onClick={handleSaveTx} className="btn-small p">저장</button>
                                                                <button onClick={() => setEditingTx(null)} className="btn-small m">취소</button>
                                                            </td>
                                                        </tr>
                                                    );
                                                    const color = tx.type === 'BUY' ? '#dc2626' : tx.type === 'SELL' ? '#2563eb' : tx.type === 'DEPOSIT' ? '#16a34a' : 'var(--muted)';
                                                    const label = tx.type === 'BUY' ? '매수' : tx.type === 'SELL' ? '매도' : tx.type === 'DEPOSIT' ? '입금' : '출금';
                                                    return (
                                                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--white-10)' }}>
                                                            <td style={{ padding: '0.6rem', color: 'var(--muted)', textAlign: 'center' }}>{tx.date.substring(5)}</td>
                                                            <td style={{ padding: '0.6rem', fontWeight: '600' }}>{tx.name ? `${tx.name} (${tx.symbol})` : (tx.symbol || tx.notes || '-')}</td>
                                                            <td style={{ padding: '0.6rem', color, fontWeight: '700', textAlign: 'center' }}>{label}</td>
                                                            <td style={{ padding: '0.6rem', textAlign: 'right', color: 'var(--muted)' }}>{tx.shares ? `${tx.shares}주` : '-'}</td>
                                                            <td style={{ padding: '0.6rem', textAlign: 'right', color: 'var(--muted)' }}>{tx.price ? formatValue(tx.price, isPrivate, tx.currency) : '-'}</td>
                                                            <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: '600' }}>{formatValue(tx.amount || (tx.price * tx.shares), isPrivate, tx.currency)}</td>
                                                            <td style={{ padding: '0.3rem', textAlign: 'center' }}>
                                                                <button onClick={() => setEditingTx({ ...tx })} className="btn-small-link">수정</button>
                                                                <button onClick={() => handleDeleteTx(tx.id)} disabled={deletingId === tx.id} className="btn-small-link-del">삭제</button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                );
            })}
            <style jsx>{`
                .nav-btn { background: none; border: none; cursor: pointer; color: var(--foreground); display:flex; align-items:center; justify-content:center; }
                .nav-btn:disabled { color: var(--muted); cursor: default; }
                .hover-bg:hover { background-color: var(--white-5) !important; }
                .tx-count { fontSize: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 4px; background: var(--primary); color: #fff; }
                .tx-details-pane { background: rgba(0,0,0,0.15); border-radius: 8px; padding: 1rem; border: 1px solid var(--border); }
                .tx-input { width: 100%; padding: 0.2rem; background: var(--white-5); color: var(--foreground); border: 1px solid var(--border); border-radius: 4px; font-size: 0.8rem; }
                .tr { text-align: right; }
                .btn-small { padding: 0.2rem 0.5rem; border: none; border-radius: 4px; cursor: pointer; font-size: 0.7rem; margin: 0 0.15rem; color: #fff; }
                .btn-small.p { background: var(--primary); }
                .btn-small.m { background: var(--muted); }
                .btn-small-link { background: none; border: 1px solid var(--border); color: var(--foreground); font-size: 0.7rem; padding: 0.2rem 0.4rem; border-radius: 4px; cursor: pointer; margin-right: 0.3rem; }
                .btn-small-link-del { background: none; border: 1px solid #ef4444; color: #ef4444; font-size: 0.7rem; padding: 0.2rem 0.4rem; border-radius: 4px; cursor: pointer; }
            `}</style>
        </SettlementTableBase>
    );
};
