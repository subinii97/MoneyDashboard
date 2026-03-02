'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, Layers, List, Eye, EyeOff } from 'lucide-react';
import { Investment, MarketType, Transaction, AssetCategory } from '@/lib/types';
import { useAssets } from '@/hooks/useAssets';
import { useInvestmentActions } from '@/hooks/useInvestmentActions';

// Components
import { InvestmentTable } from '@/components/investment/InvestmentTable';
import { AddAssetCard } from '@/components/investment/AddAssetCard';
import { EditModal } from '@/components/investment/EditModal';
import { TransactionModal } from '@/components/investment/TransactionModal';
import { TodayTransactions } from '@/components/investment/TodayTransactions';

export default function InvestmentManager() {
    const { assets, loading, isRefreshing, rate, rateTime, lastUpdated, fetchData, setAssets } = useAssets();

    const {
        knownNames,
        todayTransactions,
        addInvestment,
        deleteInvestment,
        saveEdit,
        handleTransaction,
        saveTxEdit,
    } = useInvestmentActions({ assets, rate, lastUpdated, fetchData, setAssets });

    const [viewMode, setViewMode] = useState<'aggregated' | 'detailed'>('aggregated');
    const [isPrivate, setIsPrivate] = useState(false);


    // New asset form
    const [newInvestment, setNewInvestment] = useState({
        symbol: '', shares: '', avgPrice: '',
        marketType: 'Domestic' as MarketType,
        category: 'Domestic Stock' as AssetCategory
    });

    // Edit modal
    const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
    const [editForm, setEditForm] = useState({ shares: '', avgPrice: '', category: '' as AssetCategory });
    const [showEditModal, setShowEditModal] = useState(false);

    // Transaction modal
    const [showTxModal, setShowTxModal] = useState(false);
    const [selectedInv, setSelectedInv] = useState<Investment | null>(null);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
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

    const openTxModal = useCallback((inv: Investment) => {
        setSelectedInv(inv);
        setEditingTx(null);
        setTxForm(p => ({
            ...p, type: 'BUY', shares: '',
            price: String(inv.currentPrice || inv.avgPrice),
            date: new Date().toISOString().split('T')[0]
        }));
        setShowTxModal(true);
    }, []);

    const startEditing = useCallback((inv: Investment) => {
        setEditingInvestment(inv);
        setEditForm({
            shares: String(inv.shares),
            avgPrice: String(inv.avgPrice),
            category: inv.category || (inv.marketType === 'Overseas' ? 'Overseas Stock' : 'Domestic Stock')
        });
        setShowEditModal(true);
    }, []);

    const startEditingTx = useCallback((tx: Transaction) => {
        setEditingTx(tx);
        const invSymbol = tx.symbol || '';
        const existingInv = assets.investments.find(i => i.symbol === invSymbol);
        const inv = existingInv || {
            id: 'temp', symbol: invSymbol,
            name: knownNames[invSymbol] || invSymbol,
            shares: 0, avgPrice: 0,
            currency: tx.currency,
            marketType: 'Domestic',
            category: 'Domestic Stock'
        } as Investment;
        setSelectedInv(inv);
        setTxForm({
            type: tx.type,
            shares: String(tx.shares || ''),
            price: String(tx.price || ''),
            date: tx.date,
            notes: tx.notes || ''
        });
        setShowTxModal(true);
    }, [assets.investments, knownNames]);

    const getAggregated = (list: Investment[]): Investment[] => {
        const grouped = list.reduce<Record<string, Investment>>((acc, inv) => {
            if (!acc[inv.symbol]) {
                acc[inv.symbol] = { ...inv };
            } else {
                const totalShares = acc[inv.symbol].shares + inv.shares;
                acc[inv.symbol].avgPrice = (acc[inv.symbol].shares * acc[inv.symbol].avgPrice + inv.shares * inv.avgPrice) / totalShares;
                acc[inv.symbol].shares = totalShares;
            }
            return acc;
        }, {});
        return Object.values(grouped);
    };

    const filtered = (m: MarketType): Investment[] => {
        const list = assets.investments.filter(s => s.marketType === m);
        return viewMode === 'aggregated' ? getAggregated(list) : list;
    };

    if (loading) return <div className="flex-center" style={{ height: '60vh', color: 'var(--muted)' }}>Loading...</div>;


    return (
        <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
                <div>
                    <span className="section-label">자산 관리</span>
                    <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em' }}>투자 현황</h1>
                    <p style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                        1 USD = <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{rate.toLocaleString()}</span> KRW
                        {lastUpdated && <span style={{ opacity: 0.8, marginLeft: '4px' }}>• {lastUpdated} 갱신</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => setIsPrivate(!isPrivate)} className="glass" style={{ width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isPrivate ? 'var(--primary)' : 'var(--foreground)' }}>
                        {isPrivate ? <EyeOff size={20} /> : <Eye size={20} />}

                    </button>

                    <button onClick={() => setViewMode(viewMode === 'aggregated' ? 'detailed' : 'aggregated')} className="glass" style={{ padding: '0.75rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--foreground)', fontWeight: '600', fontSize: '0.9rem' }}>
                        {viewMode === 'aggregated' ? <List size={18} /> : <Layers size={18} />} {viewMode === 'aggregated' ? '상세 내역' : '합산 내역'}
                    </button>
                    <button onClick={() => fetchData(true)} disabled={isRefreshing} className="glass" style={{ padding: '0.75rem 1.25rem', cursor: isRefreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--foreground)', fontWeight: '600', fontSize: '0.9rem', opacity: isRefreshing ? 0.7 : 1 }}>
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} /> {isRefreshing ? '갱신 중...' : '새로고침'}
                    </button>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2.5rem', marginBottom: '3rem' }}>
                <div className="glass" onMouseMove={handleMouseMove} style={{ padding: '0' }}>
                    <div className="spotlight" style={{ left: mousePos.x, top: mousePos.y }} />
                    <InvestmentTable
                        investments={filtered('Domestic')} title="국내 시장" rate={rate}
                        isPrivate={isPrivate} onEdit={startEditing} onDelete={deleteInvestment}
                        onTransaction={openTxModal}
                    />
                </div>
                <div className="glass" onMouseMove={handleMouseMove} style={{ padding: '0' }}>
                    <div className="spotlight" style={{ left: mousePos.x, top: mousePos.y }} />
                    <InvestmentTable
                        investments={filtered('Overseas')} title="해외 시장" rate={rate}
                        isPrivate={isPrivate} onEdit={startEditing} onDelete={deleteInvestment}
                        onTransaction={openTxModal}
                    />
                </div>

                {!isPrivate && (
                    <TodayTransactions
                        transactions={todayTransactions}
                        investments={assets.investments}
                        knownNames={knownNames}
                        onEditTx={startEditingTx}
                    />
                )}

                <AddAssetCard
                    newInvestment={newInvestment}
                    mousePos={mousePos}
                    onMouseMove={handleMouseMove}
                    onFormChange={(f, v) => setNewInvestment(p => ({
                        ...p, [f]: v,
                        marketType: f === 'category'
                            ? (v.includes('Overseas') ? 'Overseas' : 'Domestic')
                            : p.marketType
                    }))}
                    onSubmit={() => addInvestment(newInvestment).then(() =>
                        setNewInvestment({ symbol: '', shares: '', avgPrice: '', marketType: 'Domestic', category: 'Domestic Stock' })
                    )}
                />
            </div>

            {showTxModal && selectedInv && (
                <TransactionModal
                    selectedInv={selectedInv}
                    txForm={txForm}
                    onClose={() => { setShowTxModal(false); setEditingTx(null); }}
                    onTypeChange={(t) => setTxForm(p => ({ ...p, type: t }))}
                    onFormChange={(f, v) => setTxForm(p => ({ ...p, [f]: v }))}
                    onMaxSell={() => setTxForm(p => ({ ...p, shares: String(selectedInv.shares) }))}
                    onSubmit={async () => {
                        if (editingTx) {
                            await saveTxEdit(editingTx, selectedInv, txForm, knownNames);
                        } else {
                            await handleTransaction(selectedInv, txForm);
                        }
                        setShowTxModal(false);
                        setEditingTx(null);
                    }}
                    isEditing={!!editingTx}
                />
            )}

            {showEditModal && editingInvestment && (
                <EditModal
                    editingInvestment={editingInvestment}
                    viewMode={viewMode}
                    editForm={editForm}
                    onClose={() => setShowEditModal(false)}
                    onFormChange={(f, v) => setEditForm(p => ({ ...p, [f]: v }))}
                    onSubmit={async () => {
                        await saveEdit(editingInvestment, editForm, viewMode);
                        setShowEditModal(false);
                    }}
                />
            )}
        </main>
    );
}
