'use client';

import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { RefreshCw, ImageIcon, Info, X } from 'lucide-react';
import { toPng } from 'html-to-image';

import { Stock, Sector } from '@/components/Analysis/types';
import { squarifyLayout, getColor } from '@/components/Analysis/TreemapUtils';
import { SectorTile } from '@/components/Analysis/SectorTile';

const LEGEND = [
    { label: '-8%↓', ...getColor(-8.5) }, { label: '-5%', ...getColor(-5.5) }, { label: '-3%', ...getColor(-3.5) }, { label: '-1%', ...getColor(-1.5) },
    { label: '0%', ...getColor(0) },
    { label: '+1%', ...getColor(1.5) }, { label: '+3%', ...getColor(3.5) }, { label: '+5%', ...getColor(5.5) }, { label: '+8%↑', ...getColor(8.5) },
];

export default function AnalysisPage() {
    const [market, setMarket] = useState<'US' | 'KR' | 'KOSDAQ'>('KR');
    const [marketStatus, setMarketStatus] = useState<'OPEN' | 'CLOSED'>('CLOSED');
    const [hoverSync, setHoverSync] = useState(false);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastFetched, setLastFetched] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: 'performance' | 'sync' | 'weight' | 'influence', direction: 'desc' | 'asc' }>({ key: 'performance', direction: 'desc' });
    const [correlation, setCorrelation] = useState<{
        correlationLag: number;
        correlationLagPrev?: number;
        correlationLagHistory?: { date: string, value: number }[];
        sectorCorrelations?: Record<string, number>;
        krSectorCorrelations?: Record<string, number>;
        kqSectorCorrelations?: Record<string, number>;
        sectorSync?: Record<string, number>;
    } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ w: 1100, h: 560 });
    const [hoveredStock, setHoveredStock] = useState<Stock | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [hoverHelp, setHoverHelp] = useState(false);
    const heatmapRef = useRef<HTMLDivElement>(null);

    const handleSaveImage = useCallback(async () => {
        if (!heatmapRef.current) return;
        try {
            const dataUrl = await toPng(heatmapRef.current, {
                quality: 1,
                pixelRatio: 2,
                backgroundColor: '#ffffff', // Required for PNG output with solid background
                skipFonts: true,
                style: {
                    // Force Light Theme Colors during capture
                    backgroundColor: '#ffffff',
                    color: '#000000',
                },
                filter: (node: any) => {
                    const exclusionClasses = ['ignore-in-capture'];
                    return !exclusionClasses.some(className => node.classList?.contains(className));
                }
            });
            const link = document.createElement('a');
            link.download = `market-heatmap-${market.toLowerCase()}-${new Date().toISOString().split('T')[0]}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) { console.error('Failed to save image', err); }
    }, [market]);

    useLayoutEffect(() => {
        const measure = () => {
            if (containerRef.current) {
                const { width } = containerRef.current.getBoundingClientRect();
                setContainerSize({ w: Math.round(width), h: Math.min(Math.round(width * 0.75), 780) });
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    const isSessionActive = useCallback((sessionType: string | undefined) => {
        if (!sessionType || market !== 'US') return false;
        // NYC is UTC-4 (DST) or UTC-5 (ST). 
        // Currently it's March 26, so it's DST (UTC-4).
        const now = new Date();
        const nycTime = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric', minute: 'numeric', hour12: false
        }).format(now);
        const [hour, minute] = nycTime.split(':').map(Number);
        const timeVal = hour + minute / 60;

        if (sessionType === 'PRE_MARKET') return timeVal >= 4 && timeVal < 9.5;
        if (sessionType === 'AFTER_MARKET' || sessionType === 'POST_MARKET') return timeVal >= 16 && timeVal < 20;
        return false;
    }, [market]);

    const displaySectors = useMemo(() => {
        return sectors.map(sec => {
            const stocks = sec.stocks.map(s => {
                const isActive = isSessionActive(s.overMarketSession);
                const cp = (isActive && s.overMarketPrice && s.overMarketChangePercent !== undefined) ? s.overMarketChangePercent : s.changePercent;
                const pr = (isActive && s.overMarketPrice) ? s.overMarketPrice : s.price;
                return { ...s, changePercent: cp, price: pr };
            });
            const totalCap = stocks.reduce((a, s) => a + s.cap, 0) || 1;
            const sectorChange = stocks.reduce((a, s) => a + s.changePercent * (s.cap / totalCap), 0);
            return { ...sec, stocks, changePercent: sectorChange };
        });
    }, [sectors, isSessionActive]);

    const sectorRects = useMemo(() => {
        if (!displaySectors.length) return [];
        return squarifyLayout(displaySectors.map(s => s.weight), 0, 0, containerSize.w, containerSize.h);
    }, [displaySectors, containerSize]);

    const fetchSectors = useCallback(async (m: 'US' | 'KR' | 'KOSDAQ') => {
        if (sectors.length === 0) setLoading(true);
        try {
            const [secRes, corrRes] = await Promise.all([
                fetch(`/api/analysis/sectors?market=${m}&t=${Date.now()}`),
                fetch(`/api/analysis/correlation?t=${Date.now()}`)
            ]);
            const json = await secRes.json();
            if (json.status) setMarketStatus(json.status);
            const raw = (json.sectors || []).filter((s: Sector) => s.weight > 0);
            if (raw.length > 0) {
                setSectors(raw);
                setLastFetched(new Date().toLocaleString('ko-KR', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false
                }).replace(/\. /g, '-').replace(/\.$/, ''));
            }
            if (corrRes.ok) setCorrelation(await corrRes.json());
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [sectors.length]);

    useEffect(() => {
        fetchSectors(market);
        const interval = setInterval(() => fetchSectors(market), 10000);
        return () => clearInterval(interval);
    }, [market, fetchSectors]);

    const marketChange = displaySectors.reduce((s, sec) => s + sec.changePercent * (sec.weight / 100), 0);

    return (
        <main style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto', color: 'var(--foreground)' }}>
            <style jsx global>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .stock-tile:hover {
                    filter: brightness(1.3) !important;
                    z-index: 5;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }
                .glass {
                    background: rgba(255, 255, 255, 0.03) !important;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                }
            `}</style>

            {/* Analysis Block - THIS IS THE CAPTURE AREA */}
            <div ref={heatmapRef} style={{ background: 'var(--background)', padding: '1.5rem', borderRadius: '20px' }}>
                <header style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Market Intelligence Report</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                            <h1 style={{ fontSize: '2.25rem', fontWeight: '900', letterSpacing: '-0.05em', lineHeight: 1, marginTop: '4px', textTransform: 'uppercase' }}>
                                {market === 'US' ? 'US STOCKS' : market === 'KR' ? 'KOSPI' : 'KOSDAQ'} HEATMAP
                            </h1>
                            <div
                                onMouseEnter={() => setHoverHelp(true)}
                                onMouseLeave={() => setHoverHelp(false)}
                                style={{ color: 'var(--muted)', cursor: 'help', padding: '4px', marginTop: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                            >
                                <Info size={20} />

                                {/* Premium Hover Tooltip */}
                                {hoverHelp && (
                                    <div style={{ position: 'absolute', top: '100%', left: '0', zIndex: 2000, width: '520px', marginTop: '12px', background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(20px)', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.08)', padding: '1.8rem', boxShadow: '0 30px 80px rgba(0,0,0,0.25)', pointerEvents: 'none', color: '#111' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Info size={18} color="white" />
                                            </div>
                                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#000' }}>시장 분석 가이드</h2>
                                        </div>

                                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                                            <section>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--primary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. 한미 증시 동조화 (US-KR Sync)</div>
                                                <p style={{ fontSize: '0.88rem', color: '#333', opacity: 0.9, lineHeight: 1.6 }}>
                                                    미국 시장(S&P 500)의 전일 종가와 한국 시장(KOSPI)의 금일 흐름 사이의 상관관계를 측정합니다.
                                                    <strong>'차트 상단 지수'</strong>가 이를 나타내며, 미국 증시의 영향력이 국내 증시에 얼마나 전이되고 있는지 보여줍니다.
                                                </p>
                                            </section>

                                            <section>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--primary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. 섹터별 영향력 (Sector Influence)</div>
                                                <p style={{ fontSize: '0.88rem', color: '#333', opacity: 0.9, lineHeight: 1.6 }}>
                                                    각 개별 섹터가 해당 시장의 <strong>전체 지수</strong>와 얼마나 같은 방향으로 움직이는지 나타냅니다.
                                                    <strong>'섹터 타일 내부 지수'</strong>와 <strong>'요약 테이블'</strong>에서 확인 가능하며, 섹터의 주도력과 시장 기여도를 판별하는 기준이 됩니다.
                                                </p>
                                            </section>

                                            <section>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--primary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. 산출 방식 (Methodology)</div>
                                                <p style={{ fontSize: '0.88rem', color: '#333', opacity: 0.9, lineHeight: 1.6 }}>
                                                    최근 거래일간의 <strong>피어슨 상관계수(Pearson Correlation)</strong>를 기반으로 산출됩니다.
                                                    수익률의 선형적 관계를 분석하여 -100% ~ 100% 사이의 값을 0~100% 척도로 변환하여 표시합니다. 한미 동조화는 미국의 T-1일과 한국의 T일 데이터를 비교하는 <strong>Time-Lagged</strong> 방식을 사용합니다.
                                                </p>
                                            </section>

                                            <section style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.03)', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.8rem', color: '#000' }}>📊 현재 수치 해석 가이드 (Range)</div>
                                                <div style={{ display: 'grid', gap: '0.6rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }}></span>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, width: '100px', color: '#111' }}>75% ~ 100%</span>
                                                        <span style={{ fontSize: '0.82rem', color: '#444' }}>[강력한 동행] 시장 주도 테마 또는 지수 견인 중</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }}></span>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, width: '100px', color: '#111' }}>40% ~ 75%</span>
                                                        <span style={{ fontSize: '0.82rem', color: '#444' }}>[보통 수준] 일반적인 시장 흐름에 따른 등락</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#999' }}></span>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, width: '100px', color: '#111' }}>0% ~ 40%</span>
                                                        <span style={{ fontSize: '0.82rem', color: '#444' }}>[개별 모멘텀] 지수와 무관한 독자적인 재료로 움직임</span>
                                                    </div>
                                                </div>
                                            </section>

                                            <div style={{ fontSize: '0.78rem', color: '#888', fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1rem', lineHeight: 1.4 }}>
                                                * 디커플링(Decoupling) 발생 시, 시장 전체 흐름과 반대로 가는 섹터를 주의 깊게 관찰하십시오. 이는 해당 섹터만의 특수 호재 혹은 악재를 시사합니다.
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}><span style={{ opacity: 0.6 }}>Updated:</span> {lastFetched}</div>
                                {(() => {
                                    const firstStock = sectors[0]?.stocks[0];
                                    const sessionType = firstStock?.overMarketSession;
                                    const sessionActive = isSessionActive(sessionType);
                                    
                                    let label = marketStatus === 'OPEN' ? '● 실시간' : (sessionActive && sessionType === 'PRE_MARKET' ? '● 프리마켓' : sessionActive && (sessionType === 'AFTER_MARKET' || sessionType === 'POST_MARKET') ? '● 애프터마켓' : market === 'US' ? '장마감 (전일종가)' : '장마감');
                                    let bg = 'rgba(0,0,0,0.05)';
                                    let color = '#666';
                                    let border = 'rgba(0,0,0,0.1)';

                                    if (marketStatus === 'OPEN') {
                                        bg = 'rgba(34,197,94,0.1)';
                                        color = '#16a34a';
                                        border = 'rgba(34,197,94,0.2)';
                                    } else if (sessionActive && sessionType === 'PRE_MARKET') {
                                        bg = 'rgba(234,179,8,0.15)';
                                        color = '#ca8a04';
                                        border = 'rgba(234,179,8,0.3)';
                                    } else if (sessionActive && (sessionType === 'AFTER_MARKET' || sessionType === 'POST_MARKET')) {
                                        bg = 'rgba(139,92,246,0.15)';
                                        color = '#7c3aed';
                                        border = 'rgba(139,92,246,0.3)';
                                    }

                                    return (
                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, padding: '3px 10px', borderRadius: '6px', background: bg, color: color, border: `1px solid ${border}`, whiteSpace: 'nowrap', transition: 'all 0.3s' }}>
                                            {label}
                                        </div>
                                    );
                                })()}
                            </div>
                            <div style={{ width: '1px', height: '12px', background: 'var(--border)' }}></div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: marketChange >= 0 ? '#dc2626' : '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: 'var(--foreground)', opacity: 0.8, fontWeight: 700 }}>{market === 'US' ? 'S&P 500' : market === 'KR' ? 'KOSPI' : 'KOSDAQ'}</span>
                                {marketChange >= 0 ? '▲' : '▼'} {Math.abs(marketChange).toFixed(2)}%
                            </div>

                            {correlation && (
                                <div
                                    onMouseEnter={() => setHoverSync(true)}
                                    onMouseLeave={() => setHoverSync(false)}
                                    style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'help' }}
                                >
                                    <div style={{ width: '1px', height: '12px', background: 'var(--border)' }}></div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ opacity: 0.6 }}> 한미 증시 동조화:</span>
                                            <span style={{ color: correlation.correlationLag > 0.6 ? '#dc2626' : 'var(--foreground)', fontWeight: 800 }}>{(correlation.correlationLag * 100).toFixed(1)}%</span>
                                            {correlation.correlationLagPrev !== undefined && (
                                                <span style={{ fontSize: '0.65rem', marginLeft: '2px', color: (correlation.correlationLag - correlation.correlationLagPrev) >= 0 ? '#dc2626' : '#2563eb', opacity: 0.9 }}>
                                                    {(correlation.correlationLag - (correlation.correlationLagPrev || 0)) >= 0 ? '▲' : '▼'}{(Math.abs(correlation.correlationLag - (correlation.correlationLagPrev || 0)) * 100).toFixed(1)}%p
                                                </span>
                                            )}
                                        </div>
                                        {/* Mini Sync Bar */}
                                        <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                                            <div style={{ width: `${correlation.correlationLag * 100}%`, height: '100%', background: correlation.correlationLag > 0.6 ? 'linear-gradient(90deg, #dc2626, #ef4444)' : 'linear-gradient(90deg, #444, #888)', borderRadius: '3px' }}></div>
                                        </div>
                                    </div>

                                    {/* Sync Trend Modal */}
                                    {hoverSync && correlation.correlationLagHistory && (
                                        <div style={{ position: 'absolute', top: '100%', right: '0', zIndex: 3000, marginTop: '12px', width: '340px', background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(20px)', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.08)', padding: '1.5rem', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', pointerEvents: 'none', color: '#111' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#000', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>한미 동조화 경향 (14D)</span>
                                                <span style={{ color: 'var(--primary)', opacity: 0.8 }}>Trend</span>
                                            </div>
                                            <div style={{ height: '120px', width: '100%', position: 'relative' }}>
                                                {(() => {
                                                    const history = correlation.correlationLagHistory!;
                                                    const values = history.map(h => h.value);
                                                    const minVal = Math.min(...values);
                                                    const maxVal = Math.max(...values);
                                                    const range = maxVal - minVal || 0.1;
                                                    // Add 15% padding top/bottom
                                                    const chartHeight = 120;
                                                    const yMin = Math.max(0, minVal - range * 0.15);
                                                    const yMax = Math.min(1, maxVal + range * 0.15);
                                                    const yRange = yMax - yMin;

                                                    const getY = (v: number) => chartHeight - ((v - yMin) / yRange) * chartHeight;
                                                    const points = history.map((h, i) => ({
                                                        x: (i / (history.length - 1)) * 240,
                                                        y: getY(h.value)
                                                    }));
                                                    const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
                                                    const areaD = `M 0,${chartHeight} L ${points.map(p => `${p.x},${p.y}`).join(' L ')} L 240,${chartHeight} Z`;

                                                    return (
                                                        <svg width="100%" height="100%" viewBox={`0 0 240 ${chartHeight}`} preserveAspectRatio="none">
                                                            <defs>
                                                                <linearGradient id="syncGrad" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                                                                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                                                                </linearGradient>
                                                            </defs>
                                                            <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                                            <path d={areaD} fill="url(#syncGrad)" />
                                                            
                                                            {/* Max/Min Labels - Larger and clearer */}
                                                            <text x="8" y="16" style={{ fontSize: '11px', fontWeight: 900, fill: 'var(--primary)', filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.5))' }}>MAX: {(maxVal * 100).toFixed(1)}%</text>
                                                            <text x="8" y={chartHeight - 10} style={{ fontSize: '11px', fontWeight: 900, fill: '#666', opacity: 0.8 }}>MIN: {(minVal * 100).toFixed(1)}%</text>
                                                        </svg>
                                                    );
                                                })()}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.65rem', color: '#888', fontWeight: 600 }}>
                                                <span>{correlation.correlationLagHistory[0].date.split('-').slice(1).join('/')}</span>
                                                <span>{correlation.correlationLagHistory[correlation.correlationLagHistory.length - 1].date.split('-').slice(1).join('/')}</span>
                                            </div>
                                            <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: '12px', paddingTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.6rem', color: '#999', textTransform: 'uppercase' }}>Avg Sync</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{(correlation.correlationLagHistory.reduce((a, b) => a + b.value, 0) / correlation.correlationLagHistory.length * 100).toFixed(1)}%</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.6rem', color: '#999', textTransform: 'uppercase' }}>Current</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{(correlation.correlationLag * 100).toFixed(1)}%</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Integrated Controls - Hidden in Capture */}
                    <div className="ignore-in-capture" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', background: 'var(--card)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            {(['KR', 'KOSDAQ', 'US'] as const).map(m => (
                                <button key={m} onClick={() => { setMarket(m); }} style={{ padding: '0.4rem 1.1rem', fontSize: '0.8rem', borderRadius: '7px', border: 'none', background: market === m ? 'var(--foreground)' : 'transparent', color: market === m ? 'var(--background)' : 'var(--muted)', cursor: 'pointer', fontWeight: 700, transition: 'all 0.18s', whiteSpace: 'nowrap' }}>
                                    {m === 'KR' ? '🇰🇷 KOSPI' : m === 'KOSDAQ' ? '🇰🇷 KOSDAQ' : '🇺🇸 S&P 500'}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleSaveImage} style={{ height: '34px', padding: '0 1rem', background: 'var(--card)', color: 'var(--foreground)', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.2s' }}>
                            <ImageIcon size={18} /> PNG 저장
                        </button>
                    </div>
                </header>

                <div ref={containerRef} style={{ width: '100%', height: containerSize.h, position: 'relative', background: 'var(--card)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', minHeight: 400 }}>
                    {sectorRects.map((rect, i) => {
                        const sec = displaySectors[i];
                        if (!sec) return null;
                        const sectorCorr = market === 'US' ? correlation?.sectorCorrelations?.[sec.id] : market === 'KR' ? correlation?.krSectorCorrelations?.[sec.id] : correlation?.kqSectorCorrelations?.[sec.id];
                        return <SectorTile key={sec.id} sector={sec} rect={rect} correlation={sectorCorr} onHover={(s, e) => { setHoveredStock(s); if (e) setMousePos({ x: e.clientX, y: e.clientY }); }} />;
                    })}
                    {loading && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'white', background: sectors.length > 0 ? 'rgba(0,0,0,0.3)' : 'var(--card)', backdropFilter: sectors.length > 0 ? 'blur(4px)' : 'none', zIndex: 10 }}>
                            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{sectors.length > 0 ? '업데이트 중...' : '시장 데이터 로딩 중...'}</span>
                        </div>
                    )}
                </div>

                {!loading && displaySectors.length > 0 && (
                    <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        {LEGEND.map(l => (
                            <div key={l.label} style={{
                                minWidth: 50, height: 26, background: l.bg, borderRadius: 5, border: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.78rem', fontWeight: 800, color: l.text,
                                padding: '0 10px' // Same padding for all, box will widen as needed
                            }}>
                                {l.label}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {!loading && displaySectors.length > 0 && (
                <div style={{ marginTop: '4rem', marginBottom: '4rem' }}>
                    <div style={{ textAlign: 'left', maxWidth: '1080px', margin: '0 auto', padding: '0 1rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '16px', height: '2px', background: 'var(--primary)' }}></div>
                            Advanced Market Dynamics Analysis
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.04em', marginBottom: '2.5rem' }}>섹터 별 시장 점유율 및 영향력</h2>
                    </div>

                    <div className="glass" style={{ width: '100%', maxWidth: '1080px', margin: '0 auto', overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '24px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                                    <th style={{ padding: '1.5rem', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', width: '18%', textAlign: 'center' }}>섹터 구분</th>
                                    <th onClick={() => setSortConfig({ key: 'weight', direction: sortConfig.key === 'weight' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })} style={{ padding: '1.5rem', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800, textAlign: 'center', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', width: '12%' }}>
                                        시장 점유율 {sortConfig.key === 'weight' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                    </th>
                                    <th onClick={() => setSortConfig({ key: 'performance', direction: sortConfig.key === 'performance' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })} style={{ padding: '1.5rem', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800, textAlign: 'center', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', width: '12%' }}>
                                        변동률 {sortConfig.key === 'performance' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                    </th>
                                    <th style={{ padding: '1.5rem', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', width: '24%' }}>거래량 상위 종목</th>
                                    <th onClick={() => setSortConfig({ key: 'influence', direction: sortConfig.key === 'influence' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })} style={{ padding: '1.5rem', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800, textAlign: 'right', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', width: '17%' }}>
                                        지수 영향력 {sortConfig.key === 'influence' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                    </th>
                                    <th onClick={() => setSortConfig({ key: 'sync', direction: sortConfig.key === 'sync' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })} style={{ padding: '1.5rem', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800, textAlign: 'right', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', width: '17%' }}>
                                        한미 동조화 {sortConfig.key === 'sync' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...displaySectors].sort((a, b) => {
                                    if (sortConfig.key === 'performance') return sortConfig.direction === 'desc' ? b.changePercent - a.changePercent : a.changePercent - b.changePercent;
                                    if (sortConfig.key === 'weight') return sortConfig.direction === 'desc' ? b.weight - a.weight : a.weight - b.weight;
                                    
                                    const valA = sortConfig.key === 'influence' 
                                        ? (market === 'US' ? correlation?.sectorCorrelations?.[a.id] : market === 'KR' ? correlation?.krSectorCorrelations?.[a.id] : (correlation as any)?.kqSectorCorrelations?.[a.id])
                                        : correlation?.sectorSync?.[a.id];
                                    const valB = sortConfig.key === 'influence'
                                        ? (market === 'US' ? correlation?.sectorCorrelations?.[b.id] : market === 'KR' ? correlation?.krSectorCorrelations?.[b.id] : (correlation as any)?.kqSectorCorrelations?.[b.id])
                                        : correlation?.sectorSync?.[b.id];

                                    return sortConfig.direction === 'desc' ? (valB || 0) - (valA || 0) : (valA || 0) - (valB || 0);
                                }).map((sec, idx) => {
                                    const c = getColor(sec.changePercent);
                                    const sectorCorr = market === 'US' ? correlation?.sectorCorrelations?.[sec.id] : market === 'KR' ? correlation?.krSectorCorrelations?.[sec.id] : (correlation as any)?.kqSectorCorrelations?.[sec.id];
                                    const sectorSync = correlation?.sectorSync?.[sec.id];

                                    // Identify Top Drivers based on Trading Value
                                    const sortedByValue = [...sec.stocks].sort((a, b) => (b.tradingValue || 0) - (a.tradingValue || 0));
                                    const mainDriver = sortedByValue[0];
                                    const subDriver = sortedByValue[1];
                                    const thirdDriver = sortedByValue[2];

                                    const formatValue = (v: number | undefined | null) => {
                                        if (v === undefined || v === null) return '0';
                                        const isUS = market === 'US';
                                        const prefix = isUS ? '$' : '₩';
                                        let val = '';
                                        if (isUS) {
                                            if (v >= 1e12) val = `${(v / 1e12).toFixed(1)}T`;
                                            else if (v >= 1e9) val = `${(v / 1e9).toFixed(1)}B`;
                                            else if (v >= 1e6) val = `${(v / 1e6).toFixed(1)}M`;
                                            else val = v.toLocaleString();
                                        } else {
                                            if (v >= 1e12) val = `${(v / 1e12).toFixed(1)}조`;
                                            else if (v >= 1e8) val = `${(v / 1e8).toFixed(1)}억`;
                                            else val = v.toLocaleString();
                                        }
                                        return `${prefix}${val}`;
                                    };

                                    return (
                                        <tr key={sec.id} style={{ borderBottom: idx === displaySectors.length - 1 ? 'none' : '1px solid var(--border)', transition: 'all 0.2s', cursor: 'default' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '1.5rem', textAlign: 'center' }}>
                                                <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{sec.name}</div>
                                            </td>
                                            <td style={{ padding: '1.5rem', textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--foreground)' }}>{sec.weight.toFixed(1)}%</div>
                                            </td>
                                            <td style={{ padding: '1.5rem', textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', padding: '0.5rem 1rem', background: c.bg, color: c.text, borderRadius: '10px', fontWeight: 900, fontSize: '1.1rem', border: `1px solid ${c.border}`, minWidth: '85px', justifyContent: 'center', boxShadow: `0 4px 15px ${c.border}22` }}>
                                                    {sec.changePercent >= 0 ? '+' : ''}{sec.changePercent.toFixed(2)}%
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.5rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', whiteSpace: 'nowrap' }}>
                                                    {mainDriver && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                                                            <div style={{ width: '28px', textAlign: 'center', fontSize: '0.6rem', fontWeight: 900, background: 'var(--primary)', color: 'white', padding: '1px 3px', borderRadius: '4px', lineHeight: 1 }}>1st</div>
                                                            <span style={{ fontWeight: 800, color: 'var(--foreground)' }}>{mainDriver.name}</span>
                                                            <span style={{ fontSize: '0.75rem', color: mainDriver.changePercent >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 800 }}>{mainDriver.changePercent >= 0 ? '+' : ''}{mainDriver.changePercent.toFixed(1)}%</span>
                                                            {mainDriver.tradingValue > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 600 }}>({formatValue(mainDriver.tradingValue)})</span>}
                                                        </div>
                                                    )}
                                                    {subDriver && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                                                            <div style={{ width: '28px', textAlign: 'center', fontSize: '0.6rem', fontWeight: 900, background: 'rgba(255,255,255,0.1)', color: 'var(--muted)', padding: '1px 3px', borderRadius: '4px', lineHeight: 1 }}>2nd</div>
                                                            <span style={{ fontWeight: 600, color: 'var(--foreground)', opacity: 0.85 }}>{subDriver.name}</span>
                                                            <span style={{ fontSize: '0.75rem', color: subDriver.changePercent >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 700 }}>{subDriver.changePercent >= 0 ? '+' : ''}{subDriver.changePercent.toFixed(1)}%</span>
                                                            {subDriver.tradingValue > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 500 }}>({formatValue(subDriver.tradingValue)})</span>}
                                                        </div>
                                                    )}
                                                    {thirdDriver && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                                                            <div style={{ width: '28px', textAlign: 'center', fontSize: '0.6rem', fontWeight: 900, background: 'rgba(255,255,255,0.1)', color: 'var(--muted)', padding: '1px 3px', borderRadius: '4px', lineHeight: 1 }}>3rd</div>
                                                            <span style={{ fontWeight: 600, color: 'var(--foreground)', opacity: 0.85 }}>{thirdDriver.name}</span>
                                                            <span style={{ fontSize: '0.75rem', color: thirdDriver.changePercent >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 700 }}>{thirdDriver.changePercent >= 0 ? '+' : ''}{thirdDriver.changePercent.toFixed(1)}%</span>
                                                            {thirdDriver.tradingValue > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 500 }}>({formatValue(thirdDriver.tradingValue)})</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.5rem', textAlign: 'right' }}>
                                                {sectorCorr !== undefined ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 900, color: sectorCorr > 0.65 ? '#dc2626' : 'var(--foreground)' }}>
                                                            {(sectorCorr * 100).toFixed(1)}%
                                                        </div>
                                                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--muted)', marginTop: '2px', textTransform: 'uppercase', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)' }}>
                                                            {sectorCorr > 0.75 ? 'Critical' : sectorCorr > 0.4 ? 'Matched' : 'Decoupled'}
                                                        </div>
                                                    </div>
                                                ) : <span style={{ color: 'var(--muted)', opacity: 0.5 }}>-</span>}
                                            </td>
                                            <td style={{ padding: '1.5rem', textAlign: 'right' }}>
                                                {sectorSync !== undefined ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 900, color: sectorSync > 0.6 ? '#dc2626' : 'var(--foreground)' }}>
                                                            {(sectorSync * 100).toFixed(1)}%
                                                        </div>
                                                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--primary)', opacity: 0.8, marginTop: '2px', textTransform: 'uppercase', padding: '1px 5px', borderRadius: '4px', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                                                            {sectorSync > 0.6 ? 'High Sync' : 'Low Sync'}
                                                        </div>
                                                    </div>
                                                ) : <span style={{ color: 'var(--muted)', opacity: 0.5 }}>-</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {hoveredStock && (
                <div style={{ position: 'fixed', left: mousePos.x + 15, top: mousePos.y + 15, zIndex: 1000, pointerEvents: 'none', background: 'rgba(15, 15, 15, 0.95)', border: `1px solid ${getColor(hoveredStock.changePercent).border}`, borderRadius: '10px', padding: '0.75rem 1rem', boxShadow: '0 12px 40px rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', minWidth: '180px' }}>
                    <div style={{ marginBottom: '0.45rem', display: 'flex', flexDirection: 'column' }}><span style={{ color: 'white', fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{hoveredStock.name}</span>{hoveredStock.name !== hoveredStock.symbol && (<span style={{ color: '#888', fontWeight: 700, fontSize: '0.8rem', marginTop: '1px' }}>{hoveredStock.symbol}</span>)}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.8rem' }}><div style={{ fontSize: '1.45rem', fontWeight: 900, color: getColor(hoveredStock.changePercent).text }}>{hoveredStock.changePercent >= 0 ? '+' : ''}{hoveredStock.changePercent.toFixed(2)}%</div><div style={{ fontSize: '1rem', fontWeight: 700, color: '#bbb' }}>{market === 'US' ? '$' : '₩'}{hoveredStock.price?.toLocaleString()}</div></div>
                </div>
            )}
        </main>
    );
}
