import React from 'react';
import { TrendingUp } from 'lucide-react';
import { formatKRW } from '@/lib/utils';
import { SpotlightCard } from '@/components/common/SpotlightCard';

interface HeroSectionProps {
    totalValueKRW: number;
    change: number;
    changePercent: number;
    isPrivate: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
    totalValueKRW,
    change,
    changePercent,
    isPrivate
}) => {
    return (
        <SpotlightCard
            style={{
                padding: '3rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gridColumn: '1 / -1',
                background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)'
            }}
        >
            <span className="section-label" style={{ marginBottom: '1.5rem', opacity: 0.8 }}>Total Net Worth</span>
            {!isPrivate && (
                <div className="hero-value" style={{ marginBottom: '1.5rem' }}>
                    {formatKRW(totalValueKRW)}
                </div>
            )}

            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: isPrivate ? '1rem 2rem' : '0.6rem 1.25rem',
                borderRadius: '100px',
                backgroundColor: change >= 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                color: change >= 0 ? '#ef4444' : '#60a5fa',
                fontWeight: '700',
                fontSize: isPrivate ? '1.5rem' : '1.1rem'
            }}>
                {change >= 0 ? <TrendingUp size={isPrivate ? 28 : 22} /> : <TrendingUp size={isPrivate ? 28 : 22} style={{ transform: 'rotate(180deg)' }} />}
                <span>{change >= 0 ? '+' : ''}{changePercent.toFixed(2)}%</span>
                {!isPrivate && (
                    <span style={{ fontSize: '0.9rem', opacity: 0.7, marginLeft: '0.2rem' }}>
                        ({formatKRW(Math.abs(change))})
                    </span>
                )}
            </div>
        </SpotlightCard>
    );
};
