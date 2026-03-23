'use client';

import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';

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
interface LayoutItem extends Rect { idx: number; }

function squarifyLayout(
    values: number[],          // size of each item (e.g. market cap or sector weight)
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

    function layout(
        indices: number[], ix: number, iy: number, iw: number, ih: number
    ) {
        if (!indices.length) return;
        if (indices.length === 1) {
            result[indices[0]] = { x: ix, y: iy, w: iw, h: ih };
            return;
        }

        const iAreas = indices.map(i => areas[i]);
        const iTotal = iAreas.reduce((s, a) => s + a, 0);

        // Try horizontal strip
        const lays: Array<{ split: number; aspect: number }> = [];
        let cumArea = 0;
        for (let k = 0; k < indices.length - 1; k++) {
            cumArea += iAreas[k];
            const stripW = iw >= ih ? cumArea / ih : iw;
            const stripH = iw >= ih ? ih : cumArea / iw;
            const stripArea = iw >= ih ? cumArea : cumArea;
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

        const leftIndices  = indices.slice(0, bestSplit);
        const rightIndices = indices.slice(bestSplit);
        const leftArea     = leftIndices.reduce((s, i) => s + areas[i], 0);
        const rightArea    = rightIndices.reduce((s, i) => s + areas[i], 0);

        if (iw >= ih) {
            // Horizontal split
            const leftW = iTotal > 0 ? (leftArea / iTotal) * iw : 0;
            // Place left column (vertical strip)
            let cy = iy;
            for (const i of leftIndices) {
                const cellH = leftArea > 0 ? (areas[i] / leftArea) * ih : 0;
                result[i] = { x: ix, y: cy, w: leftW, h: cellH };
                cy += cellH;
            }
            layout(rightIndices, ix + leftW, iy, iw - leftW, ih);
        } else {
            // Vertical split
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

    // Sort descending by area, keep track of original indices
    const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    // Override areas with sorted values for layout computation
    const origAreas = [...areas];
    sorted.forEach((s, k) => { areas[k] = origAreas[s.i]; });
    const remapped = sorted.map((_, k) => k);
    layout(remapped, x, y, w, h);
    // Map back to original indices
    const finalResult: Rect[] = new Array(values.length);
    sorted.forEach((s, k) => { finalResult[s.i] = result[k]; });
    // Restore areas
    sorted.forEach((s, k) => { areas[s.i] = origAreas[s.i]; });
    return finalResult;
}

// ── Color helpers (Korean convention: red=up, blue=down) ────────────────────
// ── Color helpers (Korean convention: red=up, blue=down) ────────────────────
function getColor(pct: number) {
    if (pct === 0)   return { bg: '#1a1a1a', text: '#ccc', border: '#444' };
    if (pct > 0) {
        if (pct >= 4)    return { bg: '#3b0a0a', text: '#f87171', border: '#dc2626' };
        if (pct >= 2)    return { bg: '#5c1111', text: '#fca5a5', border: '#c41e1e' };
        if (pct >= 0.75) return { bg: '#7f1d1d', text: '#fecaca', border: '#b91c1c' };
        return                { bg: '#4a1919', text: '#fda4a4', border: '#7f1d1d' };
    } else {
        if (pct <= -4)   return { bg: '#0a1d4a', text: '#93c5fd', border: '#1d4ed8' };
        if (pct <= -2)   return { bg: '#0c2e6b', text: '#bfdbfe', border: '#2563eb' };
        if (pct <= -0.75)return { bg: '#0f3a8f', text: '#dbeafe', border: '#3b82f6' };
        return                { bg: '#0f172a', text: '#93c5fd', border: '#1e3a5f' };
    }
}


const GAP = 1.5;    // px gap between tiles
const SECTOR_GAP = 2; // px gap between sectors
const HEADER_H = 24; // sector header height

// ── Stock Tile ─────────────────────────────────────────────────────────────────
function StockTile({ stock, rect, onHover }: { stock: Stock; rect: Rect; onHover: (s: Stock | null, e: React.MouseEvent) => void }) {
    const c = getColor(stock.changePercent);
    const w = rect.w - GAP;
    const h = rect.h - GAP;
    const area = w * h;

    // Dynamically calculate font size based on tile size
    const baseSize = Math.min(w / 4.2, h / 2.2);
    const nameFontSize = Math.max(9, Math.min(baseSize, 24));
    const pctFontSize = Math.max(8, Math.min(baseSize * 0.88, 20));

    const showSymbol = h > 18 && w > 30;
    const showPct    = h > 28 && w > 34;

    return (
        <div
            onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.4)';
                onHover(stock, e);
            }}
            onMouseMove={(e) => onHover(stock, e)}
            onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'brightness(1)';
                onHover(null, null as any);
            }}
            style={{
                position: 'absolute',
                left: rect.x + GAP / 2, top: rect.y + GAP / 2,
                width: w, height: h,
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 2,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'filter 0.1s',
                boxSizing: 'border-box',
            }}
        >
            {showSymbol && (
                <div style={{
                    color: c.text, fontWeight: 800,
                    fontSize: nameFontSize,
                    lineHeight: 1.1, textAlign: 'center',
                    padding: '0 2px', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                }}>
                    {/^\d+$/.test(stock.symbol) ? stock.name : stock.symbol}
                </div>
            )}

            {showPct && (
                <div style={{
                    color: c.text, fontWeight: 700,
                    fontSize: pctFontSize,
                    lineHeight: 1.1, marginTop: 1,
                }}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </div>
            )}
        </div>
    );
}




