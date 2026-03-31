'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { HistoryChartContainer } from './HistoryChartContainer';

const CumulativeReturnChart = (props: any) => (
    <HistoryChartContainer {...props} title="누적 수익률" icon={<TrendingUp size={24} color="var(--primary)" />}>
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={props.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false}
                    tickFormatter={(val) => {
                        const row = props.data.find((d: any) => d.date === val);
                        const d = new Date(val); const dateStr = `${val.substring(5)} (${['일', '월', '화', '수', '목', '금', '토'][d.getDay()]})`;
                        return row?.isLive ? `${dateStr} (미정)` : dateStr;
                    }} />
                <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val.toFixed(1)}%`} />
                <Tooltip content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                        const rawRow = payload[0].payload; const sorted = [...payload].sort((a: any, b: any) => b.value - a.value);
                        return (
                            <div className="glass" style={{ padding: '1rem', fontSize: '0.75rem', minWidth: '160px' }}>
                                <div style={{ fontWeight: '700', marginBottom: '0.8rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--muted)' }}>{label} {rawRow?.isLive && <span style={{ color: 'var(--primary)', marginLeft: '4px' }}>(미정)</span>}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{sorted.map((e: any, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '8px', height: '2px', backgroundColor: e.color }} /><span style={{ color: 'var(--foreground)', fontWeight: '500' }}>{e.name}</span></div>
                                    <span style={{ fontWeight: '700', color: e.value >= 0 ? '#dc2626' : '#2563eb' }}>{e.value >= 0 ? '+' : ''}{Number(e.value).toFixed(2)}%</span>
                                </div>)}</div>
                            </div>);
                    } return null;
                }} />
                <Legend content={({ payload }: any) => {
                    const order = ['코스피', '코스닥', '내 국내주식', '나스닥', '다우존스', '내 해외주식'];
                    const sorted = order.map(n => payload?.find((p: any) => p.value === n)).filter(Boolean);
                    return (<div style={{ display: 'flex', justifyContent: 'center', gap: '1.2rem', paddingTop: '20px', flexWrap: 'wrap' }}>
                        {sorted.map((e: any, i: number) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><div style={{ width: '12px', height: '3px', backgroundColor: e.color, borderRadius: '1px' }} /><span style={{ fontSize: '0.75rem', color: 'var(--foreground)', fontWeight: '500' }}>{e.value}</span></div>))}
                    </div>);
                }} />
                <Line type="monotone" dataKey="kospi" name="코스피" stroke="#5f63b8" strokeWidth={1} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="kosdaq" name="코스닥" stroke="#3b82f6" strokeWidth={1} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="myDomestic" name="내 국내주식" stroke="#1d4ed8" strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="nasdaq" name="나스닥" stroke="#dc2626" strokeWidth={1} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="dow" name="다우존스" stroke="#ef4444" strokeWidth={1} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="myOverseas" name="내 해외주식" stroke="#b91c1c" strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} isAnimationActive={false} />
            </LineChart>
        </ResponsiveContainer>
    </HistoryChartContainer>
);

export default CumulativeReturnChart;
