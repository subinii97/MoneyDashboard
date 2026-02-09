import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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
    return (
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div className="glass" style={{ padding: '2rem', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem' }}>현재 자산 비중</h3>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={allocations
                                    .filter(a => getCurrentValue(a) > 0)
                                    .map(a => ({ name: CATEGORY_MAP[a.category as keyof typeof CATEGORY_MAP] || a.category, value: getCurrentValue(a), color: CATEGORY_COLORS[a.category] }))}
                                cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={0} dataKey="value" stroke="white" strokeWidth={2}
                            >
                                {allocations.filter(a => getCurrentValue(a) > 0).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category]} />
                                ))}
                            </Pie>
                            <Tooltip
                                content={({ active, payload }: any) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        const currentTotal = allocations.reduce((sum, a) => sum + getCurrentValue(a), 0);
                                        const percent = currentTotal > 0 ? (data.value / currentTotal) * 100 : 0;
                                        return (
                                            <div className="glass" style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)', textAlign: 'left' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{data.name}</div>
                                                <div className={isPrivate ? 'private-blur' : ''} style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{formatKRW(data.value)}</div>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{percent.toFixed(1)}%</div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px', fontSize: '0.8rem' }} />
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
                                data={allocations
                                    .filter(a => a.targetWeight > 0)
                                    .map(a => ({ name: CATEGORY_MAP[a.category as keyof typeof CATEGORY_MAP] || a.category, value: a.targetWeight, color: CATEGORY_COLORS[a.category] }))}
                                cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={0} dataKey="value" stroke="white" strokeWidth={2}
                            >
                                {allocations.filter(a => a.targetWeight > 0).map((entry, index) => (
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
                                                <div className={isPrivate ? 'private-blur' : ''} style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{formatKRW(targetVal)}</div>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{targetWeight.toFixed(1)}%</div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px', fontSize: '0.8rem' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </section>
    );
};
