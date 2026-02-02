'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { HistoryEntry, Transaction, Investment, AssetAllocation, CATEGORY_MAP } from '@/lib/types';
import { formatKRW, convertToKRW } from '@/lib/utils';
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, ArrowLeftRight, Briefcase, AlertCircle } from 'lucide-react';

export default function HistoryDetailPage() {
    const params = useParams();
    const router = useRouter();
    const date = params.date as string;

    const [entry, setEntry] = useState<HistoryEntry | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState(1350);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch history to find the specific entry
                const historyRes = await fetch('/api/snapshot');
                const historyData: HistoryEntry[] = await historyRes.json();
                const matchedEntry = historyData.find(h => h.date === date);
                setEntry(matchedEntry || null);

                // Fetch transactions for this date
                const txRes = await fetch('/api/transactions');
                const txData: Transaction[] = await txRes.json();
                setTransactions(txData.filter(tx => tx.date === date));

                // Fetch exchange rate (optional, can use fallback)
                const stockRes = await fetch('/api/stock?symbols=AAPL'); // Just to get the rate
                const stockData = await stockRes.json();
                if (stockData.exchangeRate) setRate(stockData.exchangeRate);
            } catch (e) {
                console.error('Failed to fetch details', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [date]);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
    if (!entry) return <div style={{ padding: '2rem', textAlign: 'center' }}>해당 날짜의 기록이 없습니다.</div>;

    const renderChange = (current: number, cost: number) => {
        const change = current - cost;
        const percent = cost > 0 ? (change / cost) * 100 : 0;
        const isPositive = change >= 0;
        return (
            <div style={{ color: isPositive ? '#ef4444' : '#3b82f6', fontWeight: 'bold' }}>
                {isPositive ? '+' : ''}{percent.toFixed(1)}% ({formatKRW(change)})
            </div>
        );
    };

    return (
        <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <button
                onClick={() => router.back()}
                className="glass"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', marginBottom: '2rem', cursor: 'pointer', color: 'white' }}
            >
                <ArrowLeft size={18} /> 뒤로가기
            </button>

            <header style={{ marginBottom: '3rem' }}>
                <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>
                    {date} 정산 상세
                </h1>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--muted)' }}>
                    총 자산: <span style={{ color: 'white' }}>{formatKRW(entry.totalValue)}</span>
                </div>
            </header>

            {(!entry.holdings && !entry.allocations) && (
                <div className="glass" style={{ padding: '2rem', textAlign: 'center', marginBottom: '3rem', color: 'var(--accent)' }}>
                    <AlertCircle size={32} style={{ margin: '0 auto 1rem' }} />
                    <p>이 날짜의 상세 기록이 존재하지 않습니다. (구버전 스냅샷)</p>
                </div>
            )}

            <section style={{ marginBottom: '3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <Briefcase size={24} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>보유 투자 항목 (정산 시점 평가액)</h2>
                </div>
                <div className="glass" style={{ padding: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: '0.85rem' }}>
                                <th style={{ padding: '1rem 0', width: 'auto' }}>항목</th>
                                <th style={{ textAlign: 'right', width: '100px' }}>수량</th>
                                <th style={{ textAlign: 'right', width: '180px' }}>평가금액 (KRW)</th>
                                <th style={{ textAlign: 'right', width: '220px' }}>수익률</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(entry.holdings || []).map((inv, idx) => {
                                const valKRW = convertToKRW((inv.currentPrice || inv.avgPrice) * inv.shares, (inv.currency || 'KRW') as any, rate);
                                const costKRW = convertToKRW(inv.avgPrice * inv.shares, (inv.currency || 'KRW') as any, rate);
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem 0' }}>
                                            <div style={{ fontWeight: 'bold' }}>{inv.name || inv.symbol}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{inv.symbol}</div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{inv.shares}</td>
                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatKRW(valKRW)}</td>
                                        <td style={{ textAlign: 'right' }}>{renderChange(valKRW, costKRW)}</td>
                                    </tr>
                                );
                            })}
                            {entry.holdings?.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)' }}>내역 없음</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>

            <section style={{ marginBottom: '3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <ArrowLeftRight size={24} color="var(--accent)" />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>오늘의 거래 및 현금 흐름</h2>
                </div>
                <div className="glass" style={{ padding: '1.5rem' }}>
                    {transactions.length > 0 ? (
                        <>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: '0.85rem' }}>
                                        <th style={{ padding: '1rem 0', width: '100px' }}>구분</th>
                                        <th style={{ padding: '1rem 0', width: '150px' }}>항목</th>
                                        <th style={{ textAlign: 'right', width: '100px' }}>수량</th>
                                        <th style={{ textAlign: 'right', width: '180px' }}>금액</th>
                                        <th style={{ paddingLeft: '1rem' }}>메모</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '1rem 0' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold',
                                                    background: tx.type === 'BUY' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                    color: tx.type === 'BUY' ? '#ef4444' : '#3b82f6'
                                                }}>
                                                    {tx.type === 'BUY' ? '매수 (-)' : '매도 (+)'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.symbol}</td>
                                            <td style={{ textAlign: 'right' }}>{tx.shares}</td>
                                            <td style={{ textAlign: 'right' }}>{tx.currency === 'USD' ? `$${tx.amount.toLocaleString()}` : formatKRW(tx.amount)}</td>
                                            <td style={{ color: 'var(--muted)', fontSize: '0.85rem', paddingLeft: '1rem' }}>{tx.notes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'flex-end', gap: '2rem' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>총 매수</div>
                                    <div style={{ fontWeight: 'bold', color: '#ef4444' }}>{formatKRW(transactions.filter(t => t.type === 'BUY').reduce((acc, t) => acc + convertToKRW(t.amount, t.currency, rate), 0))}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>총 매도</div>
                                    <div style={{ fontWeight: 'bold', color: '#3b82f6' }}>{formatKRW(transactions.filter(t => t.type === 'SELL').reduce((acc, t) => acc + convertToKRW(t.amount, t.currency, rate), 0))}</div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>거래 내역이 없습니다.</div>
                    )}
                </div>
            </section>

            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <Wallet size={24} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>기타 자산 (현금 등)</h2>
                </div>
                <div className="glass" style={{ padding: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: '0.85rem' }}>
                                <th style={{ padding: '1rem 0', width: 'auto' }}>항목</th>
                                <th style={{ textAlign: 'right', width: '180px' }}>평가액 (KRW)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {((entry.allocations && entry.allocations.length > 0) ? entry.allocations : []).map((alc, idx) => {
                                let valKRW = convertToKRW(alc.value, alc.currency, rate);

                                // Fallback logic for investment categories if value is 0
                                if (valKRW === 0 && (alc.category === 'Domestic Stock' || alc.category === 'Overseas Stock' || alc.category === 'Domestic Index' || alc.category === 'Overseas Index' || alc.category === 'Domestic Bond' || alc.category === 'Overseas Bond')) {
                                    const marketType = alc.category.startsWith('Domestic') ? 'Domestic' : 'Overseas';
                                    const categoryInvestments = entry.holdings?.filter((h: any) =>
                                        h.marketType === marketType && (h.category === alc.category || (!h.category && (alc.category === 'Domestic Stock' || alc.category === 'Overseas Stock')))
                                    );
                                    valKRW = categoryInvestments?.reduce((sum: number, h: any) =>
                                        sum + convertToKRW((h.currentPrice || h.avgPrice) * h.shares, h.currency || (marketType === 'Domestic' ? 'KRW' : 'USD'), rate), 0) || 0;
                                }

                                if (valKRW === 0 && alc.targetWeight === 0) return null;
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem 0' }}>{CATEGORY_MAP[alc.category] || alc.category}</td>
                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatKRW(valKRW)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}
