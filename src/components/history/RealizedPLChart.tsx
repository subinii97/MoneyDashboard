'use client';

import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Wallet } from 'lucide-react';
import { formatKRW, convertToKRW } from '@/lib/utils';
import { HistoryChartContainer } from './HistoryChartContainer';

const RealizedPLChart = ({ transactions, rate, isPrivate }: any) => {
    const [scope, setScope] = useState<'daily' | 'monthly'>('daily');

    const chartData = useMemo(() => {
        if (!transactions || !Array.isArray(transactions)) return [];

        // 실현 손익은 SELL 거래 중 shares, price, costBasis가 모두 있는 경우에만 계산
        const sellTxs = transactions.filter((t: any) => t.type === 'SELL' && t.shares && t.price && t.costBasis);
        
        const grouped: Record<string, number> = {};

        sellTxs.forEach((t: any) => {
            const key = scope === 'daily' ? t.date : t.date.substring(0, 7);
            const profit = (t.price - t.costBasis) * t.shares;
            const profitKRW = convertToKRW(profit, t.currency || 'KRW', rate);
            
            grouped[key] = (grouped[key] || 0) + profitKRW;
        });

        // 데이터가 없는 날짜 빈칸을 채우기보다, 데이터가 있는 날짜만 정렬해서 보여줌
        return Object.entries(grouped)
            .map(([date, profit]) => ({ date, profit }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(scope === 'daily' ? -30 : -12); // 최근 30거래일 혹은 12개월
    }, [transactions, scope, rate]);

    if (chartData.length === 0) return null;

    return (
        <HistoryChartContainer 
            title="실현 손익 (Realized P/L)" 
            icon={<Wallet size={24} color="var(--primary)" />} 
            scope={scope} 
            onScopeChange={setScope}
            scopes={[{id: 'daily', label: '일간'}, {id: 'monthly', label: '월간'}]}
        >
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis 
                        dataKey="date" 
                        stroke="var(--muted)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={v => scope === 'daily' ? v.substring(5) : v}
                    />
                    <YAxis 
                        stroke="var(--muted)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={v => isPrivate ? '***' : (Math.abs(v) >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : v))}
                    />
                    <Tooltip cursor={{fill: 'var(--border)', opacity: 0.1}} content={({ active: ac, payload, label }: any) => {
                        if (ac && payload?.length) {
                            const value = payload[0].value;
                            return (
                                <div className="glass" style={{ padding: '0.8rem', fontSize: '0.75rem', minWidth: '160px' }}>
                                    <div style={{ color: 'var(--muted)', marginBottom: '0.4rem', fontWeight: '600' }}>{label}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>실현 손익</span>
                                        <span style={{ fontWeight: '800', color: value >= 0 ? '#dc2626' : '#2563eb' }}>
                                            {isPrivate ? '***' : (value > 0 ? '+' : '') + formatKRW(value)}
                                        </span>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    }} />
                    <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell 
                                key={`cell-${index}`} 
                                fill={entry.profit >= 0 ? 'rgba(220, 38, 38, 0.8)' : 'rgba(37, 99, 235, 0.8)'} 
                                stroke={entry.profit >= 0 ? '#dc2626' : '#2563eb'}
                                strokeWidth={1}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </HistoryChartContainer>
    );
};

export default RealizedPLChart;
