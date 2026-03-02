import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, Search } from 'lucide-react';
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
    };
    mousePos: { x: number; y: number };
    onMouseMove: (e: React.MouseEvent) => void;
    onFormChange: (field: string, value: any) => void;
    onSubmit: () => Promise<void>;
}

export const AddAssetCard: React.FC<AddAssetCardProps> = ({
    newInvestment,
    mousePos,
    onMouseMove,
    onFormChange,
    onSubmit
}) => {
    const [searchQuery, setSearchQuery] = useState(newInvestment.symbol);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
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
            // Don't search if it perfectly matches the selected symbol to avoid re-fetching on selection
            if (query && query !== newInvestment.symbol && showResults) {
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
        <div className="glass" onMouseMove={onMouseMove} style={{ padding: '1.5rem', border: '1px solid var(--primary-glow)', overflow: 'visible' }}>
            <div className="spotlight" style={{ left: mousePos.x, top: mousePos.y }}></div>
            <span className="section-label" style={{ marginBottom: '1.5rem' }}>종목 추가</span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
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
                                            key={item.symbol}
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
                <button onClick={onSubmit} className="glass" style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 'bold', height: '3.2rem' }}>
                    <PlusCircle size={18} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 항목 추가
                </button>
            </div>
        </div>
    );
};
