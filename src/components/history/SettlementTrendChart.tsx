'use client';

import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatKRW } from '@/lib/utils';
import { HistoryChartContainer } from './HistoryChartContainer';

const SettlementTrendChart = ({ dailyData, weeklyData, monthlyData, scope, onScopeChange, isPrivate }: any) => {
    const cats = useMemo(() => [{ k: 'osBond', n: '해외채권', c: '#7c2d12' }, { k: 'osIndex', n: '해외지수', c: '#b91c1c' }, { k: 'osStock', n: '해외주식', c: '#dc2626' }, { k: 'domBond', n: '국내채권', c: '#1e3a8a' }, { k: 'domIndex', n: '국내지수', c: '#1d4ed8' }, { k: 'domStock', n: '국내주식', c: '#5f63b8' }, { k: 'cash', n: '현금/예금', c: '#059669' }], []);
    const [active, setActive] = useState<string[]>(cats.map(c => c.k));

    const chartData = useMemo(() => {
        let raw: any[] = [];
        if (scope === 'weekly') raw = [...weeklyData].reverse().map(w => ({ date: w.period.split(' ~ ')[1], osBond: w.metrics.osBond.current, osIndex: w.metrics.osIndex.current, osStock: w.metrics.osStock.current, domBond: w.metrics.domBond.current, domIndex: w.metrics.domIndex.current, domStock: w.metrics.domStock.current, cash: w.metrics.cash.current }));
        else {
            const dMap: any = { '1w': 7, '2w': 14, '1m': 30, '3m': 90, '1y': 365 };
            raw = [...dailyData].reverse().slice(-(dMap[scope] || 30)).map(d => ({ date: d.date, osBond: d.metrics.osBond.current, osIndex: d.metrics.osIndex.current, osStock: d.metrics.osStock.current, domBond: d.metrics.domBond.current, domIndex: d.metrics.domIndex.current, domStock: d.metrics.domStock.current, cash: d.metrics.cash.current }));
        }
        return raw;
    }, [scope, dailyData, weeklyData]);

    const yDomain = useMemo(() => {
        if (!chartData.length || !active.length) return [0, 1000000];
        const vals = chartData.map(d => active.reduce((s, cat) => s + (d[cat] || 0), 0));
        return [active.length >= 2 ? 0 : Math.floor(Math.min(...vals) * 0.95), Math.ceil(Math.max(...vals) * 1.05)];
    }, [chartData, active]);

    return (
        <HistoryChartContainer title="자산 추이" icon={<TrendingUp size={24} color="var(--primary)" />} scope={scope} onScopeChange={onScopeChange} 
            scopes={[{id: '1w', label: '1주'}, {id: '2w', label: '2주'}, {id: '1m', label: '1달'}, {id: '3m', label: '3달'}, {id: '1y', label: '1년'}, {id: 'weekly', label: '주별'}]}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.2rem', padding: '0 0.5rem' }}>
                <button onClick={() => setActive(active.length === cats.length ? [] : cats.map(c => c.k))} className="glass" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', background: active.length === cats.length ? 'var(--primary)' : 'var(--border)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, transition: 'all 0.2s' }}>전체</button>
                {cats.map(c => <button key={c.k} onClick={() => setActive(prev => prev.length === cats.length ? [c.k] : (prev.includes(c.k) ? prev.filter(k => k !== c.k) : [...prev, c.k]))} className="glass" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', background: active.includes(c.k) ? c.c : 'var(--border)', color: 'white', border: 'none', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, transition: 'all 0.2s' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white', opacity: active.includes(c.k) ? 1 : 0.4 }} />{c.n}</button>)}
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => v.substring(5)} />
                    <YAxis stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => isPrivate ? '***' : `${(v / 1000000).toFixed(0)}M`} domain={yDomain} allowDataOverflow />
                    <Tooltip content={({ active: ac, payload, label }: any) => {
                        if (ac && payload?.length) {
                            const vis = payload.filter((p: any) => active.includes(p.dataKey)); if (!vis.length) return null;
                            return (
                                <div className="glass" style={{ padding: '0.8rem', fontSize: '0.7rem', minWidth: '160px' }}>
                                    <div style={{ color: 'var(--muted)', marginBottom: '0.4rem', fontWeight: '600' }}>{label}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                        {vis.slice().reverse().map((e: any, i: number) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{e.name}</span><span style={{ fontWeight: '700' }}>{isPrivate ? '***' : formatKRW(e.value)}</span></div>)}
                                        <div style={{ marginTop: '0.4rem', borderTop: '1px dotted var(--border)', display: 'flex', justifyContent: 'space-between', color: 'var(--primary)', fontWeight: '800' }}><span>합계</span><span>{isPrivate ? '***' : formatKRW(vis.reduce((s: number, e: any) => s + e.value, 0))}</span></div>
                                    </div>
                                </div>);
                        } return null;
                    }} />
                    {cats.map(c => <Area key={c.k} type="monotone" dataKey={active.includes(c.k) ? c.k : () => 0} name={c.n} stackId="1" stroke={active.includes(c.k) ? c.c : 'transparent'} fill={active.includes(c.k) ? c.c : 'transparent'} fillOpacity={active.includes(c.k) ? 0.4 : 0} isAnimationActive={false} />)}
                </AreaChart>
            </ResponsiveContainer>
        </HistoryChartContainer>
    );
};

export default SettlementTrendChart;
