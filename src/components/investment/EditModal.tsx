import React from 'react';
import { X } from 'lucide-react';
import { Investment, AssetCategory } from '@/lib/types';

interface EditModalProps {
    editingInvestment: Investment;
    editForm: {
        shares: string;
        avgPrice: string;
        category: AssetCategory;
        tags: string[];
    };
    onClose: () => void;
    onFormChange: (field: string, value: any) => void;
    onSubmit: () => Promise<void>;
}

export const EditModal: React.FC<EditModalProps> = ({
    editingInvestment,
    editForm,
    onClose,
    onFormChange,
    onSubmit
}) => {
    const [tagInput, setTagInput] = React.useState('');

    const handleAddTag = () => {
        const val = tagInput.trim().replace(',', '');
        if (val && !(editForm.tags || []).includes(val)) {
            onFormChange('tags', [...(editForm.tags || []), val]);
        }
        setTagInput('');
    };
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--background)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
            <div className="card-hover" style={{ width: '450px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid var(--border)', backgroundColor: 'var(--card)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>항목 수정</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{editingInvestment.name || editingInvestment.symbol} ({editingInvestment.symbol})</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.5rem' }}>자산 분류</label>
                        <select
                            value={editForm.category || ''}
                            onChange={e => onFormChange('category', e.target.value)}
                            className="glass"
                            style={{ width: '100%', padding: '0.8rem', background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
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
                                style={{ width: '100%', padding: '0.8rem', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.5rem' }}>평단가 ({editingInvestment.currency})</label>
                            <input
                                type="number" step="any"
                                value={editForm.avgPrice}
                                onChange={e => onFormChange('avgPrice', e.target.value)}
                                className="glass"
                                style={{ width: '100%', padding: '0.8rem', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.5rem' }}>태그</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.4rem' }}>
                            {(editForm.tags || []).map((tag) => (
                                <span key={tag} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                    padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem',
                                    background: 'var(--primary)', color: 'white', fontWeight: '600'
                                }}>
                                    {tag}
                                    <button onClick={() => onFormChange('tags', (editForm.tags || []).filter(t => t !== tag))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="태그 입력 후 Enter"
                                className="glass"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                style={{ flex: 1, padding: '0.8rem', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                        e.preventDefault();
                                        if (e.nativeEvent.isComposing) {
                                            // Let the composition finish, but we still want to add the tag
                                            // The timing means the value might not have the last character yet in React state
                                            // But standard behavior: just let the form value sync properly on next render
                                            return;
                                        }
                                        handleAddTag();
                                    }
                                }}
                                onKeyUp={(e) => {
                                    // Korean IME specific fix: handling enter after composition finishes
                                    if (e.key === 'Enter' && tagInput.trim()) {
                                        handleAddTag();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleAddTag}
                                className="glass"
                                style={{ padding: '0.8rem 1rem', cursor: 'pointer', background: 'var(--primary)', color: 'white', border: 'none', fontWeight: '600', borderRadius: '8px', whiteSpace: 'nowrap' }}
                            >추가</button>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                        onClick={onClose}
                        style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontWeight: 'bold' }}
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
