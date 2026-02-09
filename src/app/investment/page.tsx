'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Layers, List, Eye, EyeOff, DollarSign, Edit } from 'lucide-react';
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
    const [isPrivate, setIsPrivate] = useState(true);

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

    const [todayTransactions, setTodayTransactions] = useState<Transaction[]>([]);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [knownNames, setKnownNames] = useState<Record<string, string>>({});

    // Update known names from assets
    useEffect(() => {
        const map: Record<string, string> = {};
        assets.investments.forEach(inv => {
            if (inv.name && inv.name !== inv.symbol) {
                map[inv.symbol] = inv.name;
            }
        });
        setKnownNames(prev => ({ ...prev, ...map }));
    }, [assets.investments]);

    // Fetch today's transactions and missing names
    useEffect(() => {
        const fetchTodayTx = async () => {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`/api/transactions?date=${today}`);
            if (res.ok) {
                const data = await res.json();
                setTodayTransactions(data);

                // Identify symbols needing name resolution
                const symbolsToCheck = [...new Set(data.map((t: Transaction) => t.symbol))] as string[];
                const missingSymbols = symbolsToCheck.filter(sym => !knownNames[sym] && !assets.investments.find(i => i.symbol === sym));

                if (missingSymbols.length > 0) {
                    const priceRes = await fetch(`/api/stock?symbols=${missingSymbols.join(',')}`);
                    if (priceRes.ok) {
                        const priceData = await priceRes.json();
                        const newNames: Record<string, string> = {};
                        priceData.results?.forEach((r: any) => {
                            if (r.name && r.name !== r.symbol) {
                                newNames[r.symbol] = r.name;
                            }
                        });
                        setKnownNames(prev => ({ ...prev, ...newNames }));
                    }
                }
            }
        };
        fetchTodayTx();
    }, [lastUpdated, assets.investments]); // Add assets dependency to avoid re-fetching if already known via assets

    const revertTransaction = (inv: Investment, tx: Transaction): Investment => {
        if (tx.type === 'BUY') {
            const prevShares = inv.shares - (tx.shares || 0);
            if (prevShares <= 0) return { ...inv, shares: 0, avgPrice: 0 };
            const currentTotalCost = inv.shares * inv.avgPrice;
            const prevTotalCost = currentTotalCost - (tx.amount);
            return { ...inv, shares: prevShares, avgPrice: prevTotalCost / prevShares };
        } else {
            return { ...inv, shares: inv.shares + (tx.shares || 0) };
        }
    };

    const saveTxEdit = async () => {
        if (!editingTx || !selectedInv) return;

        // 1. Revert Old Transaction
        let tempInvestments = assets.investments.map(inv => {
            if (inv.symbol === editingTx.symbol) return revertTransaction(inv, editingTx);
            return inv;
        }).filter(inv => inv.shares > 0);

        // Handle case where investment was fully sold/removed and needs to be restored for revert
        if (!assets.investments.find(inv => inv.symbol === editingTx.symbol) && editingTx.type === 'SELL') {
            // Basic restoration - we might lack category/marketType if not stored in Tx. 
            // We try to use selectedInv which we tried to populate in startEditingTx
            // Try to find name again
            const sym = editingTx.symbol || '';
            const nameToUse = knownNames[sym] || sym;

            tempInvestments.push({
                ...selectedInv,
                name: nameToUse,
                shares: editingTx.shares || 0,
                // AvgPrice is lost if fully sold. fallback to sale price or 0? 
                // If we are reverting a SELL, we are adding shares back.
                // Ideally we shouldn't have lost the avgPrice, but we did. 
                // Let's assume current selectedInv has what we need or 0.
                avgPrice: 0
            });
        }

        let tempAllocations = assets.allocations.map((a: any) => {
            if (a.category === 'Cash') {
                const txVal = convertToKRW(editingTx.amount, editingTx.currency as any, rate);
                return { ...a, value: editingTx.type === 'BUY' ? a.value + txVal : a.value - txVal }; // Revert cash
            }
            return a;
        });

        // 2. Apply New Transaction (Logic similar to handleTransaction)
        const newTx: Transaction = {
            ...editingTx,
            date: txForm.date, type: txForm.type,
            amount: Number(txForm.shares) * Number(txForm.price),
            shares: Number(txForm.shares),
            price: Number(txForm.price),
            notes: txForm.notes
        };

        // Check if investment exists in tempInvestments (it might have been removed if revert set shares to 0)
        let invExists = false;
        tempInvestments = tempInvestments.map(inv => {
            if (inv.symbol === newTx.symbol) {
                invExists = true;
                if (newTx.type === 'BUY') {
                    const totalShares = inv.shares + (newTx.shares || 0);
                    const totalCost = (inv.shares * inv.avgPrice) + (newTx.amount);
                    return { ...inv, shares: totalShares, avgPrice: totalCost / totalShares };
                } else {
                    return { ...inv, shares: Math.max(0, inv.shares - (newTx.shares || 0)) };
                }
            }
            return inv;
        }).filter(inv => inv.shares > 0);

        if (!invExists && newTx.type === 'BUY') {
            // New buy on non-existent (or reverted-to-zero) investment
            const sym = newTx.symbol || '';
            const nameToUse = knownNames[sym] || sym;

            tempInvestments.push({
                ...selectedInv,
                name: nameToUse,
                shares: newTx.shares || 0,
                avgPrice: newTx.price || 0,
                id: Date.now().toString() // New ID or keep old?
            });
        }

        tempAllocations = tempAllocations.map((a: any) => {
            if (a.category === 'Cash') {
                const txVal = convertToKRW(newTx.amount, newTx.currency as any, rate);
                return { ...a, value: newTx.type === 'BUY' ? a.value - txVal : a.value + txVal };
            }
            return a;
        });

        await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTx),
        });

        await saveAssets({ investments: tempInvestments, allocations: tempAllocations });
        setShowTxModal(false);
        setEditingTx(null);
    };

    const startEditingTx = (tx: Transaction) => {
        setEditingTx(tx);
        const invSymbol = tx.symbol || '';
        const existingInv = assets.investments.find(i => i.symbol === invSymbol);

        const inv = existingInv || {
            id: 'temp',
            symbol: invSymbol,
            name: knownNames[invSymbol] || invSymbol, // Use knownNames or fallback to symbol
            shares: 0,
            avgPrice: 0,
            currency: tx.currency,
            marketType: 'Domestic', // Fallback, user might need to correct
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
    };

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
                        1 USD = <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{rate.toLocaleString()}</span> KRW
                        {lastUpdated && <span style={{ opacity: 0.8, marginLeft: '4px' }}>• {lastUpdated} 갱신</span>}
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
                    <InvestmentTable investments={filtered('Domestic')} title="Domestic Portfolios" rate={rate} isPrivate={isPrivate} onEdit={startEditing} onDelete={deleteInvestment} onTransaction={(inv) => { setSelectedInv(inv); setEditingTx(null); setTxForm(p => ({ ...p, price: String(inv.currentPrice || inv.avgPrice), date: new Date().toISOString().split('T')[0], type: 'BUY', shares: '' })); setShowTxModal(true); }} />
                </div>
                <div className="glass" onMouseMove={handleMouseMove} style={{ padding: '0' }}>
                    <div className="spotlight" style={{ left: mousePos.x, top: mousePos.y }}></div>
                    <InvestmentTable investments={filtered('Overseas')} title="Overseas Portfolios" rate={rate} isPrivate={isPrivate} onEdit={startEditing} onDelete={deleteInvestment} onTransaction={(inv) => { setSelectedInv(inv); setEditingTx(null); setTxForm(p => ({ ...p, price: String(inv.currentPrice || inv.avgPrice), date: new Date().toISOString().split('T')[0], type: 'BUY', shares: '' })); setShowTxModal(true); }} />
                </div>

                {todayTransactions.length > 0 && !isPrivate && (
                    <div className="glass" style={{ padding: '1.5rem' }}>
                        <span className="section-label" style={{ marginBottom: '1rem' }}>Today's Activity</span>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '0.75rem' }}>거래소</th>
                                    <th style={{ padding: '0.75rem' }}>종목 정보</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>수량</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>단가</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>금액</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {todayTransactions.map(tx => (
                                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{
                                                color: tx.type === 'BUY' ? '#ef4444' : '#3b82f6',
                                                fontWeight: 'bold',
                                                fontSize: '0.75rem',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                backgroundColor: tx.type === 'BUY' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)'
                                            }}>{tx.type}</span>
                                        </td>
                                        <td style={{ padding: '0.75rem', fontWeight: '600' }}>
                                            {(() => {
                                                const inv = assets.investments.find(i => i.symbol === tx.symbol);
                                                const name = (inv && inv.name) || knownNames[tx.symbol || ''];
                                                return name ? `${name} (${tx.symbol})` : tx.symbol;
                                            })()}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{tx.shares}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                            {tx.currency === 'USD' ? '$' : '₩'}{Number(tx.price).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', opacity: 0.8 }}>
                                            {tx.currency === 'USD' ? '$' : '₩'}{Number(tx.amount).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <button onClick={() => startEditingTx(tx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', opacity: 0.8 }}>
                                                <Edit size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

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
                    onSubmit={editingTx ? saveTxEdit : handleTransaction}
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
                    onSubmit={saveEdit}
                />
            )}
        </main>
    );
}
