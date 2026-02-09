import React from 'react';
import { X } from 'lucide-react';
import { Investment, TransactionType } from '@/lib/types';

interface TransactionModalProps {
    selectedInv: Investment;
    txForm: {
        type: TransactionType;
        date: string;
        shares: string;
        price: string;
        notes: string;
    };
    onClose: () => void;
    onTypeChange: (type: TransactionType) => void;
    onFormChange: (field: string, value: string) => void;
    onMaxSell: () => void;
    onSubmit: () => Promise<void>;
    isEditing?: boolean;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
    selectedInv,
    txForm,
    onClose,
    onTypeChange,
    onFormChange,
    onMaxSell,
    onSubmit,
    isEditing
}) => {
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="glass" style={{ width: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{isEditing ? '거래 수정' : '거래 기록'}: {selectedInv.name || selectedInv.symbol}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => onTypeChange('BUY')}
                        style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: txForm.type === 'BUY' ? '#ef4444' : 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                        매수
                    </button>
                    <button
                        onClick={() => onTypeChange('SELL')}
                        style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: txForm.type === 'SELL' ? '#3b82f6' : 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                        매도
                    </button>
                </div>

                <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>날짜</label>
                    <input type="date" value={txForm.date} onChange={e => onFormChange('date', e.target.value)} className="glass" style={{ width: '100%', padding: '0.75rem', color: 'white' }} />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>수량</label>
                            {txForm.type === 'SELL' && (
                                <button
                                    onClick={onMaxSell}
                                    style={{ fontSize: '0.7rem', color: 'var(--accent)', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    전량 매도
                                </button>
                            )}
                        </div>
                        <input type="number" value={txForm.shares} onChange={e => onFormChange('shares', e.target.value)} className="glass" style={{ width: '100%', padding: '0.75rem', color: 'white' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>가격 ({selectedInv.currency})</label>
                        <input type="number" value={txForm.price} onChange={e => onFormChange('price', e.target.value)} className="glass" style={{ width: '100%', padding: '0.75rem', color: 'white' }} />
                    </div>
                </div>

                <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>메모</label>
                    <textarea
                        value={txForm.notes || ''}
                        onChange={e => onFormChange('notes', e.target.value)}
                        className="glass"
                        style={{ width: '100%', padding: '0.75rem', color: 'white', height: '80px', resize: 'none' }}
                        placeholder="거래 메모를 입력하세요"
                    />
                </div>

                <button onClick={onSubmit} className="glass" style={{ width: '100%', padding: '1rem', background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 'bold', marginTop: '1rem' }}>
                    {isEditing ? '수정 완료' : '기록 저장'}
                </button>
            </div>
        </div>
    );
};
