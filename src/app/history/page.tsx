'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HistoryEntry, AssetCategory, CATEGORY_MAP, CATEGORY_COLORS } from '@/lib/types';
import { formatKRW, convertToKRW } from '@/lib/utils';
import { TrendingUp, TrendingDown, Calendar, ArrowLeftRight, PieChart as PieChartIcon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DailySettlement extends HistoryEntry {
    change: number;
    changePercent: number;
}

interface MonthlySettlement {
    month: string;
    value: number;
    cashSavings: number;
    domestic: number;
    overseas: number;
    change: number;
    changePercent: number;
}

const CATEGORIES: AssetCategory[] = [
    'Cash',
    'Savings',
    'Domestic Stock',
    'Domestic Index',
    'Domestic Bond',
    'Overseas Stock',
    'Overseas Index',
    'Overseas Bond',
];

export default function HistoryPage() {
    const router = useRouter();
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState(1350);
    const [selectedCategories, setSelectedCategories] = useState<AssetCategory[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [historyRes, stockRes] = await Promise.all([
                    fetch('/api/snapshot?includeHoldings=true'),
                    fetch('/api/stock?symbols=AAPL')
                ]);
                const historyData = await historyRes.json();
                const stockData = await stockRes.json();

                setHistory(historyData);
                if (stockData.exchangeRate) {
                    const r = typeof stockData.exchangeRate === 'object' ? stockData.exchangeRate.rate : stockData.exchangeRate;
                    setRate(r);
                }
            } catch (err) {
                console.error('Failed to fetch history', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const toggleCategory = (cat: AssetCategory) => {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

    // Helper to get category value from an entry
    const getCategoryValue = (entry: HistoryEntry, cat: AssetCategory): number => {
        const allocation = entry.allocations?.find(a => a.category === cat);
        const entryRate = entry.exchangeRate || rate;
        const allocationValue = allocation ? convertToKRW(allocation.value, allocation.currency, entryRate) : 0;

        if (cat === 'Cash') {
            if (allocationValue > 0) return allocationValue;
            // Fallback: Total - others
            const others = CATEGORIES.filter(c => c !== 'Cash');
            const totalOthers = others.reduce((sum: number, c: AssetCategory) => sum + getCategoryValue(entry, c), 0);
            return Math.max(0, entry.totalValue - totalOthers);
        }

        if (['Domestic Stock', 'Overseas Stock', 'Domestic Index', 'Overseas Index', 'Domestic Bond', 'Overseas Bond'].includes(cat)) {
            if (allocationValue > 0) return allocationValue;

            const categoryInvestments = entry.holdings?.filter((h: any) => {
                if (h.category) return h.category === cat;
                if (cat === 'Domestic Stock') return h.marketType === 'Domestic' || h.symbol.includes('.KS') || h.symbol.includes('.KQ') || /^\d{6}/.test(h.symbol);
                if (cat === 'Overseas Stock') return h.marketType === 'Overseas' || (!h.symbol.includes('.KS') && !h.symbol.includes('.KQ') && !/^\d{6}/.test(h.symbol));
                return false;
            });

            return categoryInvestments?.reduce((sum: number, h: any) =>
                sum + convertToKRW((h.currentPrice || h.avgPrice) * h.shares, h.currency || (h.marketType === 'Domestic' ? 'KRW' : 'USD'), entryRate), 0) || 0;
        }

        return allocationValue;
    };

    // Daily Calculations
    const dailySettlements: DailySettlement[] = history.map((entry, index) => {
        const prevEntry = index > 0 ? history[index - 1] : null;
        const change = prevEntry ? entry.totalValue - prevEntry.totalValue : 0;
        const changePercent = prevEntry && prevEntry.totalValue !== 0 ? (change / prevEntry.totalValue) * 100 : 0;
        return { ...entry, change, changePercent };
    }).reverse();

    // Chart Data Processing
    const chartData = history.map(entry => {
        const data: any = { date: entry.date };
        CATEGORIES.forEach(cat => {
            data[cat] = getCategoryValue(entry, cat);
        });
        return data;
    });

    // Monthly Calculations
    const monthlyData: Record<string, HistoryEntry> = {};
    history.forEach(entry => {
        const month = entry.date.substring(0, 7); // YYYY-MM
        monthlyData[month] = entry;
    });

    const months = Object.keys(monthlyData).sort();
    const monthlySettlements: MonthlySettlement[] = months.map((month, index) => {
        const entry = monthlyData[month];
        const prevMonth = index > 0 ? months[index - 1] : null;
        const prevEntry = prevMonth ? monthlyData[prevMonth] : null;

        const change = prevEntry ? entry.totalValue - prevEntry.totalValue : 0;
        const changePercent = prevEntry && prevEntry.totalValue !== 0 ? (change / prevEntry.totalValue) * 100 : 0;

        const cashSavings = getCategoryValue(entry, 'Cash') + getCategoryValue(entry, 'Savings');
        const domestic = getCategoryValue(entry, 'Domestic Stock') + getCategoryValue(entry, 'Domestic Index') + getCategoryValue(entry, 'Domestic Bond');
        const overseas = getCategoryValue(entry, 'Overseas Stock') + getCategoryValue(entry, 'Overseas Index') + getCategoryValue(entry, 'Overseas Bond');

        return {
            month,
            value: entry.totalValue,
            cashSavings,
            domestic,
            overseas,
            change,
            changePercent
        };
    }).reverse();

    const renderChange = (change: number, percent: number) => {
        const isPositive = change >= 0;
        const Color = isPositive ? '#ef4444' : '#3b82f6';
        const Icon = isPositive ? TrendingUp : TrendingDown;

        return (
            <div style={{ color: Color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontWeight: '600' }}>
                <Icon size={16} />
                <span>{isPositive ? '+' : ''}{formatKRW(change)} ({percent.toFixed(2)}%)</span>
            </div>
        );
    };

    return (
        <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>
                    정산 내역
                </h1>
                <p style={{ color: 'white' }}>일별, 월별 자산 변동 현황 (00:00 기준)</p>
            </header>

            <section style={{ marginBottom: '4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <PieChartIcon size={24} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>자산군별 추이</h2>
                </div>
                <div className="glass" style={{ padding: '2rem', height: '500px' }}>
                    <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                            onClick={() => setSelectedCategories([])}
                            className="glass"
                            style={{
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.8rem',
                                borderRadius: '20px',
                                border: selectedCategories.length === 0 ? '1px solid var(--primary)' : '1px solid var(--border)',
                                color: selectedCategories.length === 0 ? 'var(--primary)' : 'var(--muted)',
                                cursor: 'pointer'
                            }}
                        >
                            전체 보기
                        </button>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => toggleCategory(cat)}
                                className="glass"
                                style={{
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.8rem',
                                    borderRadius: '20px',
                                    border: selectedCategories.includes(cat) ? `1px solid ${CATEGORY_COLORS[cat]}` : '1px solid var(--border)',
                                    color: selectedCategories.includes(cat) ? CATEGORY_COLORS[cat] : 'var(--muted)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: CATEGORY_COLORS[cat] }}></div>
                                {CATEGORY_MAP[cat]}
                            </button>
                        ))}
                    </div>
                    <ResponsiveContainer width="100%" height="90%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                                tickFormatter={(val) => `₩${(val / 1000000).toLocaleString()}M`}
                                domain={selectedCategories.length === 1
                                    ? [(dataMin: number) => dataMin * 0.95, (dataMax: number) => dataMax * 1.05]
                                    : [0, 'auto']}
                            />
                            <Tooltip
                                content={({ active, payload, label }: any) => {
                                    if (active && payload && payload.length) {
                                        // If specific categories are selected, Recharts only provides payload for rendered Areas.
                                        // However, if we filter rendered areas, payload is already correct.
                                        // Sort payload by value descending for better tooltip readability
                                        const visiblePayload = payload.sort((a: any, b: any) => b.value - a.value);

                                        if (visiblePayload.length === 0) return null;

                                        const total = visiblePayload.reduce((sum: number, entry: any) => sum + entry.value, 0);

                                        return (
                                            <div className="glass" style={{ padding: '1rem', border: '1px solid var(--border)' }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>{label}</div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    {visiblePayload.map((entry: any, index: number) => (
                                                        <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color }}></div>
                                                                <span style={{ fontSize: '0.85rem' }}>{CATEGORY_MAP[entry.name as AssetCategory]}</span>
                                                            </div>
                                                            <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{formatKRW(entry.value)}</span>
                                                        </div>
                                                    ))}
                                                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ fontWeight: 'bold' }}>합계</span>
                                                        <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{formatKRW(total)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            {CATEGORIES.filter(cat => selectedCategories.length === 0 || selectedCategories.includes(cat)).map(cat => (
                                <Area
                                    key={cat}
                                    type="monotone"
                                    dataKey={cat}
                                    stackId={selectedCategories.length === 1 ? undefined : "1"}
                                    stroke={CATEGORY_COLORS[cat]}
                                    fill={CATEGORY_COLORS[cat]}
                                    fillOpacity={0.6}
                                    strokeOpacity={1}
                                    activeDot={true}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </section>

            <section style={{ marginBottom: '4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <Calendar size={24} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>월별 정산</h2>
                </div>
                <div className="glass" style={{ overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)' }}>
                                <th style={{ padding: '1rem', width: '120px', textAlign: 'center' }}>기준월</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>현금/예적금</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>국내</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>해외</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>총 평가금액</th>
                                <th style={{ padding: '1rem', width: '220px', textAlign: 'center' }}>전월 대비</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlySettlements.map((m) => (
                                <tr key={m.month} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem', fontWeight: '500', textAlign: 'center' }}>{m.month}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{formatKRW(m.cashSavings)}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{formatKRW(m.domestic)}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{formatKRW(m.overseas)}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>{formatKRW(m.value)}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{renderChange(m.change, m.changePercent)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <ArrowLeftRight size={24} color="var(--accent)" />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>일별 정산</h2>
                </div>
                <div className="glass" style={{ overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)' }}>
                                <th style={{ padding: '1rem', width: '150px', textAlign: 'center' }}>날짜</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>평가금액</th>
                                <th style={{ padding: '1rem', width: '250px', textAlign: 'center' }}>전일 대비</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dailySettlements.map((d) => (
                                <tr
                                    key={d.date}
                                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                                    onClick={() => router.push(`/history/${d.date}`)}
                                    className="hover-bright"
                                >
                                    <td style={{ padding: '1.25rem 1rem', fontWeight: '500', textAlign: 'center' }}>
                                        {d.date}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>{formatKRW(d.totalValue)}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>{renderChange(d.change, d.changePercent)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}
