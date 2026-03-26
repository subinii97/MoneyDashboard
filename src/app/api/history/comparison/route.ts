import { NextResponse } from 'next/server';
import { repo } from '@/lib/db';
import { fetchMarketIndexHistory, fetchMarketIndex } from '@/lib/stock';
import { calculateTWRMultipliers, syncOverseasFriday } from '@/lib/settlement';
import { toLocalDateStr } from '@/lib/utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scope = searchParams.get('scope') || '1m';
        const customStart = searchParams.get('start');
        const customEnd = searchParams.get('end');

        let startDateStr = '';
        let endDateStr = '';
        let daysCount = 30;
        let isWeekly = false;

        const now = new Date();

        if (scope === 'custom' && customStart && customEnd) {
            startDateStr = customStart;
            endDateStr = customEnd;
            const sDate = new Date(startDateStr);
            const eDate = new Date(endDateStr);
            daysCount = Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 3600 * 24)) + 1;
        } else {
            if (scope === '1w') daysCount = 7;
            else if (scope === '2w') daysCount = 14;
            else if (scope === '1m') daysCount = 30;
            else if (scope === '3m') daysCount = 90;
            else if (scope === 'weekly') {
                daysCount = 730;
                isWeekly = true;
            }

            const start = new Date(now);
            start.setDate(now.getDate() - daysCount + 1);
            startDateStr = toLocalDateStr(start);
            endDateStr = toLocalDateStr(now);
        }

        const [kospi, kosdaq, nasdaq, dow] = await Promise.all([
            fetchMarketIndexHistory('KOSPI', daysCount + 20),
            fetchMarketIndexHistory('KOSDAQ', daysCount + 20),
            fetchMarketIndexHistory('NASDAQ', daysCount + 20),
            fetchMarketIndexHistory('DOW', daysCount + 20)
        ]);

        const allRows = repo.history.getInRange(startDateStr, endDateStr);

        try {
            const maxDateObj = new Date(endDateStr);
            const todayObj = new Date();
            const isTodayInScope = maxDateObj.toISOString().substring(0, 10) === todayObj.toISOString().substring(0, 10) || maxDateObj > todayObj;

            if (isTodayInScope) {
                const snapshotUrl = new URL('/api/snapshot', request.url);
                const liveSnapshotRes = await fetch(snapshotUrl.toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auto: true })
                });
                if (liveSnapshotRes.ok) {
                    const liveData = await liveSnapshotRes.json();
                    if (liveData && liveData.success && liveData.entry && !liveData.isSettled) {
                        const liveEntry = liveData.entry;
                        liveEntry.isLive = true;

                        try {
                            const [liveKospi, liveKosdaq, liveNasdaq, liveDow] = await Promise.all([
                                fetchMarketIndex('KOSPI').catch(() => null),
                                fetchMarketIndex('KOSDAQ').catch(() => null),
                                fetchMarketIndex('.IXIC').catch(() => null),
                                fetchMarketIndex('.DJI').catch(() => null)
                            ]);
                            liveEntry.liveIndices = {
                                kospi: liveKospi?.price,
                                kosdaq: liveKosdaq?.price,
                                nasdaq: liveNasdaq?.price,
                                dow: liveDow?.price
                            };

                            const symbols = liveEntry.holdings.map((h: any) => h.symbol).join(',');
                            const priceRes = await fetch(new URL(`/api/stock?symbols=${symbols}`, request.url).toString());
                            const priceData = await priceRes.json();

                            liveEntry.holdings.forEach((h: any) => {
                                const info = priceData.results.find((r: any) => r.symbol === h.symbol);
                                if (info) {
                                    h.currentPrice = (info.isOverMarket && info.overMarketPrice !== undefined) ? info.overMarketPrice : info.price;
                                    h.change = (info.isOverMarket && info.overMarketChange !== undefined) ? info.overMarketChange : (info.change || 0);
                                }
                            });
                        } catch (e) {
                            console.error('Failed to fetch live indices/prices for comparison:', e);
                        }

                        const existingIndex = allRows.findIndex(r => r.date === liveEntry.date);
                        if (existingIndex >= 0) {
                            allRows[existingIndex] = liveEntry;
                        } else {
                            allRows.push(liveEntry);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch live snapshot for comparison:', e);
        }

        if (allRows.length === 0) return NextResponse.json([]);

        const visibleRows = allRows.filter(row => {
            const d = new Date(row.date + 'T00:00:00').getDay();
            return d !== 0 && d !== 6;
        });

        if (visibleRows.length === 0) return NextResponse.json([]);
        const refDate = visibleRows[0].date;

        const getIndexPrice = (series: { date: string, close: number }[], targetDate: string) => {
            if (!series || series.length === 0) return 0;
            let latest = 0;
            for (const item of series) {
                if (item.date <= targetDate) latest = item.close;
                else break;
            }
            return latest;
        };

        const kospiBase = getIndexPrice(kospi, refDate);
        const kosdaqBase = getIndexPrice(kosdaq, refDate);
        const nasdaqBase = getIndexPrice(nasdaq, refDate);
        const dowBase = getIndexPrice(dow, refDate);

        const allTransactions = repo.transactions.getTypeInRange('SELL', startDateStr, endDateStr);

        const domesticMultipliers = calculateTWRMultipliers(allRows, 'Domestic', 1350, allTransactions);
        const overseasMultipliers = calculateTWRMultipliers(allRows, 'Overseas', 1350, allTransactions);

        const domesticBase = domesticMultipliers[refDate] || 1;
        const overseasBase = syncOverseasFriday(refDate, overseasMultipliers);

        const calcRelReturn = (curr: number, base: number) => {
            return base > 0 ? ((curr / base) - 1) * 100 : 0;
        };

        const result = visibleRows.map(row => {
            const date = row.date;
            const overseasVal = syncOverseasFriday(date, overseasMultipliers);

            let currentKospi = getIndexPrice(kospi, date);
            let currentKosdaq = getIndexPrice(kosdaq, date);
            let currentNasdaq = getIndexPrice(nasdaq, date);
            let currentDow = getIndexPrice(dow, date);

            if (row.isLive && row.liveIndices) {
                if (row.liveIndices.kospi) currentKospi = row.liveIndices.kospi;
                if (row.liveIndices.kosdaq) currentKosdaq = row.liveIndices.kosdaq;
                if (row.liveIndices.nasdaq) currentNasdaq = row.liveIndices.nasdaq;
                if (row.liveIndices.dow) currentDow = row.liveIndices.dow;
            }

            return {
                date: date,
                isLive: row.isLive || false,
                kospi: calcRelReturn(currentKospi, kospiBase),
                kosdaq: calcRelReturn(currentKosdaq, kosdaqBase),
                nasdaq: calcRelReturn(currentNasdaq, nasdaqBase),
                dow: calcRelReturn(currentDow, dowBase),
                myDomestic: calcRelReturn(domesticMultipliers[date] || 1, domesticBase),
                myOverseas: calcRelReturn(overseasVal, overseasBase)
            };
        });

        let finalResult = result;
        if (isWeekly) {
            finalResult = result.filter(r => new Date(r.date).getDay() === 5 || r.isLive);
        }

        return NextResponse.json(finalResult);
    } catch (error) {
        console.error('Comparison API failed:', error);
        return NextResponse.json({ error: 'Failed to fetch comparison data' }, { status: 500 });
    }
}
