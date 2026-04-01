import { NextResponse } from 'next/server';
import { repo } from '@/lib/db';
import { Assets, HistoryEntry, SettlementMeta } from '@/lib/types';
import { fetchQuote, fetchExchangeRate } from '@/lib/stock';
import { toLocalDateStr } from '@/lib/utils';
import { fetchHistoricalClosePrice } from '@/lib/stock/history';

const getSettlementStatus = (targetDateStr: string, now: Date) => {
    const [y, m, d] = targetDateStr.split('-').map(Number);
    const dayDate = new Date(y, m - 1, d);

    // 주말(토/일)은 다음 평일에 정산되거나 처리되므로 기본적으로 정산 대상에서 제외
    const dayOfWeek = dayDate.getDay(); // 0: Sun, 6: Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return { domesticSettled: false, overseasSettled: false };
    }

    // 국내 장 정산: 당일 오후 9시 이후
    const domesticDeadline = new Date(dayDate);
    domesticDeadline.setHours(21, 0, 0, 0);

    // 해외 장 정산: 미국 시간 당일 마감은 한국 시간 "다음 날" 오전 7시 이후
    // 예: 3월 31일(화) 미국 장은 4월 1일(수) 오전 6~7시에 마감됨
    const overseasDeadline = new Date(dayDate);
    overseasDeadline.setDate(dayDate.getDate() + 1);
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
        // 일요일 항목은 유효하지 않으므로 필터링 (잘못 저장된 경우 대비)
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

        // 오늘이 주말이면 마지막 평일(금요일) 날짜로 라이브 entry를 생성해 반환
        // isSettled:false로 반환 → 프론트엔드가 isLive=true로 처리 → 금요일 행을 현재가로 업데이트
        const todayDayOfWeek = now.getDay(); // 0: Sun, 6: Sat
        const isTodayWeekend = todayDayOfWeek === 0 || todayDayOfWeek === 6;

        if (isTodayWeekend) {
            // 마지막 평일(금요일) 날짜 계산
            const lastWeekdayDate = new Date(now);
            while ([0, 6].includes(lastWeekdayDate.getDay())) {
                lastWeekdayDate.setDate(lastWeekdayDate.getDate() - 1);
            }
            const lastWeekdayStr = toLocalDateStr(lastWeekdayDate);

            // 현재 라이브 가격으로 총 평가액 계산
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

            // 주말에는 금요일 장이 이미 종료되었으므로 필수 저장
            repo.history.upsert(weekendEntry);
            
            // 여기서 즉시 반환하지 않고, 아래의 loop에서 다른 누락된 요일들도 정산할 수 있게 유도
            finalResponseEntry = weekendEntry;
            finalResponseIsSettled = true;
            referenceDateStr = lastWeekdayStr; 
        }

        if (body.auto && !isTodayWeekend) { // 주말이 아닐 때만 daysToProcess를 새로 설정 (주말이면 위에서 referenceDateStr 설정됨)
            referenceDateStr = todayStr;
            const refDate = new Date(referenceDateStr + 'T12:00:00Z');
            const minus1 = new Date(refDate); minus1.setDate(refDate.getDate() - 1);
            daysToProcess = [toLocalDateStr(minus1), referenceDateStr];
        } else if (isTodayWeekend) {
             // 주말인 경우: 마지막 평일(금요일)과 그 이전 평일(목요일) 등을 확인
             const refDate = new Date(referenceDateStr + 'T12:00:00Z');
             const minus1 = new Date(refDate); minus1.setDate(refDate.getDate() - 1);
             daysToProcess = [toLocalDateStr(minus1), referenceDateStr];
        } else {
            daysToProcess = [todayStr];
            referenceDateStr = todayStr;
        }

        // 공통: 아직 정산되지 않은 과거 내역들 추가
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
            const status = getSettlementStatus(targetDate, now);
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

                // 과거 내역 정산 시, 투자 자산 외의 정보(현금 등)는 이미 저장된 정보를 우선함 (오늘 수정한 현금이 어제 내역에 덮어씌워지는 것 방지)
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
