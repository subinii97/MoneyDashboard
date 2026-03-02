'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Newspaper, Globe, Users, TrendingUp, Flame } from 'lucide-react';
import { SpotlightCard } from '@/components/common/SpotlightCard';

interface Article {
    title: string;
    link: string;
    pubDate: string;
    description: string;
    author: string;
    guid: string;
    imageUrl?: string;
}

import BreakingNewsTicker from './BreakingNewsTicker';

type Category = 'politics' | 'economy' | 'society' | 'world' | 'iran';

export default function NewsPage() {
    const [news, setNews] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState<Category>('politics');

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);

    const fetchNews = async (cat: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/news?category=${cat}`);
            if (res.ok) {
                const data = await res.json();
                setNews(data.articles || []);
                setCurrentIndex(0);
            }
        } catch (err) {
            console.error('Failed to fetch news', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews(category);
    }, [category]);

    // Auto-refresh for iran tab every 5 minutes
    useEffect(() => {
        if (category !== 'iran') return;
        const id = setInterval(() => fetchNews('iran'), 5 * 60 * 1000);
        return () => clearInterval(id);
    }, [category]);

    const handleRefresh = () => {
        fetchNews(category);
    };

    const nextCard = useCallback(() => {
        if (news.length === 0) return;
        setCurrentIndex(prev => (prev === news.length - 1 ? 0 : prev + 1));
    }, [news.length]);

    const prevCard = useCallback(() => {
        if (news.length === 0) return;
        setCurrentIndex(prev => (prev === 0 ? news.length - 1 : prev - 1));
    }, [news.length]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') { setIsAutoPlaying(false); nextCard(); }
            if (e.key === 'ArrowLeft') { setIsAutoPlaying(false); prevCard(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nextCard, prevCard]);

    // Auto-play interval
    useEffect(() => {
        if (!isAutoPlaying || news.length === 0) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => {
                if (prev === news.length - 1) return 0;
                return prev + 1;
            });
        }, 10000);
        return () => clearInterval(interval);
    }, [isAutoPlaying, news.length]);

    const handleMouseEnter = () => setIsAutoPlaying(false);
    const handleMouseLeave = () => setIsAutoPlaying(true);

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        setStartX(e.clientX);
        setIsAutoPlaying(false);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        const diffX = e.clientX - startX;
        if (Math.abs(diffX) > 50) {
            setIsDragging(false);
            if (diffX > 0) prevCard();
            else nextCard();
        }
    };

    const handlePointerUp = () => setIsDragging(false);

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return dateStr; }
    };

    const formatTime = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch { return ''; }
    };

    const isIran = category === 'iran';

    const navItems: { key: Category; label: string; icon: React.ReactNode }[] = [
        { key: 'politics', label: '정치', icon: <Newspaper size={16} /> },
        { key: 'economy', label: '경제', icon: <TrendingUp size={16} /> },
        { key: 'society', label: '사회', icon: <Users size={16} /> },
        { key: 'world', label: '국제/세계', icon: <Globe size={16} /> },
        { key: 'iran', label: '🇮🇷 이란 전쟁', icon: <Flame size={16} /> },
    ];

    return (
        <main style={{ padding: '0 2rem 2rem 2rem', maxWidth: '1500px', margin: '0 auto', color: 'var(--foreground)' }}>
            <BreakingNewsTicker />

            {/* Iran Warning Banner */}
            {isIran && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(220,38,38,0.15) 0%, rgba(239,68,68,0.08) 100%)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '12px',
                    padding: '1rem 1.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                }}>
                    <span style={{ fontSize: '1.5rem' }}>🚨</span>
                    <div>
                        <div style={{ fontWeight: '800', fontSize: '1rem', color: '#ef4444', marginBottom: '0.2rem' }}>
                            이란-이스라엘 분쟁 실시간 속보
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                            Al Jazeera, BBC, NYT, Bloomberg, Guardian, 연합뉴스, SBS 등 주요 매체에서 수집 · 5분마다 갱신
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#ef4444', fontWeight: '600' }}>
                        <span style={{
                            display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                            backgroundColor: '#ef4444',
                            boxShadow: '0 0 0 0 rgba(239,68,68,0.7)',
                            animation: 'pulse 2s infinite'
                        }} />
                        LIVE
                        <style>{`@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.7)}70%{box-shadow:0 0 0 6px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}`}</style>
                    </div>
                </div>
            )}

            <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                <span className="section-label">Real-time News</span>
                <h1 className="gradient-text" style={{ fontSize: '3rem', fontWeight: '900', marginBottom: '1rem', letterSpacing: '-0.03em' }}>뉴스 모아보기</h1>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button
                        onClick={handleRefresh}
                        className="glass flex-center"
                        style={{ padding: '0.5rem', borderRadius: '50%', color: 'var(--muted)', cursor: loading ? 'not-allowed' : 'pointer', border: 'none' }}
                        disabled={loading}
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
                        <button onClick={prevCard} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer', fontSize: '1.5rem', opacity: 0.8 }}>◀</button>
                        <span style={{ fontSize: '0.9rem', color: 'var(--muted)', minWidth: '40px' }}>{news.length > 0 ? `${currentIndex + 1} / ${news.length}` : '-'}</span>
                        <button onClick={nextCard} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer', fontSize: '1.5rem', opacity: 0.8 }}>▶</button>
                    </div>
                </div>

                <div className="glass" style={{ display: 'inline-flex', padding: '0.4rem', borderRadius: '12px', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {navItems.map(item => (
                        <button
                            key={item.key}
                            onClick={() => setCategory(item.key)}
                            style={{
                                padding: '0.6rem 1.2rem',
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                borderRadius: '8px', border: 'none',
                                background: category === item.key
                                    ? (item.key === 'iran' ? '#dc2626' : 'var(--primary)')
                                    : 'transparent',
                                color: category === item.key ? 'white' : (item.key === 'iran' ? '#f87171' : 'var(--muted)'),
                                fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: category === item.key && item.key === 'iran' ? '0 0 16px rgba(220,38,38,0.4)' : 'none',
                            }}
                        >
                            {item.icon} {item.label}
                        </button>
                    ))}
                </div>
            </header>

            {loading && news.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--muted)' }}>
                    뉴스를 불러오는 중입니다...
                </div>
            ) : news.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)', width: '100%' }}>
                    {isIran
                        ? '현재 이란 관련 최신 기사가 없습니다. 잠시 후 다시 시도해 주세요.'
                        : '해당 카테고리의 뉴스가 없습니다.'}
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '3rem', height: '550px', marginTop: '1rem', width: '100%', alignItems: 'center' }}>
                    <div
                        style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', perspective: '1200px', touchAction: 'none' }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        {news.map((item, index) => {
                            let offset = index - currentIndex;
                            const halfLength = Math.floor(news.length / 2);
                            if (offset > halfLength) offset -= news.length;
                            else if (offset < -halfLength) offset += news.length;

                            const rotateY = offset * -25;
                            const translateZ = Math.abs(offset) * -150;
                            const translateX = offset * 260;
                            const scale = offset === 0 ? 1.05 : 1 - (Math.abs(offset) * 0.15);

                            let opacity = 1;
                            if (Math.abs(offset) > 2) opacity = 0;
                            else if (Math.abs(offset) === 2) opacity = 0.4;
                            else if (Math.abs(offset) === 1) opacity = 0.7;

                            const zIndex = 100 - Math.abs(offset);

                            return (
                                <div
                                    key={item.guid}
                                    onClick={(e) => {
                                        if (Math.abs(offset) > 0) {
                                            e.preventDefault();
                                            setCurrentIndex(index);
                                            setIsAutoPlaying(false);
                                        }
                                    }}
                                    style={{
                                        position: 'absolute',
                                        width: '420px',
                                        height: '480px',
                                        transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                        transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                                        zIndex,
                                        opacity,
                                        pointerEvents: opacity === 0 ? 'none' : 'auto',
                                        cursor: offset === 0 ? 'default' : 'pointer'
                                    }}
                                >
                                    <SpotlightCard
                                        style={{
                                            padding: '0', height: '100%', display: 'flex', flexDirection: 'column',
                                            background: offset === 0 ? 'var(--background)' : undefined,
                                            border: isIran && offset === 0 ? '1px solid rgba(239,68,68,0.3)' : undefined,
                                        }}
                                        className="news-card"
                                    >
                                        <a
                                            href={offset === 0 ? item.link : undefined}
                                            target={offset === 0 ? '_blank' : undefined}
                                            rel="noopener noreferrer"
                                            style={{ display: 'flex', flexDirection: 'column', height: '100%', textDecoration: 'none', color: 'inherit', pointerEvents: offset === 0 ? 'auto' : 'none' }}
                                        >
                                            {item.imageUrl && (
                                                <div style={{ width: '100%', height: '220px', flexShrink: 0, overflow: 'hidden', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit' }}>
                                                    <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                </div>
                                            )}
                                            <div style={{ padding: '1.8rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                                {isIran && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#ef4444', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                                            🚨 LIVE
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.author}</span>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                                                    <h2 style={{ fontSize: '1.3rem', fontWeight: '800', lineHeight: 1.4, color: 'var(--foreground)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {item.title}
                                                    </h2>
                                                </div>
                                                <p style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flexGrow: 1 }}>
                                                    {item.description}
                                                </p>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                                    <span style={{ fontSize: '0.85rem', color: isIran ? '#ef4444' : 'var(--primary)', fontWeight: '600' }}>
                                                        {!isIran && item.author}
                                                    </span>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)', opacity: 0.7, fontWeight: '500' }}>
                                                        {formatDate(item.pubDate)}
                                                    </span>
                                                </div>
                                            </div>
                                        </a>
                                    </SpotlightCard>
                                </div>
                            );
                        })}
                    </div>

                    {/* Side list panel */}
                    <div className="glass news-side-panel" style={{ width: '380px', flexShrink: 0, height: '100%', overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRadius: '1rem', borderColor: isIran ? 'rgba(239,68,68,0.2)' : undefined }}>
                        <h3 className="section-label" style={{ marginBottom: '0.8rem', paddingBottom: '0.8rem', borderBottom: `1px solid ${isIran ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`, position: 'sticky', top: 0, zIndex: 10, background: 'var(--card)', color: isIran ? '#ef4444' : undefined }}>
                            {isIran ? '🇮🇷 이란 전쟁 속보' : 'News Feed'}
                        </h3>
                        {news.map((item, index) => (
                            <div
                                key={`list-${item.guid}`}
                                onClick={() => { setCurrentIndex(index); setIsAutoPlaying(false); }}
                                style={{
                                    cursor: 'pointer',
                                    padding: '0.8rem',
                                    borderRadius: '8px',
                                    background: currentIndex === index ? (isIran ? 'rgba(239,68,68,0.1)' : 'var(--primary-glow)') : 'transparent',
                                    border: currentIndex === index ? `1px solid ${isIran ? 'rgba(239,68,68,0.4)' : 'var(--primary)'}` : '1px solid transparent',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem'
                                }}
                            >
                                <div style={{
                                    fontSize: '0.95rem',
                                    lineHeight: '1.4',
                                    color: currentIndex === index ? (isIran ? '#ef4444' : 'var(--primary)') : 'var(--foreground)',
                                    fontWeight: currentIndex === index ? '700' : '500',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                }}>
                                    {item.title}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{item.author}</span>
                                    <span>{formatTime(item.pubDate)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    );
}
