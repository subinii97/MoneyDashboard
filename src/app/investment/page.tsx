'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Plus,
    Trash2,
    TrendingUp,
    Activity,
    RefreshCw,
    Save,
    Edit2,
    Check,
    X,
    PlusCircle,
    Calendar,
    DollarSign,
    Layers,
    List,
    Eye,
    EyeOff,
    ArrowUpRight,
    ArrowDownRight,
    TrendingDown
} from 'lucide-react';
import { Assets, Investment, HistoryEntry, MarketType, Transaction, TransactionType, AssetCategory } from '@/lib/types';
import { formatKRW, convertToKRW } from '@/lib/utils';

export default function InvestmentManager() {
    const [assets, setAssets] = useState<Assets>({ investments: [], allocations: [] });
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState<number>(1350);
    const [rateTime, setRateTime] = useState<string>('');
    const [viewMode, setViewMode] = useState<'aggregated' | 'detailed'>('aggregated');
    const [isPrivate, setIsPrivate] = useState(false);

    const [newInvestment, setNewInvestment] = useState({
        symbol: '',
        shares: '',
        avgPrice: '',
        marketType: 'Domestic' as MarketType,
        category: 'Domestic Stock' as AssetCategory
    });
    const [editingInvestment, setEditingInvestment] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ shares: '', avgPrice: '' });

    // Transaction states
    const [showTxModal, setShowTxModal] = useState(false);
    const [selectedInv, setSelectedInv] = useState<Investment | null>(null);
    const [txForm, setTxForm] = useState({
        type: 'BUY' as TransactionType,
        shares: '',
        price: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/assets');
            const data = await res.json();

            // Migration check: handles rename of 'stocks' to 'investments' and 'others' to 'allocations'
            const investmentsRaw = data.investments || data.stocks || [];
            const allocationsRaw = data.allocations || data.others || [];

            if (investmentsRaw.length > 0) {
                const symbols = Array.from(new Set(investmentsRaw.map((s: Investment) => s.symbol))).join(',');
                const priceRes = await fetch(`/api/stock?symbols=${symbols}&t=${Date.now()}`);
                const priceData = await priceRes.json();

                if (priceData.exchangeRate) {
                    if (typeof priceData.exchangeRate === 'object') {
                        setRate(priceData.exchangeRate.rate);
                        setRateTime(priceData.exchangeRate.time);
                    } else {
                        setRate(priceData.exchangeRate);
                    }
                }

                const updatedInvestments = investmentsRaw.map((inv: Investment) => {
                    const info = priceData.results?.find((r: any) => r.symbol === inv.symbol);
                    return {
                        ...inv,
                        currentPrice: info?.price || inv.avgPrice,
                        currency: info?.currency || (inv.symbol.includes('.') ? 'KRW' : 'USD'),
                        exchange: info?.exchange,
                        name: info?.name,
                        change: info?.change,
                        changePercent: info?.changePercent,
                        marketType: inv.marketType || (inv.symbol.includes('.') || (info && info.exchange === 'KRX') ? 'Domestic' : 'Overseas')
                    };
                });
                setAssets({ investments: updatedInvestments, allocations: allocationsRaw });
            } else {
                setAssets({ investments: [], allocations: allocationsRaw });
            }

            const historyRes = await fetch('/api/snapshot');
            if (historyRes.ok) {
                const historyData = await historyRes.json();
                setHistory(historyData);
            }
        } catch (e) {
            console.error('Failed to fetch data', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const saveAssets = async (updatedAssets: Assets) => {
        await fetch('/api/assets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedAssets),
        });
        fetchData();
    };

    const addInvestment = async () => {
        if (!newInvestment.symbol || !newInvestment.shares || !newInvestment.avgPrice) return;

        const symbol = newInvestment.symbol.toUpperCase();
        const shares = Number(newInvestment.shares);
        const price = Number(newInvestment.avgPrice);
        const currency = symbol.includes('.') || newInvestment.marketType === 'Domestic' ? 'KRW' : 'USD';

        const invToAdd: Investment = {
            id: Date.now().toString(),
            symbol: symbol,
            shares: shares,
            avgPrice: price,
            marketType: newInvestment.marketType,
            category: newInvestment.category,
            currency: currency,
            targetWeight: 0
        };

        const tx: Transaction = {
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            type: 'BUY',
            symbol: symbol,
            amount: shares * price,
            shares: shares,
            price: price,
            currency: currency as 'KRW' | 'USD',
            notes: '신규 항목 추가 (매수)'
        };

        // Update Cash in allocations
        const updatedAllocations = assets.allocations.map((a: any) => {
            if (a.category === 'Cash') {
                const txVal = convertToKRW(tx.amount, tx.currency, rate);
                return { ...a, value: a.value - txVal };
            }
            return a;
        });

        const updatedInvestments = [...assets.investments, invToAdd];

        // Save transaction to history
        await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
        });

        await saveAssets({ investments: updatedInvestments, allocations: updatedAllocations });
        setNewInvestment({ symbol: '', shares: '', avgPrice: '', marketType: 'Domestic', category: 'Domestic Stock' });
    };

    const deleteInvestment = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const updated = { ...assets, investments: assets.investments.filter((s: Investment) => s.id !== id) };
        await saveAssets(updated);
    };

    const startEditing = (inv: Investment) => {
        setEditingInvestment(inv.id);
        setEditForm({
            shares: String(inv.shares),
            avgPrice: String(inv.avgPrice)
        });
    };

    const saveEdit = async (id: string) => {
        const updatedInv = assets.investments.map((s: Investment) =>
            s.id === id
                ? {
                    ...s,
                    shares: Number(editForm.shares),
                    avgPrice: Number(editForm.avgPrice),
                    category: s.category // Ensure category persists
                }
                : s
        );
        await saveAssets({ ...assets, investments: updatedInv });
        setEditingInvestment(null);
    };

    const takeSnapshot = async () => {
        await fetch('/api/snapshot', { method: 'POST' });
        fetchData();
    };

    const getAggregatedInvestments = (list: Investment[]) => {
        const grouped = list.reduce((acc: Record<string, Investment>, inv: Investment) => {
            const sym = inv.symbol;
            if (!acc[sym]) {
                acc[sym] = { ...inv };
            } else {
                const totalShares = acc[sym].shares + inv.shares;
                const weightedAvg = (acc[sym].shares * acc[sym].avgPrice + inv.shares * inv.avgPrice) / totalShares;
                acc[sym].shares = totalShares;
                acc[sym].avgPrice = weightedAvg;
            }
            return acc;
        }, {} as Record<string, Investment>);
        return Object.values(grouped);
    };

    const domesticInv = viewMode === 'aggregated' ? getAggregatedInvestments(assets.investments.filter((s: Investment) => s.marketType === 'Domestic')) : assets.investments.filter((s: Investment) => s.marketType === 'Domestic');
    const overseasInv = viewMode === 'aggregated' ? getAggregatedInvestments(assets.investments.filter((s: Investment) => s.marketType === 'Overseas')) : assets.investments.filter((s: Investment) => s.marketType === 'Overseas');

    const handleTransaction = async () => {
        if (!selectedInv || !txForm.shares || !txForm.price) return;

        const tx: Transaction = {
            id: Date.now().toString(),
            date: txForm.date,
            type: txForm.type,
            symbol: selectedInv.symbol,
            amount: Number(txForm.shares) * Number(txForm.price),
            shares: Number(txForm.shares),
            price: Number(txForm.price),
            currency: selectedInv.currency as 'KRW' | 'USD' || 'KRW',
            notes: txForm.notes
        };

        // Update investment holdings based on transaction
        const updatedInvestments = assets.investments.map(inv => {
            if (inv.id === selectedInv.id) {
                if (tx.type === 'BUY') {
                    const totalShares = inv.shares + (tx.shares || 0);
                    const totalCost = (inv.shares * inv.avgPrice) + (tx.amount);
                    return { ...inv, shares: totalShares, avgPrice: totalCost / totalShares };
                } else if (tx.type === 'SELL') {
                    return { ...inv, shares: Math.max(0, inv.shares - (tx.shares || 0)) };
                }
            }
            return inv;
        }).filter(inv => inv.shares > 0);

        // Update Cash in allocations
        const updatedAllocations = assets.allocations.map((a: any) => {
            if (a.category === 'Cash') {
                const txVal = convertToKRW(tx.amount, tx.currency, rate);
                return { ...a, value: tx.type === 'BUY' ? a.value - txVal : a.value + txVal };
            }
            return a;
        });

        // Save transaction to history
        await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
        });

        await saveAssets({ investments: updatedInvestments, allocations: updatedAllocations });
        setShowTxModal(false);
        setSelectedInv(null);
    };

    const InvestmentTable = ({ investments, title }: { investments: Investment[], title: string }) => {
        const calculateTotalValue = (list: Investment[]) => list.reduce((acc: number, s: Investment) => {
            const val = (s.currentPrice || s.avgPrice) * s.shares;
            return acc + convertToKRW(val, s.currency || 'KRW', rate);
        }, 0);

        const subTotal = calculateTotalValue(investments);

        // Calculate daily change
        const lastHistory = history[history.length - 1];
        const lastMarketType = title.includes('국내') ? 'Domestic' : 'Overseas';
        const lastSubTotal = lastHistory?.holdings?.filter(h => h.marketType === lastMarketType).reduce((acc, h) => {
            const val = (h.currentPrice || h.avgPrice) * h.shares;
            return acc + convertToKRW(val, h.currency || 'KRW', lastHistory.exchangeRate || rate);
        }, 0) || 0;

        const dailyChange = lastHistory ? subTotal - lastSubTotal : 0;
        const dailyChangePercent = lastSubTotal > 0 ? (dailyChange / lastSubTotal) * 100 : 0;

        if (investments.length === 0) return null;

        return (
            <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{title} <span style={{ fontSize: '0.9rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>({investments.length}개)</span></h3>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>합계: <span className="gradient-text" style={{ filter: isPrivate ? 'blur(8px)' : 'none' }}>{formatKRW(subTotal)}</span></div>
                        {lastHistory && (
                            <div style={{ fontSize: '0.9rem', color: dailyChange >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 'bold' }}>
                                전날 대비: <span style={{ filter: isPrivate ? 'blur(8px)' : 'none' }}>{dailyChange >= 0 ? '+' : ''}{formatKRW(dailyChange)} ({dailyChange >= 0 ? '▲' : '▼'}{Math.abs(dailyChangePercent).toFixed(2)}%)</span>
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: '0.875rem' }}>
                                <th style={{ padding: '0.85rem', width: '95px', textAlign: 'center' }}>시장</th>
                                <th style={{ width: 'auto', paddingLeft: '0.85rem', paddingRight: '0.85rem' }}>항목 정보</th>
                                <th style={{ width: '120px', textAlign: 'right', paddingRight: '1.2rem' }}>평단가</th>
                                <th style={{ width: '120px', textAlign: 'right', paddingRight: '1.2rem', paddingLeft: '0.8rem' }}>현재가</th>
                                <th style={{ width: '90px', textAlign: 'right', paddingRight: '1.2rem' }}>수량</th>
                                <th style={{ width: '150px', textAlign: 'right', paddingRight: '1.2rem' }}>평가액 (KRW)</th>
                                <th style={{ width: '190px', textAlign: 'right', paddingRight: '1.8rem' }}>수익률 (평가손익)</th>
                                <th style={{ textAlign: 'right', width: '90px', paddingRight: '1.2rem' }}>작업</th>
                            </tr>
                        </thead>
                        <tbody>
                            {investments.map((inv) => {
                                const isUSD = inv.currency === 'USD' || (!inv.symbol.includes('.') && inv.symbol !== '');
                                const currentPrice = inv.currentPrice || inv.avgPrice;
                                const marketValRaw = currentPrice * inv.shares;
                                const marketValKRW = convertToKRW(marketValRaw, isUSD ? 'USD' : 'KRW', rate);
                                const costBasisKRW = convertToKRW(inv.avgPrice * inv.shares, isUSD ? 'USD' : 'KRW', rate);
                                const plKRW = marketValKRW - costBasisKRW;
                                const plPercent = costBasisKRW > 0 ? ((marketValKRW / costBasisKRW) - 1) * 100 : 0;
                                const ex = getExchangeStyle(inv.exchange || '');

                                return (
                                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)', opacity: (editingInvestment && editingInvestment !== inv.id) ? 0.5 : 1 }}>
                                        <td style={{ padding: '1rem 0.85rem', textAlign: 'center' }}>
                                            <span style={{ padding: '0.25rem 0.45rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '800', color: ex.color, backgroundColor: ex.bg, border: `1px solid ${ex.color}33` }}>{ex.label}</span>
                                        </td>
                                        <td style={{ paddingLeft: '0.85rem', paddingRight: '0.85rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '0.98rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.name || inv.symbol}</div>
                                                {(inv.category || inv.marketType) && (
                                                    <span style={{ fontSize: '0.62rem', padding: '1px 3px', borderRadius: '4px', border: '1px solid var(--border)', opacity: 0.6, fontWeight: 'bold' }}>
                                                        {inv.category
                                                            ? (inv.category.includes('Stock') ? '주식' : inv.category.includes('Index') ? '지수' : inv.category.includes('Bond') ? '채권' : '기타')
                                                            : '주식' // Default fallback for existing items without explicit category
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--primary)', opacity: 0.8 }}>{inv.symbol}</div>
                                        </td>
                                        <td style={{ fontSize: '0.98rem', textAlign: 'right', paddingRight: '1.2rem' }}>
                                            {editingInvestment === inv.id ? (
                                                <input type="text" value={editForm.avgPrice} onChange={e => setEditForm({ ...editForm, avgPrice: e.target.value })} className="glass" style={{ width: '75px', padding: '0.2rem', background: 'transparent', color: 'white', textAlign: 'right' }} />
                                            ) : (isUSD ? `$${inv.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : formatKRW(inv.avgPrice))}
                                        </td>
                                        <td style={{ fontSize: '0.98rem', fontWeight: '500', textAlign: 'right', paddingRight: '1.2rem', paddingLeft: '0.8rem' }}>
                                            <div>{isUSD ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : formatKRW(currentPrice)}</div>
                                            {inv.change !== undefined && inv.change !== 0 && (
                                                <div style={{ fontSize: '0.72rem', color: inv.change >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 'bold' }}>
                                                    {inv.change >= 0 ? '▲' : '▼'}{Math.abs(inv.change).toLocaleString(undefined, {
                                                        minimumFractionDigits: isUSD ? 2 : 0,
                                                        maximumFractionDigits: isUSD ? 2 : 0
                                                    })}
                                                    ({Math.abs(inv.changePercent || 0).toFixed(2)}%)
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '1.2rem', filter: isPrivate ? 'blur(8px)' : 'none' }}>
                                            {editingInvestment === inv.id ? (
                                                <input type="text" value={editForm.shares} onChange={e => setEditForm({ ...editForm, shares: e.target.value })} className="glass" style={{ width: '55px', padding: '0.2rem', background: 'transparent', color: 'white', textAlign: 'right' }} />
                                            ) : inv.shares}
                                        </td>
                                        <td style={{ fontWeight: '600', fontSize: '0.98rem', textAlign: 'right', paddingRight: '1.2rem', filter: isPrivate ? 'blur(8px)' : 'none' }}>
                                            {formatKRW(marketValKRW)}
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '1.8rem', color: plKRW >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 'bold' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                                                <div style={{
                                                    fontSize: isPrivate ? '1.1rem' : '0.82rem',
                                                    opacity: isPrivate ? 0.9 : 0.8,
                                                    fontWeight: isPrivate ? '600' : 'normal',
                                                    marginBottom: isPrivate ? '0' : '0'
                                                }}>
                                                    {plPercent >= 0 ? '▲' : '▼'} {Math.abs(plPercent).toFixed(2)}%
                                                </div>
                                                {!isPrivate && (
                                                    <div style={{
                                                        fontSize: '0.98rem',
                                                        fontWeight: '700',
                                                        opacity: 1
                                                    }}>
                                                        {plKRW >= 0 ? '+' : ''}{formatKRW(plKRW)}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                {editingInvestment === inv.id ? (
                                                    <>
                                                        <button onClick={() => saveEdit(inv.id)} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}><Check size={18} /></button>
                                                        <button onClick={() => setEditingInvestment(null)} style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedInv(inv);
                                                                setTxForm(prev => ({ ...prev, price: String(inv.currentPrice || inv.avgPrice) }));
                                                                setShowTxModal(true);
                                                            }}
                                                            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }} title="거래 기록">
                                                            <ArrowUpRight size={18} />
                                                        </button>
                                                        <button onClick={() => startEditing(inv)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}><Edit2 size={18} /></button>
                                                        {viewMode === 'detailed' && <button onClick={() => deleteInvestment(inv.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const getExchangeStyle = (ex: string) => {
        const map: Record<string, { label: string; color: string; bg: string }> = {
            'KRX': { label: 'KOSPI', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
            'KOSDAQ': { label: 'KOSDAQ', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.1)' },
            'NASDAQ': { label: 'NASDAQ', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
            'NYSE': { label: 'NYSE', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
        };
        const upper = ex?.toUpperCase() || '';
        return map[upper] || { label: '기타', color: 'var(--muted)', bg: 'rgba(255, 255, 255, 0.05)' };
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

    return (
        <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: '800' }}>투자 자산 관리</h1>
                    <p style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <DollarSign size={16} /> 적용 환율: 1 USD = {rate.toLocaleString()} KRW
                        {rateTime && <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '4px' }}>({rateTime} 기준)</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={() => setIsPrivate(!isPrivate)} className="glass" style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: isPrivate ? 'var(--accent)' : 'white' }}>
                        {isPrivate ? <Eye size={18} /> : <EyeOff size={18} />} {isPrivate ? '금액 보기' : '금액 숨기기'}
                    </button>
                    <button onClick={() => setViewMode(viewMode === 'aggregated' ? 'detailed' : 'aggregated')} className="glass" style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                        {viewMode === 'aggregated' ? <List size={18} /> : <Layers size={18} />} {viewMode === 'aggregated' ? '개별 내역 보기' : '종목별 합산 / 비중 설정'}
                    </button>
                    <button onClick={fetchData} className="glass" style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                        <RefreshCw size={18} /> 새로고침
                    </button>
                    <button onClick={takeSnapshot} className="glass" style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none' }}>
                        <Save size={18} /> 오늘 상태 기록
                    </button>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                <InvestmentTable investments={domesticInv} title="🇰🇷 국내 투자 (주식/채권/지수)" />
                <InvestmentTable investments={overseasInv} title="🇺🇸 해외 투자 (주식/채권/지수)" />

                <div className="glass" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>새로운 투자 항목 추가</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>티커 (AAPL, 005930.KS, 114800.KS)</label>
                            <input type="text" placeholder="SYMBOL" value={newInvestment.symbol} onChange={(e) => setNewInvestment({ ...newInvestment, symbol: e.target.value.toUpperCase() })} className="glass" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', color: 'white' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>분류</label>
                            <select value={newInvestment.category} onChange={(e) => setNewInvestment({ ...newInvestment, category: e.target.value as AssetCategory, marketType: e.target.value.includes('Overseas') ? 'Overseas' : 'Domestic' })} className="glass" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', background: 'var(--card)', color: 'white' }}>
                                <option value="Domestic Stock">국내 주식</option>
                                <option value="Domestic Index">국내 지수</option>
                                <option value="Domestic Bond">국내 채권</option>
                                <option value="Overseas Stock">해외 주식</option>
                                <option value="Overseas Index">해외 지수</option>
                                <option value="Overseas Bond">해외 채권</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>수량</label>
                            <input type="text" value={newInvestment.shares} onChange={(e) => setNewInvestment({ ...newInvestment, shares: e.target.value })} className="glass" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', color: 'white' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>평단가</label>
                            <input type="text" value={newInvestment.avgPrice} onChange={(e) => setNewInvestment({ ...newInvestment, avgPrice: e.target.value })} className="glass" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', color: 'white' }} />
                        </div>
                        <button onClick={addInvestment} className="glass" style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 'bold', height: '3.2rem' }}>
                            <PlusCircle size={18} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 항목 추가
                        </button>
                    </div>
                </div>
            </div>

            {/* Transaction Modal */}
            {showTxModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="glass" style={{ width: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>거래 기록: {selectedInv?.name || selectedInv?.symbol}</h3>
                            <button onClick={() => setShowTxModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setTxForm(prev => ({ ...prev, type: 'BUY' }))}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: txForm.type === 'BUY' ? '#ef4444' : 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                                매수
                            </button>
                            <button
                                onClick={() => setTxForm(prev => ({ ...prev, type: 'SELL' }))}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: txForm.type === 'SELL' ? '#3b82f6' : 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                                매도
                            </button>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>날짜</label>
                            <input type="date" value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })} className="glass" style={{ width: '100%', padding: '0.75rem', color: 'white' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>수량</label>
                                    {txForm.type === 'SELL' && selectedInv && (
                                        <button
                                            onClick={() => setTxForm({ ...txForm, shares: String(selectedInv.shares) })}
                                            style={{ fontSize: '0.7rem', color: 'var(--accent)', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            전량 매도
                                        </button>
                                    )}
                                </div>
                                <input type="number" value={txForm.shares} onChange={e => setTxForm({ ...txForm, shares: e.target.value })} className="glass" style={{ width: '100%', padding: '0.75rem', color: 'white' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>가격 ({selectedInv?.currency})</label>
                                <input type="number" value={txForm.price} onChange={e => setTxForm({ ...txForm, price: e.target.value })} className="glass" style={{ width: '100%', padding: '0.75rem', color: 'white' }} />
                            </div>
                        </div>

                        <button onClick={handleTransaction} className="glass" style={{ width: '100%', padding: '1rem', background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 'bold', marginTop: '1rem' }}>
                            기록 저장
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
