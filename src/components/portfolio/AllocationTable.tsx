'use client';

import React from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { AssetAllocation, CATEGORY_MAP, CATEGORY_COLORS } from '@/lib/types';
import { formatKRW } from '@/lib/utils';

interface AllocationTableProps {
    allocations: AssetAllocation[];
    totalValue: number;
    totalTargetWeight: number;
    isPrivate: boolean;
    showAddMenu: boolean;
    fixedCategories: string[];
    getCurrentValue: (a: AssetAllocation) => number;
    onWeightChange: (category: any, value: number) => void;
    onAddCategory: (category: any) => void;
    onToggleAddMenu: () => void;
}

const getDiffColor = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal <= 2) return '#10b981';
    if (absVal >= 5) return val > 0 ? '#ef4444' : '#3b82f6';

    const ratio = (absVal - 2) / 3;
    const start = { r: 16, g: 185, b: 129 };
    const end = val > 0 ? { r: 239, g: 68, b: 68 } : { r: 59, g: 130, b: 246 };
    const r = Math.round(start.r + (end.r - start.r) * ratio);
    const g = Math.round(start.g + (end.g - start.g) * ratio);
    const b = Math.round(start.b + (end.b - start.b) * ratio);

    return `rgb(${r}, ${g}, ${b})`;
};

export const AllocationTable: React.FC<AllocationTableProps> = ({
    allocations, totalValue, totalTargetWeight, isPrivate, showAddMenu, fixedCategories,
    getCurrentValue, onWeightChange, onAddCategory, onToggleAddMenu
}) => {
    return (
        <section className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>자산배분 상세 현황</h2>
                <div style={{ textAlign: 'right' }}>
                    <div className="section-label" style={{ marginBottom: '0.2rem' }}>Total Portfolio</div>
                    <div className={isPrivate ? 'private-blur' : ''} style={{ fontSize: '2rem', fontWeight: '800' }}>
                        {isPrivate ? '••••••' : formatKRW(totalValue)}
                    </div>
                </div>
            </div>

            <table className="dashboard-table">
                <thead>
                    <tr>
                        <th style={{ width: '180px' }}>자산군</th>
                        <th style={{ textAlign: 'right', width: '200px' }}>평가액 (KRW)</th>
                        <th style={{ textAlign: 'right', width: '100px' }}>현재 비중</th>
                        <th style={{ textAlign: 'right', width: '150px' }}>목표 비중 (%)</th>
                        <th style={{ textAlign: 'right', paddingRight: '1.5rem', width: '150px' }}>차이</th>
                    </tr>
                </thead>
                <tbody>
                    {allocations
                        .filter(a => getCurrentValue(a) > 0 || a.targetWeight > 0)
                        .sort((a, b) => fixedCategories.indexOf(a.category) - fixedCategories.indexOf(b.category))
                        .map((a) => {
                            const currentVal = getCurrentValue(a);
                            const currentWeight = totalValue > 0 ? (currentVal / totalValue) * 100 : 0;
                            const color = CATEGORY_COLORS[a.category as keyof typeof CATEGORY_COLORS] || 'var(--primary)';
                            const diff = currentWeight - a.targetWeight;

                            return (
                                <tr key={a.id}>
                                    <td style={{ padding: '1.25rem 0' }}>
                                        <div className="flex-center" style={{ gap: '0.75rem', justifyContent: 'flex-start' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: color }}></div>
                                            <span style={{ fontWeight: '600' }}>{CATEGORY_MAP[a.category as keyof typeof CATEGORY_MAP] || a.category}</span>
                                        </div>
                                    </td>
                                    <td className={isPrivate ? 'private-blur' : ''} style={{ textAlign: 'right' }}>{formatKRW(currentVal)}</td>
                                    <td style={{ textAlign: 'right' }}>{currentWeight.toFixed(1)}%</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div className="flex-center" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
                                            <input
                                                type="number" step="5" value={Math.round(a.targetWeight)}
                                                onChange={(e) => onWeightChange(a.category, Number(e.target.value))}
                                                className="glass"
                                                style={{ width: '75px', padding: '0.4rem', textAlign: 'right', background: 'transparent', color: 'white', border: '1px solid var(--border)' }}
                                            />
                                            <span style={{ fontSize: '0.8rem' }}>%</span>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                                        <div style={{ color: getDiffColor(diff), fontSize: '0.9rem', fontWeight: '700' }}>
                                            {(diff > 0 ? '+' : '') + diff.toFixed(1)}%
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    <tr>
                        <td colSpan={5} style={{ padding: '1rem 0', position: 'relative' }}>
                            <button
                                onClick={onToggleAddMenu}
                                className="glass"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', color: 'var(--primary)', cursor: 'pointer', border: '1px dashed var(--primary)' }}
                            >
                                <Plus size={16} /> 자산군 추가
                            </button>
                            {showAddMenu && (
                                <div className="glass flex-col" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, padding: '0.5rem', minWidth: '200px', gap: '0.25rem' }}>
                                    {fixedCategories.filter(cat => !allocations.some(a => a.category === cat && (getCurrentValue(a) > 0 || a.targetWeight > 0))).map(cat => (
                                        <button
                                            key={cat} onClick={() => onAddCategory(cat)}
                                            style={{ textAlign: 'left', padding: '0.5rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '4px' }}
                                        >
                                            {CATEGORY_MAP[cat as keyof typeof CATEGORY_MAP]}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr style={{ fontWeight: '800', fontSize: '1.1rem' }}>
                        <td style={{ padding: '1.5rem 0' }}>합계</td>
                        <td className={isPrivate ? 'private-blur' : ''} style={{ textAlign: 'right' }}>{formatKRW(totalValue)}</td>
                        <td style={{ textAlign: 'right' }}>100.0%</td>
                        <td style={{ textAlign: 'right', color: Math.round(totalTargetWeight) === 100 ? '#10b981' : '#ef4444' }}>
                            {Math.round(totalTargetWeight)}%
                        </td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
            {Math.round(totalTargetWeight) !== 100 && (
                <div className="flex-center" style={{ marginTop: '1rem', justifyContent: 'flex-start', gap: '0.5rem', color: '#ef4444', fontSize: '0.9rem' }}>
                    <AlertCircle size={16} /> 목표 비중의 합이 100%가 되어야 합니다.
                </div>
            )}
        </section>
    );
};
