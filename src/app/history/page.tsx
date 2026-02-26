'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useHistoryData } from '@/hooks/useHistoryData';
import CumulativeReturnChart from '@/components/history/CumulativeReturnChart';
import { DailySettlementTable, WeeklySettlementTable, MonthlySettlementTable } from '@/components/history/SettlementTables';
import SettlementTrendChart from '@/components/history/SettlementTrendChart';

export default function HistoryPage() {
    const router = useRouter();
    const {
        dailySettlements,
        dailyGroupedByMonth,
        weeklySettlements,
        monthlySettlements,
        loading,
        setHistory
    } = useHistoryData();

    const [showAddMonthly, setShowAddMonthly] = useState(false);
    const [newMonthly, setNewMonthly] = useState({ month: '', value: '', cash: '', domestic: '', overseas: '' });
    const [dailyMonthIndex, setDailyMonthIndex] = useState(0);
    const [comparisonData, setComparisonData] = useState<any[]>([]);
    const [comparisonScope, setComparisonScope] = useState<'1w' | '2w' | '1m' | '3m'>('1m');

    useEffect(() => {
        const fetchComparison = async () => {
            try {
                const res = await fetch(`/api/history/comparison?scope=${comparisonScope}`);
                const data = await res.json();
                setComparisonData(data);
            } catch (err) {
                console.error('Failed to fetch comparison data', err);
            }
        };
        fetchComparison();
    }, [comparisonScope]);

    const handleAddMonthly = async () => {
        if (!newMonthly.month || !newMonthly.value) return;
        try {
            const res = await fetch('/api/snapshot/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: `${newMonthly.month}-01`,
                    totalValue: Number(newMonthly.value.replace(/,/g, '')),
                    allocations: [
                        { category: 'Cash', value: Number(newMonthly.cash.replace(/,/g, '')), currency: 'KRW' },
                        { category: 'Domestic Stock', value: Number(newMonthly.domestic.replace(/,/g, '')), currency: 'KRW' },
                        { category: 'Overseas Stock', value: Number(newMonthly.overseas.replace(/,/g, '')), currency: 'KRW' }
                    ]
                })
            });
            if (res.ok) {
                const updated = await fetch('/api/snapshot?includeHoldings=true').then(r => r.json());
                setHistory(updated);
                setShowAddMonthly(false);
                setNewMonthly({ month: '', value: '', cash: '', domestic: '', overseas: '' });
            }
        } catch (err) {
            console.error('Failed to add manual data', err);
        }
    };

    const getDayOfWeek = (dateStr: string) => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const date = new Date(dateStr);
        return days[date.getDay()];
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

    return (
        <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={() => router.push('/')} className="glass" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft size={20} />
                </button>
                <h1 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.02em' }}>내역 관리</h1>
            </div>

            <SettlementTrendChart
                dailyData={dailySettlements}
                weeklyData={weeklySettlements}
                monthlyData={monthlySettlements}
            />

            <CumulativeReturnChart
                data={comparisonData}
                scope={comparisonScope}
                onScopeChange={setComparisonScope}
            />

            <DailySettlementTable
                dailyGroupedByMonth={dailyGroupedByMonth}
                getDayOfWeek={getDayOfWeek}
                monthIndex={dailyMonthIndex}
                setMonthIndex={setDailyMonthIndex}
            />

            <WeeklySettlementTable
                weeklySettlements={weeklySettlements}
            />

            <MonthlySettlementTable
                monthlySettlements={monthlySettlements}
                setShowAddMonthly={setShowAddMonthly}
            />

            {showAddMonthly && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem' }}>과거 데이터 추가</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>대상 월 (YYYY-MM)</label>
                                <input type="text" value={newMonthly.month} onChange={e => setNewMonthly({ ...newMonthly, month: e.target.value })} placeholder="2023-12" className="glass" style={{ width: '100%', padding: '0.6rem 0.8rem', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>총 자산 (KRW)</label>
                                <input type="text" value={newMonthly.value} onChange={e => setNewMonthly({ ...newMonthly, value: e.target.value })} placeholder="0" className="glass" style={{ width: '100%', padding: '0.6rem 0.8rem', outline: 'none' }} />
                            </div>
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1rem' }}>자산 분류별 평가액 (선택)</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    <input type="text" value={newMonthly.cash} onChange={e => setNewMonthly({ ...newMonthly, cash: e.target.value })} placeholder="현금/예금" className="glass" style={{ width: '100%', padding: '0.6rem 0.8rem', outline: 'none', fontSize: '0.85rem' }} />
                                    <input type="text" value={newMonthly.domestic} onChange={e => setNewMonthly({ ...newMonthly, domestic: e.target.value })} placeholder="국내투자" className="glass" style={{ width: '100%', padding: '0.6rem 0.8rem', outline: 'none', fontSize: '0.85rem' }} />
                                    <input type="text" value={newMonthly.overseas} onChange={e => setNewMonthly({ ...newMonthly, overseas: e.target.value })} placeholder="해외투자" className="glass" style={{ width: '100%', padding: '0.6rem 0.8rem', outline: 'none', fontSize: '0.85rem' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button onClick={() => setShowAddMonthly(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', cursor: 'pointer' }}>취소</button>
                                <button onClick={handleAddMonthly} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600' }}>저장</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
