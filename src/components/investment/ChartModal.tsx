import React, { useMemo } from 'react';
import { X, PieChart } from 'lucide-react';
import { Investment } from '@/lib/types';

interface ChartModalProps {
    investments: Investment[];
    onClose: () => void;
}

export const ChartModal: React.FC<ChartModalProps> = ({ investments, onClose }) => {
    // 1. Calculate sector weights based on the FIRST tag
    const sectorData = useMemo(() => {
        let totalVal = 0;
        const sums: Record<string, number> = {};

        investments.forEach(inv => {
            if (inv.shares <= 0 || inv.avgPrice <= 0) return;
            const sector = (inv.tags && inv.tags.length > 0) ? inv.tags[0] : '기타';
            const value = inv.shares * inv.avgPrice;
            totalVal += value;
            sums[sector] = (sums[sector] || 0) + value;
        });

        if (totalVal === 0) return [];

        // Sort by value descending
        return Object.entries(sums)
            .map(([name, value]) => ({
                name,
                value,
                weight: (value / totalVal) * 100
            }))
            .sort((a, b) => b.value - a.value);
    }, [investments]);

    // Simple colors for the chart
    const COLORS = [
        '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#0ea5e9', '#14b8a6', '#f97316', '#64748b'
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
            <div className="card-hover" style={{ width: '500px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', border: '1px solid var(--border)', backgroundColor: 'var(--background)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <PieChart size={24} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>섹터별 보유 비중</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                {sectorData.length === 0 ? (
                    <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--muted)' }}>
                        보유중인 자산이 없습니다.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Custom Pure CSS Horizontal Bar Chart */}
                        <div style={{ display: 'flex', height: '24px', borderRadius: '12px', overflow: 'hidden', width: '100%' }}>
                            {sectorData.map((d, i) => (
                                <div 
                                    key={d.name} 
                                    style={{ 
                                        width: `${d.weight}%`, 
                                        backgroundColor: COLORS[i % COLORS.length],
                                        height: '100%',
                                        transition: 'width 0.3s ease'
                                    }} 
                                    title={`${d.name}: ${d.weight.toFixed(1)}%`}
                                />
                            ))}
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                            {sectorData.map((d, i) => (
                                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length] }} />
                                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                                        <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>{d.name}</span>
                                        <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{d.weight.toFixed(1)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