// ── Sector Tile ────────────────────────────────────────────────────────────────
function SectorTile({ sector, rect, onHover }: { sector: Sector; rect: Rect; onHover: (s: Stock | null, e: React.MouseEvent) => void }) {
    const c = getColor(sector.changePercent);
    const innerW = rect.w - SECTOR_GAP;
    const innerH = rect.h - SECTOR_GAP;
    const contentH = innerH - HEADER_H;

    // Layout stocks within this sector's content area
    const stocks = [...sector.stocks].filter(s => s.price > 0).sort((a, b) => b.cap - a.cap);
    const caps = stocks.map(s => s.cap);
    const stockRects = squarifyLayout(caps, 0, 0, innerW, contentH);

    return (
        <div style={{
            position: 'absolute',
            left: rect.x + SECTOR_GAP / 2, top: rect.y + SECTOR_GAP / 2,
            width: innerW, height: innerH,
            background: 'rgba(255, 255, 255, 0.02)',
            border: `1px solid ${c.border}`,
            borderRadius: 4,
            overflow: 'hidden',
            boxSizing: 'border-box',
        }}>
            {/* Header */}
            <div style={{
                height: HEADER_H,
                background: c.bg,
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px',
                flexShrink: 0, borderBottom: `1px solid ${c.border}`,
            }}>
                <span style={{ color: c.text, fontWeight: 800, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sector.name}
                </span>
                <span style={{ color: c.text, fontWeight: 800, fontSize: 11, whiteSpace: 'nowrap', marginLeft: 6 }}>
                    {sector.changePercent >= 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
                </span>
            </div>

            {/* Stock tiles */}
            <div style={{ position: 'relative', width: innerW, height: contentH, overflow: 'hidden' }}>
                {stocks.map((stock, i) => (
                    stockRects[i] && (
                        <StockTile key={stock.symbol} stock={stock} rect={stockRects[i]} onHover={onHover} />
                    )
                ))}
            </div>
        </div>
    );
}

// ── Legend ────────────────────────────────────────────────────────────────────
const LEGEND = [
    { label: '-4%+', ...getColor(-5) },
    { label: '-2%',  ...getColor(-3) },
    { label: '-1%',  ...getColor(-1.5) },
    { label: '0%',   bg: '#1a1a1a', text: '#ccc', border: '#444' },
    { label: '+1%',  ...getColor(1.5) },
    { label: '+2%',  ...getColor(3) },
    { label: '+4%+', ...getColor(5) },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
    const [market, setMarket] = useState<'US' | 'KR'>('US');
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastFetched, setLastFetched] = useState('');
    const [correlation, setCorrelation] = useState<{ correlation: number; correlationLag: number; sampleSize: number } | null>(null);
    const [showCorrTooltip, setShowCorrTooltip] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ w: 1100, h: 560 });
    const [hoveredStock, setHoveredStock] = useState<Stock | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Measure container
    useLayoutEffect(() => {
        const measure = () => {
            if (containerRef.current) {
                const { width } = containerRef.current.getBoundingClientRect();
                const h = Math.min(Math.round(width * 0.75), 780);
                setContainerSize({ w: Math.round(width), h });
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    // Recompute sector layout when sectors or container size changes
    const sectorRects = useMemo(() => {
        if (!sectors.length) return [];
        const weights = sectors.map(s => s.weight);
        return squarifyLayout(weights, 0, 0, containerSize.w, containerSize.h);
    }, [sectors, containerSize]);

    const fetchSectors = useCallback(async (m: 'US' | 'KR') => {
        const isInitial = sectors.length === 0;
        if (isInitial) setLoading(true);
        try {
            const [secRes, corrRes] = await Promise.all([
                fetch(`/api/analysis/sectors?market=${m}&t=${Date.now()}`),
                fetch(`/api/analysis/correlation?t=${Date.now()}`)
            ]);
            const json = await secRes.json();
            const raw: Sector[] = (json.sectors || []).filter((s: Sector) => s.weight > 0);
            setSectors(raw);
            setLastFetched(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
            
            if (corrRes.ok) {
                setCorrelation(await corrRes.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { 
        fetchSectors(market); 
        const interval = setInterval(() => fetchSectors(market), 10000);
        return () => clearInterval(interval);
    }, [market, fetchSectors]);

    const marketChange = sectors.length > 0
        ? sectors.reduce((s, sec) => s + sec.changePercent * (sec.weight / 100), 0)
        : 0;
    const mc = getColor(marketChange);

    return (
        <main style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto', color: 'var(--foreground)' }}>
            {/* Header Redesign */}
            <header style={{ 
                marginBottom: '1.5rem', 
                display: 'flex', 
                alignItems: 'flex-end', 
                justifyContent: 'space-between',
                gap: '1.5rem',
                flexWrap: 'wrap'
            }}>
                <div style={{ flexShrink: 0 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Market Intelligence
                    </span>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.04em', lineHeight: 1.1, marginTop: '2px' }}>
                        Sector Heatmap
                    </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Market Toggle - Light style */}
                    <div style={{ display: 'flex', background: '#f5f5f5', padding: '3px', borderRadius: '10px', border: '1px solid #ddd', marginRight: '0.5rem' }}>
                        {(['US', 'KR'] as const).map(m => (
                            <button key={m} onClick={() => setMarket(m)} style={{
                                padding: '0.4rem 1.1rem', fontSize: '0.8rem', borderRadius: '7px',
                                border: 'none', background: market === m ? 'black' : 'transparent',
                                color: market === m ? 'white' : '#666', cursor: 'pointer', fontWeight: 700, transition: 'all 0.18s',
                            }}>
                                {m === 'US' ? '🇺🇸 S&P 500' : '🇰🇷 KOSPI'}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {correlation && (
                            <div 
                                onMouseEnter={() => setShowCorrTooltip(true)}
                                onMouseLeave={() => setShowCorrTooltip(false)}
                                style={{ 
                                    padding: '0.4rem 0.9rem', background: '#f5f5f5', color: '#111', borderRadius: '9px', 
                                    fontWeight: 700, fontSize: '0.82rem', border: '1px solid #ddd',
                                    display: 'flex', gap: '0.6rem', alignItems: 'center', cursor: 'help',
                                    position: 'relative', height: '34px', boxSizing: 'border-box'
                                }}
                            >
                                <span style={{ color: '#666', fontWeight: 600 }}>커플링:</span>
                                <span style={{ color: correlation.correlationLag > 0.6 ? '#dc2626' : '#111' }}>
                                    {correlation.correlationLag.toFixed(3)}
                                </span>
                                {showCorrTooltip && (
                                    <div style={{
                                        position: 'absolute', top: '100%', right: 0, marginTop: '10px',
                                        background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px',
                                        padding: '1rem', width: '280px', zIndex: 1100,
                                        boxShadow: '0 15px 40px rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)',
                                        color: '#ccc', fontSize: '0.8rem', lineHeight: 1.6, pointerEvents: 'none'
                                    }}>
                                        <div style={{ color: 'white', fontWeight: 800, marginBottom: '6px', fontSize: '0.85rem' }}>커플링 지수 (Pearson)</div>
                                        미국 증시(S&P 500)와 한국 증시(KOSPI)가 얼마나 비슷하게 움직이는지 나타냅니다. 
                                        <br/><br/>
                                        • <span style={{ color: 'white' }}>1.0</span>에 가까울수록 동조화가 강하며, <span style={{ color: '#f87171' }}>0.6 이상</span>이면 미국 시장의 영향력이 매우 크다는 의미입니다.
                                    </div>
                                )}
                            </div>
                        )}

                        {!loading && sectors.length > 0 && (
                            <div style={{ 
                                padding: '0.4rem 0.9rem', background: mc.bg, color: mc.text, borderRadius: '9px', 
                                fontWeight: 800, fontSize: '0.85rem', border: `1px solid ${mc.border}`,
                                height: '34px', boxSizing: 'border-box', display: 'flex', alignItems: 'center'
                            }}>
                                {market === 'US' ? 'S&P 500' : 'KOSPI'} {marketChange >= 0 ? '+' : ''}{marketChange.toFixed(2)}%
                            </div>
                        )}
                        <div style={{ fontSize: '0.72rem', color: '#555', fontWeight: 600, marginLeft: '4px' }}>
                            Last updated: {lastFetched}
                        </div>
                    </div>
                </div>
            </header>


            {/* Treemap container */}
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: containerSize.h,
                    position: 'relative',
                    background: 'var(--card)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    minHeight: 400,
                }}
            >
                {loading && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: '#555' }}>
                        <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: '0.9rem' }}>시장 데이터 로딩 중... (10~20초 소요)</span>
                    </div>
                )}
                {!loading && sectorRects.map((rect, i) => {
                    const sec = sectors[i];
                    if (!sec) return null;
                    return <SectorTile key={sec.id} sector={sec} rect={rect} onHover={(s, e) => {
                        setHoveredStock(s);
                        if (e) setMousePos({ x: e.clientX, y: e.clientY });
                    }} />;
                })}
            </div>

            {/* Legend - Bottom Right */}
            {!loading && sectors.length > 0 && (
                <div style={{ marginTop: '0.6rem', display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                    {LEGEND.map(l => (
                        <div key={l.label} style={{
                            width: 50, height: 26, background: l.bg, borderRadius: 5,
                            border: `1px solid ${l.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.78rem', fontWeight: 800, color: l.text,
                        }}>{l.label}</div>
                    ))}
                </div>
            )}


            {/* Floating Global Tooltip */}
            {hoveredStock && (
                <div style={{
                    position: 'fixed',
                    left: mousePos.x + 15,
                    top: mousePos.y + 15,
                    zIndex: 1000,
                    pointerEvents: 'none',
                    background: 'rgba(15, 15, 15, 0.95)',
                    border: `1px solid ${getColor(hoveredStock.changePercent).border}`,
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(10px)',
                    minWidth: '180px',
                }}>
                    <div style={{ marginBottom: '0.45rem', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'white', fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                            {hoveredStock.name}
                        </span>
                        {hoveredStock.name !== hoveredStock.symbol && (
                            <span style={{ color: '#888', fontWeight: 700, fontSize: '0.8rem', marginTop: '1px' }}>
                                {hoveredStock.symbol}
                            </span>
                        )}
                    </div>


                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.8rem' }}>
                        <div style={{ fontSize: '1.45rem', fontWeight: 900, color: getColor(hoveredStock.changePercent).text, letterSpacing: '-0.02em' }}>
                            {hoveredStock.changePercent >= 0 ? '+' : ''}{hoveredStock.changePercent.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#bbb' }}>
                            {market === 'US' ? '$' : '₩'}{hoveredStock.price?.toLocaleString()}
                        </div>
                    </div>
                </div>
            )}







            {/* Sector Summary Section */}
            {!loading && sectors.length > 0 && (
                <div style={{ marginTop: '2.5rem' }}>
                    <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '1.25rem' }}>
                        Sector Performance Summary
                    </div>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateRows: 'repeat(3, auto)', 
                        gridAutoFlow: 'column',
                        gap: '0.6rem 0.8rem',
                        justifyContent: 'center',
                        maxWidth: '100%',
                        overflowX: 'auto',
                        padding: '0 1rem'
                    }}>
                        {[...sectors].sort((a, b) => b.changePercent - a.changePercent).map(sec => {
                            const c = getColor(sec.changePercent);
                            return (
                                <div key={sec.id} style={{
                                    padding: '0.45rem 1rem', background: c.bg, color: c.text,
                                    borderRadius: '9px', fontSize: '0.8rem', fontWeight: 800,
                                    border: `1px solid ${c.border}`, display: 'flex', 
                                    justifyContent: 'space-between', alignItems: 'center',
                                    width: '160px', boxSizing: 'border-box',
                                    transition: 'all 0.2s', cursor: 'default'
                                }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.75rem', opacity: 0.9, textAlign: 'left' }}>{sec.name}</span>
                                    <span style={{ letterSpacing: '-0.02em', textAlign: 'right' }}>
                                        {sec.changePercent >= 0 ? '+' : ''}{sec.changePercent.toFixed(2)}%
                                    </span>
                                </div>


                            );
                        })}
                    </div>
                </div>
            )}
        </main>
    );
}

