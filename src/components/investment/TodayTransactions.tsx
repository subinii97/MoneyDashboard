'use client';

import React from 'react';
import { Edit } from 'lucide-react';
import { Transaction, Investment } from '@/lib/types';

interface Props {
    transactions: Transaction[];
    investments: Investment[];
    knownNames: Record<string, string>;
    onEditTx: (tx: Transaction) => void;
}

export function TodayTransactions({ transactions, investments, knownNames, onEditTx }: Props) {
    if (transactions.length === 0) return null;

    return (
        <div className="glass" style={{ padding: '1.5rem' }}>
            <span className="section-label" style={{ marginBottom: '1rem' }}>Today's Activity</span>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '0.75rem' }}>거래소</th>
                        <th style={{ padding: '0.75rem' }}>종목 정보</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>수량</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>단가</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>금액</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>작업</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map(tx => {
                        const inv = investments.find(i => i.symbol === tx.symbol);
                        const name = (inv?.name) || knownNames[tx.symbol || ''];
                        const displayName = name ? `${name} (${tx.symbol})` : tx.symbol;
                        const prefix = tx.currency === 'USD' ? '$' : '₩';

                        return (
                            <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.75rem' }}>
                                    <span style={{
                                        color: tx.type === 'BUY' ? '#dc2626' : '#2563eb',
                                        fontWeight: 'bold',
                                        fontSize: '0.75rem',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: tx.type === 'BUY' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)'
                                    }}>
                                        {tx.type}
                                    </span>
                                </td>
                                <td style={{ padding: '0.75rem', fontWeight: '600' }}>{displayName}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>{tx.shares}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                    {prefix}{Number(tx.price).toLocaleString()}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', opacity: 0.8 }}>
                                    {prefix}{Number(tx.amount).toLocaleString()}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <button
                                        onClick={() => onEditTx(tx)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', opacity: 0.8 }}
                                    >
                                        <Edit size={16} />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
