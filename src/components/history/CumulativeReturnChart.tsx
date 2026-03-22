'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';

interface CumulativeReturnChartProps {
    data: any[];
    scope: string;
    onScopeChange: (scope: any) => void;
    customDates?: { start: string, end: string };
    onCustomDatesChange?: (dates: { start: string, end: string }) => void;
}

const CumulativeReturnChart: React.FC<CumulativeReturnChartProps> = ({ data, scope, onScopeChange, customDates, onCustomDatesChange }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <section style={{ marginBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <TrendingUp size={24} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>누적 수익률</h2>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
                    <div className="glass" style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem' }}>
                        {(['1w', '2w', '1m', '3m', 'weekly', 'custom'] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => {
                                    onScopeChange(s);
                                    if (s === 'custom') {
                                        setIsDropdownOpen(!isDropdownOpen);
                                    } else {
                                        setIsDropdownOpen(false);
                                    }
                                }}
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
                                {s === '1w' ? '1주' : s === '2w' ? '2주' : s === '1m' ? '1달' : s === '3m' ? '3달' : s === 'weekly' ? '주별' : '기간'}
                            </button>
                        ))}
                    </div>

                    {isDropdownOpen && scope === 'custom' && customDates && onCustomDatesChange && (
                        <div ref={dropdownRef} className="glass" style={{ 
                            position: 'absolute', 
                            top: '100%', 
                            right: 0, 
                            marginTop: '0.5rem', 
                            padding: '1rem', 
                            borderRadius: '12px',
                            display: 'flex', 
                            flexDirection: 'column',
                            gap: '0.75rem',
                            zIndex: 50,
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                            animation: 'fadeIn 0.2s ease-out'
                        }}>
                            <style>{`
                                @keyframes fadeIn {
                                    from { opacity: 0; transform: translateY(-10px); }
                                    to { opacity: 1; transform: translateY(0); }
                                }
                            `}</style>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={16} color="var(--primary)" />
                                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--foreground)' }}>조회 기간 설정</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="date"
                                    value={customDates.start}
                                    onChange={(e) => onCustomDatesChange({ ...customDates, start: e.target.value })}
                                    style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.85rem', outline: 'none' }}
                                />
                                <span style={{ color: 'var(--muted)', fontWeight: '500' }}>~</span>
                                <input
                                    type="date"
                                    value={customDates.end}
                                    onChange={(e) => onCustomDatesChange({ ...customDates, end: e.target.value })}
                                    style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.85rem', outline: 'none' }}
                                />
                            </div>
                            <button 
                                onClick={() => setIsDropdownOpen(false)}
                                style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '600', cursor: 'pointer' }}
                            >
                                적용하기
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="glass" style={{ padding: '1.5rem', height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="var(--muted)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => {
                                const row = data.find((d: any) => d.date === val);
                                const d = new Date(val);
                                const dateStr = `${val.substring(5)} (${['일', '월', '화', '수', '목', '금', '토'][d.getDay()]})`;
                                return row?.isLive ? `${dateStr} (미정)` : dateStr;
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
                                    const rawRow = payload[0].payload;
                                    const sortedPayload = [...payload].sort((a: any, b: any) => b.value - a.value);
                                    return (
                                        <div className="glass" style={{ padding: '1rem', border: '1px solid var(--border)', fontSize: '0.75rem', minWidth: '160px' }}>
                                            <div style={{ fontWeight: '700', marginBottom: '0.8rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--muted)' }}>
                                                {label} {rawRow?.isLive && <span style={{ color: 'var(--primary)', marginLeft: '4px' }}>(미정)</span>}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {sortedPayload.map((entry: any, index: number) => {
                                                    const isPositive = entry.value >= 0;
                                                    return (
                                                        <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <div style={{ width: '8px', height: '2px', backgroundColor: entry.color }}></div>
                                                                <span style={{ color: 'var(--foreground)', fontWeight: '500' }}>
                                                                    {entry.name}
                                                                </span>
                                                            </div>
                                                            <span style={{ fontWeight: '700', color: isPositive ? '#dc2626' : '#2563eb' }}>
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
                                                <span style={{ fontSize: '0.75rem', color: 'var(--foreground)', fontWeight: '500' }}>
                                                    {entry.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            }}
                        />
                        <Line type="monotone" dataKey="kospi" name="코스피" stroke="#5f63b8" strokeWidth={1} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="kosdaq" name="코스닥" stroke="#3b82f6" strokeWidth={1} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="myDomestic" name="내 국내주식" stroke="#1d4ed8" strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} isAnimationActive={false} />

                        <Line type="monotone" dataKey="nasdaq" name="나스닥" stroke="#dc2626" strokeWidth={1} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="dow" name="다우존스" stroke="#ef4444" strokeWidth={1} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="myOverseas" name="내 해외주식" stroke="#b91c1c" strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
};

export default CumulativeReturnChart;
