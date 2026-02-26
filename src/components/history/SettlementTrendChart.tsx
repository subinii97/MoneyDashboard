'use client';

import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatKRW } from '@/lib/utils';

interface SettlementTrendChartProps {
    dailyData: any[];
    weeklyData: any[];
    monthlyData: any[];
}

type ChartScope = '1w' | '2w' | '1m' | '3m' | '1y' | 'weekly';

const SettlementTrendChart: React.FC<SettlementTrendChartProps> = ({ dailyData, weeklyData, monthlyData }) => {
    const [scope, setScope] = useState<ChartScope>('1m');

    const categories = useMemo(() => [
        { key: 'osBond', name: '해외채권', color: '#7c2d12' },
        { key: 'osIndex', name: '해외지수', color: '#b91c1c' },
        { key: 'osStock', name: '해외주식', color: '#ef4444' },
        { key: 'domBond', name: '국내채권', color: '#1e3a8a' },
        { key: 'domIndex', name: '국내지수', color: '#1d4ed8' },
        { key: 'domStock', name: '국내주식', color: '#3b82f6' },
        { key: 'cash', name: '현금/예금', color: '#10b981' }
    ], []);

    const [activeCategories, setActiveCategories] = useState<string[]>(categories.map(c => c.key));

    const chartData = useMemo(() => {
        let raw: any[] = [];
        if (scope === 'weekly') {
            raw = [...weeklyData].reverse().map(w => ({
                date: w.period.split(' ~ ')[1],
                osBond: w.metrics.osBond.current,
                osIndex: w.metrics.osIndex.current,
                osStock: w.metrics.osStock.current,
                domBond: w.metrics.domBond.current,
                domIndex: w.metrics.domIndex.current,
                domStock: w.metrics.domStock.current,
                cash: w.metrics.cash.current,
            }));
        } else {
            let days = 30;
            if (scope === '1w') days = 7;
            else if (scope === '2w') days = 14;
            else if (scope === '1m') days = 30;
            else if (scope === '3m') days = 90;
            else if (scope === '1y') days = 365;

            raw = [...dailyData].reverse().slice(-days).map(d => ({
                date: d.date,
                osBond: d.metrics.osBond.current,
                osIndex: d.metrics.osIndex.current,
                osStock: d.metrics.osStock.current,
                domBond: d.metrics.domBond.current,
                domIndex: d.metrics.domIndex.current,
                domStock: d.metrics.domStock.current,
                cash: d.metrics.cash.current,
            }));
        }
        return raw;
    }, [scope, dailyData, weeklyData, monthlyData]);

    const yDomain = useMemo(() => {
        if (chartData.length === 0 || activeCategories.length === 0) return [0, 1000000];

        const values = chartData.map(d => {
            return activeCategories.reduce((sum, cat) => sum + (d[cat] || 0), 0);
        });

        const min = Math.min(...values);
        const max = Math.max(...values);

        // If 2+ categories are stacked, use 0 as minimum. 
        // If single category, use 95% of min to show fluctuations.
        const finalMin = activeCategories.length >= 2 ? 0 : Math.floor(min * 0.95);
        const finalMax = Math.ceil(max * 1.05);

        return [finalMin, finalMax];
    }, [chartData, activeCategories]);

    const toggleCategory = (key: string) => {
        const allKeys = categories.map(c => c.key);
        const isAllSelected = activeCategories.length === allKeys.length;

        if (isAllSelected) {
            setActiveCategories([key]);
        } else {
            setActiveCategories(prev => {
                if (prev.includes(key)) {
                    return prev.filter(k => k !== key);
                }
                const next = [...prev, key];
                // Maintain defined order for stacking stability
                return categories.map(c => c.key).filter(k => next.includes(k));
            });
        }
    };

    const handleAllToggle = () => {
        const allKeys = categories.map(c => c.key);
        if (activeCategories.length === allKeys.length) {
            setActiveCategories([]);
        } else {
            setActiveCategories(allKeys);
        }
    };

    const isAllSelected = activeCategories.length === categories.length;

    return (
        <section style={{ marginBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <TrendingUp size={24} color="var(--primary)" />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>자산 추이</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={handleAllToggle}
                            className="glass"
                            style={{
                                padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px', border: 'none',
                                background: isAllSelected ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                color: isAllSelected ? 'white' : 'var(--muted)', cursor: 'pointer', fontWeight: '600'
                            }}
                        >
                            전체
                        </button>
                        {categories.map(cat => {
                            const active = activeCategories.includes(cat.key);
                            return (
                                <button
                                    key={cat.key}
                                    onClick={() => toggleCategory(cat.key)}
                                    className="glass"
                                    style={{
                                        padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px', border: 'none',
                                        background: active ? cat.color : 'rgba(255,255,255,0.05)',
                                        color: active ? 'white' : 'var(--muted)', cursor: 'pointer', fontWeight: '600',
                                        display: 'flex', alignItems: 'center', gap: '0.25rem'
                                    }}
                                >
                                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: active ? 'white' : cat.color }}></div>
                                    {cat.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="glass" style={{ display: 'flex', gap: '0.2rem', padding: '0.2rem' }}>
                    {(['1w', '2w', '1m', '3m', '1y', 'weekly'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setScope(s)}
                            style={{
                                padding: '0.3rem 0.6rem', fontSize: '0.7rem', borderRadius: '4px', border: 'none',
                                background: scope === s ? 'var(--primary)' : 'transparent',
                                color: scope === s ? 'white' : 'var(--muted)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '600'
                            }}
                        >
                            {s === '1w' ? '1주' : s === '2w' ? '2주' : s === '1m' ? '1달' : s === '3m' ? '3달' : s === '1y' ? '1년' : '주별'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="glass" style={{ padding: '1.5rem', height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="var(--muted)"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => {
                                return val.substring(5);
                            }}
                        />
                        <YAxis
                            stroke="var(--muted)"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                            domain={yDomain}
                            allowDataOverflow={true}
                        />
                        <Tooltip
                            content={({ active, payload, label }: any) => {
                                if (active && payload && payload.length) {
                                    const visiblePayload = payload.filter((p: any) => activeCategories.includes(p.dataKey));
                                    if (visiblePayload.length === 0) return null;
                                    const total = visiblePayload.reduce((sum: number, entry: any) => sum + entry.value, 0);

                                    return (
                                        <div className="glass" style={{ padding: '1rem', border: '1px solid var(--border)', fontSize: '0.75rem', minWidth: '180px' }}>
                                            <div style={{ color: 'var(--muted)', marginBottom: '0.6rem', fontWeight: '600', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>{label}</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                {visiblePayload.slice().reverse().map((entry: any, idx: number) => (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            <div style={{ width: '7px', height: '7px', borderRadius: '1.5px', background: entry.color }}></div>
                                                            <span style={{ color: 'rgba(255,255,255,0.8)' }}>{entry.name}</span>
                                                        </div>
                                                        <span style={{ fontWeight: '700' }}>{formatKRW(entry.value)}</span>
                                                    </div>
                                                ))}
                                                <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dotted var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', color: 'var(--primary)' }}>
                                                    <span>{activeCategories.length === categories.length ? '총 합계' : '선택 합계'}</span>
                                                    <span>{formatKRW(total)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        {categories
                            .map(cat => (
                                <Area
                                    key={cat.key}
                                    type="monotone"
                                    dataKey={activeCategories.includes(cat.key) ? cat.key : () => 0}
                                    name={cat.name}
                                    stackId="1"
                                    stroke={activeCategories.includes(cat.key) ? cat.color : 'transparent'}
                                    fill={activeCategories.includes(cat.key) ? cat.color : 'transparent'}
                                    fillOpacity={activeCategories.includes(cat.key) ? 0.4 : 0}
                                    isAnimationActive={false}
                                />
                            ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
};

export default SettlementTrendChart;
