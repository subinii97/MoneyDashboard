import React, { useState } from 'react';

interface SpotlightCardProps {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    onMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({ children, style, className, onMouseMove }) => {
    return (
        <div
            className={`glass ${className || ''}`}
            onMouseMove={onMouseMove}
            style={style}
        >
            {children}
        </div>
    );
};
