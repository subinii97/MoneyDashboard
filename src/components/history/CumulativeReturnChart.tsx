'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface CumulativeReturnChartProps {
    data: any[];
    scope: string;
    onScopeChange: (scope: any) => void;
}

const CumulativeReturnChart: React.FC<CumulativeReturnChartProps> = ({ data, scope, onScopeChange }) => {
    return (
        <section style={{ marginBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <TrendingUp size={24} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>누적 수익률 비교</h2>
                </div>
                <div className="glass" style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem' }}>
                    {(['1w', '2w', '1m', '3m'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => onScopeChange(s)}
                            style={{
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.8rem',
                                borderRadius: '6px',
                                border: 'none',
                                background: scope === s ? 'var(--primary)' : 'transparent',
                                color: scope === s ? 'white' : 'var(--muted)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: '600'
                            }}
                        >
                            {s === '1w' ? '1주' : s === '2w' ? '2주' : s === '1m' ? '1달' : '3달'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="glass" style={{ padding: '1.5rem', height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="var(--muted)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => {
                                const d = new Date(val);
                                return `${val.substring(5)} (${['일', '월', '화', '수', '목', '금', '토'][d.getDay()]})`;
                            }}
                        />
                        <YAxis
                            stroke="var(--muted)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => `${val.toFixed(1)}%`}
                        />
                        <Tooltip
                            content={({ active, payload, label }: any) => {
                                if (active && payload && payload.length) {
                                    const sortedPayload = [...payload].sort((a: any, b: any) => b.value - a.value);
                                    return (
                                        <div className="glass" style={{ padding: '1rem', border: '1px solid var(--border)', fontSize: '0.75rem', minWidth: '160px' }}>
                                            <div style={{ fontWeight: '700', marginBottom: '0.8rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--muted)' }}>
                                                {label}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {sortedPayload.map((entry: any, index: number) => {
                                                    const isPositive = entry.value >= 0;
                                                    return (
                                                        <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <div style={{ width: '8px', height: '2px', backgroundColor: entry.color }}></div>
                                                                <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '500' }}>
                                                                    {entry.name}
                                                                </span>
                                                            </div>
                                                            <span style={{ fontWeight: '700', color: isPositive ? '#ef4444' : '#3b82f6' }}>
                                                                {isPositive ? '+' : ''}{Number(entry.value).toFixed(2)}%
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend
                            content={(props: any) => {
                                const { payload } = props;
                                const requestedOrder = ['코스피', '코스닥', '내 국내주식', '나스닥', '다우존스', '내 해외주식'];
                                const sortedPayload = requestedOrder
                                    .map(name => payload?.find((p: any) => p.value === name))
                                    .filter(Boolean);

                                return (
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.2rem', paddingTop: '20px', flexWrap: 'wrap' }}>
                                        {sortedPayload.map((entry: any, index: number) => (
                                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <div style={{ width: '12px', height: '3px', backgroundColor: entry.color, borderRadius: '1px' }}></div>
                                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)', fontWeight: '500' }}>
                                                    {entry.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            }}
                        />
                        <Line type="monotone" dataKey="kospi" name="코스피" stroke="#3b82f6" strokeWidth={1} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="kosdaq" name="코스닥" stroke="#60a5fa" strokeWidth={1} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="myDomestic" name="내 국내주식" stroke="#1d4ed8" strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} isAnimationActive={false} />

                        <Line type="monotone" dataKey="nasdaq" name="나스닥" stroke="#ef4444" strokeWidth={1} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="dow" name="다우존스" stroke="#f87171" strokeWidth={1} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="myOverseas" name="내 해외주식" stroke="#b91c1c" strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
};

export default CumulativeReturnChart;
