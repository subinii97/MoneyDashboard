import { NextResponse } from 'next/server';
import { repo } from '@/lib/db';
import { Assets, HistoryEntry, SettlementMeta } from '@/lib/types';
import { fetchQuote, fetchExchangeRate } from '@/lib/stock';
import { toLocalDateStr } from '@/lib/utils';
import { fetchHistoricalClosePrice } from '@/lib/stock/history';
import { getSessionInfo, isDomesticDateSettled, isOverseasDateSettled } from '@/lib/session';


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
        const filtered = history.filter((h: any) => {
            const d = new Date(h.date + 'T00:00:00').getDay();
            return d !== 0; // 0 = 일요일
        });
        return NextResponse.json(filtered);
    } catch (error) {
        console.error('Failed to fetch history:', error);
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const investments = repo.investments.getAll();
        const allocations = repo.allocations.getAll();
        const assets: Assets = { investments, allocations };

        if (assets.investments.length === 0 && assets.allocations.length === 0) {
            return NextResponse.json({ success: false, error: 'No assets found to snapshot' }, { status: 400 });
        }

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

        // ─── 세션 경계 정보 (단일 진실 공급원) ──────────────────────────────────
        const session = getSessionInfo(now);
        // 해외 세션 날짜: KST 17:00 이전이면 어제 KST(= 어제 미국 ET날짜), 이후면 오늘
        const overseasSessionDateStr = session.overseasSessionDate;

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
                    change: (quote as any).change,
                    changePercent: (quote as any).changePercent,
                    isOverMarket: quote.isOverMarket,
                    overMarketPrice: quote.overMarketPrice,
                    overMarketChange: quote.overMarketChange,
                    overMarketChangePercent: quote.overMarketChangePercent,
                    overMarketSession: (quote as any).overMarketSession,
                    marketStatus: (quote as any).marketStatus,
                    category: inv.category || (inv.marketType === 'Domestic' ? 'Domestic Stock' : 'Overseas Stock')
                };
            })
        );

        let finalResponseEntry: HistoryEntry | null = null;
        let finalResponseIsSettled = false;
        let daysToProcess: string[] = [];
        let referenceDateStr = todayStr;

        const todayDayOfWeek = now.getDay();
        const isTodayWeekend = todayDayOfWeek === 0 || todayDayOfWeek === 6;

        if (isTodayWeekend) {
            const lastWeekdayDate = new Date(now);
            while ([0, 6].includes(lastWeekdayDate.getDay())) {
                lastWeekdayDate.setDate(lastWeekdayDate.getDate() - 1);
            }
            const lastWeekdayStr = toLocalDateStr(lastWeekdayDate);

            const invValue = liveInvEntries.reduce((acc, inv) => {
                const val = (inv.currentPrice || inv.avgPrice) * inv.shares;
                return acc + (inv.currency === 'USD' ? val * rate : val);
            }, 0);
            const otherValue = (assets.allocations || [])
                .filter((a: any) => !['Domestic Stock', 'Overseas Stock', 'Domestic Index', 'Overseas Index', 'Domestic Bond', 'Overseas Bond'].includes(a.category))
                .reduce((acc: number, a: any) => {
                    let val = a.value || 0;
                    if (a.details?.length > 0) {
                        val = a.details.reduce((s: number, d: any) => s + (d.value || 0) * (d.currency === 'USD' ? rate : 1) / (a.currency === 'USD' ? rate : 1), 0);
                    }
                    return acc + (a.currency === 'USD' ? val * rate : val);
                }, 0);
            const totalValue = invValue + otherValue;

            const updAlloc = (assets.allocations || []).map((alc: any) => {
                if (['Domestic Stock', 'Overseas Stock', 'Domestic Index', 'Overseas Index', 'Domestic Bond', 'Overseas Bond'].includes(alc.category)) {
                    const catVal = liveInvEntries
                        .filter((inv: any) => inv.category === alc.category)
                        .reduce((s: number, inv: any) => s + (inv.currentPrice || inv.avgPrice) * inv.shares * (inv.currency === 'USD' ? rate : 1), 0);
                    return { ...alc, value: catVal / (alc.currency === 'USD' ? rate : 1) };
                }
                return alc;
            });

            const dbRow = repo.history.getByDate(lastWeekdayStr);
            const weekendEntry: HistoryEntry = {
                date: lastWeekdayStr,
                totalValue,
                snapshotValue: totalValue,
                manualAdjustment: dbRow?.manualAdjustment || 0,
                holdings: liveInvEntries,
                allocations: updAlloc,
                exchangeRate: rate,
                meta: { domesticSettled: true, overseasSettled: true },
                isWeekendSettled: true
            } as any;

            repo.history.upsert(weekendEntry);
            finalResponseEntry = weekendEntry;
            finalResponseIsSettled = true;
            referenceDateStr = lastWeekdayStr; 
        }

        if (body.auto && !isTodayWeekend) {
            referenceDateStr = todayStr;
            // 오늘(KST) + 해외 세션 날짜(다를 경우 어제)를 모두 처리
            daysToProcess = [todayStr];
            if (overseasSessionDateStr !== todayStr && !daysToProcess.includes(overseasSessionDateStr)) {
                daysToProcess.unshift(overseasSessionDateStr);
            }
        } else if (isTodayWeekend) {
             const refDate = new Date(referenceDateStr + 'T12:00:00Z');
             const minus1 = new Date(refDate); minus1.setDate(refDate.getDate() - 1);
             daysToProcess = [toLocalDateStr(minus1), referenceDateStr];
        } else {
            daysToProcess = [todayStr];
            referenceDateStr = todayStr;
        }

        const allHist = repo.history.getAll(false) as HistoryEntry[];
        for (const h of allHist) {
            if (h.meta && (!h.meta.domesticSettled || !h.meta.overseasSettled)) {
                if (!daysToProcess.includes(h.date)) {
                    daysToProcess.push(h.date);
                }
            }
        }
        daysToProcess.sort((a, b) => a.localeCompare(b));
        daysToProcess = daysToProcess.filter(d => {
            const day = new Date(d + 'T00:00:00').getDay();
            return day !== 0 && day !== 6;
        });

        for (const targetDate of daysToProcess) {
            const dbRow = repo.history.getByDate(targetDate);
            let meta: SettlementMeta = { domesticSettled: false, overseasSettled: false };

            if (dbRow && dbRow.meta) {
                meta = dbRow.meta;
            } else if (dbRow && !dbRow.meta) {
                meta = { domesticSettled: true, overseasSettled: true };
            }

            const dayDate = new Date(targetDate + 'T00:00:00');
            const isRecent = (now.getTime() - dayDate.getTime()) < 7 * 24 * 3600 * 1000;
            if (meta.domesticSettled && meta.overseasSettled && !isRecent) {
                if (targetDate === referenceDateStr && dbRow) {
                    finalResponseEntry = dbRow;
                    finalResponseIsSettled = true;
                }
                continue;
            }

            const shouldSaveToHistory = isDomesticDateSettled(targetDate, now) || isOverseasDateSettled(targetDate, now);
            const needsProcessing = shouldSaveToHistory || targetDate === referenceDateStr;
            if (!needsProcessing) continue;

            const oldHoldings = dbRow && dbRow.holdings ? dbRow.holdings : [];
            const targetHoldings = (targetDate === todayStr)
                ? liveInvEntries
                : (oldHoldings.length > 0 ? oldHoldings : liveInvEntries);

            const mergedInvEntries = await Promise.all(targetHoldings.map(async (inv: any) => {
                const isDomestic = inv.marketType === 'Domestic' ||
                    ['Domestic Stock', 'Domestic Index', 'Domestic Bond'].includes(inv.category);

                if (isDomestic) {
                    if (dbRow?.meta?.domesticSettled) return inv;

                    if (isDomesticDateSettled(targetDate, now)) {
                        const price = await fetchHistoricalClosePrice(inv.symbol, targetDate, true);
                        if (price !== null) return { ...inv, currentPrice: price, isOverMarket: false, overMarketPrice: undefined, overMarketChange: undefined, marketStatus: 'CLOSED' };
                    }
                    const lm = liveInvEntries.find(l => l.symbol === inv.symbol);
                    return lm || inv;

                } else {
                    if (dbRow?.meta?.overseasSettled) return inv;

                    if (targetDate === overseasSessionDateStr) {
                        const lm = liveInvEntries.find(l => l.symbol === inv.symbol);
                        if (!lm) return inv;

                        if (isOverseasDateSettled(targetDate, now)) {
                            if (lm.overMarketPrice && ['AFTER_MARKET', 'POST_MARKET'].includes(lm.overMarketSession || '')) {
                                return { ...lm, currentPrice: lm.overMarketPrice, isOverMarket: false, overMarketPrice: undefined, overMarketChange: undefined, marketStatus: 'CLOSED' };
                            }
                            const price = await fetchHistoricalClosePrice(inv.symbol, targetDate, false);
                            if (price !== null) return { ...inv, currentPrice: price, isOverMarket: false, overMarketPrice: undefined, overMarketChange: undefined, marketStatus: 'CLOSED' };
                        }
                        return lm;

                    } else if (targetDate === todayStr) {
                        const prevRow = repo.history.getByDate(overseasSessionDateStr);
                        const prevHolding = (prevRow?.holdings as any[])?.find((h: any) => h.symbol === inv.symbol);
                        if (prevHolding) return { ...prevHolding, isOverMarket: false, overMarketPrice: undefined, overMarketChange: undefined, marketStatus: 'CLOSED' };
                        const lm = liveInvEntries.find(l => l.symbol === inv.symbol);
                        return lm || inv;

                    } else {
                        if (isOverseasDateSettled(targetDate, now)) {
                            const price = await fetchHistoricalClosePrice(inv.symbol, targetDate, false);
                            if (price !== null) return { ...inv, currentPrice: price, isOverMarket: false, overMarketPrice: undefined, overMarketChange: undefined, marketStatus: 'CLOSED' };
                        }
                        return inv;
                    }
                }
            }));

            const totalInvValue = mergedInvEntries.reduce((acc, inv) => {
                const val = (inv.currentPrice || inv.avgPrice) * inv.shares;
                return acc + (inv.currency === 'USD' ? val * rate : val);
            }, 0);

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

                if (targetDate !== todayStr && dbRow && dbRow.allocations) {
                    const oldAlc = dbRow.allocations.find((a: any) => a.category === alc.category);
                    if (oldAlc) return oldAlc;
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

            const totalOtherValue = updatedAllocations
                .filter(a => ![
                    'Domestic Stock', 'Overseas Stock',
                    'Domestic Index', 'Overseas Index',
                    'Domestic Bond', 'Overseas Bond'
                ].includes(a.category))
                .reduce((acc, a) => {
                    const val = a.value || 0;
                    return acc + (a.currency === 'USD' ? val * rate : val);
                }, 0);

            const totalValue = totalInvValue + totalOtherValue;

            // meta 정산 플래그 업데이트 (session.ts 기준)
            if (isDomesticDateSettled(targetDate, now)) meta.domesticSettled = true;
            if (isOverseasDateSettled(targetDate, now)) meta.overseasSettled = true;

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
