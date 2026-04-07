import React from 'react';
import { Sector, Stock } from '@/components/Analysis/types';
import { Rect, squarifyLayout, getColor } from '@/components/Analysis/TreemapUtils';
import { StockTile } from '@/components/Analysis/StockTile';

const SECTOR_GAP = 1.2;
const HEADER_H = 28;
const CONTENT_PADDING = 0.5;

export function SectorTile({ sector, rect, onHover, correlation }: { sector: Sector; rect: Rect; onHover: (s: Stock | null, e: React.MouseEvent) => void; correlation?: number; }) {
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
        <div style={{ position: 'absolute', left: rect.x + SECTOR_GAP / 2, top: rect.y + SECTOR_GAP / 2, width: innerW, height: innerH, background: 'transparent', borderRadius: 4, overflow: 'hidden', boxSizing: 'border-box', transition: 'left 0.5s ease-out, top 0.5s ease-out, width 0.5s ease-out, height 0.5s ease-out' }}>
            <div style={{ height: HEADER_H, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sector.name}</span>
                    {correlation !== undefined && (
                        <span style={{ fontSize: '10.5px', fontWeight: 900, color: correlation > 0.6 ? '#f87171' : '#eee', backgroundColor: 'rgba(0,0,0,0.4)', padding: '2px 5px', borderRadius: '5px', border: `1px solid ${correlation > 0.6 ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.15)'}`, whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                            🔗 {correlation.toFixed(2)}
                        </span>
                    )}
                </div>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', marginLeft: 6, opacity: 0.9 }}>
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
