import React from 'react';
import { formatPrice, formatKRW } from '@/lib/utils';

export const formatValue = (v: number, isPrivate: boolean, currency: string = 'KRW') => isPrivate ? '*****' : formatPrice(v, currency);

interface RenderChangeProps {
    val: number;
    percent: number;
    showPercentOnly?: boolean;
    hidePercent?: boolean;
    isPrivate?: boolean;
}

export const RenderChange: React.FC<RenderChangeProps> = ({ val, percent, showPercentOnly = false, hidePercent = false, isPrivate = false }) => {
    const roundedVal = Math.round(val);
    const roundedPercent = Number(percent.toFixed(2));

    if (roundedVal === 0 && roundedPercent === 0) return <span style={{ color: 'var(--muted)' }}>-</span>;
    const isUp = roundedVal > 0 || (roundedPercent > 0 && !hidePercent);
    const color = isUp ? '#dc2626' : '#2563eb';
    const triangle = isUp ? '▲' : '▼';

    if (showPercentOnly || (isPrivate && !hidePercent)) {
        if (hidePercent && !isPrivate) return null;
        if (hidePercent && isPrivate) return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem', color: 'var(--muted)', fontWeight: '600' }}><span>*****</span></div>;
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem', color, fontWeight: '600' }}>
                <span>{triangle}</span>
                <span>{Math.abs(roundedPercent).toFixed(2)}%</span>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem', color, fontWeight: '600' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span>{triangle}</span>
                <span>{isPrivate ? '*****' : formatKRW(Math.abs(roundedVal))}</span>
            </div>
            {!hidePercent && (
                <span style={{ opacity: 0.85 }}>{isUp ? '+' : '-'}{Math.abs(roundedPercent).toFixed(2)}%</span>
            )}
        </div>
    );
};
