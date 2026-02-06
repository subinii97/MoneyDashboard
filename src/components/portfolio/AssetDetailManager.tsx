import React from 'react';
import { Calculator } from 'lucide-react';
import { AssetAllocation, CATEGORY_MAP, CATEGORY_COLORS, AssetDetail } from '@/lib/types';
import { formatKRW } from '@/lib/utils';

interface AssetDetailManagerProps {
    allocations: AssetAllocation[];
    isPrivate: boolean;
    getCurrentValue: (a: AssetAllocation) => number;
    onAddDetail: (category: any) => void;
    onDeleteDetail: (category: any, id: string) => void;
    onUpdateDetail: (category: any, id: string, updates: Partial<AssetDetail>) => void;
}

export const AssetDetailManager: React.FC<AssetDetailManagerProps> = ({
    allocations,
    isPrivate,
    getCurrentValue,
    onAddDetail,
    onDeleteDetail,
    onUpdateDetail
}) => {
    return (
        <section className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <Calculator size={24} color="var(--primary)" />
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>자산 관리</h2>
            </div>
            <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>보유 중인 현금 및 예적금을 항목별로 나누어 관리할 수 있습니다.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {allocations
                    .filter(a => a.category === 'Cash' || a.category === 'Savings')
                    .map(a => (
                        <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: CATEGORY_COLORS[a.category as keyof typeof CATEGORY_COLORS] }}></div>
                                    {CATEGORY_MAP[a.category as keyof typeof CATEGORY_MAP]}
                                </div>
                                <button onClick={() => onAddDetail(a.category)} className="glass" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--primary)' }}>+ 항목 추가</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {(a.details || []).map(d => (
                                    <div key={d.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <input
                                            placeholder="항목 명칭" value={d.name}
                                            onChange={(e) => onUpdateDetail(a.category, d.id, { name: e.target.value })}
                                            className="glass"
                                            style={{ flex: 2, padding: '0.4rem', fontSize: '0.85rem', background: 'transparent', color: 'white', border: '1px solid var(--border)' }}
                                        />
                                        <input
                                            type="number" placeholder="금액" value={d.value}
                                            onChange={(e) => onUpdateDetail(a.category, d.id, { value: Number(e.target.value) })}
                                            className="glass"
                                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem', textAlign: 'right', background: 'transparent', color: 'white', border: '1px solid var(--border)', filter: isPrivate ? 'blur(6px)' : 'none' }}
                                        />
                                        <select
                                            value={d.currency || a.currency}
                                            onChange={(e) => onUpdateDetail(a.category, d.id, { currency: e.target.value as 'KRW' | 'USD' })}
                                            className="glass"
                                            style={{ padding: '0.4rem', fontSize: '0.75rem', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--border)', cursor: 'pointer' }}
                                        >
                                            <option value="KRW" style={{ background: '#1c1c1e' }}>KRW</option>
                                            <option value="USD" style={{ background: '#1c1c1e' }}>USD</option>
                                        </select>
                                        <button onClick={() => onDeleteDetail(a.category, d.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}>×</button>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '1rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                <span style={{ color: 'var(--muted)', marginRight: '0.5rem' }}>소계:</span>
                                <span className="gradient-text" style={{ fontSize: '1.2rem', filter: isPrivate ? 'blur(8px)' : 'none' }}>{formatKRW(getCurrentValue(a))}</span>
                            </div>
                        </div>
                    ))}
            </div>
        </section>
    );
};
