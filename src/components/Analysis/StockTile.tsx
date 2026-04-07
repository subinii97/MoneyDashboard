import React from 'react';
import { Stock } from '@/components/Analysis/types';
import { Rect, getColor } from '@/components/Analysis/TreemapUtils';

const GAP = 1.0;

export function StockTile({ stock, rect, onHover }: { stock: Stock; rect: Rect; onHover: (s: Stock | null, e: React.MouseEvent) => void }) {
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
                transition: 'filter 0.2s, left 0.5s ease-out, top 0.5s ease-out, width 0.5s ease-out, height 0.5s ease-out, background 0.5s ease-out',
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
