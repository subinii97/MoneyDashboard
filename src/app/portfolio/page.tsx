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
    const { assets, loading, isRefreshing, rate, lastUpdated, fetchData, setAssets } = useAssets();
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
            const syncedAllocations = assets.allocations.map(a => {
                if (a.details && a.details.length > 0) {
                    const sum = a.details.reduce((acc, d) => acc + convertToKRW(d.value, d.currency || (a.currency as any), rate), 0);
                    const baseSum = a.currency === 'USD' ? sum / rate : sum;
                    return { ...a, value: baseSum };
                }
                return a;
            });
            await fetch('/api/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...assets, allocations: syncedAllocations.filter(a => FIXED_CATEGORIES.includes(a.category)) }),
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

    if (loading) return <div className="flex-center" style={{ height: '60vh', color: 'var(--muted)' }}>Loading...</div>;

    return (
        <>
            <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--foreground)' }}>
                <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <span className="section-label">Portfolio</span>
                        <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-0.03em' }}>자산 배분 및 리밸런싱</h1>
                        <p style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            전체 자산군별 비중을 관리하고 리밸런싱 전략을 확인하세요
                            {lastUpdated && <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>• {lastUpdated} 갱신</span>}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => setIsPrivate(!isPrivate)} className="glass" style={{ width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isPrivate ? 'var(--primary)' : 'var(--foreground)' }}>
                            {isPrivate ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                        <button onClick={() => fetchData(true)} disabled={isRefreshing} className="glass" style={{ padding: '0.75rem 1.5rem', cursor: isRefreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--foreground)', opacity: isRefreshing ? 0.7 : 1 }}>
                            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} /> {isRefreshing ? '갱신 중...' : '새로고침'}
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

            {/* Sticky Save Bar — appears only when there are unsaved changes */}
            {hasChanges && (
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
                    background: 'var(--card)', backdropFilter: 'blur(20px)',
                    borderTop: '1px solid var(--border-bright)',
                    padding: '0.85rem 2rem',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem',
                }}>
                    <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>저장되지 않은 변경사항이 있습니다</span>
                    <button
                        onClick={saveChanges}
                        disabled={isSaving}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.65rem 1.75rem', borderRadius: '10px',
                            background: 'var(--primary)', color: 'white',
                            border: 'none', fontWeight: '700', fontSize: '0.95rem',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            opacity: isSaving ? 0.7 : 1,
                            boxShadow: '0 0 20px rgba(37,99,235,0.4)',
                        }}
                    >
                        <Save size={17} /> {isSaving ? '저장 중...' : '지금 저장'}
                    </button>
                    <button
                        onClick={() => { fetchData(); setHasChanges(false); }}
                        style={{
                            background: 'none', border: '1px solid var(--border-bright)',
                            borderRadius: '10px', padding: '0.65rem 1.25rem',
                            color: 'var(--muted)', fontSize: '0.9rem', cursor: 'pointer'
                        }}
                    >
                        되돌리기
                    </button>
                </div>
            )}
        </>
    );
}


