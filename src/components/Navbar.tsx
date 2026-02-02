'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, Briefcase, LayoutDashboard, Activity } from 'lucide-react';

export default function Navbar() {
    const pathname = usePathname();

    const navItems = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'History', href: '/history', icon: Activity },
        { name: 'Portfolio', href: '/portfolio', icon: BarChart2 },
        { name: 'Investment', href: '/investment', icon: Briefcase },
    ];

    return (
        <nav className="glass" style={{
            margin: '1rem 2rem',
            padding: '0.5rem 1rem',
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            position: 'sticky',
            top: '1rem',
            zIndex: 100
        }}>
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
        </nav>
    );
}
