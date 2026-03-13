'use client';

import React from 'react';

interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    style?: React.CSSProperties;
}

/**
 * SVG-based sparkline mini chart.
 * Draws a smooth line representing price movement.
 */
export const Sparkline: React.FC<SparklineProps> = ({
    data,
    width = 120,
    height = 36,
    color,
    style
}) => {
    if (!data || data.length < 2) {
        return (
            <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--muted)', opacity: 0.5 }}>—</span>
            </div>
        );
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;

    // Determine color from price trend if not specified
    const lineColor = color || (data[data.length - 1] >= data[0] ? '#dc2626' : '#3b82f6');

    // Create SVG path
    const points = data.map((val, i) => {
        const x = padding + (i / (data.length - 1)) * (width - padding * 2);
        const y = padding + (1 - (val - min) / range) * (height - padding * 2);
        return { x, y };
    });

    // Build smooth path using cubic bezier
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpx = (prev.x + curr.x) / 2;
        pathD += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    // Gradient fill path
    const fillD = pathD +
        ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    const gradientId = `spark-grad-${Math.random().toString(36).slice(2, 8)}`;

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ display: 'block', overflow: 'visible', ...style }}
        >
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path
                d={fillD}
                fill={`url(#${gradientId})`}
            />
            <path
                d={pathD}
                fill="none"
                stroke={lineColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Current price dot */}
            <circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r="2"
                fill={lineColor}
            />
        </svg>
    );
};
