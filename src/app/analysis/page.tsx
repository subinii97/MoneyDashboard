'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface StockBlock {
    symbol: string;
    name: string;
    changePercent: number;
    price: number;
    marketCap: number;
}

interface SectorData {
    id: string;
    name: string;
    weight: number;
    changePercent: number;
    change: number;
    price: number;
    stocks: StockBlock[];
}

// ── Color scale (US-style: green = up, red = down) ────────────────────────────
function getPct(pct: number): { bg: string; text: string } {
    if (pct >= 5)    return { bg: '#1a4731', text: '#4ade80' };
    if (pct >= 3)    return { bg: '#14532d', text: '#86efac' };
    if (pct >= 1.5)  return { bg: '#166534', text: '#bbf7d0' };
    if (pct >= 0.5)  return { bg: '#1e6b3c', text: '#d1fae5' };
    if (pct >= 0)    return { bg: '#1f4b35', text: '#a7f3d0' };
    if (pct >= -0.5) return { bg: '#4c1d24', text: '#fca5a5' };
    if (pct >= -1.5) return { bg: '#7f1d1d', text: '#fca5a5' };
    if (pct >= -3)   return { bg: '#991b1b', text: '#fed7d7' };
    if (pct >= -5)   return { bg: '#b91c1c', text: '#fef2f2' };
    return               { bg: '#c41e1e', text: '#fff5f5' };
}

