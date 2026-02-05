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
    const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
    const [editForm, setEditForm] = useState({ shares: '', avgPrice: '', category: '' as AssetCategory });
    const [showEditModal, setShowEditModal] = useState(false);

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
                        // Priority: use currentPriceInfo's currency if available to ensure real-time accuracy
                        currency: info?.currency || inv.currency || (inv.symbol.includes('.') ? 'KRW' : 'USD'),
                        exchange: inv.exchange || info?.exchange,
                        name: inv.name || info?.name,
                        change: info?.change,
                        changePercent: info?.changePercent,
                        marketType: inv.marketType || (inv.symbol.includes('.') || (info && info.exchange === 'KRX') ? 'Domestic' : 'Overseas')
                    };
                });
                setAssets({ investments: updatedInvestments, allocations: allocationsRaw });
            } else {
                setAssets({ investments: [], allocations: allocationsRaw });
            }

            const historyRes = await fetch('/api/snapshot?includeHoldings=true');
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
        // Silently trigger auto snapshot on load
        fetch('/api/snapshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auto: true })
        }).catch(() => { });
    }, [fetchData]);

    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

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
        setEditingInvestment(inv);

        let initialCategory = inv.category as AssetCategory;
        if (!initialCategory) {
            // Infer category based on marketType and probable type
            if (inv.marketType === 'Overseas') {
                initialCategory = 'Overseas Stock';
            } else {
                initialCategory = 'Domestic Stock';
            }
        }

        // Use the full precision of the price to avoid unintentional rounding when editing
        setEditForm({
            shares: String(inv.shares),
            avgPrice: String(inv.avgPrice),
            category: initialCategory
        });
        setShowEditModal(true);
    };

    const saveEdit = async () => {
        if (!editingInvestment) return;

        try {
            // Remove commas and convert to number
            const sharesStr = editForm.shares.toString().replace(/,/g, '');
            const priceStr = editForm.avgPrice.toString().replace(/,/g, '');

            const sharesNum = Number(sharesStr);
            const priceNum = Number(priceStr);

            if (isNaN(sharesNum) || isNaN(priceNum) || sharesNum < 0) {
                alert('유효한 수량과 평단가를 입력해주세요.');
                return;
            }

            const category = editForm.category || (editingInvestment.marketType === 'Overseas' ? 'Overseas Stock' : 'Domestic Stock');
            const marketType = (category.includes('Overseas') ? 'Overseas' : 'Domestic') as MarketType;

            let updatedInvestments: Investment[];

            if (viewMode === 'aggregated') {
                // When editing an aggregated row, we consolidate all entries of that symbol
                const otherSymbols = assets.investments.filter(inv =>
                    inv.symbol !== editingInvestment.symbol || inv.marketType !== editingInvestment.marketType
                );

                const mergedEntry: Investment = {
                    ...editingInvestment,
                    shares: sharesNum,
                    avgPrice: priceNum,
                    category: category as AssetCategory,
                    marketType: marketType
                };
                updatedInvestments = [...otherSymbols, mergedEntry];
            } else {
                updatedInvestments = assets.investments.map((s: Investment) =>
                    s.id === editingInvestment.id
                        ? {
                            ...s,
                            shares: sharesNum,
                            avgPrice: priceNum,
                            category: category as AssetCategory,
                            marketType: marketType
                        }
                        : s
                );
            }

            await saveAssets({ ...assets, investments: updatedInvestments });
            setShowEditModal(false);
            setEditingInvestment(null);
        } catch (err) {
            console.error('Save failed:', err);
            alert('저장 도중 오류가 발생했습니다.');
        }
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

        // Total Unrealized P/L (Total ROI)
        const totalPL = investments.reduce((acc, s) => {
            const currentPrice = s.currentPrice || s.avgPrice;
            const pl = (currentPrice - s.avgPrice) * s.shares;
            return acc + convertToKRW(pl, s.currency || 'KRW', rate);
        }, 0);
        const totalPLPercent = (subTotal - totalPL) > 0 ? (totalPL / (subTotal - totalPL)) * 100 : 0;

        // Refined Daily Change: Sum of (per-share change * held shares) using real-time data
        const dailyChange = investments.reduce((acc, s) => {
            const changeAmount = (s.change || 0) * s.shares;
            return acc + convertToKRW(changeAmount, s.currency || 'KRW', rate);
        }, 0);
        const dailyChangePercent = (subTotal - dailyChange) > 0 ? (dailyChange / (subTotal - dailyChange)) * 100 : 0;

        if (investments.length === 0) return null;

        return (
            <div style={{ padding: '1.5rem', marginBottom: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div>
                        <span className="section-label" style={{ color: 'var(--muted)', marginBottom: '0.5rem' }}>Portfolio</span>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.01em' }}>{title}</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
                        <div style={{ textAlign: 'left' }}>
                            <span className="section-label" style={{ marginBottom: '0.2rem' }}>Sub Total</span>
                            <div className="hero-value" style={{ fontSize: '1.75rem', filter: isPrivate ? 'blur(10px)' : 'none' }}>{formatKRW(subTotal)}</div>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <span className="section-label" style={{ marginBottom: '0.2rem' }}>Daily Change</span>
                            <div style={{ fontSize: '1.2rem', color: dailyChange >= 0 ? '#ef4444' : '#60a5fa', fontWeight: '800', filter: isPrivate ? 'blur(8px)' : 'none' }}>
                                {dailyChange >= 0 ? '+' : ''}{formatKRW(dailyChange)}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: dailyChange >= 0 ? '#ef4444' : '#60a5fa', fontWeight: '600', opacity: 0.8 }}>
                                {dailyChange >= 0 ? '▲' : '▼'}{Math.abs(dailyChangePercent).toFixed(2)}%
                            </div>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <span className="section-label" style={{ marginBottom: '0.2rem' }}>Total Gain/Loss</span>
                            <div style={{ fontSize: '1.2rem', color: totalPL >= 0 ? '#ef4444' : '#60a5fa', fontWeight: '800', filter: isPrivate ? 'blur(8px)' : 'none' }}>
                                {totalPL >= 0 ? '+' : ''}{formatKRW(totalPL)}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: totalPL >= 0 ? '#ef4444' : '#60a5fa', fontWeight: '600', opacity: 0.8 }}>
                                {totalPL >= 0 ? '▲' : '▼'}{Math.abs(totalPLPercent).toFixed(2)}%
                            </div>
                        </div>
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
                                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
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
                                                            : '주식'
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--primary)', opacity: 0.8 }}>{inv.symbol}</div>
                                        </td>
                                        <td style={{ fontSize: '0.98rem', textAlign: 'right', paddingRight: '1.2rem' }}>
                                            {isUSD
                                                ? `$${inv.avgPrice.toLocaleString(undefined, { minimumFractionDigits: inv.avgPrice < 100 ? 4 : 2, maximumFractionDigits: inv.avgPrice < 100 ? 4 : 2 })}`
                                                : formatKRW(inv.avgPrice)}
                                        </td>
                                        <td style={{ fontSize: '0.98rem', fontWeight: '500', textAlign: 'right', paddingRight: '1.2rem', paddingLeft: '0.8rem' }}>
                                            <div>
                                                {isUSD
                                                    ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: currentPrice < 100 ? 4 : 2, maximumFractionDigits: currentPrice < 100 ? 4 : 2 })}`
                                                    : formatKRW(currentPrice)}
                                            </div>
                                            {inv.change !== undefined && (
                                                <div style={{ fontSize: '0.72rem', color: inv.change >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 'bold' }}>
                                                    {inv.change >= 0 ? '▲' : '▼'}{Math.abs(inv.change).toLocaleString(undefined, {
                                                        minimumFractionDigits: isUSD ? 2 : 0,
                                                        maximumFractionDigits: isUSD ? 2 : 0
                                                    })}
                                                    ({Math.abs(inv.changePercent || 0).toFixed(2)}%)
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '1.2rem', filter: isPrivate ? 'blur(8px)' : 'none', userSelect: isPrivate ? 'none' : 'auto', pointerEvents: isPrivate ? 'none' : 'auto' }}>
                                            {inv.shares}
                                        </td>
                                        <td style={{ fontWeight: '600', fontSize: '0.98rem', textAlign: 'right', paddingRight: '1.2rem', filter: isPrivate ? 'blur(8px)' : 'none', userSelect: isPrivate ? 'none' : 'auto', pointerEvents: isPrivate ? 'none' : 'auto' }}>
                                            {formatKRW(marketValKRW)}
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '1.8rem', color: plKRW >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 'bold' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                                                {!isPrivate && (
                                                    <div style={{
                                                        fontSize: '0.98rem',
                                                        fontWeight: '700',
                                                        opacity: 1
                                                    }}>
                                                        {plKRW >= 0 ? '+' : ''}{formatKRW(plKRW)}
                                                    </div>
                                                )}
                                                <div style={{
                                                    fontSize: isPrivate ? '1.1rem' : '0.82rem',
                                                    opacity: isPrivate ? 0.9 : 0.8,
                                                    fontWeight: isPrivate ? '600' : 'normal',
                                                    marginTop: isPrivate ? '0' : '0'
                                                }}>
                                                    {plPercent >= 0 ? '▲' : '▼'} {Math.abs(plPercent).toFixed(2)}%
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
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
                                                <button onClick={() => deleteInvestment(inv.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
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
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
                <div>
                    <span className="section-label">Management</span>
                    <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em' }}>Assets</h1>
                    <p style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                        <DollarSign size={14} /> 1 USD = <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{rate.toLocaleString()}</span> KRW
                        {rateTime && <span style={{ opacity: 0.6, marginLeft: '4px' }}>({rateTime})</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => setIsPrivate(!isPrivate)} className="glass" style={{ padding: '0.75rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', color: isPrivate ? 'var(--primary)' : 'white', fontWeight: '600', fontSize: '0.9rem' }}>
                        {isPrivate ? <Eye size={18} /> : <EyeOff size={18} />} {isPrivate ? '금액 보기' : '금액 숨기기'}
                    </button>
                    <button onClick={() => setViewMode(viewMode === 'aggregated' ? 'detailed' : 'aggregated')} className="glass" style={{ padding: '0.75rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'white', fontWeight: '600', fontSize: '0.9rem' }}>
                        {viewMode === 'aggregated' ? <List size={18} /> : <Layers size={18} />} {viewMode === 'aggregated' ? '상세 내역' : '합산 내역'}
                    </button>
                    <button onClick={fetchData} className="glass" style={{ padding: '0.75rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'white', fontWeight: '600', fontSize: '0.9rem' }}>
                        <RefreshCw size={18} /> 새로고침
                    </button>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2.5rem', marginBottom: '3rem' }}>
                <div className="glass" onMouseMove={handleMouseMove} style={{ padding: '0' }}>
                    <div className="spotlight" style={{ left: mousePos.x, top: mousePos.y }}></div>
                    <InvestmentTable investments={domesticInv} title="Domestic Portfolios" />
                </div>
                <div className="glass" onMouseMove={handleMouseMove} style={{ padding: '0' }}>
                    <div className="spotlight" style={{ left: mousePos.x, top: mousePos.y }}></div>
                    <InvestmentTable investments={overseasInv} title="Overseas Portfolios" />
                </div>

                <div className="glass" onMouseMove={handleMouseMove} style={{ padding: '1.5rem', border: '1px solid var(--primary-glow)' }}>
                    <div className="spotlight" style={{ left: mousePos.x, top: mousePos.y }}></div>
                    <span className="section-label" style={{ marginBottom: '1.5rem' }}>Add Asset</span>
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
            {/* Edit Modal */}
            {showEditModal && editingInvestment && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
                    <div className="glass" style={{ width: '450px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid rgba(255,255,255,0.25)', backgroundColor: '#1a1d23', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>항목 수정</h3>
                                <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{editingInvestment.name || editingInvestment.symbol} ({editingInvestment.symbol})</p>
                            </div>
                            <button onClick={() => { setShowEditModal(false); setEditingInvestment(null); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        {viewMode === 'aggregated' && (
                            <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#eab308', fontSize: '0.8rem' }}>
                                ⚠️ 종목별 합산 모드에서 수정 시, 해당 종목의 모든 매수 기록이 하나로 통합됩니다.
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.5rem' }}>자산 분류</label>
                                <select
                                    value={editForm.category || ''}
                                    onChange={e => setEditForm({ ...editForm, category: e.target.value as AssetCategory })}
                                    className="glass"
                                    style={{ width: '100%', padding: '0.8rem', background: 'var(--card)', color: 'white', border: '1px solid var(--border)' }}
                                >
                                    <option value="" disabled>분류 선택</option>
                                    <option value="Domestic Stock">국내 주식</option>
                                    <option value="Domestic Index">국내 지수</option>
                                    <option value="Domestic Bond">국내 채권</option>
                                    <option value="Overseas Stock">해외 주식</option>
                                    <option value="Overseas Index">해외 지수</option>
                                    <option value="Overseas Bond">해외 채권</option>
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.5rem' }}>수량</label>
                                    <input
                                        type="number" step="any"
                                        value={editForm.shares}
                                        onChange={e => setEditForm({ ...editForm, shares: e.target.value })}
                                        className="glass"
                                        style={{ width: '100%', padding: '0.8rem', color: 'white', border: '1px solid var(--border)' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.5rem' }}>평단가 ({editingInvestment.currency})</label>
                                    <input
                                        type="number" step="any"
                                        value={editForm.avgPrice}
                                        onChange={e => setEditForm({ ...editForm, avgPrice: e.target.value })}
                                        className="glass"
                                        style={{ width: '100%', padding: '0.8rem', color: 'white', border: '1px solid var(--border)' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button
                                onClick={() => setShowEditModal(false)}
                                style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                취소
                            </button>
                            <button
                                onClick={saveEdit}
                                style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
