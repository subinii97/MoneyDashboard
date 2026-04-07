import { NextResponse } from 'next/server';
import { repo } from '@/lib/db';
import { fetchMarketIndexHistory, fetchMarketIndex, fetchQuote } from '@/lib/stock';
import { calculateTWRMultipliers } from '@/lib/settlement';
import { toLocalDateStr } from '@/lib/utils';
import { getSessionInfo } from '@/lib/session';

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

        const leadStart = new Date(new Date(startDateStr).getTime() - 7 * 24 * 3600 * 1000).toISOString().substring(0, 10);
        const allRows = repo.history.getInRange(leadStart, endDateStr);

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
                        const todayStr = todayObj.toISOString().substring(0, 10);
                        liveEntry.date = todayStr;
                        liveEntry.isLive = true;

                        try {
                            const [liveKospi, liveKosdaq, liveNasdaq, liveDow] = await Promise.all([
                                fetchMarketIndex('KOSPI').catch(() => null),
                                fetchMarketIndex('KOSDAQ').catch(() => null),
                                fetchMarketIndex('.IXIC').catch(() => null),
                                fetchMarketIndex('.DJI').catch(() => null)
                            ]);
                            const investments = repo.investments.getAll();
                            const liveInvEntries = await Promise.all(investments.map(async (inv) => {
                                const quote = await fetchQuote(inv.symbol);
                                let currentPrice = inv.avgPrice;
                                if (!(quote as any).error) {
                                    currentPrice = (quote.isOverMarket && quote.overMarketPrice) 
                                        ? quote.overMarketPrice 
                                        : (quote.price || currentPrice);
                                }
                                return { 
                                    ...inv, 
                                    currentPrice,
                                    change: (quote as any).change,
                                    isOverMarket: quote.isOverMarket,
                                    overMarketChange: quote.overMarketChange,
                                    overMarketPrice: quote.overMarketPrice,
                                    marketStatus: (quote as any).marketStatus
                                };
                            }));
                            liveEntry.liveIndices = {
                                kospi: liveKospi?.price,
                                kosdaq: liveKosdaq?.price,
                                nasdaq: liveNasdaq?.price,
                                dow: liveDow?.price
                            };

                            const symbols = liveEntry.holdings.map((h: any) => h.symbol).join(',');
                            const priceRes = await fetch(new URL(`/api/stock?symbols=${symbols}`, request.url).toString());
                            const priceData = await priceRes.json();

                            if (priceData.exchangeRate) {
                                liveEntry.exchangeRate = priceData.exchangeRate.rate || priceData.exchangeRate;
                            }

                            liveEntry.holdings.forEach((h: any) => {
                                const info = priceData.results?.find((r: any) => r.symbol === h.symbol);
                                if (info) {
                                    h.currentPrice = (info.isOverMarket && info.overMarketPrice !== undefined) ? info.overMarketPrice : info.price;
                                    h.change = (info.isOverMarket && info.overMarketChange !== undefined) ? info.overMarketChange : (info.change || 0);
                                    h.currency = info.currency || 'USD';
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

        const firstDate = visibleRows[0].date;
        const secondDate = visibleRows.length > 1 ? visibleRows[1].date : undefined;

        // 동기화된 베이스 가격/멀티플라이어 계산 (차트가 0%에서 시작하도록 보장)
        const getSyncBase = (series: any[], d: string, nD: string | undefined, ent?: any, nEnt?: any) => {
            // 정산이 완료된 시점이라면 자신(d)을 기준으로 시작하도록 베이스 설정
            if (nD && !ent?.meta?.overseasSettled && !(nEnt?.isLive && new Date().getHours() >= 17)) {
                return getIndexPrice(series, nD);
            }
            return getIndexPrice(series, d);
        };

        const kospiBase = getIndexPrice(kospi, firstDate);
        const kosdaqBase = getIndexPrice(kosdaq, firstDate);
        const firstRow = visibleRows[0];
        const nextRowFromFirst = visibleRows.length > 1 ? visibleRows[1] : undefined;
        const nasdaqBase = getSyncBase(nasdaq, firstDate, secondDate, firstRow, nextRowFromFirst);
        const dowBase = getSyncBase(dow, firstDate, secondDate, firstRow, nextRowFromFirst);

        const allTransactions = repo.transactions.getTypeInRange('SELL', startDateStr, endDateStr);
        const domesticMultipliers = calculateTWRMultipliers(allRows, 'Domestic', 1350, allTransactions);
        const overseasMultipliers = calculateTWRMultipliers(allRows, 'Overseas', 1350, allTransactions);

        const domesticBase = domesticMultipliers[firstDate] || 1;
        const overseasBase = overseasMultipliers[firstDate] || 1;

        const calcRelReturn = (curr: number, base: number) => {
            return base > 0 ? ((curr / base) - 1) * 100 : 0;
        };

        const result = visibleRows.map((row, idx) => {
            const date = row.date;
            let currentKospi = getIndexPrice(kospi, date);
            let currentKosdaq = getIndexPrice(kosdaq, date);
            let currentNasdaq = getIndexPrice(nasdaq, date);
            let currentDow = getIndexPrice(dow, date);

            // 라이브 행의 경우 실시간 지수 오버라이드
            if (row.isLive && row.liveIndices) {
                if (row.liveIndices.kospi) currentKospi = row.liveIndices.kospi;
                if (row.liveIndices.kosdaq) currentKosdaq = row.liveIndices.kosdaq;
                if (row.liveIndices.nasdaq) currentNasdaq = row.liveIndices.nasdaq;
                if (row.liveIndices.dow) currentDow = row.liveIndices.dow;
            }

            // TWR: DB에 이미 올바른 날짜에 올바른 가격이 저장됐으므로 직접 사용
            const domTWR = domesticMultipliers[date] || 1;
            const osTWR = overseasMultipliers[date] || 1;

            return {
                date,
                isLive: row.isLive || false,
                kospi: calcRelReturn(currentKospi, kospiBase),
                kosdaq: calcRelReturn(currentKosdaq, kosdaqBase),
                nasdaq: calcRelReturn(currentNasdaq, nasdaqBase),
                dow: calcRelReturn(currentDow, dowBase),
                myDomestic: calcRelReturn(domTWR, domesticBase),
                myOverseas: calcRelReturn(osTWR, overseasBase)
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
