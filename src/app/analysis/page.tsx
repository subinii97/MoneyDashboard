'use client';

import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { RefreshCw, ImageIcon, Info, X } from 'lucide-react';
import { toPng } from 'html-to-image';

import { SectorTile } from '@/components/Analysis/SectorTile';
import { squarifyLayout, getColor } from '@/components/Analysis/TreemapUtils';
import { LEGEND, MarketHelpTooltip, SyncTrendChart, SectorTableRow } from '@/components/Analysis/AnalysisComponents';
import { Sector, Stock } from '@/components/Analysis/types';

export default function AnalysisPage() {
    const [market, setMarket] = useState<'US' | 'KR' | 'KOSDAQ'>('KR');
    const [marketStatus, setMarketStatus] = useState<'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_MARKET'>('CLOSED');
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastFetched, setLastFetched] = useState('');
    const [hoverHelp, setHoverHelp] = useState(false);
    const [hoverSync, setHoverSync] = useState(false);
    const [hoveredStock, setHoveredStock] = useState<Stock | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [containerSize, setContainerSize] = useState({ w: 1100, h: 560 });
    const [sort, setSort] = useState<{ k: string, d: 'desc' | 'asc' }>({ k: 'performance', d: 'desc' });
    const [correlation, setCorrelation] = useState<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const heatmapRef = useRef<HTMLDivElement>(null);

    const handleSaveImage = useCallback(async () => {
        if (!heatmapRef.current) return;
        try {
            // Wait for any images or fonts to be ready
            await document.fonts.ready;
            const dataUrl = await toPng(heatmapRef.current, { 
                quality: 1, 
                pixelRatio: 2, 
                backgroundColor: '#fff', 
                style: { backgroundColor: '#fff', color: '#000' },
                filter: (n: any) => !n.classList?.contains('ignore-in-capture'),
                cacheBust: true,
            });
            const link = document.createElement('a');
            link.download = `market-heatmap-${market.toLowerCase()}-${new Date().toISOString().split('T')[0]}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err: any) {
            console.error('Image Capture Failed:', err);
            if (err.name === 'SecurityError' || err.message?.includes('cssRules')) {
                alert('CSS 보안 정책으로 인해 이미지 저장이 제한되었습니다. 브라우저 확장 프로그램을 끄거나 다른 브라우저에서 시도해 보세요.');
            }
        }
    }, [market]);

    useLayoutEffect(() => {
        const m = () => { if (containerRef.current) { const { width } = containerRef.current.getBoundingClientRect(); setContainerSize({ w: Math.round(width), h: Math.min(Math.round(width * 0.75), 780) }); } };
        m(); window.addEventListener('resize', m); return () => window.removeEventListener('resize', m);
    }, []);

    const isSessionActive = useCallback((s: string | undefined) => {
        if (!s) return false; const now = new Date();
        if (market === 'US') {
            const nyc = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
            const nycTime = nyc.getHours() + nyc.getMinutes() / 60;
            if (s === 'PRE_MARKET') return nycTime >= 4 && nycTime < 9.5;
            if (s === 'AFTER_MARKET' || s === 'POST_MARKET') return nycTime >= 16 && nycTime < 20;
        } else if (s === 'AFTER_MARKET') {
            const kst = new Date(now.getTime() + 9 * 3600000);
            const timeVal = kst.getUTCHours() + kst.getUTCMinutes() / 60; return timeVal >= 15.6 && timeVal < 20;
        }
        return false;
    }, [market]);

    const displaySectors = useMemo(() => sectors.map(sec => {
        const stocks = sec.stocks.map(s => {
            const isActive = isSessionActive(s.overMarketSession);
            const isAfter = s.overMarketSession === 'AFTER_MARKET' || s.overMarketSession === 'POST_MARKET';
            let cp = s.changePercent, pr = s.price;
            if (marketStatus !== 'OPEN' && s.overMarketPrice && (isActive || isAfter)) {
                pr = s.overMarketPrice; const prev = s.price / (1 + s.changePercent / 100);
                if (prev > 0) cp = ((s.overMarketPrice / prev) - 1) * 100;
            }
            return { ...s, changePercent: cp, price: pr };
        });
        const totalCap = stocks.reduce((a, s) => a + s.cap, 0) || 1;
        return { ...sec, stocks, changePercent: stocks.reduce((a, s) => a + s.changePercent * (s.cap / totalCap), 0) };
    }), [sectors, isSessionActive, marketStatus]);

    const sectorRects = useMemo(() => squarifyLayout(displaySectors.map(s => s.weight), 0, 0, containerSize.w, containerSize.h), [displaySectors, containerSize]);

    const fetchSectors = useCallback(async (m: string) => {
        if (!sectors.length) setLoading(true);
        try {
            const [sRes, cRes] = await Promise.all([fetch(`/api/analysis/sectors?market=${m}&t=${Date.now()}`), fetch(`/api/analysis/correlation?t=${Date.now()}`)]);
            const sJson = await sRes.json(); if (sJson.status) setMarketStatus(sJson.status);
            const raw = (sJson.sectors || []).filter((s: Sector) => s.weight > 0);
            if (raw.length) { setSectors(raw); setLastFetched(new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/\. /g, '-').replace(/\.$/, '')); }
            if (cRes.ok) setCorrelation(await cRes.json());
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [sectors.length]);

    useEffect(() => { fetchSectors(market); const i = setInterval(() => fetchSectors(market), 10000); return () => clearInterval(i); }, [market, fetchSectors]);

    const marketChange = displaySectors.reduce((s, sec) => s + sec.changePercent * (sec.weight / 100), 0);
    const sortedSectors = useMemo(() => [...displaySectors].sort((a, b) => {
        const dir = sort.d === 'desc' ? 1 : -1;
        if (sort.k === 'performance') return dir * (b.changePercent - a.changePercent);
        if (sort.k === 'weight') return dir * (b.weight - a.weight);
        const valA = sort.k === 'influence' ? (market === 'US' ? correlation?.sectorCorrelations?.[a.id] : market === 'KR' ? correlation?.krSectorCorrelations?.[a.id] : correlation?.kqSectorCorrelations?.[a.id]) : correlation?.sectorSync?.[a.id];
        const valB = sort.k === 'influence' ? (market === 'US' ? correlation?.sectorCorrelations?.[b.id] : market === 'KR' ? correlation?.krSectorCorrelations?.[b.id] : correlation?.kqSectorCorrelations?.[b.id]) : correlation?.sectorSync?.[b.id];
        return dir * ((valB || 0) - (valA || 0));
    }), [displaySectors, sort, correlation, market]);

    return (
        <main style={{ padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto' }}>
            <style jsx global>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .stock-tile:hover { filter: brightness(1.3) !important; z-index: 5; box-shadow: 0 4px 12px rgba(0,0,0,0.3); } .glass { background: rgba(255, 255, 255, 0.03) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }`}</style>
            <div ref={heatmapRef} style={{ background: 'var(--background)', padding: '1.5rem', borderRadius: '20px' }}>
                <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.15em' }}>Market Intelligence Report</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                            <h1 style={{ fontSize: '2.25rem', fontWeight: '900', letterSpacing: '-0.05em', textTransform: 'uppercase' }}>{market === 'US' ? 'S&P 500' : (market === 'KR' ? 'KOSPI' : market)} HEATMAP</h1>
                            <div onMouseEnter={() => setHoverHelp(true)} onMouseLeave={() => setHoverHelp(false)} style={{ color: 'var(--muted)', cursor: 'help' }}>
                                <Info size={20} /> {hoverHelp && <MarketHelpTooltip />}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', fontSize: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ opacity: 0.6 }}>Updated: {lastFetched}</span>
                                <div style={{ 
                                    fontWeight: 800, padding: '3px 10px', borderRadius: '6px', 
                                    background: marketStatus === 'OPEN' ? 'rgba(34, 197, 94, 0.1)' : (marketStatus === 'CLOSED' ? 'rgba(0,0,0,0.05)' : 'rgba(245, 158, 11, 0.1)'),
                                    color: marketStatus === 'OPEN' ? '#22c55e' : (marketStatus === 'CLOSED' ? '#666' : '#f59e0b'),
                                    border: `1px solid ${marketStatus === 'OPEN' ? 'rgba(34, 197, 94, 0.2)' : (marketStatus === 'CLOSED' ? 'rgba(0,0,0,0.1)' : 'rgba(245, 158, 11, 0.2)')}`
                                }}>● {market === 'KR' ? 'KOSPI' : (market === 'US' ? 'S&P 500' : market)} {marketStatus}</div>
                            </div>
                            <div style={{ fontWeight: 900, color: marketChange >= 0 ? '#dc2626' : '#2563eb' }}>{market === 'US' ? 'S&P 500' : (market === 'KR' ? 'KOSPI' : market)} {marketChange >= 0 ? '▲' : '▼'} {Math.abs(marketChange).toFixed(2)}%</div>
                            {correlation && (
                                <div onMouseEnter={() => setHoverSync(true)} onMouseLeave={() => setHoverSync(false)} style={{ position: 'relative', cursor: 'help', fontWeight: 700, color: 'var(--muted)' }}>
                                    한미 증시 동조화: <span style={{ fontWeight: 800, color: correlation.correlationLag > 0.6 ? '#dc2626' : 'inherit' }}>{(correlation.correlationLag * 100).toFixed(1)}%</span>
                                    {hoverSync && correlation.correlationLagHistory && <SyncTrendChart history={correlation.correlationLagHistory} current={correlation.correlationLag} avg={correlation.correlationLagHistory.reduce((a: any, b: any) => a + b.value, 0) / correlation.correlationLagHistory.length} />}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="ignore-in-capture" style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', background: 'var(--card)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            {(['KR', 'KOSDAQ', 'US'] as const).map(m => <button key={m} onClick={() => setMarket(m)} style={{ padding: '0.4rem 1.1rem', fontSize: '0.8rem', borderRadius: '7px', border: 'none', background: market === m ? 'var(--foreground)' : 'transparent', color: market === m ? 'var(--background)' : 'var(--muted)', cursor: 'pointer', fontWeight: 700 }}>{m === 'KR' ? 'KOSPI' : (m === 'US' ? 'S&P 500' : m)}</button>)}
                        </div>
                        <button onClick={handleSaveImage} style={{ padding: '0 1rem', background: 'var(--card)', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.85rem' }}><ImageIcon size={18} /> PNG 저장</button>
                    </div>
                </header>
                <div ref={containerRef} style={{ width: '100%', height: containerSize.h, position: 'relative', background: 'var(--card)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', minHeight: 400 }}>
                    {sectorRects.map((rect, i) => {
                        const s = displaySectors[i]; if (!s) return null;
                        const corr = market === 'US' ? correlation?.sectorCorrelations?.[s.id] : market === 'KR' ? correlation?.krSectorCorrelations?.[s.id] : correlation?.kqSectorCorrelations?.[s.id];
                        return <SectorTile key={s.id} sector={s} rect={rect} correlation={corr} onHover={(st, e) => { setHoveredStock(st); if (e) setMousePos({ x: e.clientX, y: e.clientY }); }} />;
                    })}
                    {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', zIndex: 10 }}><RefreshCw size={28} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>시장 데이터 로딩 중...</span></div>}
                </div>
                {!loading && displaySectors.length > 0 && <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>{LEGEND.map(l => <div key={l.label} style={{ minWidth: 50, height: 26, background: l.bg, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, color: l.text }}>{l.label}</div>)}</div>}
            </div>
            {!loading && displaySectors.length > 0 && (
                <div style={{ marginTop: '4rem' }}>
                    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '0 1rem' }}><div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '0.75rem' }}>Advanced Market Dynamics Analysis</div><h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '2.5rem' }}>섹터 별 시장 점유율 및 영향력</h2></div>
                    <div className="glass" style={{ width: '100%', maxWidth: '1080px', margin: '0 auto', overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '24px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                                    <th style={{ padding: '1.5rem', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800, textAlign: 'center' }}>섹터 구분</th>
                                    {(['weight', 'performance', 'None', 'influence', 'sync'] as const).map(k => (
                                        <th key={k} onClick={() => k !== 'None' && setSort({ k, d: sort.k === k && sort.d === 'desc' ? 'asc' : 'desc' })} style={{ padding: '1.5rem', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800, textAlign: k === 'influence' || k === 'sync' ? 'right' : 'center', cursor: k !== 'None' ? 'pointer' : 'default' }}>{k === 'weight' ? '시장 점유율' : k === 'performance' ? '변동률' : k === 'None' ? '거래량 상위 종목' : k === 'influence' ? '지수 영향력' : '한미 동조화'} {sort.k === k && (sort.d === 'desc' ? '▼' : '▲')}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>{sortedSectors.map((s, i) => <SectorTableRow key={s.id} sec={s} market={market} correlation={correlation} idx={i} isLast={i === displaySectors.length - 1} />)}</tbody>
                        </table>
                    </div>
                </div>
            )}
            {hoveredStock && <div style={{ position: 'fixed', left: mousePos.x + 15, top: mousePos.y + 15, zIndex: 1000, pointerEvents: 'none', background: 'rgba(15, 15, 15, 0.95)', border: `1px solid ${getColor(hoveredStock.changePercent).border}`, borderRadius: '10px', padding: '0.75rem 1rem', boxShadow: '0 12px 40px rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', color: 'white' }}><div><div style={{ fontSize: '1.25rem', fontWeight: 900 }}>{hoveredStock.name}</div><div style={{ color: '#888', fontWeight: 700, fontSize: '0.8rem' }}>{hoveredStock.symbol}</div></div><div style={{ display: 'flex', alignItems: 'baseline', gap: '0.8rem' }}><div style={{ fontSize: '1.45rem', fontWeight: 900, color: getColor(hoveredStock.changePercent).text }}>{hoveredStock.changePercent >= 0 ? '+' : ''}{hoveredStock.changePercent.toFixed(2)}%</div><div style={{ fontSize: '1rem', fontWeight: 700, color: '#bbb' }}>{market === 'US' ? '$' : '₩'}{hoveredStock.price?.toLocaleString()}</div></div></div>}
        </main>
    );
}