// ── Stock Block ───────────────────────────────────────────────────────────────
function StockTile({ stock, height }: { stock: StockBlock; height: number }) {
    const c = getPct(stock.changePercent);
    const large = height > 60;
    const small = height < 35;
    return (
        <div
            title={`${stock.symbol}\n${stock.name}\n${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`}
            style={{
                background: c.bg,
                color: c.text,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderRadius: '3px',
                border: '1px solid rgba(0,0,0,0.35)',
                cursor: 'pointer',
                transition: 'filter 0.15s',
                userSelect: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.25)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
        >
            {!small && (
                <div style={{ fontWeight: '800', fontSize: large ? '0.85rem' : '0.7rem', lineHeight: 1.1, textAlign: 'center', padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {stock.symbol}
                </div>
            )}
            <div style={{ fontWeight: '700', fontSize: large ? '0.78rem' : small ? '0.55rem' : '0.65rem', lineHeight: 1.1, marginTop: '2px' }}>
                {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
            </div>
        </div>
    );
}

// ── Sector Block ──────────────────────────────────────────────────────────────
function SectorBlock({ sector, totalWidth }: { sector: SectorData; totalWidth: number }) {
    const c = getPct(sector.changePercent);
    // Compute how wide this sector is (proportion of total visible area)
    // Each stock gets area proportional to marketCap, then we fill a grid
    const stocks = sector.stocks.filter(s => s.price > 0);

    // Simple proportional tiling: lay out stocks in rows, heights scale with relative size
    // Row height = constant, column widths = proportional
    const blockHeight = 140;
    const headerH = 28;
    const contentH = blockHeight - headerH;

    // Compute per-stock relative widths within sector block
    const totalCap = stocks.reduce((s, t) => s + (t.marketCap || 1), 0) || 1;

    return (
        <div style={{
            flex: `${sector.weight} 0 0`,
            minWidth: '80px',
            height: `${blockHeight}px`,
            background: '#151515',
            border: '1px solid #2a2a2a',
            borderRadius: '4px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Sector header */}
            <div style={{
                height: `${headerH}px`,
                background: c.bg,
                color: c.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px',
                fontWeight: '700',
                fontSize: '0.72rem',
                flexShrink: 0,
                gap: '6px',
            }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sector.name}</span>
                <span style={{ whiteSpace: 'nowrap', fontWeight: '800', flexShrink: 0 }}>
                    {sector.changePercent >= 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
                </span>
            </div>

            {/* Stock tiles */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1px',
                padding: '1px',
                alignContent: 'flex-start',
                overflow: 'hidden',
            }}>
                {stocks.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '0.7rem' }}>
                        로딩 중...
                    </div>
                )}
                {stocks.map(stock => {
                    const capRatio = (stock.marketCap || 1) / totalCap;
                    // Each stock gets a width proportional to its cap ratio
                    // We give minimum 40px, maximum is capped naturally
                    const minW = 40;
                    const maxW = Math.max(minW, capRatio * 100); // in %

                    return (
                        <div
                            key={stock.symbol}
                            style={{
                                flex: `${capRatio * 100} 0 ${minW}px`,
                                maxWidth: `${Math.min(capRatio * 500, 99)}%`,
                                height: `${contentH - 3}px`,
                            }}
                        >
                            <StockTile stock={stock} height={contentH - 3} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── S&P500 / KOSPI split layout like Finviz ────────────────────────────────────
// We split into ~3 rows by grouping sectors with similar weights
function buildRows(sectors: SectorData[]): SectorData[][] {
    // Sort by weight desc, then split into rows
    // Row 1: Tech + 2-3 others up to ~55% total
    // Row 2: mid-weight sectors
    // Row 3: smaller sectors
    let remaining = [...sectors];
    const rows: SectorData[][] = [];

    // Greedy: fill rows until weight ~= 35%
    const TARGET_ROW = 35;
    while (remaining.length > 0) {
        const row: SectorData[] = [];
        let rowW = 0;
        let i = 0;
        while (i < remaining.length && (rowW < TARGET_ROW || row.length === 0)) {
            row.push(remaining[i]);
            rowW += remaining[i].weight;
            i++;
        }
        remaining = remaining.slice(row.length);
        if (rows.length >= 2 && remaining.length > 0) {
            // Push all remainders into last row
            row.push(...remaining);
            remaining = [];
        }
        rows.push(row);
    }
    return rows;
}

// ── Legend ────────────────────────────────────────────────────────────────────
const LEGEND_STEPS = [
    { label: '-5%+', bg: '#c41e1e', text: '#fff5f5' },
    { label: '-3%', bg: '#991b1b', text: '#fed7d7' },
    { label: '-1%', bg: '#7f1d1d', text: '#fca5a5' },
    { label: '0%', bg: '#2d2d2d', text: '#888' },
    { label: '+1%', bg: '#1e6b3c', text: '#d1fae5' },
    { label: '+3%', bg: '#166534', text: '#bbf7d0' },
    { label: '+5%+', bg: '#14532d', text: '#86efac' },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
    const [market, setMarket] = useState<'US' | 'KR'>('US');
    const [sectors, setSectors] = useState<SectorData[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastFetched, setLastFetched] = useState<string>('');
    const [rows, setRows] = useState<SectorData[][]>([]);

    const fetchSectors = useCallback(async (m: 'US' | 'KR') => {
        setLoading(true);
        try {
            const res = await fetch(`/api/analysis/sectors?market=${m}&t=${Date.now()}`);
            const json = await res.json();
            const s: SectorData[] = json.sectors || [];
            setSectors(s);
            setRows(buildRows([...s].sort((a, b) => b.weight - a.weight)));
            setLastFetched(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSectors(market);
    }, [market, fetchSectors]);

    // Overall market performance (weighted avg)
    const marketChange = sectors.length > 0
        ? sectors.reduce((s, sec) => s + sec.changePercent * (sec.weight / 100), 0)
        : 0;
    const mc = getPct(marketChange);

    return (
        <main style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto', color: 'var(--foreground)', background: 'var(--background)' }}>
            {/* Header */}
            <header style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div>
                    <span className="section-label">Market Analysis</span>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-0.03em', lineHeight: 1 }}>
                        Sector Heatmap
                    </h1>
                </div>

                {/* Market toggle */}
                <div style={{ display: 'flex', gap: '0.4rem', background: '#1a1a1a', padding: '4px', borderRadius: '10px', border: '1px solid #2a2a2a' }}>
                    {(['US', 'KR'] as const).map(m => (
                        <button key={m} onClick={() => setMarket(m)} style={{
                            padding: '0.4rem 1.2rem',
                            fontSize: '0.85rem',
                            borderRadius: '7px',
                            border: 'none',
                            background: market === m ? 'var(--primary)' : 'transparent',
                            color: market === m ? 'white' : '#888',
                            cursor: 'pointer',
                            fontWeight: '700',
                            transition: 'all 0.2s',
                        }}>
                            {m === 'US' ? '🇺🇸 S&P 500' : '🇰🇷 KOSPI'}
                        </button>
                    ))}
                </div>

                {/* Refresh */}
                <button onClick={() => fetchSectors(market)} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.4rem 0.85rem', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
                    <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    {lastFetched || '갱신'}
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </button>

                {/* Market summary badge */}
                {!loading && sectors.length > 0 && (
                    <div style={{
                        padding: '0.35rem 0.85rem',
                        background: mc.bg,
                        color: mc.text,
                        borderRadius: '8px',
                        fontWeight: '800',
                        fontSize: '0.9rem',
                    }}>
                        {market === 'US' ? 'S&P 500' : 'KOSPI'}&nbsp;
                        {marketChange >= 0 ? '+' : ''}{marketChange.toFixed(2)}%
                    </div>
                )}

                {/* Legend */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {LEGEND_STEPS.map(s => (
                        <div key={s.label} style={{
                            width: '38px', height: '22px',
                            background: s.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6rem', fontWeight: '700', color: s.text,
                            borderRadius: '3px',
                        }}>
                            {s.label}
                        </div>
                    ))}
                </div>
            </header>

            {/* Heatmap */}
            {loading ? (
                <div style={{ height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '1rem' }}>
                    시장 데이터 로딩 중... (10~20초 소요)
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', userSelect: 'none' }}>
                    {rows.map((row, ri) => (
                        <div key={ri} style={{ display: 'flex', gap: '2px', width: '100%' }}>
                            {row.map(sec => (
                                <SectorBlock key={sec.id} sector={sec} totalWidth={100} />
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* Sector summary bar */}
            {!loading && sectors.length > 0 && (
                <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {[...sectors].sort((a, b) => b.changePercent - a.changePercent).map(sec => {
                        const c = getPct(sec.changePercent);
                        return (
                            <div key={sec.id} style={{
                                padding: '0.3rem 0.8rem',
                                background: c.bg,
                                color: c.text,
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: '700',
                                display: 'flex',
                                gap: '0.5rem',
                            }}>
                                <span>{sec.name}</span>
                                <span>{sec.changePercent >= 0 ? '+' : ''}{sec.changePercent.toFixed(2)}%</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {market === 'KR' && (
                <p style={{ marginTop: '1rem', fontSize: '0.78rem', color: '#555', textAlign: 'center' }}>
                    * 한국 시장 데이터는 준비 중입니다. 현재는 US S&P 500 섹터를 확인해주세요.
                </p>
            )}
        </main>
    );
}
