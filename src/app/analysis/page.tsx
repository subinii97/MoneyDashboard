'use client';

import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { RefreshCw, ImageIcon, Info, X } from 'lucide-react';
import { toPng } from 'html-to-image';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stock {
    symbol: string;
    name: string;
    cap: number;
    changePercent: number;
    price: number;
}

interface Sector {
    id: string;
    name: string;
    weight: number;
    changePercent: number;
    stocks: Stock[];
}

interface Rect { x: number; y: number; w: number; h: number; }

// ── Squarified treemap algorithm ───────────────────────────────────────────────
function squarifyLayout(
    values: number[],
    x: number, y: number, w: number, h: number
): Rect[] {
    if (!values.length) return [];
    const total = values.reduce((s, v) => s + v, 0);
    const areas = values.map(v => (v / total) * w * h);
    const result: Rect[] = new Array(values.length);

    function worstAspect(row: number[], rowW: number): number {
        const rowSum = row.reduce((s, a) => s + a, 0);
        const rowH = rowSum / rowW;
        let worst = 0;
        for (const a of row) {
            const cellW = rowW > 0 ? a / rowH : 0;
            const ratio = Math.max(rowH / cellW, cellW / rowH);
            if (ratio > worst) worst = ratio;
        }
        return worst;
    }

    function layout(indices: number[], ix: number, iy: number, iw: number, ih: number) {
        if (!indices.length) return;
        if (indices.length === 1) {
            result[indices[0]] = { x: ix, y: iy, w: iw, h: ih };
            return;
        }

        const iAreas = indices.map(i => areas[i]);
        const iTotal = iAreas.reduce((s, a) => s + a, 0);
        const lays: Array<{ split: number; aspect: number }> = [];
        let cumArea = 0;
        for (let k = 0; k < indices.length - 1; k++) {
            cumArea += iAreas[k];
            const rowDir = iw >= ih;
            const bandW = rowDir ? (iTotal > 0 ? (cumArea / iTotal) * iw : 0) : iw;
            const bandH = rowDir ? ih : (iTotal > 0 ? (cumArea / iTotal) * ih : 0);
            const row = iAreas.slice(0, k + 1);
            const aspect = worstAspect(row, rowDir ? bandH : bandW);
            lays.push({ split: k + 1, aspect });
        }

        let bestSplit = 1;
        let bestAspect = Infinity;
        for (const l of lays) {
            if (l.aspect < bestAspect) { bestAspect = l.aspect; bestSplit = l.split; }
        }

        const leftIndices = indices.slice(0, bestSplit);
        const rightIndices = indices.slice(bestSplit);
        const leftArea = leftIndices.reduce((s, i) => s + areas[i], 0);

        if (iw >= ih) {
            const leftW = iTotal > 0 ? (leftArea / iTotal) * iw : 0;
            let cy = iy;
            for (const i of leftIndices) {
                const cellH = leftArea > 0 ? (areas[i] / leftArea) * ih : 0;
                result[i] = { x: ix, y: cy, w: leftW, h: cellH };
                cy += cellH;
            }
            layout(rightIndices, ix + leftW, iy, iw - leftW, ih);
        } else {
            const topH = iTotal > 0 ? (leftArea / iTotal) * ih : 0;
            let cx = ix;
            for (const i of leftIndices) {
                const cellW = leftArea > 0 ? (areas[i] / leftArea) * iw : 0;
                result[i] = { x: cx, y: iy, w: cellW, h: topH };
                cx += cellW;
            }
            layout(rightIndices, ix, iy + topH, iw, ih - topH);
        }
    }

    const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const origAreas = [...areas];
    sorted.forEach((s, k) => { areas[k] = origAreas[s.i]; });
    layout(sorted.map((_, k) => k), x, y, w, h);
    const finalResult: Rect[] = new Array(values.length);
    sorted.forEach((s, k) => { finalResult[s.i] = result[k]; });
    return finalResult;
}

function getColor(inputPct: number) {
    const pct = Math.round(inputPct * 100) / 100;
    if (pct === 0) return { bg: '#252528', text: '#777', border: '#333' }; // Neutral (Base level)

    if (pct > 0) {
        if (pct >= 5.0) return { bg: '#ff1a1a', text: '#fff', border: '#ff7875' };      // explosive (Vivid)
        if (pct >= 3.0) return { bg: '#d91818', text: '#f5f5f5', border: '#ff7875' };  // strong
        if (pct >= 2.0) return { bg: '#b31515', text: '#e0e0e0', border: '#ffa39e' };  // moderate
        if (pct >= 1.0) return { bg: '#8c1212', text: '#bdbdbd', border: '#cf1322' };  // slight
        return { bg: '#45121a', text: '#9e9e9e', border: '#a8071a' };                   // trace
    } else {
        const abs = Math.abs(pct);
        if (abs >= 5.0) return { bg: '#006fff', text: '#fff', border: '#69c0ff' };      // explosive (Electric Blue)
        if (abs >= 3.0) return { bg: '#1677ff', text: '#f5f5f5', border: '#40a9ff' };  // strong (Vivid)
        if (abs >= 2.0) return { bg: '#0050b3', text: '#e0e0e0', border: '#1890ff' };  // moderate
        if (abs >= 1.0) return { bg: '#003a8c', text: '#bdbdbd', border: '#096dd9' };  // slight
        return { bg: '#101a33', text: '#9e9e9e', border: '#001d66' };                   // trace
    }
}

