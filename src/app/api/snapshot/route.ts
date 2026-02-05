import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { Assets, HistoryEntry } from '@/lib/types';
import { fetchQuote, fetchExchangeRate } from '@/lib/stock';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const includeHoldings = searchParams.get('includeHoldings') === 'true';

        if (date) {
            const entry = db.prepare('SELECT * FROM history WHERE date = ?').get(date) as any;
            if (!entry) return NextResponse.json(null, { status: 404 });

            return NextResponse.json({
                ...entry,
                holdings: entry.holdings ? JSON.parse(entry.holdings) : undefined,
                allocations: entry.allocations ? JSON.parse(entry.allocations) : undefined
            });
        }

        const rows = db.prepare('SELECT * FROM history ORDER BY date ASC').all();
        const history = rows.map((row: any) => ({
            ...row,
            holdings: includeHoldings && row.holdings ? JSON.parse(row.holdings) : undefined,
            allocations: row.allocations ? JSON.parse(row.allocations) : undefined
        }));
        return NextResponse.json(history);
    } catch (error) {
        console.error('Failed to fetch history:', error);
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));

        // Fetch current assets from DB
        const invRows = db.prepare('SELECT * FROM investments').all();
        const alcRows = db.prepare('SELECT * FROM allocations').all();

        const assets: Assets = {
            investments: invRows.map((r: any) => ({ ...r })),
            allocations: alcRows.map((r: any) => ({
                ...r,
                details: r.details ? JSON.parse(r.details) : undefined
            }))
        };

        if (assets.investments.length === 0 && assets.allocations.length === 0) {
            return NextResponse.json({ success: false, error: 'No assets found to snapshot' }, { status: 400 });
        }

        // If it's a manual adjustment to a specific date
        if (body.date && body.manualAdjustment !== undefined) {
            const row = db.prepare('SELECT * FROM history WHERE date = ?').get(body.date) as any;
            if (row) {
                const totalValue = (row.snapshotValue || row.totalValue) + body.manualAdjustment;
                db.prepare('UPDATE history SET manualAdjustment = ?, totalValue = ? WHERE date = ?')
                    .run(body.manualAdjustment, totalValue, body.date);
            }
            return NextResponse.json({ success: true });
        }

        // Use local time for date calculation
        const now = new Date();
        const getLocalDateStr = (date: Date) => {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        };

        const todayStr = getLocalDateStr(now);

        let targetDate = todayStr;
        if (body.auto) {
            // Logic for 00:00 - 01:00 window: Treat as final record for yesterday
            if (now.getHours() === 0) {
                const yesterday = new Date(now);
                yesterday.setDate(now.getDate() - 1);
                targetDate = getLocalDateStr(yesterday);
                // For yesterday's final record, we don't return early so it can be updated one last time at 00:xx
            } else {
                // During the day, we keep updating today's snapshot
                targetDate = todayStr;
            }
        }

        const rateInfo = await fetchExchangeRate();
        const rate = typeof rateInfo === 'object' ? rateInfo.rate : rateInfo;

        // Record daily exchange rate
        db.prepare('INSERT OR REPLACE INTO currency_rates (date, rate) VALUES (?, ?)')
            .run(targetDate, rate);

        // Calculate Investment Values
        const invEntries = await Promise.all(
            assets.investments.map(async (inv) => {
                const quote = await fetchQuote(inv.symbol);
                let currentPrice = inv.avgPrice;
                let currency = inv.currency || (inv.symbol.includes('.') ? 'KRW' : 'USD');

                if (!(quote as any).error) {
                    currentPrice = (quote as any).price || currentPrice;
                    currency = (quote as any).currency || currency;
                }

                return {
                    ...inv,
                    currentPrice,
                    currency,
                    category: inv.category || (inv.marketType === 'Domestic' ? 'Domestic Stock' : 'Overseas Stock')
                };
            })
        );

        const totalInvValue = invEntries.reduce((acc, inv) => {
            const val = (inv.currentPrice || inv.avgPrice) * inv.shares;
            return acc + (inv.currency === 'USD' ? val * rate : val);
        }, 0);

        const totalOtherValue = (assets.allocations || [])
            .filter(a => ![
                'Domestic Stock', 'Overseas Stock',
                'Domestic Index', 'Overseas Index',
                'Domestic Bond', 'Overseas Bond'
            ].includes(a.category))
            .reduce((acc, a) => {
                const val = a.value || 0;
                return acc + (a.currency === 'USD' ? val * rate : val);
            }, 0);

        const totalValue = totalOtherValue + totalInvValue;

        const updatedAllocations = (assets.allocations || []).map(alc => {
            const categoryValue = invEntries
                .filter(inv => inv.category === alc.category)
                .reduce((sum, inv) => {
                    const val = (inv.currentPrice || inv.avgPrice) * inv.shares;
                    return sum + (inv.currency === 'USD' ? val * rate : val);
                }, 0);

            if (alc.category === 'Domestic Stock' ||
                alc.category === 'Overseas Stock' ||
                alc.category === 'Domestic Index' ||
                alc.category === 'Overseas Index' ||
                alc.category === 'Domestic Bond' ||
                alc.category === 'Overseas Bond') {
                return { ...alc, value: categoryValue / (alc.currency === 'USD' ? rate : 1) };
            }
            return alc;
        });

        const newEntry: HistoryEntry = {
            date: targetDate,
            totalValue,
            snapshotValue: totalValue,
            manualAdjustment: 0,
            holdings: invEntries,
            allocations: updatedAllocations,
            exchangeRate: rate
        };

        db.prepare(`
            INSERT OR REPLACE INTO history (date, totalValue, snapshotValue, manualAdjustment, exchangeRate, holdings, allocations)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            newEntry.date, newEntry.totalValue, newEntry.snapshotValue,
            newEntry.manualAdjustment, newEntry.exchangeRate,
            JSON.stringify(newEntry.holdings), JSON.stringify(newEntry.allocations)
        );

        return NextResponse.json({ success: true, entry: newEntry });
    } catch (error) {
        console.error('Snapshot failed', error);
        return NextResponse.json({ success: false, error: 'Snapshot failed' }, { status: 500 });
    }
}
