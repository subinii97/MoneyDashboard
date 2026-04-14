'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, Briefcase, LayoutDashboard, Activity, Newspaper, Sun, Moon, TrendingUp } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function Navbar() {
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const navItems = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'News', href: '/news', icon: Newspaper },
        { name: 'History', href: '/history', icon: Activity },
        { name: 'Portfolio', href: '/portfolio', icon: BarChart2 },
        { name: 'Investment', href: '/investment', icon: Briefcase },
        { name: 'Markets', href: '/markets', icon: TrendingUp },
    ];

    return (
        <nav className="glass" style={{
            margin: '1rem 2rem',
            padding: '0.5rem 1rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'sticky',
            top: '1rem',
            zIndex: 100
        }}>
            <div style={{ display: 'flex', gap: '2rem', flex: 1, justifyContent: 'center' }}>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                textDecoration: 'none',
                                color: isActive ? 'var(--primary)' : 'var(--muted)',
                                fontWeight: isActive ? '700' : '500',
                                padding: '0.5rem 1rem',
                                borderRadius: '0.5rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Icon size={20} />
                            {item.name}
                        </Link>
                    );
                })}
            </div>

            {mounted && (
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    style={{
                        position: 'absolute',
                        right: '1.5rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.5rem',
                        borderRadius: '50%',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}
                    aria-label="Toggle Dark Mode"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            )}
        </nav>
    );
}
