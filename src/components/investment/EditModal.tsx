import React from 'react';
import { X } from 'lucide-react';
import { Investment, AssetCategory } from '@/lib/types';

interface EditModalProps {
    editingInvestment: Investment;
    viewMode: 'aggregated' | 'detailed';
    editForm: {
        shares: string;
        avgPrice: string;
        category: AssetCategory;
    };
    onClose: () => void;
    onFormChange: (field: string, value: any) => void;
    onSubmit: () => Promise<void>;
}

export const EditModal: React.FC<EditModalProps> = ({
    editingInvestment,
    viewMode,
    editForm,
    onClose,
    onFormChange,
    onSubmit
}) => {
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
            <div className="glass" style={{ width: '450px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid rgba(255,255,255,0.25)', backgroundColor: '#1a1d23', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>항목 수정</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{editingInvestment.name || editingInvestment.symbol} ({editingInvestment.symbol})</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                {viewMode === 'aggregated' && (
                    <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#eab308', fontSize: '0.8rem' }}>
                        ⚠️ 종목별 합산 모드에서 수정 시, 해당 종목의 모든 매수 기록이 하나로 통합됩니다.
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.5rem' }}>자산 분류</label>
                        <select
                            value={editForm.category || ''}
                            onChange={e => onFormChange('category', e.target.value)}
                            className="glass"
                            style={{ width: '100%', padding: '0.8rem', background: 'var(--card)', color: 'white', border: '1px solid var(--border)' }}
                        >
                            <option value="" disabled>분류 선택</option>
                            <option value="Domestic Stock">국내 주식</option>
                            <option value="Domestic Index">국내 지수</option>
                            <option value="Domestic Bond">국내 채권</option>
                            <option value="Overseas Stock">해외 주식</option>
                            <option value="Overseas Index">해외 지수</option>
                            <option value="Overseas Bond">해외 채권</option>
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.5rem' }}>수량</label>
                            <input
                                type="number" step="any"
                                value={editForm.shares}
                                onChange={e => onFormChange('shares', e.target.value)}
                                className="glass"
                                style={{ width: '100%', padding: '0.8rem', color: 'white', border: '1px solid var(--border)' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.5rem' }}>평단가 ({editingInvestment.currency})</label>
                            <input
                                type="number" step="any"
                                value={editForm.avgPrice}
                                onChange={e => onFormChange('avgPrice', e.target.value)}
                                className="glass"
                                style={{ width: '100%', padding: '0.8rem', color: 'white', border: '1px solid var(--border)' }}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                        onClick={onClose}
                        style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        취소
                    </button>
                    <button
                        onClick={onSubmit}
                        style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        저장하기
                    </button>
                </div>
            </div>
        </div>
    );
};
