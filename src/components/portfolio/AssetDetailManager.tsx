'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AssetAllocation, CATEGORY_MAP, CATEGORY_COLORS, AssetDetail } from '@/lib/types';
import { formatKRW, convertToKRW } from '@/lib/utils';

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
    const cashCategories = allocations.filter(a => a.category === 'Cash' || a.category === 'Savings');

    return (
        <section style={{ marginBottom: '6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div>
                    <span className="section-label">Cash & Savings</span>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.02em' }}>현금 / 예적금 관리</h2>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'right' }}>
                    항목을 추가해 현금·예금을 세분화하여 관리하세요
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(370px, 1fr))', gap: '1.5rem' }}>
                {cashCategories.map(a => {
                    const color = CATEGORY_COLORS[a.category as keyof typeof CATEGORY_COLORS];
                    const subtotal = getCurrentValue(a);

                    return (
                        <div
                            key={a.id}
                            className="glass"
                            style={{ padding: '1.5rem', borderRadius: '1.25rem' }}
                        >
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                                    <span style={{ fontWeight: '700', fontSize: '1rem' }}>
                                        {CATEGORY_MAP[a.category as keyof typeof CATEGORY_MAP]}
                                    </span>
                                </div>
                                <button
                                    onClick={() => onAddDetail(a.category)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                                        padding: '0.35rem 0.75rem', borderRadius: '8px',
                                        background: 'var(--primary-glow)', border: '1px solid var(--primary)',
                                        color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer'
                                    }}
                                >
                                    <Plus size={13} /> 항목 추가
                                </button>
                            </div>

                            {/* Detail rows */}
                            {(a.details || []).length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
                                    항목이 없습니다. "+ 항목 추가"를 눌러 추가하세요
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                                    {(a.details || []).map(d => (
                                        <div
                                            key={d.id}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 130px 60px auto',
                                                gap: '0.5rem',
                                                alignItems: 'center',
                                                padding: '0.6rem 0.75rem',
                                                borderRadius: '10px',
                                                background: 'var(--input-bg)',
                                                border: '1px solid var(--border)',
                                            }}
                                        >
                                            <input
                                                placeholder="항목명 (예: KB 보통예금)"
                                                value={d.name}
                                                onChange={e => onUpdateDetail(a.category, d.id, { name: e.target.value })}
                                                style={{
                                                    background: 'transparent', border: 'none', outline: 'none',
                                                    color: 'var(--foreground)', fontSize: '0.88rem', fontWeight: '500',
                                                    width: '100%'
                                                }}
                                            />
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="금액"
                                                value={d.value === 0 ? '' : d.value.toLocaleString()}
                                                onChange={e => {
                                                    const raw = e.target.value.replace(/,/g, '');
                                                    if (!isNaN(Number(raw))) onUpdateDetail(a.category, d.id, { value: Number(raw) });
                                                }}
                                                style={{
                                                    background: 'transparent', border: 'none', outline: 'none',
                                                    color: 'var(--foreground)', fontSize: '0.88rem', textAlign: 'right',
                                                    width: '100%', filter: isPrivate ? 'blur(6px)' : 'none'
                                                }}
                                            />
                                            <select
                                                value={d.currency || a.currency}
                                                onChange={e => onUpdateDetail(a.category, d.id, { currency: e.target.value as 'KRW' | 'USD' })}
                                                style={{
                                                    background: 'var(--input-bg)', border: '1px solid var(--border-bright)',
                                                    borderRadius: '6px', color: 'var(--primary)', fontSize: '0.75rem',
                                                    fontWeight: '700', padding: '0.25rem', cursor: 'pointer', outline: 'none',
                                                    width: '100%'
                                                }}
                                            >
                                                <option value="KRW">KRW</option>
                                                <option value="USD">USD</option>
                                            </select>
                                            <button
                                                onClick={() => onDeleteDetail(a.category, d.id)}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    color: 'var(--muted)', padding: '0.2rem', display: 'flex',
                                                    alignItems: 'center', opacity: 0.7,
                                                    transition: 'color 0.2s'
                                                }}
                                                onMouseOver={e => (e.currentTarget.style.color = '#dc2626')}
                                                onMouseOut={e => (e.currentTarget.style.color = 'var(--muted)')}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Subtotal */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>소계</span>
                                <span
                                    className="gradient-text"
                                    style={{ fontSize: '1.15rem', fontWeight: '800', filter: isPrivate ? 'blur(8px)' : 'none' }}
                                >
                                    {formatKRW(subtotal)}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};
