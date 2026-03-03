import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { Assets, HistoryEntry } from '@/lib/types';
import { fetchQuote, fetchExchangeRate } from '@/lib/stock';

const getSettlementStatus = (targetDateStr: string, now: Date) => {
    const [y, m, d] = targetDateStr.split('-').map(Number);
    const midnight = new Date(y, m - 1, d);

    const domesticDeadline = new Date(midnight);
    domesticDeadline.setHours(21, 0, 0, 0);

    const overseasDeadline = new Date(midnight);
    overseasDeadline.setDate(overseasDeadline.getDate() + 1);
    overseasDeadline.setHours(7, 0, 0, 0);

    return {
        domesticSettled: now >= domesticDeadline,
        overseasSettled: now >= overseasDeadline
    };
};

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
                allocations: entry.allocations ? JSON.parse(entry.allocations) : undefined,
                meta: entry.meta ? JSON.parse(entry.meta) : undefined
            });
        }

        const rows = db.prepare('SELECT * FROM history ORDER BY date ASC').all();
        let history = rows.map((row: any) => ({
            ...row,
            holdings: includeHoldings && row.holdings ? JSON.parse(row.holdings) : undefined,
            allocations: row.allocations ? JSON.parse(row.allocations) : undefined,
            meta: row.meta ? JSON.parse(row.meta) : undefined
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

        // Manual adjustment logic
        if (body.date && body.manualAdjustment !== undefined) {
            const row = db.prepare('SELECT * FROM history WHERE date = ?').get(body.date) as any;
            if (row) {
                const totalValue = (row.snapshotValue || row.totalValue) + body.manualAdjustment;
                db.prepare('UPDATE history SET manualAdjustment = ?, totalValue = ? WHERE date = ?')
                    .run(body.manualAdjustment, totalValue, body.date);
            }
            return NextResponse.json({ success: true });
        }

        const now = new Date();
        const getLocalDateStr = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const todayStr = getLocalDateStr(now);
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = getLocalDateStr(yesterday);

        // Calculate latest prices and rates exactly ONCE
        const rateInfo = await fetchExchangeRate();
        const rate = typeof rateInfo === 'object' ? rateInfo.rate : rateInfo;

        db.prepare('INSERT OR REPLACE INTO currency_rates (date, rate) VALUES (?, ?)')
            .run(todayStr, rate);

        const liveInvEntries = await Promise.all(
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

        let finalResponseEntry: HistoryEntry | null = null;
        let finalResponseIsSettled = false;

        let daysToProcess: string[] = [];
        let referenceDateStr = todayStr; // The date whose values we ultimately return as 'live'

        if (body.auto) {
            const isBefore7AM = now.getHours() < 7;

            // If it's before 7 AM today, the primary active session is actually "yesterday"
            // Let's resolve what days we need to look at.
            if (isBefore7AM) {
                // "now" belongs to yesterday's trading period
                referenceDateStr = yesterdayStr;
            } else {
                // "now" belongs to today's trading period
                referenceDateStr = todayStr;
            }

            // Generate a list of dates to process. Start from 2 days before the reference.
            // (e.g., if reference is today, check back to yesterday. If reference is yesterday, check back to day before).
            const refDate = new Date(referenceDateStr + 'T12:00:00Z'); // neutral noon to avoid tz issues
            const minus1 = new Date(refDate); minus1.setDate(refDate.getDate() - 1);

            daysToProcess = [getLocalDateStr(minus1), referenceDateStr];
        } else {
            daysToProcess = [todayStr];
            referenceDateStr = todayStr;
        }

        for (const targetDate of daysToProcess) {
            const status = getSettlementStatus(targetDate, now);
            const dbRow = db.prepare('SELECT * FROM history WHERE date = ?').get(targetDate) as any;
            let meta = { domesticSettled: false, overseasSettled: false };

            if (dbRow && dbRow.meta) {
                try { meta = JSON.parse(dbRow.meta); } catch { }
            } else if (dbRow && !dbRow.meta) {
                // If the row exists but has no meta, it's a legacy row.
                // We should assume it was fully settled under the old system to avoid overwriting it.
                meta = { domesticSettled: true, overseasSettled: true };
            }

            // Both settled in DB, nothing to do unless it's the requested date we need to return
            if (meta.domesticSettled && meta.overseasSettled) {
                if (targetDate === referenceDateStr) {
                    finalResponseEntry = {
                        date: targetDate,
                        totalValue: dbRow.totalValue,
                        snapshotValue: dbRow.snapshotValue,
                        manualAdjustment: dbRow.manualAdjustment,
                        exchangeRate: dbRow.exchangeRate,
                        holdings: JSON.parse(dbRow.holdings),
                        allocations: JSON.parse(dbRow.allocations),
                        meta
                    };
                    finalResponseIsSettled = true;
                }
                continue;
            }

            // Determine if anything is newly closable OR it's the target return date
            const shouldSaveToHistory = status.domesticSettled || status.overseasSettled;
            const needsProcessing = shouldSaveToHistory || targetDate === referenceDateStr;

            if (!needsProcessing) continue;

            const oldHoldings = dbRow && dbRow.holdings ? JSON.parse(dbRow.holdings) : [];

            // Merge holdings:
            // If DB domestic is settled, keep old domestic. Otherwise, use live domestic.
            // If DB overseas is settled, keep old overseas. Otherwise, use live overseas.
            const mergedInvEntries = liveInvEntries.map(liveInv => {
                // Determine marketType (default based on category)
                const isDomestic = liveInv.marketType === 'Domestic' || ['Domestic Stock', 'Domestic Index', 'Domestic Bond'].includes(liveInv.category);

                if (isDomestic && meta.domesticSettled) {
                    const oldInv = oldHoldings.find((o: any) => o.symbol === liveInv.symbol);
                    if (oldInv) return oldInv;
                }
                if (!isDomestic && meta.overseasSettled) {
                    const oldInv = oldHoldings.find((o: any) => o.symbol === liveInv.symbol);
                    if (oldInv) return oldInv;
                }
                return liveInv; // LIVE quote
            });

            // Calculate Totals using merged entries
            const totalInvValue = mergedInvEntries.reduce((acc, inv) => {
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
                    let val = a.value || 0;
                    if (a.details && a.details.length > 0) {
                        val = a.details.reduce((sum, d) => {
                            const dVal = d.value || 0;
                            const dRate = (d.currency === 'USD' ? rate : 1);
                            const aRate = (a.currency === 'USD' ? rate : 1);
                            return sum + (dVal * dRate / aRate);
                        }, 0);
                    }
                    return acc + (a.currency === 'USD' ? val * rate : val);
                }, 0);

            const totalValue = totalOtherValue + totalInvValue;

            const updatedAllocations = (assets.allocations || []).map(alc => {
                const isInvCat = [
                    'Domestic Stock', 'Overseas Stock',
                    'Domestic Index', 'Overseas Index',
                    'Domestic Bond', 'Overseas Bond'
                ].includes(alc.category);

                if (isInvCat) {
                    const categoryValue = mergedInvEntries
                        .filter(inv => inv.category === alc.category)
                        .reduce((sum, inv) => {
                            const val = (inv.currentPrice || inv.avgPrice) * inv.shares;
                            return sum + (inv.currency === 'USD' ? val * rate : val);
                        }, 0);
                    return { ...alc, value: categoryValue / (alc.currency === 'USD' ? rate : 1) };
                }

                if (alc.details && alc.details.length > 0) {
                    const sumValue = alc.details.reduce((sum, d) => {
                        const dVal = d.value || 0;
                        const dRate = (d.currency === 'USD' ? rate : 1);
                        const aRate = (alc.currency === 'USD' ? rate : 1);
                        return sum + (dVal * dRate / aRate);
                    }, 0);
                    return { ...alc, value: sumValue };
                }
                return alc;
            });

            // Update meta flags based on what was just processed
            // If it could be settled now, mark it as settled
            if (status.domesticSettled) meta.domesticSettled = true;
            if (status.overseasSettled) meta.overseasSettled = true;

            const newEntry: HistoryEntry = {
                date: targetDate,
                totalValue,
                snapshotValue: totalValue,
                manualAdjustment: dbRow ? dbRow.manualAdjustment : 0,
                holdings: mergedInvEntries,
                allocations: updatedAllocations,
                exchangeRate: rate,
                meta: meta
            };

            if (shouldSaveToHistory) {
                db.prepare(`
                    INSERT OR REPLACE INTO history (date, totalValue, snapshotValue, manualAdjustment, exchangeRate, holdings, allocations, meta)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    newEntry.date, newEntry.totalValue, newEntry.snapshotValue,
                    newEntry.manualAdjustment, newEntry.exchangeRate,
                    JSON.stringify(newEntry.holdings), JSON.stringify(newEntry.allocations),
                    JSON.stringify(newEntry.meta)
                );
            }

            if (targetDate === referenceDateStr) {
                finalResponseEntry = newEntry;
                finalResponseIsSettled = meta.domesticSettled && meta.overseasSettled;
            }
        }

        if (finalResponseEntry) {
            return NextResponse.json({
                success: true,
                entry: finalResponseEntry,
                isSettled: finalResponseIsSettled
            });
        }

        // Fallback for extreme cases empty response
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Snapshot failed', error);
        return NextResponse.json({ success: false, error: 'Snapshot failed' }, { status: 500 });
    }
}
