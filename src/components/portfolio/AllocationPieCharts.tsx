'use client';

import React, { useRef, useState, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { AssetAllocation, CATEGORY_MAP, CATEGORY_COLORS } from '@/lib/types';
import { formatKRW } from '@/lib/utils';

interface AllocationPieChartsProps {
    allocations: AssetAllocation[];
    totalValue: number;
    getCurrentValue: (a: AssetAllocation) => number;
    isPrivate: boolean;
}

export const AllocationPieCharts: React.FC<AllocationPieChartsProps> = ({
    allocations,
    totalValue,
    getCurrentValue,
    isPrivate
}) => {
    const mouseRef = useRef({ x: 0, y: 0 });
    const tooltipElRef = useRef<HTMLDivElement>(null);
    const [tooltipData, setTooltipData] = useState<{ name: string; value: number; mode: 'current' | 'target' } | null>(null);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        mouseRef.current = { x: e.clientX, y: e.clientY };
        if (tooltipElRef.current) {
            tooltipElRef.current.style.left = `${e.clientX + 16}px`;
            tooltipElRef.current.style.top = `${e.clientY - 16}px`;
        }
    }, []);

    const handlePieEnter = useCallback((mode: 'current' | 'target') => (_: any, index: number) => {
        const data = mode === 'current' ? currentDataRef.current[index] : targetDataRef.current[index];
        if (data) setTooltipData({ name: data.name, value: data.value, mode });
    }, []);

    const handlePieLeave = useCallback(() => {
        setTooltipData(null);
    }, []);

    const currentData = allocations
        .filter(a => getCurrentValue(a) > 0)
        .map(a => ({
            name: CATEGORY_MAP[a.category as keyof typeof CATEGORY_MAP] || a.category,
            value: getCurrentValue(a),
            color: CATEGORY_COLORS[a.category]
        }));

    const targetData = allocations
        .filter(a => a.targetWeight > 0)
        .map(a => ({
            name: CATEGORY_MAP[a.category as keyof typeof CATEGORY_MAP] || a.category,
            value: a.targetWeight,
            color: CATEGORY_COLORS[a.category]
        }));

    // Keep refs to avoid stale closures in callbacks
    const currentDataRef = useRef(currentData);
    currentDataRef.current = currentData;
    const targetDataRef = useRef(targetData);
    targetDataRef.current = targetData;

    // Tooltip render
    const renderTooltipContent = () => {
        if (!tooltipData) return null;
        if (tooltipData.mode === 'current') {
            const currentTotal = allocations.reduce((s, a) => s + getCurrentValue(a), 0);
            const pct = currentTotal > 0 ? (tooltipData.value / currentTotal) * 100 : 0;
            return (
                <>
                    <div style={{ fontWeight: '700', marginBottom: '0.3rem', fontSize: '0.9rem' }}>{tooltipData.name}</div>
                    <div className={isPrivate ? 'private-blur' : ''} style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '1rem' }}>{formatKRW(tooltipData.value)}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem' }}>{pct.toFixed(1)}%</div>
                </>
            );
        }
        const targetVal = (totalValue * tooltipData.value) / 100;
        return (
            <>
                <div style={{ fontWeight: '700', marginBottom: '0.3rem', fontSize: '0.9rem' }}>{tooltipData.name} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>(목표)</span></div>
                <div className={isPrivate ? 'private-blur' : ''} style={{ color: 'var(--accent)', fontWeight: '700', fontSize: '1rem' }}>{formatKRW(targetVal)}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem' }}>{tooltipData.value.toFixed(1)}%</div>
            </>
        );
    };

    return (
        <section
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem', position: 'relative' }}
            onMouseMove={handleMouseMove}
        >
            {/* Custom Floating Tooltip */}
            <div
                ref={tooltipElRef}
                style={{
                    position: 'fixed',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    padding: tooltipData ? '0.6rem 1rem' : '0',
                    border: tooltipData ? '1px solid var(--border)' : 'none',
                    backgroundColor: tooltipData ? 'var(--card)' : 'transparent',
                    borderRadius: '8px',
                    boxShadow: tooltipData ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
                    opacity: tooltipData ? 1 : 0,
                    transition: 'opacity 0.1s',
                    minWidth: tooltipData ? '120px' : '0',
                    textAlign: 'left',
                }}
            >
                {renderTooltipContent()}
            </div>

            {/* 현재 자산 비중 */}
            <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem' }}>현재 자산 비중</h3>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={currentData}
                                cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                                paddingAngle={0} dataKey="value" stroke="white" strokeWidth={2}
                                isAnimationActive={true}
                                animationDuration={800}
                                onMouseEnter={handlePieEnter('current')}
                                onMouseLeave={handlePieLeave}
                            >
                                {currentData.map((entry, i) => (
                                    <Cell key={`cell-${i}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px', fontSize: '0.8rem' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 목표 자산 비중 */}
            <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem' }}>목표 자산 비중</h3>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={targetData}
                                cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                                paddingAngle={0} dataKey="value" stroke="white" strokeWidth={2}
                                isAnimationActive={true}
                                animationDuration={800}
                                onMouseEnter={handlePieEnter('target')}
                                onMouseLeave={handlePieLeave}
                            >
                                {targetData.map((entry, i) => (
                                    <Cell key={`cell-${i}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px', fontSize: '0.8rem' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </section>
    );
};
