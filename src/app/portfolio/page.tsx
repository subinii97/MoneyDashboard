'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Assets, AssetAllocation, AssetCategory, MarketType, AssetDetail } from '@/lib/types';
import { convertToKRW } from '@/lib/utils';
import { useAssets } from '@/hooks/useAssets';

// Components
import { AllocationPieCharts } from '@/components/portfolio/AllocationPieCharts';
import { AllocationTable } from '@/components/portfolio/AllocationTable';
import { AssetDetailManager } from '@/components/portfolio/AssetDetailManager';

const FIXED_CATEGORIES: AssetCategory[] = [
    'Cash', 'Savings', 'Domestic Stock', 'Domestic Index', 'Domestic Bond',
    'Overseas Stock', 'Overseas Bond', 'Overseas Index'
];

export default function PortfolioPage() {
    const { assets, loading, rate, fetchData, setAssets } = useAssets();
    const [isSaving, setIsSaving] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [isPrivate, setIsPrivate] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [navTarget, setNavTarget] = useState<string | null>(null);

    const enrichAllocations = useCallback((data: Assets) => {
        let initial = data.allocations || [];
        const existing = initial.map(a => a.category);
        const missing = FIXED_CATEGORIES.filter(c => !existing.includes(c));

        if (missing.length > 0) {
            const added = missing.map(cat => ({
                id: cat.toLowerCase().replace(' ', '-'),
                category: cat, value: 0,
                currency: cat.startsWith('Overseas') ? 'USD' : ('KRW' as any),
                targetWeight: 0
            }));
            initial = [...initial, ...added];
        }
        return initial.map(a => ({ ...a, targetWeight: Math.round(a.targetWeight || 0) }));
    }, []);

    useEffect(() => {
        if (!loading && assets.allocations) {
            const enriched = enrichAllocations(assets);
            if (JSON.stringify(enriched) !== JSON.stringify(assets.allocations)) {
                setAssets(prev => ({ ...prev, allocations: enriched }));
            }
        }
    }, [loading, assets, enrichAllocations, setAssets]);

    const handleWeightChange = (category: AssetCategory, raw: number) => {
        const val = Math.min(100, Math.max(0, Math.round(raw / 5) * 5));
        setAssets(prev => ({ ...prev, allocations: prev.allocations.map(a => a.category === category ? { ...a, targetWeight: val } : a) }));
        setHasChanges(true);
    };

    const saveChanges = async () => {
        setIsSaving(true);
        try {
            await fetch('/api/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...assets, allocations: assets.allocations.filter(a => FIXED_CATEGORIES.includes(a.category)) }),
            });
            setHasChanges(false);
            alert('저장되었습니다.');
        } catch { alert('저장에 실패했습니다.'); }
        finally { setIsSaving(false); }
    };

    const getCurrentValue = (a: AssetAllocation) => {
        const isInv = a.category.includes('Stock') || a.category.includes('Index') || a.category.includes('Bond');
        if (isInv) {
            return assets.investments
                .filter(inv => inv.category ? inv.category === a.category : (a.category === 'Domestic Stock' ? inv.marketType === 'Domestic' : (a.category === 'Overseas Stock' ? inv.marketType === 'Overseas' : false)))
                .reduce((acc, inv) => acc + convertToKRW((inv.currentPrice || inv.avgPrice) * inv.shares, inv.currency as any, rate), 0);
        }
        if (a.details?.length) return a.details.reduce((sum, d) => sum + convertToKRW(d.value, d.currency || (a.currency as any), rate), 0);
        return convertToKRW(a.value, a.currency as any, rate);
    };

    const totalValue = assets.allocations.reduce((acc, a) => acc + getCurrentValue(a), 0);
    const totalTargetWeight = assets.allocations.reduce((acc, a) => acc + (a.targetWeight || 0), 0);

    const updateDetail = (cat: AssetCategory, id: string, updates: Partial<AssetDetail>) => {
        setAssets(prev => ({ ...prev, allocations: prev.allocations.map(a => a.category === cat ? { ...a, details: a.details?.map(d => d.id === id ? { ...d, ...updates } : d) } : a) }));
        setHasChanges(true);
    };

    const addDetail = (cat: AssetCategory) => {
        setAssets(prev => ({ ...prev, allocations: prev.allocations.map(a => a.category === cat ? { ...a, details: [...(a.details || []), { id: Date.now().toString(), name: '', value: 0, currency: a.currency as any }] } : a) }));
        setHasChanges(true);
    };

    const deleteDetail = (cat: AssetCategory, id: string) => {
        setAssets(prev => ({ ...prev, allocations: prev.allocations.map(a => a.category === cat ? { ...a, details: a.details?.filter(d => d.id !== id) } : a) }));
        setHasChanges(true);
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

    return (
        <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: '800' }}>자산 배분 및 리밸런싱</h1>
                    <p style={{ color: 'var(--muted)' }}>전체 자산군별 비중을 관리하고 리밸런싱 전략을 확인하세요</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => setIsPrivate(!isPrivate)} className="glass" style={{ width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isPrivate ? 'var(--primary)' : 'white' }}>
                        {isPrivate ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                    <button onClick={fetchData} className="glass" style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                        <RefreshCw size={18} /> 새로고침
                    </button>
                    <button onClick={saveChanges} disabled={isSaving} className="glass" style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none' }}>
                        <Save size={18} /> {isSaving ? '저장 중...' : '설정 저장'}
                    </button>
                </div>
            </header>

            <AllocationPieCharts allocations={assets.allocations} totalValue={totalValue} getCurrentValue={getCurrentValue} isPrivate={isPrivate} />

            <AllocationTable
                allocations={assets.allocations}
                totalValue={totalValue}
                totalTargetWeight={totalTargetWeight}
                isPrivate={isPrivate}
                showAddMenu={showAddMenu}
                fixedCategories={FIXED_CATEGORIES}
                getCurrentValue={getCurrentValue}
                onWeightChange={handleWeightChange}
                onAddCategory={(cat) => { setAssets(prev => ({ ...prev, allocations: prev.allocations.map(a => a.category === cat ? { ...a, targetWeight: 5 } : a) })); setHasChanges(true); setShowAddMenu(false); }}
                onToggleAddMenu={() => setShowAddMenu(!showAddMenu)}
            />

            <AssetDetailManager
                allocations={assets.allocations}
                isPrivate={isPrivate}
                getCurrentValue={getCurrentValue}
                onAddDetail={addDetail}
                onDeleteDetail={deleteDetail}
                onUpdateDetail={updateDetail}
            />
        </main>
    );
}
