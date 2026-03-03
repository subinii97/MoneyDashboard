import React, { useMemo, useState } from 'react';
import { X, PieChart } from 'lucide-react';
import { Investment, MarketType } from '@/lib/types';

interface ChartModalProps {
    investments: Investment[];
    rate: number;
    onClose: () => void;
}

interface SectorData {
    name: string;
    value: number;
    weight: number;
    components: { name: string; weight: number; percentage: number }[];
}

export const ChartModal: React.FC<ChartModalProps> = ({ investments, rate, onClose }) => {

    // Calculates sector data for a specific filter
    const getSectorData = (mode: 'All' | MarketType): SectorData[] => {
        let totalVal = 0;
        const sums: Record<string, { value: number, components: { name: string, weight: number }[] }> = {};

        const filtered = mode === 'All' ? investments : investments.filter(inv => inv.marketType === mode);

        filtered.forEach(inv => {
            if (inv.shares <= 0 || inv.avgPrice <= 0) return;
            const sector = (inv.tags && inv.tags.length > 0) ? inv.tags[0] : '기타';
            const value = inv.marketType === 'Overseas' ? inv.shares * inv.avgPrice * rate : inv.shares * inv.avgPrice;
            totalVal += value;

            if (!sums[sector]) {
                sums[sector] = { value: 0, components: [] };
            }
            sums[sector].value += value;
            sums[sector].components.push({ name: inv.name || inv.symbol, weight: value });
        });

        if (totalVal === 0) return [];

        return Object.entries(sums)
            .map(([name, data]) => {
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
    };

    const allData = useMemo(() => getSectorData('All'), [investments, rate]);
    const domesticData = useMemo(() => getSectorData('Domestic'), [investments, rate]);
    const overseasData = useMemo(() => getSectorData('Overseas'), [investments, rate]);

    const COLORS = [
        '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#0ea5e9', '#14b8a6', '#f97316', '#64748b'
    ];

    // Tooltip state
    const [tooltip, setTooltip] = useState<{ x: number, y: number, data: SectorData } | null>(null);

    const handleMouseMove = (e: React.MouseEvent, data: SectorData) => {
        setTooltip({
            x: e.clientX,
            y: e.clientY,
            data
        });
    };

    const handleMouseLeave = () => {
        setTooltip(null);
    };

    const renderChartSection = (title: string, data: SectorData[]) => {
        if (data.length === 0) return null;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>{title}</h4>
                <div style={{ display: 'flex', height: '28px', borderRadius: '14px', overflow: 'hidden', width: '100%', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    {data.map((d, i) => (
                        <div
                            key={d.name}
                            style={{
                                width: `${d.weight}%`,
                                backgroundColor: COLORS[i % COLORS.length],
                                height: '100%',
                                transition: 'width 0.3s ease',
                                cursor: 'pointer'
                            }}
                            // Remove browser default title tooltip since we use custom hover
                            onMouseMove={(e) => handleMouseMove(e, d)}
                            onMouseLeave={handleMouseLeave}
                        />
                    ))}
                </div>
                {/* Minimal Legend below the bar (excluding the full breakdown) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.25rem' }}>
                    {data.map((d, i) => (
                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length] }} />
                            <span style={{ color: 'var(--muted)' }}>{d.name} <strong style={{ color: 'var(--foreground)' }}>{d.weight.toFixed(1)}%</strong></span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
            <div className="card-hover" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', border: '1px solid var(--border)', backgroundColor: 'var(--background)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <PieChart size={24} style={{ color: 'var(--primary)' }} />
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>섹터별 보유 비중</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                {allData.length === 0 ? (
                    <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--muted)' }}>
                        보유중인 자산이 없습니다.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        {renderChartSection('전체 시장 (Total)', allData)}
                        {renderChartSection('국내 주식 (Domestic)', domesticData)}
                        {renderChartSection('해외 주식 (Overseas)', overseasData)}
                    </div>
                )}
            </div>

            {/* Custom Interactive Tooltip */}
            {tooltip && (
                <div
                    style={{
                        position: 'fixed',
                        left: tooltip.x + 15,
                        top: tooltip.y + 15,
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        padding: '1rem',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        pointerEvents: 'none',
                        zIndex: 1300,
                        minWidth: '200px'
                    }}
                >
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.25rem', color: 'var(--foreground)' }}>
                        {tooltip.data.name}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                        비중: {tooltip.data.weight.toFixed(1)}%
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                        {tooltip.data.components.map(c => (
                            <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                                    {c.name}
                                </span>
                                <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                                    {c.percentage.toFixed(1)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
