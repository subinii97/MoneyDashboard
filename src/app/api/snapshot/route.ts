import { NextResponse } from 'next/server';
import { repo } from '@/lib/db';
import { Assets, HistoryEntry, SettlementMeta } from '@/lib/types';
import { fetchQuote, fetchExchangeRate } from '@/lib/stock';
import { toLocalDateStr } from '@/lib/utils';
import { fetchHistoricalClosePrice } from '@/lib/stock/history';

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
            const entry = repo.history.getByDate(date);
            if (!entry) return NextResponse.json(null, { status: 404 });
            return NextResponse.json(entry);
        }

        const history = repo.history.getAll(includeHoldings);
        return NextResponse.json(history);
    } catch (error) {
        console.error('Failed to fetch history:', error);
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));

        // Fetch current assets from DB via repository
        const investments = repo.investments.getAll();
        const allocations = repo.allocations.getAll();

        const assets: Assets = { investments, allocations };

        if (assets.investments.length === 0 && assets.allocations.length === 0) {
            return NextResponse.json({ success: false, error: 'No assets found to snapshot' }, { status: 400 });
        }

        // Manual adjustment logic
        if (body.date && body.manualAdjustment !== undefined) {
            const row = repo.history.getByDate(body.date);
            if (row) {
                const totalValue = (row.snapshotValue || row.totalValue) + body.manualAdjustment;
                repo.history.updateAdjustment(body.date, body.manualAdjustment, totalValue);
            }
            return NextResponse.json({ success: true });
        }

        const now = new Date();
        const todayStr = toLocalDateStr(now);
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = toLocalDateStr(yesterday);

        // Fetch latest rate
        const rateInfo = await fetchExchangeRate();
        const rate = typeof rateInfo === 'object' ? rateInfo.rate : rateInfo;
        repo.rates.save(todayStr, rate);

        const liveInvEntries = await Promise.all(
            assets.investments.map(async (inv) => {
                const quote = await fetchQuote(inv.symbol);
                let currentPrice = inv.avgPrice;
                let currency = inv.currency || (inv.symbol.includes('.') ? 'KRW' : 'USD');

                if (!(quote as any).error) {
                    currentPrice = (quote.isOverMarket && quote.overMarketPrice) 
                        ? quote.overMarketPrice 
                        : (quote.price || currentPrice);
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
        let referenceDateStr = todayStr;

        if (body.auto) {
            if (now.getHours() < 7) {
                referenceDateStr = yesterdayStr;
            } else {
                referenceDateStr = todayStr;
            }
            const refDate = new Date(referenceDateStr + 'T12:00:00Z');
            const minus1 = new Date(refDate); minus1.setDate(refDate.getDate() - 1);
            daysToProcess = [toLocalDateStr(minus1), referenceDateStr];

            const allHist = repo.history.getAll(false) as HistoryEntry[];
            for (const h of allHist) {
                if (h.meta && (!h.meta.domesticSettled || !h.meta.overseasSettled)) {
                    if (!daysToProcess.includes(h.date)) {
                        daysToProcess.push(h.date);
                    }
                }
            }
            daysToProcess.sort((a, b) => a.localeCompare(b));
        } else {
            daysToProcess = [todayStr];
            referenceDateStr = todayStr;
        }

        for (const targetDate of daysToProcess) {
            const status = getSettlementStatus(targetDate, now);
            const dbRow = repo.history.getByDate(targetDate);
            let meta: SettlementMeta = { domesticSettled: false, overseasSettled: false };

            if (dbRow && dbRow.meta) {
                meta = dbRow.meta;
            } else if (dbRow && !dbRow.meta) {
                meta = { domesticSettled: true, overseasSettled: true };
            }

            if (meta.domesticSettled && meta.overseasSettled) {
                if (targetDate === referenceDateStr && dbRow) {
                    finalResponseEntry = dbRow;
                    finalResponseIsSettled = true;
                }
                continue;
            }

            const shouldSaveToHistory = status.domesticSettled || status.overseasSettled;
            const needsProcessing = shouldSaveToHistory || targetDate === referenceDateStr;
            if (!needsProcessing) continue;

            const oldHoldings = dbRow && dbRow.holdings ? dbRow.holdings : [];

            const mergedInvEntries = await Promise.all(liveInvEntries.map(async liveInv => {
                const isDomestic = liveInv.marketType === 'Domestic' || ['Domestic Stock', 'Domestic Index', 'Domestic Bond'].includes(liveInv.category);
                if (isDomestic && meta.domesticSettled) {
                    const oldInv = oldHoldings.find((o: any) => o.symbol === liveInv.symbol);
                    if (oldInv) return oldInv;
                }
                if (!isDomestic && meta.overseasSettled) {
                    const oldInv = oldHoldings.find((o: any) => o.symbol === liveInv.symbol);
                    if (oldInv) return oldInv;
                }

                // Fetch historical true closing price if the targetDate market has fully closed
                const isMarketSettledForTargetDate = isDomestic ? status.domesticSettled : status.overseasSettled;
                if (isMarketSettledForTargetDate && targetDate !== todayStr) {
                    const historicalPrice = await fetchHistoricalClosePrice(liveInv.symbol, targetDate, isDomestic);
                    if (historicalPrice !== null) {
                        return { 
                            ...liveInv, 
                            currentPrice: historicalPrice, 
                            isOverMarket: false, 
                            overMarketChange: undefined, 
                            overMarketPrice: undefined, 
                            overMarketChangePercent: undefined 
                        };
                    }
                }
                return liveInv;
            }));

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
                repo.history.upsert(newEntry);
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
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Snapshot failed', error);
        return NextResponse.json({ success: false, error: 'Snapshot failed' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { date } = await request.json();
        if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 });
        
        repo.history.delete(date);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete history entry:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete history entry' }, { status: 500 });
    }
}
