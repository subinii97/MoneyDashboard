'use client';

import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { Wallet } from 'lucide-react';
import { formatKRW, convertToKRW } from '@/lib/utils';
import { HistoryChartContainer } from './HistoryChartContainer';

const RealizedPLChart = ({ transactions, rate, isPrivate }: any) => {
    const [scope, setScope] = useState<'daily' | 'monthly'>('daily');
    const [activeIndex, setActiveIndex] = useState<number>(-1);

    const chartData = useMemo(() => {
        if (!transactions || !Array.isArray(transactions)) return [];

        const sellTxs = transactions.filter((t: any) => t.type === 'SELL' && t.shares && t.price && t.costBasis);
        const grouped: Record<string, number> = {};

        sellTxs.forEach((t: any) => {
            const key = scope === 'daily' ? t.date : t.date.substring(0, 7);
            const profit = (t.price - t.costBasis) * t.shares;
            const profitKRW = convertToKRW(profit, t.currency || 'KRW', rate);
            grouped[key] = (grouped[key] || 0) + profitKRW;
        });

        return Object.entries(grouped)
            .map(([date, profit]) => ({ date, profit }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(scope === 'daily' ? -30 : -12);
    }, [transactions, scope, rate]);

    if (chartData.length === 0) return null;

    const activeEntry = activeIndex >= 0 ? chartData[activeIndex] : null;

    // 커스텀 막대 렌더러: 각 막대에 직접 mouseenter/mouseleave 이벤트를 걸어 안정적인 호버 구현
    const CustomBar = (props: any) => {
        const { x, y, width, height, index, profit } = props;
        if (!height || height === 0) return null;

        const isSelected = index === activeIndex;
        const isHovering = activeIndex !== -1;

        const isPositive = profit >= 0;
        const baseColor = isPositive ? '#dc2626' : '#2563eb';
        const activeColor = isPositive ? '#7f1d1d' : '#1e3a8a';

        let fillColor: string;
        let opacity: number;

        if (!isHovering) {
            fillColor = baseColor;
            opacity = 0.7;
        } else if (isSelected) {
            fillColor = activeColor;
            opacity = 1;
        } else {
            fillColor = baseColor;
            opacity = 0.3;
        }

        const r = 4;
        const rectY = height < 0 ? y + height : y;
        const rectH = Math.abs(height);

        return (
            <rect
                x={x}
                y={rectY}
                width={width}
                height={rectH}
                rx={r}
                ry={r}
                fill={fillColor}
                opacity={opacity}
                style={{ transition: 'opacity 0.15s ease, fill 0.15s ease', cursor: 'default' }}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(-1)}
            />
        );
    };

    return (
        <HistoryChartContainer
            title="실현 손익"
            icon={<Wallet size={24} color="var(--primary)" />}
            scope={scope}
            onScopeChange={setScope}
            scopes={[{ id: 'daily', label: '일간' }, { id: 'monthly', label: '월간' }]}
        >
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 15 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
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
                        width={65}
                        tickFormatter={v => isPrivate ? '***' : (
                            Math.abs(v) >= 1000000 ? `${(v / 1000000).toFixed(1)}M` :
                                Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : v
                        )}
                    />
                    {/* 툴팁 팝업 비활성화 */}
                    <Tooltip cursor={false} content={() => null} />

                    {/* 0 기준선 */}
                    <ReferenceLine y={0} stroke="var(--muted)" strokeWidth={1} opacity={0.3} />

                    {/* 호버 시 Y축에 해당 수치를 표시하는 수평 기준선 */}
                    {activeEntry && !isPrivate && (
                        <ReferenceLine
                            y={activeEntry.profit}
                            stroke="var(--primary)"
                            strokeDasharray="4 3"
                            strokeWidth={1}
                            isFront={true as any}
                            label={{
                                position: 'left',
                                value: formatKRW(activeEntry.profit),
                                fill: 'var(--primary)',
                                fontSize: 10,
                                fontWeight: 700,
                            }}
                        />
                    )}

                    <Bar
                        dataKey="profit"
                        shape={(props: any) => <CustomBar {...props} index={props.index} profit={props.profit} />}
                        isAnimationActive={false}
                    >
                        {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </HistoryChartContainer>
    );
};

export default RealizedPLChart;
