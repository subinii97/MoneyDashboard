'use client';

import React from 'react';
import { Info, ImageIcon, RefreshCw } from 'lucide-react';
import { getColor } from './TreemapUtils';
import { Sector, Stock } from './types';

// --- Legend ---
export const LEGEND = [
    { label: '-8%↓', ...getColor(-8.5) }, { label: '-5%', ...getColor(-5.5) }, { label: '-3%', ...getColor(-3.5) }, { label: '-1%', ...getColor(-1.5) },
    { label: '0%', ...getColor(0) },
    { label: '+1%', ...getColor(1.5) }, { label: '+3%', ...getColor(3.5) }, { label: '+5%', ...getColor(5.5) }, { label: '+8%↑', ...getColor(8.5) },
];

// --- Help Tooltip ---
export const MarketHelpTooltip = () => (
    <div style={{ position: 'absolute', top: '100%', left: '0', zIndex: 2000, width: '520px', marginTop: '12px', background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(20px)', borderRadius: '24px', border: '1px solid rgba(0,0,0,0.08)', padding: '1.8rem', boxShadow: '0 30px 80px rgba(0,0,0,0.25)', pointerEvents: 'none', color: '#111' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Info size={18} color="white" /></div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#000' }}>시장 분석 가이드</h2>
        </div>
        <div style={{ display: 'grid', gap: '1.5rem' }}>
            <HelpSection title="1. 한미 증시 동조화 (US-KR Sync)" content="미국 시장(S&P 500)의 전일 종가와 한국 시장(KOSPI)의 금일 흐름 사이의 상관관계를 측정합니다. '차트 상단 지수'가 이를 나타냅니다." />
            <HelpSection title="2. 섹터별 영향력 (Sector Influence)" content="각 개별 섹터가 해당 시장의 전체 지수와 얼마나 같은 방향으로 움직이는지 나타냅니다." />
            <HelpSection title="3. 산출 방식 (Methodology)" content="최근 거래일간의 피어슨 상관계수를 기반으로 산출됩니다. 0~100% 척도로 표시합니다." />
            <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.03)', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.8rem', color: '#000' }}>📊 현재 수치 해석 가이드</div>
                <StatusRow color="#dc2626" range="75% ~ 100%" desc="[강력한 동행] 시장 주도 테마" />
                <StatusRow color="#eab308" range="40% ~ 75%" desc="[보통 수준] 일반적 시장 흐름" />
                <StatusRow color="#999" range="0% ~ 40%" desc="[개별 모멘텀] 독자 제재로 움직임" />
            </div>
        </div>
    </div>
);

const HelpSection = ({ title, content }: any) => (
    <section>
        <div style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{title}</div>
        <p style={{ fontSize: '0.88rem', color: '#333', opacity: 0.9, lineHeight: 1.6 }}>{content}</p>
    </section>
);

const StatusRow = ({ color, range, desc }: any) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
        <span style={{ fontSize: '0.82rem', fontWeight: 700, width: '100px', color: '#111' }}>{range}</span>
        <span style={{ fontSize: '0.82rem', color: '#444' }}>{desc}</span>
    </div>
);

