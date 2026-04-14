'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import {
    LineChart, Line, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

// ── Label/metadata map ────────────────────────────────────────────────────────
const META: Record<string, { name: string; suffix?: string; prefix?: string; decimals?: number }> = {
    KOSPI:   { name: '코스피 (KOSPI)' },
    KOSDAQ:  { name: '코스닥 (KOSDAQ)' },
    NASDAQ:  { name: '나스닥 (NASDAQ)' },
    DOW:     { name: '다우존스 (DOW)' },
    USDKRW:  { name: '달러/원 (USD/KRW)', suffix: '원' },
    EURKRW:  { name: '유로/원 (EUR/KRW)', suffix: '원' },
    EURUSD:  { name: '유로/달러 (EUR/USD)', prefix: '$', decimals: 4 },
    JPYKRW:  { name: '엔/원 (JPY/KRW)', suffix: '원', decimals: 4 },
    BTC:     { name: '비트코인 (BTC)', prefix: '$' },
    ETH:     { name: '이더리움 (ETH)', prefix: '$' },
    GOLD:    { name: '금 (Gold)', prefix: '$' },
    SILVER:  { name: '은 (Silver)', prefix: '$' },
    COPPER:  { name: '구리 (Copper)', prefix: '$' },
    WTI:     { name: 'WTI 원유', prefix: '$' },
    IRON:    { name: '철광석', prefix: '$' },
};

interface ChartPoint { label: string; price: number; }

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const meta = META[id] || { name: id };

    const [sparkData, setSparkData] = useState<number[]>([]);
    const [currentItem, setCurrentItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                const [sparkRes, marketRes] = await Promise.all([
                    fetch('/api/market/sparkline'),
                    fetch('/api/market'),
                ]);
                const sparkJson = await sparkRes.json();
                const marketJson = await marketRes.json();

                setSparkData(sparkJson[id] || []);

                // Find current item across all categories
                const all = [
                    ...(marketJson.indices || []),
                    ...(marketJson.rates || []),
                    ...(marketJson.crypto || []),
                    ...(marketJson.commodities || []),
                ];
                setCurrentItem(all.find((x: any) => x.id === id) || null);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [id]);

    // Build chart data from sparkline
    const chartData: ChartPoint[] = sparkData.map((price, i) => ({
        label: `Day ${i - sparkData.length + 1}`,
        price,
    }));
    if (chartData.length > 0) chartData[chartData.length - 1].label = '오늘';

    const isUp = (currentItem?.change || 0) >= 0;
    const lineColor = isUp ? '#dc2626' : '#3b82f6';
    const changeColor = isUp ? '#dc2626' : '#2563eb';
    const dec = meta.decimals ?? 2;
    const fmt = (v: number) => {
        if (!v && v !== 0) return '-';
        const str = v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
        return `${meta.prefix || ''}${str}${meta.suffix || ''}`;
    };

    const minY = chartData.length > 0 ? Math.min(...chartData.map(d => d.price)) * 0.998 : 0;
    const maxY = chartData.length > 0 ? Math.max(...chartData.map(d => d.price)) * 1.002 : 1;

    return (
        <main style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', color: 'var(--foreground)' }}>
            {/* Back button */}
            <button
                onClick={() => router.back()}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', marginBottom: '2rem', padding: 0 }}
            >
                <ArrowLeft size={18} /> 뒤로가기
            </button>

            {/* Header */}
            <header style={{ marginBottom: '2.5rem' }}>
                <span className="section-label">Market Detail</span>
                <h1 className="gradient-text" style={{ fontSize: '2.2rem', fontWeight: '900', letterSpacing: '-0.03em' }}>
                    {meta.name}
                </h1>

                {!loading && currentItem && (
                    <div style={{ display: 'flex', gap: '2rem', marginTop: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: '600', marginBottom: '0.2rem' }}>현재가</div>
                            <div style={{ fontSize: '2rem', fontWeight: '800' }}>{fmt(currentItem.price)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: '600', marginBottom: '0.2rem' }}>전일 대비</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: changeColor, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {isUp ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                                {isUp ? '+' : ''}{fmt(currentItem.change)}
                                <span style={{ fontSize: '1rem', opacity: 0.85 }}>
                                    ({(currentItem.changePercent || 0) >= 0 ? '+' : ''}{(currentItem.changePercent || 0).toFixed(2)}%)
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Chart */}
            <div className="glass" style={{ padding: '2rem', borderRadius: '18px', marginBottom: '3rem' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--muted)' }}>최근 14일 가격 추이</h2>
                    {loading && <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>로딩 중...</span>}
                </div>
                {!loading && chartData.length === 0 && (
                    <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                        차트 데이터를 사용할 수 없습니다.
                    </div>
                )}
                {chartData.length > 0 && (
                    <ResponsiveContainer width="100%" height={320}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={lineColor} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="label" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis
                                stroke="var(--muted)"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                domain={[minY, maxY]}
                                tickFormatter={v => fmt(v)}
                                width={80}
                            />
                            <Tooltip
                                content={({ active, payload, label }: any) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="glass" style={{ padding: '0.75rem 1rem', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                                <div style={{ color: 'var(--muted)', marginBottom: '0.3rem' }}>{label}</div>
                                                <div style={{ fontWeight: '800', color: lineColor }}>{fmt(payload[0].value)}</div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke={lineColor}
                                strokeWidth={2.5}
                                fill="url(#areaGrad)"
                                dot={false}
                                activeDot={{ r: 5, fill: lineColor }}
                                isAnimationActive={true}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </main>
    );
}
