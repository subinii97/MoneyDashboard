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
    if (pct === 0)   return { bg: '#1a1a1a', text: '#888', border: '#333' };
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
function StockTile({ stock, rect }: { stock: Stock; rect: Rect }) {
    const [hovered, setHovered] = useState(false);
    const c = getColor(stock.changePercent);
    const w = rect.w - GAP;
    const h = rect.h - GAP;
    const showSymbol = h > 22 && w > 36;
    const showPct    = h > 14 && w > 28;
    const bigFont    = h > 55 && w > 70;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            title={`${stock.name} (${stock.symbol})\n${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%\n$${stock.price?.toLocaleString()}`}
            style={{
                position: 'absolute',
                left: rect.x + GAP / 2, top: rect.y + GAP / 2,
                width: w, height: h,
                background: hovered ? c.border : c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 3,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                overflow: hovered ? 'visible' : 'hidden',
                cursor: 'pointer',
                transition: 'background 0.15s',
                boxSizing: 'border-box',
                zIndex: hovered ? 50 : 1,
            }}
        >
            {(showSymbol || hovered) && (
                <div style={{
                    color: c.text, fontWeight: 800,
                    fontSize: bigFont ? 13 : (h > 35 || hovered) ? 11 : 9,
                    lineHeight: 1.1, textAlign: 'center',
                    padding: '0 3px', whiteSpace: 'nowrap',
                    overflow: hovered ? 'visible' : 'hidden',
                    textOverflow: 'ellipsis', maxWidth: (hovered && !showSymbol) ? 'none' : '100%',
                    textShadow: hovered ? '0 0 4px rgba(0,0,0,0.8)' : 'none',
                }}>
                    {stock.name}
                </div>
            )}
            {(showPct || hovered) && (
                <div style={{
                    color: c.text, fontWeight: 700,
                    fontSize: bigFont ? 12 : (h > 35 || hovered) ? 10 : 8.5,
                    lineHeight: 1.1, marginTop: (showSymbol || hovered) ? 2 : 0,
                    textShadow: hovered ? '0 0 4px rgba(0,0,0,0.8)' : 'none',
                }}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </div>
            )}
        </div>
    );
}


// ── Sector Tile ────────────────────────────────────────────────────────────────
function SectorTile({ sector, rect }: { sector: Sector; rect: Rect }) {
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
            background: '#0d0d0d',
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
                        <StockTile key={stock.symbol} stock={stock} rect={stockRects[i]} />
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
    { label: '0%',   bg: '#1a1a1a', text: '#666', border: '#333' },
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
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ w: 1100, h: 560 });

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
        setLoading(true);
        try {
            const res = await fetch(`/api/analysis/sectors?market=${m}&t=${Date.now()}`);
            const json = await res.json();
            const raw: Sector[] = (json.sectors || []).filter((s: Sector) => s.weight > 0);
            setSectors(raw);
            setLastFetched(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSectors(market); }, [market, fetchSectors]);

    const marketChange = sectors.length > 0
        ? sectors.reduce((s, sec) => s + sec.changePercent * (sec.weight / 100), 0)
        : 0;
    const mc = getColor(marketChange);

    return (
        <main style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto', color: 'var(--foreground)' }}>
            {/* Header */}
            <header style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                    <span className="section-label">Market Analysis</span>
                    <h1 style={{ fontSize: '1.7rem', fontWeight: '900', letterSpacing: '-0.03em', lineHeight: 1 }}>
                        Sector Heatmap
                    </h1>
                </div>

                {/* Market tabs */}
                <div style={{ display: 'flex', gap: '0.3rem', background: '#111', padding: '3px', borderRadius: '10px', border: '1px solid #222' }}>
                    {(['US', 'KR'] as const).map(m => (
                        <button key={m} onClick={() => setMarket(m)} style={{
                            padding: '0.35rem 1rem', fontSize: '0.82rem', borderRadius: '7px',
                            border: 'none', background: market === m ? 'var(--primary)' : 'transparent',
                            color: market === m ? 'white' : '#666', cursor: 'pointer', fontWeight: 700, transition: 'all 0.18s',
                        }}>
                            {m === 'US' ? '🇺🇸 S&P 500' : '🇰🇷 KOSPI'}
                        </button>
                    ))}
                </div>

                {/* Refresh */}
                <button onClick={() => fetchSectors(market)} disabled={loading} style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
                    padding: '0.35rem 0.75rem', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                }}>
                    <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    {loading ? '로딩 중...' : lastFetched}
                </button>

                {/* Market badge */}
                {!loading && sectors.length > 0 && (
                    <div style={{ padding: '0.3rem 0.8rem', background: mc.bg, color: mc.text, borderRadius: '7px', fontWeight: 800, fontSize: '0.88rem', border: `1px solid ${mc.border}` }}>
                        {market === 'US' ? 'S&P 500' : 'KOSPI'} {marketChange >= 0 ? '+' : ''}{marketChange.toFixed(2)}%
                    </div>
                )}

            </header>

            {/* Treemap container */}
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: containerSize.h,
                    position: 'relative',
                    background: '#0a0a0a',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid #1a1a1a',
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
                    return <SectorTile key={sec.id} sector={sec} rect={rect} />;
                })}
            </div>

            {/* Legend - moved below treemap */}
            {!loading && sectors.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', marginTop: '1rem' }}>
                    {LEGEND.map(l => (
                        <div key={l.label} style={{
                            width: 54, height: 28, background: l.bg, borderRadius: 4,
                            border: `1px solid ${l.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.78rem', fontWeight: 800, color: l.text,
                        }}>{l.label}</div>
                    ))}
                </div>
            )}

            {/* Sector summary pill row */}
            {!loading && sectors.length > 0 && (
                <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {[...sectors].sort((a, b) => b.changePercent - a.changePercent).map(sec => {
                        const c = getColor(sec.changePercent);
                        return (
                            <div key={sec.id} style={{
                                padding: '0.25rem 0.7rem', background: c.bg, color: c.text,
                                borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                                border: `1px solid ${c.border}`, display: 'flex', gap: '0.5rem',
                            }}>
                                <span>{sec.name}</span>
                                <span>{sec.changePercent >= 0 ? '+' : ''}{sec.changePercent.toFixed(2)}%</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
