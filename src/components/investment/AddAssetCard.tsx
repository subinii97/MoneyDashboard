import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, Search, X } from 'lucide-react';
import { AssetCategory, MarketType } from '@/lib/types';

interface SearchResult {
    symbol: string;
    name: string;
    exchange: string;
    isDomestic: boolean;
}

interface AddAssetCardProps {
    newInvestment: {
        symbol: string;
        shares: string;
        avgPrice: string;
        marketType: MarketType;
        category: AssetCategory;
        tags?: string[];
    };
    mousePos: { x: number; y: number };
    onMouseMove: (e: React.MouseEvent) => void;
    onFormChange: (field: string, value: any) => void;
    onSubmit: () => Promise<void>;
    onCancel: () => void;
}

export const AddAssetCard: React.FC<AddAssetCardProps> = ({
    newInvestment,
    mousePos,
    onMouseMove,
    onFormChange,
    onSubmit,
    onCancel
}) => {
    const [searchQuery, setSearchQuery] = useState(newInvestment.symbol);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [tagInput, setTagInput] = useState('');

    const handleAddTag = () => {
        const val = tagInput.trim().replace(',', '');
        if (val && !(newInvestment.tags || []).includes(val)) {
            onFormChange('tags', [...(newInvestment.tags || []), val]);
        }
        setTagInput('');
    };
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Sync external symbol changes back to search query (e.g. after submit clears it)
    useEffect(() => {
        setSearchQuery(newInvestment.symbol);
    }, [newInvestment.symbol]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const timer = setTimeout(async () => {
            const query = searchQuery.trim();
            // Search when typed, relying on showResults to prevent auto-searching after selection
            if (query && showResults) {
                setIsSearching(true);
                try {
                    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                    const data = await res.json();
                    setResults(data.results || []);
                } catch (e) {
                    setResults([]);
                } finally {
                    setIsSearching(false);
                }
            } else if (!query) {
                setResults([]);
            }
        }, 300); // 300ms debounce
        return () => clearTimeout(timer);
    }, [searchQuery, showResults, newInvestment.symbol]);

    const handleSelect = (item: SearchResult) => {
        setSearchQuery(item.symbol);
        onFormChange('symbol', item.symbol);
        onFormChange('category', item.isDomestic ? 'Domestic Stock' : 'Overseas Stock');
        setShowResults(false);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase();
        setSearchQuery(val);
        onFormChange('symbol', val);
        setShowResults(true);
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
            <div className="glass" onMouseMove={onMouseMove} style={{ width: '450px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid var(--primary-glow)', backgroundColor: 'var(--card)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', overflow: 'visible', position: 'relative' }}>
                <div className="spotlight" style={{ left: mousePos.x, top: mousePos.y }}></div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <span className="section-label" style={{ marginBottom: '0.2rem' }}>자산 관리</span>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>종목 추가</h2>
                    </div>
                    <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ position: 'relative' }} ref={searchRef}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>종목검색 / 티커입력</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="삼성전자 또는 005930.KS"
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onFocus={() => setShowResults(true)}
                                className="glass"
                                style={{ width: '100%', padding: '0.75rem', paddingRight: '2rem', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                            />
                            <Search size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                        </div>

                        {/* Search Results Dropdown */}
                        {showResults && (searchQuery.trim().length > 0) && (
                            <div className="glass" style={{
                                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                                maxHeight: '200px', overflowY: 'auto', zIndex: 100,
                                border: '1px solid var(--border)', background: 'var(--background)',
                                borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                            }}>
                                {isSearching ? (
                                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>검색 중...</div>
                                ) : results.length > 0 ? (
                                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                        {results.map((item) => (
                                            <li
                                                key={`${item.symbol}-${item.exchange}`}
                                                onClick={() => handleSelect(item)}
                                                style={{
                                                    padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
                                                    cursor: 'pointer', transition: 'background 0.2s',
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{item.name}</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px', fontFamily: 'monospace' }}>{item.symbol}</span>
                                                </div>
                                                <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--border)', borderRadius: '4px', color: 'var(--muted)' }}>
                                                    {item.exchange}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>결과가 없습니다.</div>
                                )}
                            </div>
                        )}
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>분류</label>
                        <select
                            value={newInvestment.category}
                            onChange={(e) => onFormChange('category', e.target.value)}
                            className="glass"
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                        >
                            <option value="Domestic Stock">국내 주식</option>
                            <option value="Domestic Index">국내 지수</option>
                            <option value="Domestic Bond">국내 채권</option>
                            <option value="Overseas Stock">해외 주식</option>
                            <option value="Overseas Index">해외 지수</option>
                            <option value="Overseas Bond">해외 채권</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>수량</label>
                        <input
                            type="text"
                            value={newInvestment.shares}
                            onChange={(e) => onFormChange('shares', e.target.value)}
                            className="glass"
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>평단가</label>
                        <input
                            type="text"
                            value={newInvestment.avgPrice}
                            onChange={(e) => onFormChange('avgPrice', e.target.value)}
                            className="glass"
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.4rem' }}>태그</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.4rem' }}>
                            {(newInvestment.tags || []).map((tag) => (
                                <span key={tag} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                    padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem',
                                    background: 'var(--primary)', color: 'white', fontWeight: '600'
                                }}>
                                    {tag}
                                    <button onClick={() => onFormChange('tags', (newInvestment.tags || []).filter(t => t !== tag))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
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
                                style={{ flex: 1, padding: '0.75rem', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                        e.preventDefault();
                                        if (e.nativeEvent.isComposing) return;
                                        handleAddTag();
                                    }
                                }}
                                onKeyUp={(e) => {
                                    if (e.key === 'Enter' && tagInput.trim()) {
                                        handleAddTag();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleAddTag}
                                className="glass"
                                style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: 'var(--primary)', color: 'white', border: 'none', fontWeight: '600', borderRadius: '8px', whiteSpace: 'nowrap' }}
                            >추가</button>
                        </div>
                    </div>
                    <button onClick={onSubmit} className="glass" style={{ marginTop: '0.5rem', padding: '0.75rem 1rem', cursor: 'pointer', background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 'bold', height: '3.2rem', width: '100%' }}>
                        <PlusCircle size={18} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 항목 추가
                    </button>
                </div>
            </div>
        </div>
    );
};
