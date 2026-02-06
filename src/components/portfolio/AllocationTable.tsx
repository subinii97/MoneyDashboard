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

export const AllocationTable: React.FC<AllocationTableProps> = ({
    allocations,
    totalValue,
    totalTargetWeight,
    isPrivate,
    showAddMenu,
    fixedCategories,
    getCurrentValue,
    onWeightChange,
    onAddCategory,
    onToggleAddMenu
}) => {
    return (
        <section className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>자산배분 상세 현황</h2>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>총 자산 평가액</div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', filter: isPrivate ? 'blur(10px)' : 'none' }}>{formatKRW(totalValue)}</div>
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
                    {allocations
                        .filter(a => getCurrentValue(a) > 0 || a.targetWeight > 0)
                        .sort((a, b) => fixedCategories.indexOf(a.category) - fixedCategories.indexOf(b.category))
                        .map((a) => {
                            const currentVal = getCurrentValue(a);
                            const currentWeight = totalValue > 0 ? (currentVal / totalValue) * 100 : 0;
                            const color = CATEGORY_COLORS[a.category as keyof typeof CATEGORY_COLORS] || 'var(--primary)';

                            return (
                                <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1.25rem 0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: color }}></div>
                                            <span style={{ fontWeight: '600' }}>{CATEGORY_MAP[a.category as keyof typeof CATEGORY_MAP] || a.category}</span>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right', filter: isPrivate ? 'blur(8px)' : 'none' }}>{formatKRW(currentVal)}</td>
                                    <td style={{ textAlign: 'right' }}>{currentWeight.toFixed(1)}%</td>
                                    <td style={{ textAlign: 'right', padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
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
                                        <div style={{ color: currentWeight > a.targetWeight ? '#ef4444' : '#3b82f6', fontSize: '0.9rem' }}>
                                            {(currentWeight - a.targetWeight).toFixed(1)}%
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    <tr>
                        <td colSpan={5} style={{ padding: '1rem 0', position: 'relative' }}>
                            <button
                                onClick={onToggleAddMenu}
                                className="glass hover-bright"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', border: '1px dashed var(--primary)' }}
                            >
                                <Plus size={16} /> 자산군 추가
                            </button>
                            {showAddMenu && (
                                <div className="glass" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, padding: '0.5rem', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {fixedCategories.filter(cat => !allocations.some(a => a.category === cat && (getCurrentValue(a) > 0 || a.targetWeight > 0))).map(cat => (
                                        <button
                                            key={cat} onClick={() => onAddCategory(cat)} className="hover-bright"
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
                        <td style={{ textAlign: 'right', filter: isPrivate ? 'blur(10px)' : 'none' }}>{formatKRW(totalValue)}</td>
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
    );
};
