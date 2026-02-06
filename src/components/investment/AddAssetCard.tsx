import React from 'react';
import { PlusCircle } from 'lucide-react';
import { AssetCategory, MarketType } from '@/lib/types';

interface AddAssetCardProps {
    newInvestment: {
        symbol: string;
        shares: string;
        avgPrice: string;
        marketType: MarketType;
        category: AssetCategory;
    };
    mousePos: { x: number; y: number };
    onMouseMove: (e: React.MouseEvent) => void;
    onFormChange: (field: string, value: any) => void;
    onSubmit: () => Promise<void>;
}

export const AddAssetCard: React.FC<AddAssetCardProps> = ({
    newInvestment,
    mousePos,
    onMouseMove,
    onFormChange,
    onSubmit
}) => {
    return (
        <div className="glass" onMouseMove={onMouseMove} style={{ padding: '1.5rem', border: '1px solid var(--primary-glow)' }}>
            <div className="spotlight" style={{ left: mousePos.x, top: mousePos.y }}></div>
            <span className="section-label" style={{ marginBottom: '1.5rem' }}>Add Asset</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
                <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>티커 (AAPL, 005930.KS, 114800.KS)</label>
                    <input
                        type="text"
                        placeholder="SYMBOL"
                        value={newInvestment.symbol}
                        onChange={(e) => onFormChange('symbol', e.target.value.toUpperCase())}
                        className="glass"
                        style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', color: 'white' }}
                    />
                </div>
                <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>분류</label>
                    <select
                        value={newInvestment.category}
                        onChange={(e) => onFormChange('category', e.target.value)}
                        className="glass"
                        style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', background: 'var(--card)', color: 'white' }}
                    >
                        <option value="Domestic Stock">국내 주식</option>
                        <option value="Domestic Index">국내 지수</option>
                        <option value="Domestic Bond">국내 채권</option>
                        <option value="Overseas Stock">해외 주식</option>
                        <option value="Overseas Index">해외 지수</option>
                        <option value="Overseas Bond">해외 채권</option>
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>수량</label>
                    <input
                        type="text"
                        value={newInvestment.shares}
                        onChange={(e) => onFormChange('shares', e.target.value)}
                        className="glass"
                        style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', color: 'white' }}
                    />
                </div>
                <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>평단가</label>
                    <input
                        type="text"
                        value={newInvestment.avgPrice}
                        onChange={(e) => onFormChange('avgPrice', e.target.value)}
                        className="glass"
                        style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', color: 'white' }}
                    />
                </div>
                <button onClick={onSubmit} className="glass" style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 'bold', height: '3.2rem' }}>
                    <PlusCircle size={18} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 항목 추가
                </button>
            </div>
        </div>
    );
};