// --- Correlation Trend Chart (SVG) ---
export const SyncTrendChart = ({ history, current, avg }: any) => {
    const values = history.map((h: any) => h.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 0.1;
    const chartHeight = 120;
    const yMin = Math.max(0, minVal - range * 0.15);
    const yMax = Math.min(1, maxVal + range * 0.15);
    const yRange = yMax - yMin;

    const getY = (v: number) => chartHeight - ((v - yMin) / yRange) * chartHeight;
    const points = history.map((h: any, i: number) => ({ x: (i / (history.length - 1)) * 240, y: getY(h.value) }));
    const pathD = `M ${points.map((p: any) => `${p.x},${p.y}`).join(' L ')}`;
    const areaD = `M 0,${chartHeight} L ${points.map((p: any) => `${p.x},${p.y}`).join(' L ')} L 240,${chartHeight} Z`;

    return (
        <div style={{ position: 'absolute', top: '100%', right: '0', zIndex: 3000, marginTop: '12px', width: '340px', background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(20px)', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.08)', padding: '1.5rem', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', color: '#111' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 800, marginBottom: '1.25rem' }}><span>한미 동조화 경향 (14D)</span><span style={{ color: 'var(--primary)', opacity: 0.8 }}>Trend</span></div>
            <div style={{ height: 'chartHeight', width: '100%', position: 'relative' }}>
                <svg width="100%" height="120" viewBox="0 0 240 120" preserveAspectRatio="none">
                    <defs><linearGradient id="syncGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs>
                    <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={areaD} fill="url(#syncGrad)" />
                    <text x="8" y="16" style={{ fontSize: '11px', fontWeight: 900, fill: 'var(--primary)' }}>MAX: {(maxVal * 100).toFixed(1)}%</text>
                    <text x="8" y="110" style={{ fontSize: '11px', fontWeight: 900, fill: '#666', opacity: 0.8 }}>MIN: {(minVal * 100).toFixed(1)}%</text>
                </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.65rem', color: '#888', fontWeight: 600 }}>
                <span>{history[0].date.split('-').slice(1).join('/')}</span><span>{history[history.length - 1].date.split('-').slice(1).join('/')}</span>
            </div>
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: '12px', paddingTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div><div style={{ fontSize: '0.6rem', color: '#999' }}>Avg Sync</div><div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{(avg * 100).toFixed(1)}%</div></div>
                <div><div style={{ fontSize: '0.6rem', color: '#999' }}>Current</div><div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{(current * 100).toFixed(1)}%</div></div>
            </div>
        </div>
    );
};

// --- Sector Influence Table Row ---
export const formatTradingValue = (v: number | undefined | null, isUS: boolean) => {
    if (!v) return '0';
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

export const SectorTableRow = ({ sec, market, correlation, idx, isLast }: any) => {
    const c = getColor(sec.changePercent);
    const sectorCorr = market === 'US' ? correlation?.sectorCorrelations?.[sec.id] : market === 'KR' ? correlation?.krSectorCorrelations?.[sec.id] : correlation?.kqSectorCorrelations?.[sec.id];
    const sectorSync = correlation?.sectorSync?.[sec.id];
    const sortedByValue = [...sec.stocks].sort((a, b) => (b.tradingValue || 0) - (a.tradingValue || 0)).slice(0, 3);

    return (
        <tr style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', transition: 'all 0.2s' }}>
            <td style={{ padding: '1.5rem', textAlign: 'center' }}><div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{sec.name}</div></td>
            <td style={{ padding: '1.5rem', textAlign: 'center' }}><div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{sec.weight.toFixed(1)}%</div></td>
            <td style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', padding: '0.5rem 1rem', background: c.bg, color: c.text, borderRadius: '10px', fontWeight: 900, fontSize: '1.1rem', border: `1px solid ${c.border}`, minWidth: '85px', justifyContent: 'center' }}>
                    {sec.changePercent >= 0 ? '+' : ''}{sec.changePercent.toFixed(2)}%
                </div>
            </td>
            <td style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {sortedByValue.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem' }}>
                            <div style={{ width: '28px', textAlign: 'center', fontSize: '0.6rem', fontWeight: 900, background: i === 0 ? 'var(--primary)' : 'rgba(255,255,255,0.1)', color: i === 0 ? 'white' : 'var(--muted)', padding: '1px 3px', borderRadius: '4px' }}>{i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : 'rd'}</div>
                            <span style={{ fontWeight: i === 0 ? 800 : 600 }}>{s.name}</span>
                            <span style={{ fontSize: '0.75rem', color: s.changePercent >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 800 }}>{s.changePercent >= 0 ? '+' : ''}{s.changePercent.toFixed(1)}%</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>({formatTradingValue(s.tradingValue, market === 'US')})</span>
                        </div>
                    ))}
                </div>
            </td>
            <td style={{ padding: '1.5rem', textAlign: 'right' }}>
                {sectorCorr !== undefined ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: sectorCorr > 0.65 ? '#dc2626' : 'inherit' }}>{(sectorCorr * 100).toFixed(1)}%</div>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--muted)', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)' }}>{sectorCorr > 0.75 ? 'Critical' : sectorCorr > 0.4 ? 'Matched' : 'Decoupled'}</div>
                    </div>
                ) : '-'}
            </td>
            <td style={{ padding: '1.5rem', textAlign: 'right' }}>
                {sectorSync !== undefined ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: sectorSync > 0.6 ? '#dc2626' : 'inherit' }}>{(sectorSync * 100).toFixed(1)}%</div>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--primary)', padding: '1px 5px', borderRadius: '4px', background: 'rgba(var(--primary-rgb), 0.05)' }}>{sectorSync > 0.6 ? 'High Sync' : 'Low Sync'}</div>
                    </div>
                ) : '-'}
            </td>
        </tr>
    );
};
