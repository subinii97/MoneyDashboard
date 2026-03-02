'use client';

import { useState, useEffect, useCallback } from 'react';
import { Investment, Transaction, Assets, AssetCategory } from '@/lib/types';
import { convertToKRW } from '@/lib/utils';

interface UseInvestmentActionsProps {
    assets: Assets;
    rate: number;
    lastUpdated: string | null;
    fetchData: (refresh?: boolean) => void;
    setAssets: (assets: Assets) => void;
}

export function useInvestmentActions({ assets, rate, lastUpdated, fetchData }: UseInvestmentActionsProps) {
    const [knownNames, setKnownNames] = useState<Record<string, string>>({});
    const [todayTransactions, setTodayTransactions] = useState<Transaction[]>([]);

    // Build known names map from current assets
    useEffect(() => {
        const map: Record<string, string> = {};
        assets.investments.forEach(inv => {
            if (inv.name && inv.name !== inv.symbol) {
                map[inv.symbol] = inv.name;
            }
        });
        setKnownNames(prev => ({ ...prev, ...map }));
    }, [assets.investments]);

    // Fetch today's transactions
    useEffect(() => {
        const fetchTodayTx = async () => {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`/api/transactions?date=${today}`);
            if (!res.ok) return;
            const data = await res.json();
            setTodayTransactions(data);

            // Resolve names for symbols not yet known
            const symbolsToCheck = [...new Set(data.map((t: Transaction) => t.symbol))] as string[];
            const missing = symbolsToCheck.filter(
                sym => !knownNames[sym] && !assets.investments.find(i => i.symbol === sym)
            );

            if (missing.length > 0) {
                const priceRes = await fetch(`/api/stock?symbols=${missing.join(',')}`);
                if (priceRes.ok) {
                    const priceData = await priceRes.json();
                    const newNames: Record<string, string> = {};
                    priceData.results?.forEach((r: any) => {
                        if (r.name && r.name !== r.symbol) newNames[r.symbol] = r.name;
                    });
                    setKnownNames(prev => ({ ...prev, ...newNames }));
                }
            }
        };
        fetchTodayTx();
    }, [lastUpdated, assets.investments]);

    // ── Core helpers ────────────────────────────────────────────────────────
    const saveAssets = useCallback(async (updatedAssets: Assets) => {
        await fetch('/api/assets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedAssets),
        });
        fetchData();
    }, [fetchData]);

    const applyTransaction = useCallback((
        investments: Investment[],
        tx: Transaction,
        direction: 'apply' | 'revert'
    ): Investment[] => {
        const isBuy = tx.type === 'BUY';
        const isApply = direction === 'apply';

        return investments.map(inv => {
            if (inv.symbol !== tx.symbol) return inv;
            if (isBuy === isApply) {
                // Apply BUY or Revert SELL → add shares
                const addShares = tx.shares || 0;
                const totalShares = inv.shares + addShares;
                const totalCost = (inv.shares * inv.avgPrice) + (isApply ? tx.amount : 0);
                return { ...inv, shares: totalShares, avgPrice: isApply ? (totalCost / totalShares) : inv.avgPrice };
            } else {
                // Apply SELL or Revert BUY → remove shares
                const removeShares = tx.shares || 0;
                if (direction === 'revert' && isBuy) {
                    const prevShares = inv.shares - removeShares;
                    if (prevShares <= 0) return { ...inv, shares: 0, avgPrice: 0 };
                    const prevCost = inv.shares * inv.avgPrice - tx.amount;
                    return { ...inv, shares: prevShares, avgPrice: prevCost / prevShares };
                }
                return { ...inv, shares: Math.max(0, inv.shares - removeShares) };
            }
        }).filter(inv => inv.shares > 0);
    }, []);

    const adjustCash = useCallback((
        allocations: any[],
        tx: Transaction,
        direction: 'apply' | 'revert'
    ) => {
        const txVal = convertToKRW(tx.amount, tx.currency as any, rate);
        const isBuy = tx.type === 'BUY';
        const shouldDeduct = (isBuy && direction === 'apply') || (!isBuy && direction === 'revert');
        return allocations.map((a: any) => {
            if (a.category !== 'Cash') return a;
            return { ...a, value: shouldDeduct ? a.value - txVal : a.value + txVal };
        });
    }, [rate]);

    // ── Public actions ──────────────────────────────────────────────────────
    const addInvestment = useCallback(async (form: {
        symbol: string; shares: string; avgPrice: string;
        marketType: 'Domestic' | 'Overseas'; category: AssetCategory;
    }) => {
        if (!form.symbol || !form.shares || !form.avgPrice) return;
        const symbol = form.symbol.toUpperCase();
        const shares = Number(form.shares);
        const price = Number(form.avgPrice);
        const currency = form.marketType === 'Overseas' ? 'USD' : 'KRW';

        const invToAdd: Investment = {
            id: Date.now().toString(), symbol, shares, avgPrice: price,
            marketType: form.marketType, category: form.category,
            currency: currency as any, targetWeight: 0
        };

        const tx: Transaction = {
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            type: 'BUY', symbol,
            amount: shares * price, shares, price,
            currency: currency as any,
            notes: '신규 항목 추가 (매수)'
        };

        await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
        });

        const updatedAllocations = adjustCash(assets.allocations, tx, 'apply');
        await saveAssets({ investments: [...assets.investments, invToAdd], allocations: updatedAllocations });
    }, [assets, adjustCash, saveAssets]);

    const deleteInvestment = useCallback(async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        await saveAssets({ ...assets, investments: assets.investments.filter(s => s.id !== id) });
    }, [assets, saveAssets]);

    const saveEdit = useCallback(async (
        editingInvestment: Investment,
        editForm: { shares: string; avgPrice: string; category: AssetCategory },
        viewMode: 'aggregated' | 'detailed'
    ) => {
        const sharesNum = Number(editForm.shares.replace(/,/g, ''));
        const priceNum = Number(editForm.avgPrice.replace(/,/g, ''));
        const category = editForm.category;
        const marketType = category.includes('Overseas') ? 'Overseas' : 'Domestic';

        let updatedInvestments: Investment[];
        if (viewMode === 'aggregated') {
            const others = assets.investments.filter(inv =>
                inv.symbol !== editingInvestment.symbol || inv.marketType !== editingInvestment.marketType
            );
            updatedInvestments = [...others, { ...editingInvestment, shares: sharesNum, avgPrice: priceNum, category, marketType: marketType as any }];
        } else {
            updatedInvestments = assets.investments.map(s =>
                s.id === editingInvestment.id
                    ? { ...s, shares: sharesNum, avgPrice: priceNum, category, marketType: marketType as any }
                    : s
            );
        }
        await saveAssets({ ...assets, investments: updatedInvestments });
    }, [assets, saveAssets]);

    const handleTransaction = useCallback(async (
        selectedInv: Investment,
        txForm: { type: any; shares: string; price: string; date: string; notes: string }
    ) => {
        if (!txForm.shares || !txForm.price) return;
        const tx: Transaction = {
            id: Date.now().toString(),
            date: txForm.date, type: txForm.type,
            symbol: selectedInv.symbol,
            amount: Number(txForm.shares) * Number(txForm.price),
            shares: Number(txForm.shares),
            price: Number(txForm.price),
            currency: (selectedInv.currency as any) || 'KRW',
            notes: txForm.notes
        };
        const updatedInvestments = applyTransaction(assets.investments, tx, 'apply');
        const updatedAllocations = adjustCash(assets.allocations, tx, 'apply');
        await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tx),
        });
        await saveAssets({ investments: updatedInvestments, allocations: updatedAllocations });
    }, [assets, applyTransaction, adjustCash, saveAssets]);

    const saveTxEdit = useCallback(async (
        editingTx: Transaction,
        selectedInv: Investment,
        txForm: { type: any; shares: string; price: string; date: string; notes: string },
        knownNamesRef: Record<string, string>
    ) => {
        // 1. Revert old transaction
        let tempInvestments = applyTransaction(assets.investments, editingTx, 'revert');
        let tempAllocations = adjustCash(assets.allocations, editingTx, 'revert');

        // 2. Apply new transaction
        const newTx: Transaction = {
            ...editingTx,
            date: txForm.date, type: txForm.type,
            amount: Number(txForm.shares) * Number(txForm.price),
            shares: Number(txForm.shares),
            price: Number(txForm.price),
            notes: txForm.notes
        };

        let invExists = false;
        tempInvestments = tempInvestments.map(inv => {
            if (inv.symbol !== newTx.symbol) return inv;
            invExists = true;
            return applyTransaction([inv], newTx, 'apply')[0] || { ...inv, shares: 0 };
        }).filter(inv => inv.shares > 0);

        if (!invExists && newTx.type === 'BUY') {
            const sym = newTx.symbol || '';
            tempInvestments.push({
                ...selectedInv,
                name: knownNamesRef[sym] || sym,
                shares: newTx.shares || 0,
                avgPrice: newTx.price || 0,
                id: selectedInv.id
            });
        }

        tempAllocations = adjustCash(tempAllocations, newTx, 'apply');

        await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTx),
        });
        await saveAssets({ investments: tempInvestments, allocations: tempAllocations });
    }, [assets, applyTransaction, adjustCash, saveAssets]);

    return {
        knownNames,
        todayTransactions,
        saveAssets,
        addInvestment,
        deleteInvestment,
        saveEdit,
        handleTransaction,
        saveTxEdit,
    };
}
