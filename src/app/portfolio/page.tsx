'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Save,
    RefreshCw,
    AlertCircle,
    ArrowRight,
    TrendingUp,
    TrendingDown,
    Plus,
    Eye,
    EyeOff,
    Calculator,
    CheckCircle2,
    GripVertical
} from 'lucide-react';
import { Assets, AssetAllocation, AssetCategory, MarketType, CATEGORY_MAP, CATEGORY_COLORS, AssetDetail } from '@/lib/types';
import { formatKRW, convertToKRW } from '@/lib/utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import React from 'react';
import Link from 'next/link';

const FIXED_CATEGORIES: AssetCategory[] = [
    'Cash',
    'Savings',
    'Domestic Stock',
    'Domestic Index',
    'Domestic Bond',
    'Overseas Stock',
    'Overseas Bond',
    'Overseas Index'
];

export default function PortfolioPage() {
    const [assets, setAssets] = useState<Assets>({ investments: [], allocations: [] });
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState<number>(1350);
    const [isSaving, setIsSaving] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [isPrivate, setIsPrivate] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [navTarget, setNavTarget] = useState<string | null>(null);

    // Slider refinement states
    const [editingWeight, setEditingWeight] = useState<AssetCategory | null>(null);
    const [tempWeight, setTempWeight] = useState('');
    const [hoveringCategory, setHoveringCategory] = useState<AssetCategory | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/assets');
            const data = await res.json();

            const investmentsRaw = data.investments || data.stocks || [];
            let initialAllocations = data.allocations || data.others || [];

            const existingCategories = initialAllocations.map((a: AssetAllocation) => a.category);
            const missing = FIXED_CATEGORIES.filter(c => !existingCategories.includes(c));

            if (missing.length > 0) {
                const newAllocations = [...initialAllocations];
                missing.forEach(cat => {
                    newAllocations.push({
                        id: cat.toLowerCase().replace(' ', '-'),
                        category: cat,
                        value: 0,
                        currency: cat.startsWith('Overseas') ? 'USD' : 'KRW',
                        targetWeight: 0
                    });
                });
                initialAllocations = newAllocations;
            }

            initialAllocations = initialAllocations.map((a: AssetAllocation) => ({
                ...a,
                targetWeight: Math.round(a.targetWeight || 0)
            }));

            // Fetch current prices to ensure "Current Value" is accurate
            const symbols = Array.from(new Set(investmentsRaw.map((s: any) => s.symbol))).join(',');
            const priceRes = await fetch(`/api/stock?symbols=${symbols}&t=${Date.now()}`);
            const priceData = await priceRes.json();

            if (priceData.exchangeRate) {
                const r = typeof priceData.exchangeRate === 'object' ? priceData.exchangeRate.rate : priceData.exchangeRate;
                setRate(r);
            }

            const updatedInvestments = investmentsRaw.map((inv: any) => {
                const info = priceData.results?.find((r: any) => r.symbol === inv.symbol);
                return {
                    ...inv,
                    currentPrice: info?.price || inv.avgPrice,
                    currency: info?.currency || inv.currency || (inv.symbol.includes('.') ? 'KRW' : 'USD'),
                    marketType: inv.marketType || (inv.symbol.includes('.') || (info && info.exchange === 'KRX') ? 'Domestic' : 'Overseas')
                };
            });

            setAssets({ investments: updatedInvestments, allocations: initialAllocations });
            setHasChanges(false);
        } catch (e) {
            console.error('Failed to fetch data', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleWeightChange = (category: AssetCategory, rawValue: number) => {
        // Round to nearest 5 for consistency, but don't force balancing
        const newValue = Math.min(100, Math.max(0, Math.round(rawValue / 5) * 5));

        setAssets(prev => {
            const newAllocations = prev.allocations.map(a =>
                a.category === category ? { ...a, targetWeight: newValue } : a
            );
            return { ...prev, allocations: newAllocations };
        });
        setHasChanges(true);
    };

    const addCategory = (category: AssetCategory) => {
        setAssets(prev => ({
            ...prev,
            allocations: prev.allocations.map(a =>
                a.category === category ? { ...a, targetWeight: 5 } : a
            )
        }));
        setHasChanges(true);
        setShowAddMenu(false);
    };

    const saveChanges = async () => {
        setIsSaving(true);
        try {
            const finalAllocations = assets.allocations.filter(a => FIXED_CATEGORIES.includes(a.category));
            await fetch('/api/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...assets, allocations: finalAllocations }),
            });
            setHasChanges(false);
            alert('저장되었습니다.');
        } catch (e) {
            alert('저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const getInvestmentValue = (type: MarketType) => {
        return assets.investments
            .filter(s => s.marketType === type)
            .reduce((acc, s) => {
                const val = (s.currentPrice || s.avgPrice) * s.shares;
                return acc + convertToKRW(val, s.currency || (type === 'Domestic' ? 'KRW' : 'USD'), rate);
            }, 0);
    };

    const domesticStockValue = getInvestmentValue('Domestic');
    const overseasStockValue = getInvestmentValue('Overseas');

    const getCurrentValue = (a: AssetAllocation) => {
        const isStockIndexBond = a.category.includes('Stock') || a.category.includes('Index') || a.category.includes('Bond');

        if (isStockIndexBond) {
            return assets.investments
                .filter(inv => {
                    // Match by explicit category if available
                    if (inv.category) return inv.category === a.category;
                    // Fallback to marketType for Stock categories if no category set
                    if (a.category === 'Domestic Stock') return inv.marketType === 'Domestic';
                    if (a.category === 'Overseas Stock') return inv.marketType === 'Overseas';
                    return false;
                })
                .reduce((acc, inv) => {
                    const price = inv.currentPrice || inv.avgPrice;
                    const val = price * inv.shares;
                    const isUSD = inv.currency === 'USD' || (inv.marketType === 'Overseas' && inv.currency !== 'KRW');
                    return acc + convertToKRW(val, isUSD ? 'USD' : 'KRW', rate);
                }, 0);
        }

        if (a.details && a.details.length > 0) {
            return a.details.reduce((sum, d) => {
                return sum + convertToKRW(d.value, d.currency || a.currency, rate);
            }, 0);
        }

        return convertToKRW(a.value, a.currency, rate);
    };

    const totalValue = assets.allocations.reduce((acc, a) => acc + getCurrentValue(a), 0);
    const totalTargetWeight = assets.allocations.reduce((acc, a) => acc + (a.targetWeight || 0), 0);

    const rebalancingProposals = assets.allocations.map(a => {
        const currentVal = getCurrentValue(a);
        const targetVal = (totalValue * (a.targetWeight || 0)) / 100;
        const diff = targetVal - currentVal;
        return { ...a, localizedCategory: CATEGORY_MAP[a.category], currentVal, targetVal, diff };
    }).filter(p => Math.abs(p.diff) > 1000);

    const addDetail = (category: AssetCategory) => {
        setAssets(prev => ({
            ...prev,
            allocations: prev.allocations.map(a => {
                if (a.category === category) {
                    const newDetails = [...(a.details || []), { id: Date.now().toString(), name: '', value: 0, currency: a.currency }];
                    return { ...a, details: newDetails };
                }
                return a;
            })
        }));
        setHasChanges(true);
    };

    const deleteDetail = (category: AssetCategory, detailId: string) => {
        setAssets(prev => ({
            ...prev,
            allocations: prev.allocations.map(a => {
                if (a.category === category && a.details) {
                    const newDetails = a.details.filter(d => d.id !== detailId);
                    return { ...a, details: newDetails };
                }
                return a;
            })
        }));
        setHasChanges(true);
    };

    const updateDetail = (category: AssetCategory, detailId: string, updates: Partial<AssetDetail>) => {
        setAssets(prev => ({
            ...prev,
            allocations: prev.allocations.map(a => {
                if (a.category === category && a.details) {
                    const newDetails = a.details.map(d => d.id === detailId ? { ...d, ...updates } : d);
                    return { ...a, details: newDetails };
                }
                return a;
            })
        }));
        setHasChanges(true);
    };

    // Warn on unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        const handleInternalNavigation = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest('a');
            if (anchor && hasChanges) {
                const href = anchor.getAttribute('href');
                if (href && (href.startsWith('/') || href.startsWith(window.location.origin))) {
                    e.preventDefault();
                    e.stopPropagation();
                    setNavTarget(href);
                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('click', handleInternalNavigation, true); // Use capture phase to intercept early

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('click', handleInternalNavigation, true);
        };
    }, [hasChanges]);



    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

    return (
        <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: '800' }}>자산 배분 및 리밸런싱</h1>
                    <p style={{ color: 'var(--muted)' }}>전체 자산군별 비중을 관리하고 리밸런싱 전략을 확인하세요</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => setIsPrivate(!isPrivate)} className="glass" style={{ width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isPrivate ? 'var(--primary)' : 'white' }} title={isPrivate ? "금액 표시" : "금액 숨기기"}>
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

            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem' }}>현재 자산 비중</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={assets.allocations
                                        .filter(a => getCurrentValue(a) > 0)
                                        .map(a => ({ name: CATEGORY_MAP[a.category], value: getCurrentValue(a), color: CATEGORY_COLORS[a.category] }))}
                                    cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={0} dataKey="value" stroke="white" strokeWidth={2}
                                >
                                    {assets.allocations.filter(a => getCurrentValue(a) > 0).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }: any) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            const currentTotal = assets.allocations.reduce((sum, a) => sum + getCurrentValue(a), 0);
                                            const percent = currentTotal > 0 ? (data.value / currentTotal) * 100 : 0;
                                            return (
                                                <div className="glass" style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)', textAlign: 'left' }}>
                                                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{data.name}</div>
                                                    <div style={{ color: 'var(--primary)', fontWeight: 'bold', filter: isPrivate ? 'blur(6px)' : 'none', userSelect: isPrivate ? 'none' : 'auto', pointerEvents: isPrivate ? 'none' : 'auto' }}>{formatKRW(data.value)}</div>
                                                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{percent.toFixed(1)}%</div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    wrapperStyle={{ paddingTop: '20px', fontSize: '0.8rem' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem' }}>목표 자산 비중</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={assets.allocations
                                        .filter(a => a.targetWeight > 0)
                                        .map(a => ({ name: CATEGORY_MAP[a.category], value: a.targetWeight, color: CATEGORY_COLORS[a.category] }))}
                                    cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={0} dataKey="value" stroke="white" strokeWidth={2}
                                >
                                    {assets.allocations.filter(a => a.targetWeight > 0).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }: any) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            const targetWeight = data.value;
                                            const targetVal = (totalValue * targetWeight) / 100;
                                            return (
                                                <div className="glass" style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)', textAlign: 'left' }}>
                                                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{data.name} (목표)</div>
                                                    <div style={{ color: 'var(--primary)', fontWeight: 'bold', filter: isPrivate ? 'blur(6px)' : 'none', userSelect: isPrivate ? 'none' : 'auto', pointerEvents: isPrivate ? 'none' : 'auto' }}>{formatKRW(targetVal)}</div>
                                                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{targetWeight.toFixed(1)}%</div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    wrapperStyle={{ paddingTop: '20px', fontSize: '0.8rem' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </section>

            <section className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>자산배분 상세 현황</h2>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>총 자산 평가액</div>
                        <div style={{ fontSize: '2rem', fontWeight: '800', filter: isPrivate ? 'blur(10px)' : 'none', userSelect: isPrivate ? 'none' : 'auto', pointerEvents: isPrivate ? 'none' : 'auto' }}>{formatKRW(totalValue)}</div>
                    </div>
                </div>



                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: '0.875rem' }}>
                            <th style={{ padding: '1rem 0', width: '180px' }}>자산군</th>
                            <th style={{ textAlign: 'right', width: '200px' }}>평가액 (KRW)</th>
                            <th style={{ textAlign: 'right', width: '100px' }}>현재 비중</th>
                            <th style={{ textAlign: 'right', width: '150px' }}>목표 비중 (%)</th>
                            <th style={{ textAlign: 'right', paddingRight: '1.5rem', width: '150px' }}>차이 (목표대비)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.allocations
                            .filter(a => getCurrentValue(a) > 0 || a.targetWeight > 0)
                            .sort((a, b) => FIXED_CATEGORIES.indexOf(a.category) - FIXED_CATEGORIES.indexOf(b.category))
                            .map((a) => {
                                const currentVal = getCurrentValue(a);
                                const currentWeight = totalValue > 0 ? (currentVal / totalValue) * 100 : 0;
                                const color = CATEGORY_COLORS[a.category] || 'var(--primary)';

                                return (
                                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1.25rem 0' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: color }}></div>
                                                <span style={{ fontWeight: '600' }}>{CATEGORY_MAP[a.category] || a.category}</span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right', filter: isPrivate ? 'blur(8px)' : 'none', userSelect: isPrivate ? 'none' : 'auto', pointerEvents: isPrivate ? 'none' : 'auto' }}>{formatKRW(currentVal)}</td>
                                        <td style={{ textAlign: 'right' }}>{currentWeight.toFixed(1)}%</td>
                                        <td style={{ textAlign: 'right', padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                <input
                                                    type="number" step="5" value={Math.round(a.targetWeight)}
                                                    onChange={(e) => handleWeightChange(a.category, Number(e.target.value))}
                                                    className="glass"
                                                    style={{ width: '75px', padding: '0.4rem', textAlign: 'right', background: 'transparent', color: 'white', border: '1px solid var(--border)' }}
                                                />
                                                <span style={{ fontSize: '0.8rem' }}>%</span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                                            <div style={{ color: currentWeight > a.targetWeight ? '#ef4444' : '#3b82f6', fontSize: '0.9rem' }}>
                                                {(currentWeight - a.targetWeight).toFixed(1)}%
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        {/* Add category row */}
                        <tr>
                            <td colSpan={5} style={{ padding: '1rem 0', position: 'relative' }}>
                                <button
                                    onClick={() => setShowAddMenu(!showAddMenu)}
                                    className="glass hover-bright"
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', border: '1px dashed var(--primary)' }}
                                >
                                    <Plus size={16} /> 자산군 추가
                                </button>
                                {showAddMenu && (
                                    <div className="glass" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, padding: '0.5rem', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        {FIXED_CATEGORIES.filter(cat => !assets.allocations.some(a => a.category === cat && (getCurrentValue(a) > 0 || a.targetWeight > 0))).map(cat => (
                                            <button
                                                key={cat} onClick={() => addCategory(cat)} className="hover-bright"
                                                style={{ textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '4px' }}
                                            >
                                                {CATEGORY_MAP[cat]}
                                            </button>
                                        ))}
                                        {FIXED_CATEGORIES.filter(cat => !assets.allocations.some(a => a.category === cat && (getCurrentValue(a) > 0 || a.targetWeight > 0))).length === 0 && (
                                            <div style={{ padding: '0.5rem', color: 'var(--muted)', fontSize: '0.8rem' }}>모든 카테고리가 표시 중입니다.</div>
                                        )}
                                    </div>
                                )}
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr style={{ fontWeight: '800', fontSize: '1.1rem' }}>
                            <td style={{ padding: '1.5rem 0' }}>합계</td>
                            <td style={{ textAlign: 'right', filter: isPrivate ? 'blur(10px)' : 'none', userSelect: isPrivate ? 'none' : 'auto', pointerEvents: isPrivate ? 'none' : 'auto' }}>{formatKRW(totalValue)}</td>
                            <td style={{ textAlign: 'right' }}>100.0%</td>
                            <td style={{ textAlign: 'right', color: Math.round(totalTargetWeight) === 100 ? '#10b981' : '#ef4444' }}>
                                {Math.round(totalTargetWeight)}%
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
                {Math.round(totalTargetWeight) !== 100 && (
                    <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '0.9rem' }}>
                        <AlertCircle size={16} /> 목표 비중의 합이 100%가 되어야 합니다.
                    </div>
                )}
            </section>

            <section className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <Calculator size={24} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>자산 관리</h2>
                </div>
                <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>보유 중인 현금 및 예적금을 항목별로 나누어 관리할 수 있습니다.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                    {assets.allocations
                        .filter(a => a.category === 'Cash' || a.category === 'Savings')
                        .map(a => (
                            <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: CATEGORY_COLORS[a.category] }}></div>
                                        {CATEGORY_MAP[a.category]}
                                    </div>
                                    <button onClick={() => addDetail(a.category)} className="glass" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--primary)' }}>+ 항목 추가</button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {(a.details || []).map(d => (
                                        <div key={d.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input
                                                placeholder="항목 명칭" value={d.name}
                                                onChange={(e) => updateDetail(a.category, d.id, { name: e.target.value })}
                                                className="glass"
                                                style={{ flex: 2, padding: '0.4rem', fontSize: '0.85rem', background: 'transparent', color: 'white', border: '1px solid var(--border)' }}
                                            />
                                            <input
                                                type="number" placeholder="금액" value={d.value}
                                                onChange={(e) => updateDetail(a.category, d.id, { value: Number(e.target.value) })}
                                                className="glass"
                                                style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem', textAlign: 'right', background: 'transparent', color: 'white', border: '1px solid var(--border)', filter: isPrivate ? 'blur(6px)' : 'none', userSelect: isPrivate ? 'none' : 'auto', pointerEvents: isPrivate ? 'none' : 'auto' }}
                                            />
                                            <select
                                                value={d.currency || a.currency}
                                                onChange={(e) => updateDetail(a.category, d.id, { currency: e.target.value as 'KRW' | 'USD' })}
                                                className="glass"
                                                style={{ padding: '0.4rem', fontSize: '0.75rem', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--border)', cursor: 'pointer' }}
                                            >
                                                <option value="KRW" style={{ background: '#1c1c1e' }}>KRW</option>
                                                <option value="USD" style={{ background: '#1c1c1e' }}>USD</option>
                                            </select>
                                            <button onClick={() => deleteDetail(a.category, d.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}>×</button>
                                        </div>
                                    ))}
                                    {(a.details || []).length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)', fontSize: '0.8rem', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                                            추가된 항목이 없습니다.
                                        </div>
                                    )}
                                </div>
                                <div style={{ marginTop: '1rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                    <span style={{ color: 'var(--muted)', marginRight: '0.5rem' }}>소계:</span>
                                    <span className="gradient-text" style={{ fontSize: '1.2rem', filter: isPrivate ? 'blur(8px)' : 'none', userSelect: isPrivate ? 'none' : 'auto', pointerEvents: isPrivate ? 'none' : 'auto' }}>{formatKRW(getCurrentValue(a))}</span>
                                </div>
                            </div>
                        ))}
                </div>
            </section>

            {/* Unsaved Changes Dialog */}
            {navTarget && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="glass" style={{
                        padding: '2.5rem', maxWidth: '450px', width: '90%',
                        textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <div style={{
                            width: '60px', height: '60px', borderRadius: '50%',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem', color: 'var(--primary)'
                        }}>
                            <Save size={30} />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem' }}>변경사항 저장</h2>
                        <p style={{ color: 'var(--muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
                            저장되지 않은 변경사항이 있습니다.<br />
                            지금 저장하시겠습니까?
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button
                                onClick={async () => {
                                    await saveChanges();
                                    window.location.href = navTarget;
                                }}
                                className="glass"
                                style={{
                                    padding: '1rem', background: 'var(--primary)', color: 'white',
                                    border: 'none', cursor: 'pointer', fontWeight: '700', borderRadius: '12px'
                                }}
                            >
                                저장하고 이동
                            </button>
                            <button
                                onClick={() => {
                                    setHasChanges(false);
                                    window.location.href = navTarget;
                                }}
                                style={{
                                    padding: '1rem', background: 'transparent',
                                    border: '1px solid var(--border)', cursor: 'pointer', color: 'white',
                                    borderRadius: '12px'
                                }}
                            >
                                저장하지 않고 이동
                            </button>
                            <button
                                onClick={() => setNavTarget(null)}
                                style={{
                                    padding: '1rem', background: 'none', border: 'none',
                                    color: 'var(--muted)', cursor: 'pointer', fontSize: '0.9rem'
                                }}
                            >
                                취소하고 머무르기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