const GAP = 1.0;
const SECTOR_GAP = 1.2;
const HEADER_H = 28;
const CONTENT_PADDING = 0.5;

function StockTile({ stock, rect, onHover }: { stock: Stock; rect: Rect; onHover: (s: Stock | null, e: React.MouseEvent) => void }) {
    const c = getColor(stock.changePercent);
    const w = rect.w - GAP;
    const h = rect.h - GAP;
    const area = w * h;
    const sizeFromArea = Math.sqrt(area) / 4.8;
    const baseSize = Math.min(sizeFromArea, w / 1.1, h / 1.1);
    const nameFontSize = Math.max(9, Math.min(baseSize, 32));
    const pctFontSize = Math.max(8, Math.min(baseSize * 0.85, 24));
    const showSymbol = h > 18 && w > 30;
    const showPct = h > 28 && w > 34;

    return (
        <div
            onMouseEnter={(e) => onHover(stock, e)}
            onMouseMove={(e) => onHover(stock, e)}
            onMouseLeave={() => onHover(null, null as any)}
            className="stock-tile"
            style={{
                position: 'absolute', left: rect.x + GAP / 2, top: rect.y + GAP / 2,
                width: w, height: h, background: c.bg, border: 'none',
                borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', cursor: 'pointer', boxSizing: 'border-box',
                transition: 'filter 0.2s',
            }}
        >
            {showSymbol && (
                <div style={{ color: c.text, fontWeight: 800, fontSize: nameFontSize, lineHeight: 1.1, textAlign: 'center', padding: '0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {/^\d+$/.test(stock.symbol) ? stock.name : stock.symbol}
                </div>
            )}
            {showPct && (
                <div style={{ color: c.text, fontWeight: 700, fontSize: pctFontSize, lineHeight: 1.1, marginTop: 1 }}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </div>
            )}
        </div>
    );
}

function SectorTile({ sector, rect, onHover, correlation }: { sector: Sector; rect: Rect; onHover: (s: Stock | null, e: React.MouseEvent) => void; correlation?: number; }) {
    const c = getColor(sector.changePercent);
    const innerW = rect.w - SECTOR_GAP;
    const innerH = rect.h - SECTOR_GAP;
    const contentH = innerH - HEADER_H;
    const stocks = [...sector.stocks].filter(s => s.price > 0).sort((a, b) => b.cap - a.cap);
    const caps = stocks.map(s => s.cap);
    const layoutW = innerW - CONTENT_PADDING * 2;
    const layoutH = contentH - CONTENT_PADDING * 2;
    const stockRects = squarifyLayout(caps, 0, 0, layoutW, layoutH);

    return (
        <div style={{ position: 'absolute', left: rect.x + SECTOR_GAP / 2, top: rect.y + SECTOR_GAP / 2, width: innerW, height: innerH, background: 'transparent', borderRadius: 4, overflow: 'hidden', boxSizing: 'border-box' }}>
            <div style={{ height: HEADER_H, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <span style={{ color: c.text, fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sector.name}</span>
                    {correlation !== undefined && (
                        <span style={{ fontSize: '10.5px', fontWeight: 900, color: correlation > 0.6 ? '#f87171' : '#eee', backgroundColor: 'rgba(0,0,0,0.4)', padding: '2px 5px', borderRadius: '5px', border: `1px solid ${correlation > 0.6 ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.15)'}`, whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                            🔗 {correlation.toFixed(2)}
                        </span>
                    )}
                </div>
                <span style={{ color: c.text, fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', marginLeft: 6, opacity: 0.9 }}>
                    {sector.changePercent >= 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
                </span>
            </div>
            <div style={{ position: 'relative', width: innerW, height: contentH, overflow: 'hidden' }}>
                {stocks.map((stock, i) => stockRects[i] && (
                    <StockTile key={stock.symbol} stock={stock} rect={{ ...stockRects[i], x: stockRects[i].x + CONTENT_PADDING, y: stockRects[i].y + CONTENT_PADDING }} onHover={onHover} />
                ))}
            </div>
        </div>
    );
}

const LEGEND = [
    { label: '-5%+', ...getColor(-5.5) }, { label: '-3%', ...getColor(-3.5) }, { label: '-2%', ...getColor(-2.5) }, { label: '-1%', ...getColor(-1.5) },
    { label: '0%', ...getColor(0) },
    { label: '+1%', ...getColor(1.5) }, { label: '+2%', ...getColor(2.5) }, { label: '+3%', ...getColor(3.5) }, { label: '+5%+', ...getColor(5.5) },
];

export default function AnalysisPage() {
    const [market, setMarket] = useState<'US' | 'KR' | 'KOSDAQ'>('KR');
    const [marketStatus, setMarketStatus] = useState<'OPEN' | 'CLOSED'>('CLOSED');
    const [hoverSync, setHoverSync] = useState(false);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastFetched, setLastFetched] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: 'performance' | 'coupling' | 'weight', direction: 'desc' | 'asc' }>({ key: 'performance', direction: 'desc' });
    const [correlation, setCorrelation] = useState<{ 
        correlationLag: number; 
        correlationLagPrev?: number;
        correlationLagHistory?: { date: string, value: number }[];
        sectorCorrelations?: Record<string, number>; 
        krSectorCorrelations?: Record<string, number>; 
        kqSectorCorrelations?: Record<string, number>; 
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
                backgroundColor: 'var(--background)',
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

    const sectorRects = useMemo(() => {
        if (!sectors.length) return [];
        return squarifyLayout(sectors.map(s => s.weight), 0, 0, containerSize.w, containerSize.h);
    }, [sectors, containerSize]);

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

    const marketChange = sectors.reduce((s, sec) => s + sec.changePercent * (sec.weight / 100), 0);

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
            <div ref={heatmapRef} style={{ background: 'var(--background)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: 600 }}><span style={{ opacity: 0.6 }}>Updated:</span> {lastFetched}</div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: marketStatus === 'OPEN' ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.05)', color: marketStatus === 'OPEN' ? '#16a34a' : '#666', border: marketStatus === 'OPEN' ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(0,0,0,0.1)', whiteSpace: 'nowrap' }}>
                                    {marketStatus === 'OPEN' ? '● 실시간' : market === 'US' ? '장마감 (전일종가)' : '장마감'}
                                </div>
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
                                                <span style={{ fontSize: '0.65rem', marginLeft: '2px', color: (correlation.correlationLag - correlation.correlationLagPrev) >= 0 ? '#16a34a' : '#dc2626', opacity: 0.9 }}>
                                                    {(correlation.correlationLag - (correlation.correlationLagPrev || 0)) >= 0 ? '▲' : '▼'}{(Math.abs(correlation.correlationLag - (correlation.correlationLagPrev || 0)) * 100).toFixed(1)}%
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
                                        <div style={{ position: 'absolute', top: '100%', right: '0', zIndex: 3000, marginTop: '12px', width: '280px', background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(20px)', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.08)', padding: '1.25rem', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', pointerEvents: 'none', color: '#111' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#000', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>한미 동조화 경향 (14D)</span>
                                                <span style={{ color: 'var(--primary)', opacity: 0.8 }}>Trend</span>
                                            </div>
                                            <div style={{ height: '80px', width: '100%', position: 'relative' }}>
                                                <svg width="100%" height="100%" viewBox="0 0 240 80" preserveAspectRatio="none">
                                                    <defs>
                                                        <linearGradient id="syncGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                                                            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                                                        </linearGradient>
                                                    </defs>
                                                    <path
                                                        d={`M ${correlation.correlationLagHistory.map((h, i) => `${(i / (correlation.correlationLagHistory!.length - 1)) * 240},${80 - h.value * 80}`).join(' L ')}`}
                                                        fill="none"
                                                        stroke="var(--primary)"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                    <path
                                                        d={`M 0,80 L ${correlation.correlationLagHistory.map((h, i) => `${(i / (correlation.correlationLagHistory!.length - 1)) * 240},${80 - h.value * 80}`).join(' L ')} L 240,80 Z`}
                                                        fill="url(#syncGrad)"
                                                    />
                                                </svg>
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
                                                    <div style={{ fontSize: '0.6rem', color: '#999', textTransform: 'uppercase' }}>Peak</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{(Math.max(...correlation.correlationLagHistory.map(h => h.value)) * 100).toFixed(1)}%</div>
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
                                <button key={m} onClick={() => setMarket(m)} style={{ padding: '0.4rem 1.1rem', fontSize: '0.8rem', borderRadius: '7px', border: 'none', background: market === m ? 'var(--foreground)' : 'transparent', color: market === m ? 'var(--background)' : 'var(--muted)', cursor: 'pointer', fontWeight: 700, transition: 'all 0.18s', whiteSpace: 'nowrap' }}>
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
                        const sec = sectors[i];
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

                {!loading && sectors.length > 0 && (
                    <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        {LEGEND.map(l => (
                            <div key={l.label} style={{ width: 50, height: 26, background: l.bg, borderRadius: 5, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, color: l.text }}>{l.label}</div>
                        ))}
                    </div>
                )}
            </div>

            {!loading && sectors.length > 0 && (
                <div style={{ marginTop: '3.5rem', marginBottom: '2rem' }}>
                    <div style={{ textAlign: 'left', fontSize: '0.75rem', color: '#888', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', paddingLeft: '8px', marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '960px', margin: '0 auto' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                        Market Sector Performance & Influence Insight
                    </div>
                    <div className="glass" style={{ width: '100%', maxWidth: '960px', margin: '0 auto', overflowX: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(var(--primary-glow-rgb), 0.05)' }}>
                                    <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 800 }}>SECTOR NAME</th>
                                    <th onClick={() => setSortConfig({ key: 'weight', direction: sortConfig.key === 'weight' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })} style={{ padding: '1.25rem 1.5rem', fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 800, textAlign: 'right', cursor: 'pointer' }}>MARKET SHARE {sortConfig.key === 'weight' ? (sortConfig.direction === 'desc' ? '▼' : '▲') : ''}</th>
                                    <th onClick={() => setSortConfig({ key: 'performance', direction: sortConfig.key === 'performance' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })} style={{ padding: '1.25rem 1.5rem', fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 800, textAlign: 'right', cursor: 'pointer' }}>PERFORMANCE {sortConfig.key === 'performance' ? (sortConfig.direction === 'desc' ? '▼' : '▲') : ''}</th>
                                    <th onClick={() => setSortConfig({ key: 'coupling', direction: sortConfig.key === 'coupling' && sortConfig.direction === 'desc' ? 'asc' : 'desc' })} style={{ padding: '1.25rem 1.5rem', fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 800, textAlign: 'right', cursor: 'pointer' }}>INFLUENCE {sortConfig.key === 'coupling' ? (sortConfig.direction === 'desc' ? '▼' : '▲') : ''}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...sectors].sort((a, b) => {
                                    if (sortConfig.key === 'performance') return sortConfig.direction === 'desc' ? b.changePercent - a.changePercent : a.changePercent - b.changePercent;
                                    if (sortConfig.key === 'weight') return sortConfig.direction === 'desc' ? b.weight - a.weight : a.weight - b.weight;
                                    const corrA = (market === 'US' ? correlation?.sectorCorrelations?.[a.id] : market === 'KR' ? correlation?.krSectorCorrelations?.[a.id] : (correlation as any)?.kqSectorCorrelations?.[a.id]) || 0;
                                    const corrB = (market === 'US' ? correlation?.sectorCorrelations?.[b.id] : market === 'KR' ? correlation?.krSectorCorrelations?.[b.id] : (correlation as any)?.kqSectorCorrelations?.[b.id]) || 0;
                                    return sortConfig.direction === 'desc' ? corrB - corrA : corrA - corrB;
                                }).map((sec, idx) => {
                                    const c = getColor(sec.changePercent);
                                    const sectorCorr = market === 'US' ? correlation?.sectorCorrelations?.[sec.id] : market === 'KR' ? correlation?.krSectorCorrelations?.[sec.id] : correlation?.kqSectorCorrelations?.[sec.id];
                                    return (
                                        <tr key={sec.id} style={{ borderBottom: idx === sectors.length - 1 ? 'none' : '1px solid var(--border)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--card-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '1.2rem 1.5rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ width: '6px', height: '24px', borderRadius: '3px', background: c.border }}></div><span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--foreground)' }}>{sec.name}</span></div></td>
                                            <td style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}><div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)' }}>{sec.weight.toFixed(1)}%</div></td>
                                            <td style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}><div style={{ display: 'inline-flex', padding: '0.4rem 0.8rem', background: c.bg, color: c.text, borderRadius: '8px', fontWeight: 900, fontSize: '0.95rem', border: `1px solid ${c.border}`, minWidth: '70px', justifyContent: 'center' }}>{sec.changePercent >= 0 ? '+' : ''}{sec.changePercent.toFixed(2)}%</div></td>
                                            <td style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}>{sectorCorr !== undefined ? (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 900, color: sectorCorr > 0.6 ? '#f87171' : 'var(--foreground)' }}><span style={{ fontSize: '0.9rem', opacity: 0.5 }}>🔗</span>{(sectorCorr * 100).toFixed(1)}%</div><div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', marginTop: '2px', textTransform: 'uppercase' }}>{sectorCorr > 0.6 ? 'High Influence' : 'Moderate'}</div></div>) : (<span style={{ color: 'var(--muted)' }}>–</span>)}</td>
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
