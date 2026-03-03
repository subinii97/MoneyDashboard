'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, Layers, List, Eye, EyeOff, PlusCircle, Tag, PieChart } from 'lucide-react';
import { Investment, MarketType, Transaction, AssetCategory } from '@/lib/types';
import { useAssets } from '@/hooks/useAssets';
import { useInvestmentActions } from '@/hooks/useInvestmentActions';

// Components
import { InvestmentTable } from '@/components/investment/InvestmentTable';
import { AddAssetCard } from '@/components/investment/AddAssetCard';
import { ChartModal } from '@/components/investment/ChartModal';

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

    const [isPrivate, setIsPrivate] = useState(false);
    const [showChartModal, setShowChartModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);


    // New asset form
    const [newInvestment, setNewInvestment] = useState({
        symbol: '', shares: '', avgPrice: '',
        marketType: 'Domestic' as MarketType,
        category: 'Domestic Stock' as AssetCategory,
        tags: [] as string[]
    });

    // Edit modal
    const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
    const [editForm, setEditForm] = useState({ shares: '', avgPrice: '', category: '' as AssetCategory, tags: [] as string[] });
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
            category: inv.category || (inv.marketType === 'Overseas' ? 'Overseas Stock' : 'Domestic Stock'),
            tags: inv.tags || []
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

    const filtered = (m: MarketType): Investment[] => {
        let list = assets.investments.filter(s => s.marketType === m);
        if (selectedTag) {
            list = list.filter(s => s.tags && s.tags.includes(selectedTag));
        }
        return list;
    };

    if (loading) return <div className="flex-center" style={{ height: '60vh', color: 'var(--muted)' }}>Loading...</div>;


    return (
        <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
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
                    <button onClick={() => setShowAddModal(true)} className="glass" style={{ padding: '0.75rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary)', fontWeight: '600', fontSize: '0.9rem' }}>
                        <PlusCircle size={18} /> 종목 추가
                    </button>
                    <button onClick={() => setIsPrivate(!isPrivate)} className="glass" style={{ width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isPrivate ? 'var(--primary)' : 'var(--foreground)' }}>
                        {isPrivate ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                    <button onClick={() => fetchData(true)} disabled={isRefreshing} className="glass" style={{ padding: '0.75rem 1.25rem', cursor: isRefreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--foreground)', fontWeight: '600', fontSize: '0.9rem', opacity: isRefreshing ? 0.7 : 1 }}>
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} /> {isRefreshing ? '갱신 중...' : '새로고침'}
                    </button>
                </div>
            </header>

            {/* Tag Filter */}
            {(() => {
                const allTags = [...new Set(assets.investments.flatMap(inv => inv.tags || []))].sort();
                if (allTags.length === 0) return null;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        <Tag size={16} style={{ color: 'var(--muted)' }} />
                        <button
                            onClick={() => setSelectedTag(null)}
                            className="glass"
                            style={{
                                padding: '0.3rem 0.7rem', borderRadius: '16px', fontSize: '0.75rem',
                                cursor: 'pointer', fontWeight: '600', border: 'none',
                                background: !selectedTag ? 'var(--primary)' : 'var(--border)',
                                color: !selectedTag ? 'white' : 'var(--muted)',
                            }}
                        >전체</button>
                        {allTags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                className="glass"
                                style={{
                                    padding: '0.3rem 0.7rem', borderRadius: '16px', fontSize: '0.75rem',
                                    cursor: 'pointer', fontWeight: '600', border: 'none',
                                    background: selectedTag === tag ? 'var(--primary)' : 'var(--border)',
                                    color: selectedTag === tag ? 'white' : 'var(--muted)',
                                }}
                            >{tag}</button>
                        ))}
                    </div>
                );
            })()}

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
                    editForm={editForm}
                    onClose={() => setShowEditModal(false)}
                    onFormChange={(f, v) => setEditForm(p => ({ ...p, [f]: v }))}
                    onSubmit={async () => {
                        await saveEdit(editingInvestment, editForm, 'aggregated');
                        setShowEditModal(false);
                    }}
                />
            )}

            {showChartModal && (
                <ChartModal 
                    investments={assets.investments}
                    onClose={() => setShowChartModal(false)}
                />
            )}

            {showAddModal && (
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
                    onSubmit={async () => {
                        await addInvestment(newInvestment);
                        setNewInvestment({ symbol: '', shares: '', avgPrice: '', marketType: 'Domestic', category: 'Domestic Stock', tags: [] });
                        setShowAddModal(false);
                    }}
                    onCancel={() => setShowAddModal(false)}
                />
            )}
        </main>
    );
}
