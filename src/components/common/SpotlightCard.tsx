import React, { useState } from 'react';

interface SpotlightCardProps {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    onMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({ children, style, className, onMouseMove }) => {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        if (onMouseMove) onMouseMove(e);
    };

    return (
        <div
            className={`glass ${className || ''}`}
            onMouseMove={handleMouseMove}
            style={{ position: 'relative', overflow: 'hidden', ...style }}
        >
            <div
                className="spotlight"
                style={{
                    position: 'absolute',
                    pointerEvents: 'none',
                    left: mousePos.x,
                    top: mousePos.y,
                    transform: 'translate(-50%, -50%)',
                    width: '600px',
                    height: '600px',
                    background: 'radial-gradient(circle, rgba(var(--primary-glow-rgb), 0.15) 0%, transparent 70%)',
                    zIndex: 1
                }}
            ></div>
            <div style={{ position: 'relative', zIndex: 2 }}>
                {children}
            </div>
        </div>
    );
};
