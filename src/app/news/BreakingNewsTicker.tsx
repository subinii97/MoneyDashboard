'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface Article {
    title: string;
    link: string;
    pubDate: string;
    guid: string;
}

export default function BreakingNewsTicker() {
    const [news, setNews] = useState<Article[]>([]);

    useEffect(() => {
        const fetchBreakingNews = async () => {
            try {
                // Fetch breaking news (using the newly added 'breaking' category)
                const res = await fetch('/api/news?category=breaking');
                if (res.ok) {
                    const data = await res.json();
                    // Take top 8 latest items for the ticker
                    setNews((data.articles || []).slice(0, 8));
                }
            } catch (err) {
                console.error('Failed to fetch breaking news', err);
            }
        };

        // Initial fetch
        fetchBreakingNews();

        // Fetch every 10 minutes (600,000 ms)
        const intervalId = setInterval(fetchBreakingNews, 10 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, []);

    if (news.length === 0) return null;

    const formatTime = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } catch {
            return '';
        }
    };

    return (
        <div style={{
            width: '100%',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
            borderTop: '1px solid rgba(239, 68, 68, 0.15)',
            padding: '0.6rem 0',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            marginBottom: '2rem',
            position: 'relative'
        }}>
            <div style={{
                backgroundColor: '#ef4444',
                color: 'white',
                padding: '0.3rem 0.8rem',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginLeft: '1.5rem',
                marginRight: '1rem',
                boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
                zIndex: 10,
                flexShrink: 0,
                letterSpacing: '0.05em'
            }}>
                <AlertCircle size={16} strokeWidth={2.5} />
                BREAKING NEWS
            </div>

            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)', maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
                <style>{`
                    @keyframes ticker {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .news-ticker-track {
                        display: flex;
                        width: max-content;
                        animation: ticker 40s linear infinite;
                    }
                    .news-ticker-track:hover {
                        animation-play-state: paused;
                    }
                    .news-ticker-content {
                        display: flex;
                        gap: 3rem;
                        padding-right: 3rem;
                        align-items: center;
                    }
                    .news-ticker-item {
                        color: var(--foreground);
                        display: flex;
                        align-items: center;
                        gap: 0.6rem;
                        text-decoration: none;
                        font-weight: 500;
                        font-size: 0.95rem;
                        white-space: nowrap;
                        transition: color 0.2s;
                    }
                    .news-ticker-item:hover {
                        color: #ef4444;
                    }
                    .news-ticker-dot {
                        animation: pulse-red 2s infinite;
                        flex-shrink: 0;
                    }
                    @keyframes pulse-red {
                        0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                        70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                    }
                `}</style>
                <div className="news-ticker-track">
                    <div className="news-ticker-content">
                        {news.map((item, i) => (
                            <a
                                key={`breaking-${item.guid || i}`}
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="news-ticker-item"
                            >
                                <span className="news-ticker-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                                <span style={{ opacity: 0.7, fontSize: '0.85rem', fontWeight: '600', marginRight: '0.2rem' }}>[{formatTime(item.pubDate)}]</span>
                                {item.title}
                            </a>
                        ))}
                    </div>
                    {/* Duplicate the content for seamless infinite looping */}
                    <div className="news-ticker-content">
                        {news.map((item, i) => (
                            <a
                                key={`breaking-dup-${item.guid || i}`}
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="news-ticker-item"
                            >
                                <span className="news-ticker-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                                <span style={{ opacity: 0.7, fontSize: '0.85rem', fontWeight: '600', marginRight: '0.2rem' }}>[{formatTime(item.pubDate)}]</span>
                                {item.title}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
