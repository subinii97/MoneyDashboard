'use client';

import React from 'react';
import { formatKRW } from '@/lib/utils';
import { Calendar, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';

import { RenderChange, formatValue } from './SettlementUtils';

export const DailySettlementTable = ({ dailyGroupedByMonth, getDayOfWeek, monthIndex, setMonthIndex , isPrivate}: any) => {
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
                            style={{ background: 'none', border: 'none', color: monthIndex >= months.length - 1 ? 'var(--muted)' : 'var(--foreground)', cursor: 'pointer' }}
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
                            style={{ background: 'none', border: 'none', color: monthIndex <= 0 ? 'var(--muted)' : 'var(--foreground)', cursor: 'pointer' }}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                )}
            </div>

            <div className="glass" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>날짜</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>현금/예금</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>국내투자</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>해외투자</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>합계</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>전일 대비</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((d: any) => (
                            <tr key={d.date} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: '600' }}>{d.date.substring(5)}</div>
                                    <div style={{ fontSize: '0.75rem', color: d.isLive ? 'var(--primary)' : 'var(--muted)', fontWeight: d.isLive ? '600' : 'normal' }}>
                                        {d.isLive ? '미정' : `${getDayOfWeek(d.date)}요일`}
                                    </div>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatValue(d.metrics.cash.current, isPrivate)}</div>
                                    <RenderChange val={d.metrics.cash.change} percent={d.metrics.cash.percent} hidePercent isPrivate={isPrivate} />
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatValue(d.metrics.domestic.current, isPrivate)}</div>
                                    <RenderChange val={d.metrics.domestic.change} percent={d.metrics.domestic.percent} showPercentOnly isPrivate={isPrivate} />
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatValue(d.metrics.overseas.current, isPrivate)}</div>
                                    <RenderChange val={d.metrics.overseas.change} percent={d.metrics.overseas.percent} showPercentOnly isPrivate={isPrivate} />
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', borderRight: '1px solid var(--border)' }}>
                                    {formatValue(d.totalValue, isPrivate)}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <RenderChange val={d.change} percent={d.changePercent} isPrivate={isPrivate} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export const MonthlySettlementTable = ({ monthlySettlements, setShowAddMonthly , isPrivate}: any) => {
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
                        <tr style={{ background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>월</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>현금/예금</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>국내투자</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>해외투자</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>합계</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>전월 대비</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monthlySettlements.map((m: any) => (
                            <tr key={m.month} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem', fontWeight: '600', textAlign: 'center', borderRight: '1px solid var(--border)' }}>{m.month}</td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatValue(m.metrics.cash.current, isPrivate)}</div>
                                    <RenderChange val={m.metrics.cash.change} percent={m.metrics.cash.percent} hidePercent isPrivate={isPrivate} />
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatValue(m.metrics.domestic.current, isPrivate)}</div>
                                    <RenderChange val={m.metrics.domestic.change} percent={m.metrics.domestic.percent} showPercentOnly isPrivate={isPrivate} />
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatValue(m.metrics.overseas.current, isPrivate)}</div>
                                    <RenderChange val={m.metrics.overseas.change} percent={m.metrics.overseas.percent} showPercentOnly isPrivate={isPrivate} />
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', borderRight: '1px solid var(--border)' }}>{formatValue(m.value, isPrivate)}</td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <RenderChange val={m.change} percent={m.changePercent} isPrivate={isPrivate} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export const WeeklySettlementTable = ({ weeklySettlements, refreshTransactions , isPrivate}: any) => {
    const [expandedWeeks, setExpandedWeeks] = React.useState<Set<string>>(new Set());
    
    // 수정 관련 상태 추가
    const [editingTx, setEditingTx] = React.useState<any>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);

    const toggleWeek = (period: string) => {
        setExpandedWeeks(prev => {
            const next = new Set(prev);
            if (next.has(period)) next.delete(period);
            else next.add(period);
            return next;
        });
    };

    const handleSaveTx = async () => {
        if (!editingTx) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingTx)
            });
            if (res.ok) {
                setEditingTx(null);
                if (refreshTransactions) await refreshTransactions();
            } else {
                alert('저장에 실패했습니다.');
            }
        } catch (e) {
            console.error(e);
            alert('오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTx = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        setDeletingId(id);
        try {
            const res = await fetch('/api/transactions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                if (refreshTransactions) await refreshTransactions();
            } else {
                alert('삭제에 실패했습니다.');
            }
        } catch (e) {
            console.error(e);
            alert('오류가 발생했습니다.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <section style={{ marginBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <ArrowLeftRight size={24} color="var(--primary)" />
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>주별 정산 (월~토)</h2>
            </div>
            <div className="glass" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>기간</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>현금/예금</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>국내투자</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>해외투자</th>
                            <th style={{ padding: '1rem', textAlign: 'center', borderRight: '1px solid var(--border)' }}>합계</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>전주 대비</th>
                        </tr>
                    </thead>
                    <tbody>
                        {weeklySettlements.map((w: any) => {
                            const hasTx = w.transactions && w.transactions.length > 0;
                            const isExpanded = expandedWeeks.has(w.period);

                            return (
                                <React.Fragment key={w.period}>
                                    <tr 
                                        onClick={() => hasTx && toggleWeek(w.period)}
                                        style={{ 
                                            borderBottom: isExpanded ? 'none' : '1px solid var(--border)', 
                                            cursor: hasTx ? 'pointer' : 'default',
                                            transition: 'background-color 0.2s',
                                            backgroundColor: isExpanded ? 'var(--white-5)' : 'transparent'
                                        }}
                                        className={hasTx ? 'hover-bg' : ''}
                                    >
                                        <td style={{ padding: '1rem', fontWeight: '600', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                                {w.period}
                                                {hasTx && (
                                                    <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--primary)', color: '#fff' }}>
                                                        {w.transactions.length}건 {isExpanded ? '▲' : '▼'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
                                            <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatValue(w.metrics.cash.current, isPrivate)}</div>
                                            <RenderChange val={w.metrics.cash.change} percent={w.metrics.cash.percent} hidePercent isPrivate={isPrivate} />
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
                                            <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatValue(w.metrics.domestic.current, isPrivate)}</div>
                                            <RenderChange val={w.metrics.domestic.change} percent={w.metrics.domestic.percent} showPercentOnly isPrivate={isPrivate} />
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', borderRight: '1px solid var(--border)' }}>
                                            <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{formatValue(w.metrics.overseas.current, isPrivate)}</div>
                                            <RenderChange val={w.metrics.overseas.change} percent={w.metrics.overseas.percent} showPercentOnly isPrivate={isPrivate} />
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', borderRight: '1px solid var(--border)' }}>{formatValue(w.value, isPrivate)}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <RenderChange val={w.change} percent={w.changePercent} isPrivate={isPrivate} />
                                        </td>
                                    </tr>

                                    {/* 과거 거래내역 펼치기 섹션 */}
                                    {isExpanded && hasTx && (
                                        <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--white-5)' }}>
                                            <td colSpan={6} style={{ padding: '1rem 2rem 2rem 2rem' }}>
                                                <div style={{ 
                                                    background: 'rgba(0, 0, 0, 0.15)', 
                                                    borderRadius: '8px', 
                                                    padding: '1rem',
                                                    border: '1px solid var(--border)' 
                                                }}>
                                                    <div style={{ fontWeight: '700', marginBottom: '0.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <ArrowLeftRight size={16} /> 주간 거래 상세내역
                                                    </div>
                                                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', textAlign: 'center' }}>
                                                        <thead>
                                                            <tr style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--muted)' }}>
                                                                <th style={{ padding: '0.6rem', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>날짜</th>
                                                                <th style={{ padding: '0.6rem', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>내용 (티커/심볼)</th>
                                                                <th style={{ padding: '0.6rem', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>분류</th>
                                                                <th style={{ padding: '0.6rem', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>수량</th>
                                                                <th style={{ padding: '0.6rem', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>단가</th>
                                                                <th style={{ padding: '0.6rem', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>금액 (총액)</th>
                                                                <th style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)' }}>관리</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {w.transactions.map((tx: any) => {
                                                                const isBuy = tx.type === 'BUY';
                                                                const isSell = tx.type === 'SELL';
                                                                const isDep = tx.type === 'DEPOSIT';
                                                                
                                                                let typeText = isBuy ? '매수' : isSell ? '매도' : isDep ? '입금' : '출금';
                                                                let typeColor = isBuy ? '#dc2626' : isSell ? '#2563eb' : isDep ? '#16a34a' : 'var(--muted)';
                                                                
                                                                const isEditing = editingTx?.id === tx.id;
                                                                const isDeleting = deletingId === tx.id;

                                                                if (isEditing) {
                                                                    return (
                                                                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--white-10)' }}>
                                                                            <td style={{ padding: '0.6rem' }}>
                                                                                <input 
                                                                                    type="date" 
                                                                                    value={editingTx.date} 
                                                                                    onChange={e => setEditingTx({...editingTx, date: e.target.value})}
                                                                                    style={{ width: '100px', padding: '0.2rem', background: 'var(--white-5)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '4px' }}
                                                                                />
                                                                            </td>
                                                                            <td style={{ padding: '0.6rem' }}>
                                                                                <input 
                                                                                    type="text" 
                                                                                    placeholder="심볼/메모"
                                                                                    value={editingTx.symbol || ''} 
                                                                                    onChange={e => setEditingTx({...editingTx, symbol: e.target.value})}
                                                                                    style={{ width: '80px', padding: '0.2rem', background: 'var(--white-5)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '4px' }}
                                                                                />
                                                                            </td>
                                                                            <td style={{ padding: '0.6rem' }}>
                                                                                <select
                                                                                    value={editingTx.type}
                                                                                    onChange={e => setEditingTx({...editingTx, type: e.target.value})}
                                                                                    style={{ padding: '0.2rem', background: 'var(--white-5)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '4px' }}
                                                                                >
                                                                                    <option value="BUY">매수</option>
                                                                                    <option value="SELL">매도</option>
                                                                                    <option value="DEPOSIT">입금</option>
                                                                                    <option value="WITHDRAW">출금</option>
                                                                                </select>
                                                                            </td>
                                                                            <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                                                                                <input 
                                                                                    type="number" 
                                                                                    value={editingTx.shares || ''} 
                                                                                    onChange={e => setEditingTx({...editingTx, shares: parseFloat(e.target.value)})}
                                                                                    style={{ width: '60px', padding: '0.2rem', textAlign: 'right', background: 'var(--white-5)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '4px' }}
                                                                                />
                                                                            </td>
                                                                            <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                                                                                <input 
                                                                                    type="number" 
                                                                                    value={editingTx.price || ''} 
                                                                                    onChange={e => {
                                                                                        const price = parseFloat(e.target.value);
                                                                                        setEditingTx({...editingTx, price, amount: (editingTx.shares || 0) * price});
                                                                                    }}
                                                                                    style={{ width: '80px', padding: '0.2rem', textAlign: 'right', background: 'var(--white-5)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '4px' }}
                                                                                />
                                                                            </td>
                                                                            <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                                                                               <input 
                                                                                    type="number" 
                                                                                    value={editingTx.amount || ''} 
                                                                                    onChange={e => setEditingTx({...editingTx, amount: parseFloat(e.target.value)})}
                                                                                    style={{ width: '100px', padding: '0.2rem', textAlign: 'right', background: 'var(--white-5)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '4px' }}
                                                                                />
                                                                            </td>
                                                                            <td style={{ padding: '0.3rem', textAlign: 'center' }}>
                                                                                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                                                                                    <button 
                                                                                        disabled={isSaving}
                                                                                        onClick={handleSaveTx}
                                                                                        style={{ padding: '0.2rem 0.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>
                                                                                        {isSaving ? '...' : '저장'}
                                                                                    </button>
                                                                                    <button 
                                                                                        disabled={isSaving}
                                                                                        onClick={() => setEditingTx(null)}
                                                                                        style={{ padding: '0.2rem 0.5rem', background: 'var(--muted)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>
                                                                                        취소
                                                                                    </button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                }

                                                                return (
                                                                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--white-10)' }}>
                                                                        <td style={{ padding: '0.6rem', color: 'var(--muted)' }}>{tx.date.substring(5)}</td>
                                                                        <td style={{ padding: '0.6rem', fontWeight: '600' }}>
                                                                            {tx.name ? `${tx.name} (${tx.symbol})` : (tx.symbol || tx.notes || '-')}
                                                                        </td>
                                                                        <td style={{ padding: '0.6rem', color: typeColor, fontWeight: '700' }}>
                                                                            {typeText}
                                                                        </td>
                                                                        <td style={{ padding: '0.6rem', textAlign: 'right', color: 'var(--muted)' }}>
                                                                            {tx.shares ? `${tx.shares}주` : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '0.6rem', textAlign: 'right', color: 'var(--muted)' }}>
                                                                            {tx.price ? `${tx.price.toLocaleString()} ${tx.currency}` : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: '600' }}>
                                                                            {formatValue(tx.amount || (tx.price * tx.shares), isPrivate)} {tx.currency !== 'KRW' && <span style={{fontSize: '0.7rem', opacity: 0.6}}>({tx.currency})</span>}
                                                                        </td>
                                                                        <td style={{ padding: '0.3rem', textAlign: 'center' }}>
                                                                            <button
                                                                                onClick={() => setEditingTx({...tx})}
                                                                                className="hover-opacity"
                                                                                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--foreground)', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', marginRight: '0.3rem' }}
                                                                            >수정</button>
                                                                            <button
                                                                                onClick={() => handleDeleteTx(tx.id)}
                                                                                disabled={isDeleting}
                                                                                className="hover-opacity"
                                                                                style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                                                                            >{isDeleting ? '...' : '삭제'}</button>
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
                    </tbody>
                </table>
            </div>
            <style jsx>{`
                .hover-bg:hover {
                    background-color: var(--white-5) !important;
                }
            `}</style>
        </section>
    );
};
