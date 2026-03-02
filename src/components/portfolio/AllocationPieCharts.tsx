'use client';

import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AssetAllocation, CATEGORY_MAP, CATEGORY_COLORS } from '@/lib/types';
import { formatKRW } from '@/lib/utils';

interface AllocationPieChartsProps {
    allocations: AssetAllocation[];
    totalValue: number;
    getCurrentValue: (a: AssetAllocation) => number;
    isPrivate: boolean;
}

// Custom tooltip that renders at mouse position via a fixed-position portal-style div
const MouseTooltip = ({
    active, payload, isPrivate, mode, totalValue, getCurrentValue, allocations
}: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    if (mode === 'current') {
        const currentTotal = allocations.reduce((s: number, a: AssetAllocation) => s + getCurrentValue(a), 0);
        const pct = currentTotal > 0 ? (data.value / currentTotal) * 100 : 0;
        return (
            <div className="glass" style={{ padding: '0.6rem 1rem', border: '1px solid var(--border)', textAlign: 'left', pointerEvents: 'none', minWidth: '120px' }}>
                <div style={{ fontWeight: '700', marginBottom: '0.3rem', fontSize: '0.9rem' }}>{data.name}</div>
                <div className={isPrivate ? 'private-blur' : ''} style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '1rem' }}>{formatKRW(data.value)}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem' }}>{pct.toFixed(1)}%</div>
            </div>
        );
    }

    // target mode
    const targetWeight = data.value;
    const targetVal = (totalValue * targetWeight) / 100;
    return (
        <div className="glass" style={{ padding: '0.6rem 1rem', border: '1px solid var(--border)', textAlign: 'left', pointerEvents: 'none', minWidth: '120px' }}>
            <div style={{ fontWeight: '700', marginBottom: '0.3rem', fontSize: '0.9rem' }}>{data.name} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>(목표)</span></div>
            <div className={isPrivate ? 'private-blur' : ''} style={{ color: 'var(--accent)', fontWeight: '700', fontSize: '1rem' }}>{formatKRW(targetVal)}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem' }}>{targetWeight.toFixed(1)}%</div>
        </div>
    );
};

export const AllocationPieCharts: React.FC<AllocationPieChartsProps> = ({
    allocations,
    totalValue,
    getCurrentValue,
    isPrivate
}) => {
    const [mouse, setMouse] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent) => {
        setMouse({ x: e.clientX, y: e.clientY });
    };

    const tooltipCommonProps = {
        position: { x: mouse.x + 14, y: mouse.y - 10 } as any,
        isAnimationActive: false,
        wrapperStyle: {
            // Recharts places the tooltip inside the chart svg wrapper;
            // we override with fixed positioning via CSS transforms
            position: 'fixed' as const,
            top: 0,
            left: 0,
            transform: `translate(${mouse.x + 14}px, ${mouse.y - 10}px)`,
            zIndex: 9999,
            pointerEvents: 'none' as const,
        },
    };

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

    return (
        <section
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}
            onMouseMove={handleMouseMove}
        >
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
                            >
                                {allocations.filter(a => getCurrentValue(a) > 0).map((entry, i) => (
                                    <Cell key={`cell-${i}`} fill={CATEGORY_COLORS[entry.category]} />
                                ))}
                            </Pie>
                            <Tooltip
                                {...tooltipCommonProps}
                                content={(props: any) => (
                                    <MouseTooltip {...props} isPrivate={isPrivate} mode="current" allocations={allocations} getCurrentValue={getCurrentValue} />
                                )}
                            />
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
                            >
                                {allocations.filter(a => a.targetWeight > 0).map((entry, i) => (
                                    <Cell key={`cell-${i}`} fill={CATEGORY_COLORS[entry.category]} />
                                ))}
                            </Pie>
                            <Tooltip
                                {...tooltipCommonProps}
                                content={(props: any) => (
                                    <MouseTooltip {...props} isPrivate={isPrivate} mode="target" totalValue={totalValue} />
                                )}
                            />
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px', fontSize: '0.8rem' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </section>
    );
};
