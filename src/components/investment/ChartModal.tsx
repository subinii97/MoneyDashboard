import React, { useMemo, useState } from 'react';
import { X, PieChart, Filter } from 'lucide-react';
import { Investment, MarketType } from '@/lib/types';

interface ChartModalProps {
    investments: Investment[];
    onClose: () => void;
}

export const ChartModal: React.FC<ChartModalProps> = ({ investments, onClose }) => {
    // Determine the view scope: 'All', 'Domestic', 'Overseas'
    const [viewMode, setViewMode] = useState<'All' | MarketType>('All');
    
    // 1. Filter investments based on viewScope and calculate sector weights based on the FIRST tag
    const sectorData = useMemo(() => {
        let totalVal = 0;
        const sums: Record<string, { value: number, components: { name: string, weight: number }[] }> = {};

        const filtered = viewMode === 'All' ? investments : investments.filter(inv => inv.marketType === viewMode);

        filtered.forEach(inv => {
            if (inv.shares <= 0 || inv.avgPrice <= 0) return;
            const sector = (inv.tags && inv.tags.length > 0) ? inv.tags[0] : '기타';
            const value = inv.shares * inv.avgPrice;
            totalVal += value;
            
            if (!sums[sector]) {
                sums[sector] = { value: 0, components: [] };
            }
            sums[sector].value += value;
            sums[sector].components.push({ name: inv.name || inv.symbol, weight: value });
        });

        if (totalVal === 0) return [];

        // Sort by value descending and calculate percentages
        return Object.entries(sums)
            .map(([name, data]) => {
                // sort components inside the sector
                const sortedComponents = data.components
                    .map(c => ({ ...c, percentage: (c.weight / data.value) * 100 }))
                    .sort((a, b) => b.weight - a.weight);
                    
                return {
                    name,
                    value: data.value,
                    weight: (data.value / totalVal) * 100,
                    components: sortedComponents
                };
            })
            .sort((a, b) => b.value - a.value);
    }, [investments, viewMode]);

    // Simple colors for the chart
    const COLORS = [
        '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#0ea5e9', '#14b8a6', '#f97316', '#64748b'
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
            <div className="card-hover" style={{ width: '550px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', border: '1px solid var(--border)', backgroundColor: 'var(--background)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <PieChart size={24} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>섹터별 보유 비중</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}><X size={24} /></button>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--card)', padding: '0.35rem', borderRadius: '12px', border: '1px solid var(--border)', width: 'fit-content' }}>
                    <button 
                        onClick={() => setViewMode('All')} 
                        style={{ padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 600, fontSize: '0.9rem', background: viewMode === 'All' ? 'var(--primary)' : 'transparent', color: viewMode === 'All' ? '#fff' : 'var(--muted)', transition: 'all 0.2s' }}
                    >
                        전체
                    </button>
                    <button 
                        onClick={() => setViewMode('Domestic')} 
                        style={{ padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 600, fontSize: '0.9rem', background: viewMode === 'Domestic' ? 'var(--primary)' : 'transparent', color: viewMode === 'Domestic' ? '#fff' : 'var(--muted)', transition: 'all 0.2s' }}
                    >
                        국내
                    </button>
                    <button 
                        onClick={() => setViewMode('Overseas')} 
                        style={{ padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 600, fontSize: '0.9rem', background: viewMode === 'Overseas' ? 'var(--primary)' : 'transparent', color: viewMode === 'Overseas' ? '#fff' : 'var(--muted)', transition: 'all 0.2s' }}
                    >
                        해외
                    </button>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {sectorData.map((d, i) => (
                                <div key={d.name} className="sector-legend-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--border)', position: 'relative' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length], flexShrink: 0 }} />
                                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{d.name}</span>
                                            <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{d.weight.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    
                                    <div className="sector-components" style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
                                        {d.components.map(c => (
                                            <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }} title={c.name}>{c.name}</span>
                                                <span>{c.percentage.toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                .sector-legend-item .sector-components {
                    max-height: 0;
                    opacity: 0;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }
                .sector-legend-item:hover .sector-components {
                    max-height: 200px;
                    opacity: 1;
                    padding-top: 0.25rem;
                    border-top: 1px dashed var(--border);
                }
            `}</style>
        </div>
    );
};
