'use client';

import React, { useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AssetAllocation, CATEGORY_MAP, CATEGORY_COLORS } from '@/lib/types';
import { formatKRW } from '@/lib/utils';

interface AllocationPieChartsProps {
    allocations: AssetAllocation[];
    totalValue: number;
    getCurrentValue: (a: AssetAllocation) => number;
    isPrivate: boolean;
}

const CustomTooltip = ({ active, payload, isPrivate, mode, totalValue, getCurrentValue, allocations }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    if (mode === 'current') {
        const currentTotal = allocations.reduce((s: number, a: AssetAllocation) => s + getCurrentValue(a), 0);
        const pct = currentTotal > 0 ? (data.value / currentTotal) * 100 : 0;
        return (
            <div style={{ padding: '0.6rem 1rem', border: '1px solid var(--border)', textAlign: 'left', minWidth: '120px', backgroundColor: 'var(--card)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                <div style={{ fontWeight: '700', marginBottom: '0.3rem', fontSize: '0.9rem' }}>{data.name}</div>
                <div className={isPrivate ? 'private-blur' : ''} style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '1rem' }}>{formatKRW(data.value)}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem' }}>{pct.toFixed(1)}%</div>
            </div>
        );
    }

    const targetWeight = data.value;
    const targetVal = (totalValue * targetWeight) / 100;
    return (
        <div style={{ padding: '0.6rem 1rem', border: '1px solid var(--border)', textAlign: 'left', minWidth: '120px', backgroundColor: 'var(--card)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
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
    const mouseRef = useRef({ x: 0, y: 0 });
    const tooltipRef1 = useRef<HTMLDivElement>(null);
    const tooltipRef2 = useRef<HTMLDivElement>(null);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        mouseRef.current = { x: e.clientX, y: e.clientY };
        // Directly update tooltip wrapper positions via DOM (no re-render)
        if (tooltipRef1.current) {
            const wrapper = tooltipRef1.current.querySelector('.recharts-tooltip-wrapper') as HTMLElement;
            if (wrapper) {
                wrapper.style.transform = `translate(${e.clientX + 16}px, ${e.clientY - 16}px)`;
                wrapper.style.position = 'fixed';
                wrapper.style.top = '0';
                wrapper.style.left = '0';
                wrapper.style.pointerEvents = 'none';
            }
        }
        if (tooltipRef2.current) {
            const wrapper = tooltipRef2.current.querySelector('.recharts-tooltip-wrapper') as HTMLElement;
            if (wrapper) {
                wrapper.style.transform = `translate(${e.clientX + 16}px, ${e.clientY - 16}px)`;
                wrapper.style.position = 'fixed';
                wrapper.style.top = '0';
                wrapper.style.left = '0';
                wrapper.style.pointerEvents = 'none';
            }
        }
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

    return (
        <section
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}
            onMouseMove={handleMouseMove}
        >
            {/* 현재 자산 비중 */}
            <div className="glass" style={{ padding: '2rem', textAlign: 'center' }} ref={tooltipRef1}>
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
                            >
                                {currentData.map((entry, i) => (
                                    <Cell key={`cell-${i}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                content={(props: any) => (
                                    <CustomTooltip {...props} isPrivate={isPrivate} mode="current" allocations={allocations} getCurrentValue={getCurrentValue} />
                                )}
                                isAnimationActive={false}
                            />
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px', fontSize: '0.8rem' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 목표 자산 비중 */}
            <div className="glass" style={{ padding: '2rem', textAlign: 'center' }} ref={tooltipRef2}>
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
                            >
                                {targetData.map((entry, i) => (
                                    <Cell key={`cell-${i}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                content={(props: any) => (
                                    <CustomTooltip {...props} isPrivate={isPrivate} mode="target" totalValue={totalValue} />
                                )}
                                isAnimationActive={false}
                            />
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px', fontSize: '0.8rem' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </section>
    );
};
