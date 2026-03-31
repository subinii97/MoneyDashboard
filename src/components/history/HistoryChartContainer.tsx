'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';

interface ChartContainerProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    scope: string;
    onScopeChange: (scope: any) => void;
    customDates?: { start: string, end: string };
    onCustomDatesChange?: (dates: { start: string, end: string }) => void;
    scopes?: Array<{ id: string, label: string }>;
}

export const HistoryChartContainer: React.FC<ChartContainerProps> = ({ title, icon, children, scope, onScopeChange, customDates, onCustomDatesChange, scopes }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const defaultScopes = [{ id: '1w', label: '1주' }, { id: '2w', label: '2주' }, { id: '1m', label: '1달' }, { id: '3m', label: '3달' }, { id: 'weekly', label: '주별' }, { id: 'custom', label: '기간' }];
    const activeScopes = scopes || defaultScopes;

    useEffect(() => {
        const h = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsDropdownOpen(false); };
        document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
    }, []);

    return (
        <section style={{ marginBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>{icon}<h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{title}</h2></div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
                    <div className="glass" style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem' }}>
                        {activeScopes.map((s) => (
                            <button key={s.id} onClick={() => { onScopeChange(s.id); if (s.id === 'custom') setIsDropdownOpen(!isDropdownOpen); else setIsDropdownOpen(false); }}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '6px', border: 'none', background: scope === s.id ? 'var(--primary)' : 'transparent', color: scope === s.id ? 'white' : 'var(--muted)', cursor: 'pointer', fontWeight: '600' }}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                    {isDropdownOpen && scope === 'custom' && customDates && onCustomDatesChange && (
                        <div ref={dropdownRef} className="glass" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.75rem', zIndex: 50, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', animation: 'fIn 0.2s' }}>
                            <style>{`@keyframes fIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={16} color="var(--primary)" /><span style={{ fontSize: '0.9rem', fontWeight: '600' }}>조회 기간 설정</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input type="date" value={customDates.start} onChange={(e) => onCustomDatesChange({ ...customDates, start: e.target.value })} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.85rem' }} />
                                <span style={{ color: 'var(--muted)' }}>~</span>
                                <input type="date" value={customDates.end} onChange={(e) => onCustomDatesChange({ ...customDates, end: e.target.value })} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.85rem' }} />
                            </div>
                            <button onClick={() => setIsDropdownOpen(false)} style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '600', cursor: 'pointer' }}>적용하기</button>
                        </div>
                    )}
                </div>
            </div>
            <div className="glass" style={{ padding: '1.5rem', height: '400px' }}>{children}</div>
        </section>
    );
};
