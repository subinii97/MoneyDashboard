'use client';

import { useState } from 'react';
import { RefreshCw, Layers, List, Eye, EyeOff, DollarSign } from 'lucide-react';
import { Investment, MarketType, Transaction, AssetCategory } from '@/lib/types';
import { convertToKRW } from '@/lib/utils';
import { useAssets } from '@/hooks/useAssets';

// Components
import { InvestmentTable } from '@/components/investment/InvestmentTable';
import { AddAssetCard } from '@/components/investment/AddAssetCard';
import { EditModal } from '@/components/investment/EditModal';
import { TransactionModal } from '@/components/investment/TransactionModal';

export default function InvestmentManager() {
    const { assets, loading, isRefreshing, rate, rateTime, lastUpdated, fetchData, setAssets } = useAssets();
    const [viewMode, setViewMode] = useState<'aggregated' | 'detailed'>('aggregated');
    const [isPrivate, setIsPrivate] = useState(false);

    // Form/Modal states
    const [newInvestment, setNewInvestment] = useState({
        symbol: '', shares: '', avgPrice: '',
        marketType: 'Domestic' as MarketType,
        category: 'Domestic Stock' as AssetCategory
    });
    const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
    const [editForm, setEditForm] = useState({ shares: '', avgPrice: '', category: '' as AssetCategory });
    const [showEditModal, setShowEditModal] = useState(false);
    const [showTxModal, setShowTxModal] = useState(false);
    const [selectedInv, setSelectedInv] = useState<Investment | null>(null);
    const [txForm, setTxForm] = useState({
        type: 'BUY' as any,
        shares: '', price: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const isUSD = (inv: Investment) => inv.currency === 'USD' || (inv.marketType === 'Overseas' && !inv.symbol.includes('.KS') && !inv.symbol.includes('.KQ'));

    const saveAssets = async (updatedAssets: any) => {
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
        const currency = newInvestment.marketType === 'Overseas' ? 'USD' : 'KRW';

        const invToAdd: Investment = {
            id: Date.now().toString(),
            symbol, shares, avgPrice: price,
            marketType: newInvestment.marketType,
            category: newInvestment.category,
            currency: currency as any,
            targetWeight: 0
        };

        const tx: Transaction = {
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            type: 'BUY',
            symbol,
            amount: shares * price,
            shares, price,
            currency: currency as any,
            notes: '신규 항목 추가 (매수)'
        };

        const updatedAllocations = assets.allocations.map((a: any) => {
            if (a.category === 'Cash') {
                const txVal = convertToKRW(tx.amount, tx.currency as any, rate);
                return { ...a, value: a.value - txVal };
            }
            return a;
        });

        await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
        });

        await saveAssets({ investments: [...assets.investments, invToAdd], allocations: updatedAllocations });
        setNewInvestment({ symbol: '', shares: '', avgPrice: '', marketType: 'Domestic', category: 'Domestic Stock' });
    };

    const deleteInvestment = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        await saveAssets({ ...assets, investments: assets.investments.filter((s: Investment) => s.id !== id) });
    };

    const startEditing = (inv: Investment) => {
        setEditingInvestment(inv);
        setEditForm({
            shares: String(inv.shares),
            avgPrice: String(inv.avgPrice),
            category: inv.category || (inv.marketType === 'Overseas' ? 'Overseas Stock' : 'Domestic Stock')
        });
        setShowEditModal(true);
    };

    const saveEdit = async () => {
        if (!editingInvestment) return;
        const sharesNum = Number(editForm.shares.replace(/,/g, ''));
        const priceNum = Number(editForm.avgPrice.replace(/,/g, ''));
        const category = editForm.category;
        const marketType = category.includes('Overseas') ? 'Overseas' : 'Domestic';

        let updatedInvestments: Investment[];
        if (viewMode === 'aggregated') {
            const others = assets.investments.filter(inv => inv.symbol !== editingInvestment.symbol || inv.marketType !== editingInvestment.marketType);
            updatedInvestments = [...others, { ...editingInvestment, shares: sharesNum, avgPrice: priceNum, category, marketType: marketType as any }];
        } else {
            updatedInvestments = assets.investments.map((s: Investment) => s.id === editingInvestment.id ? { ...s, shares: sharesNum, avgPrice: priceNum, category, marketType: marketType as any } : s);
        }

        await saveAssets({ ...assets, investments: updatedInvestments });
        setShowEditModal(false);
    };

    const handleTransaction = async () => {
        if (!selectedInv || !txForm.shares || !txForm.price) return;
        const tx: Transaction = {
            id: Date.now().toString(),
            date: txForm.date, type: txForm.type,
            symbol: selectedInv.symbol,
            amount: Number(txForm.shares) * Number(txForm.price),
            shares: Number(txForm.shares),
            price: Number(txForm.price),
            currency: selectedInv.currency as any || 'KRW',
            notes: txForm.notes
        };

        const updatedInvestments = assets.investments.map(inv => {
            if (inv.id === selectedInv.id) {
                if (tx.type === 'BUY') {
                    const totalShares = inv.shares + (tx.shares || 0);
                    const totalCost = (inv.shares * inv.avgPrice) + (tx.amount);
                    return { ...inv, shares: totalShares, avgPrice: totalCost / totalShares };
                } else {
                    return { ...inv, shares: Math.max(0, inv.shares - (tx.shares || 0)) };
                }
            }
            return inv;
        }).filter(inv => inv.shares > 0);

        const updatedAllocations = assets.allocations.map((a: any) => {
            if (a.category === 'Cash') {
                const txVal = convertToKRW(tx.amount, tx.currency as any, rate);
                return { ...a, value: tx.type === 'BUY' ? a.value - txVal : a.value + txVal };
            }
            return a;
        });

        await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
        });

        await saveAssets({ investments: updatedInvestments, allocations: updatedAllocations });
        setShowTxModal(false);
    };

    const getAggregated = (list: Investment[]) => {
        const grouped = list.reduce((acc: any, inv) => {
            if (!acc[inv.symbol]) { acc[inv.symbol] = { ...inv }; }
            else {
                const totalShares = acc[inv.symbol].shares + inv.shares;
                acc[inv.symbol].avgPrice = (acc[inv.symbol].shares * acc[inv.symbol].avgPrice + inv.shares * inv.avgPrice) / totalShares;
                acc[inv.symbol].shares = totalShares;
            }
            return acc;
        }, {});
        return Object.values(grouped) as Investment[];
    };

    const filtered = (m: MarketType) => {
        const list = assets.investments.filter(s => s.marketType === m);
        return viewMode === 'aggregated' ? getAggregated(list) : list;
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
                        {lastUpdated && <span style={{ opacity: 0.8, marginLeft: '4px' }}>• {lastUpdated} 갱신</span>}
                        {rateTime && <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>(시장 {rateTime})</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => setIsPrivate(!isPrivate)} className="glass" style={{ padding: '0.75rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', color: isPrivate ? 'var(--primary)' : 'white', fontWeight: '600', fontSize: '0.9rem' }}>
                        {isPrivate ? <Eye size={18} /> : <EyeOff size={18} />} {isPrivate ? '금액 보기' : '금액 숨기기'}
                    </button>
                    <button onClick={() => setViewMode(viewMode === 'aggregated' ? 'detailed' : 'aggregated')} className="glass" style={{ padding: '0.75rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'white', fontWeight: '600', fontSize: '0.9rem' }}>
                        {viewMode === 'aggregated' ? <List size={18} /> : <Layers size={18} />} {viewMode === 'aggregated' ? '상세 내역' : '합산 내역'}
                    </button>
                    <button onClick={() => fetchData(true)} disabled={isRefreshing} className="glass" style={{ padding: '0.75rem 1.25rem', cursor: isRefreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'white', fontWeight: '600', fontSize: '0.9rem', opacity: isRefreshing ? 0.7 : 1 }}>
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} /> {isRefreshing ? '갱신 중...' : '새로고침'}
                    </button>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2.5rem', marginBottom: '3rem' }}>
                <div className="glass" onMouseMove={handleMouseMove} style={{ padding: '0' }}>
                    <div className="spotlight" style={{ left: mousePos.x, top: mousePos.y }}></div>
                    <InvestmentTable investments={filtered('Domestic')} title="Domestic Portfolios" rate={rate} isPrivate={isPrivate} onEdit={startEditing} onDelete={deleteInvestment} onTransaction={(inv) => { setSelectedInv(inv); setTxForm(p => ({ ...p, price: String(inv.currentPrice || inv.avgPrice) })); setShowTxModal(true); }} />
                </div>
                <div className="glass" onMouseMove={handleMouseMove} style={{ padding: '0' }}>
                    <div className="spotlight" style={{ left: mousePos.x, top: mousePos.y }}></div>
                    <InvestmentTable investments={filtered('Overseas')} title="Overseas Portfolios" rate={rate} isPrivate={isPrivate} onEdit={startEditing} onDelete={deleteInvestment} onTransaction={(inv) => { setSelectedInv(inv); setTxForm(p => ({ ...p, price: String(inv.currentPrice || inv.avgPrice) })); setShowTxModal(true); }} />
                </div>

                <AddAssetCard
                    newInvestment={newInvestment}
                    mousePos={mousePos}
                    onMouseMove={handleMouseMove}
                    onFormChange={(f, v) => setNewInvestment(p => ({ ...p, [f]: v, marketType: f === 'category' ? (v.includes('Overseas') ? 'Overseas' : 'Domestic') : p.marketType }))}
                    onSubmit={addInvestment}
                />
            </div>

            {showTxModal && selectedInv && (
                <TransactionModal
                    selectedInv={selectedInv}
                    txForm={txForm}
                    onClose={() => setShowTxModal(false)}
                    onTypeChange={(t) => setTxForm(p => ({ ...p, type: t }))}
                    onFormChange={(f, v) => setTxForm(p => ({ ...p, [f]: v }))}
                    onMaxSell={() => setTxForm(p => ({ ...p, shares: String(selectedInv.shares) }))}
                    onSubmit={handleTransaction}
                />
            )}

            {showEditModal && editingInvestment && (
                <EditModal
                    editingInvestment={editingInvestment}
                    viewMode={viewMode}
                    editForm={editForm}
                    onClose={() => setShowEditModal(false)}
                    onFormChange={(f, v) => setEditForm(p => ({ ...p, [f]: v }))}
                    onSubmit={saveEdit}
                />
            )}
        </main>
    );
}
