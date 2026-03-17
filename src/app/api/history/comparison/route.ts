import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { fetchMarketIndexHistory } from '@/lib/stock';
import { calculateTWRMultipliers, syncOverseasFriday } from '@/lib/settlement';

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
            startDateStr = start.toISOString().substring(0, 10);
            endDateStr = now.toISOString().substring(0, 10);
        }

        const [kospi, kosdaq, nasdaq, dow] = await Promise.all([
            fetchMarketIndexHistory('KOSPI', daysCount + 20),
            fetchMarketIndexHistory('KOSDAQ', daysCount + 20),
            fetchMarketIndexHistory('NASDAQ', daysCount + 20),
            fetchMarketIndexHistory('DOW', daysCount + 20)
        ]);

        const allRows = db.prepare('SELECT * FROM history WHERE date >= ? AND date <= ? ORDER BY date ASC').all(startDateStr, endDateStr) as any[];

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
                        liveEntry.isLive = true; // Mark as live for potential UI usage
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

        // 매도 거래 데이터 조회 (TWR에서 매도 종목 가격 반영용)
        const allTransactions = db.prepare('SELECT * FROM transactions WHERE type = ? AND date >= ? AND date <= ? ORDER BY date ASC').all('SELL', startDateStr, endDateStr) as any[];

        const domesticMultipliers = calculateTWRMultipliers(allRows, 'Domestic', 1350, allTransactions);
        const overseasMultipliers = calculateTWRMultipliers(allRows, 'Overseas', 1350, allTransactions);

        const domesticBase = domesticMultipliers[refDate] || 1;
        const overseasBase = overseasMultipliers[refDate] || 1;

        const calcRelReturn = (curr: number, base: number) => {
            return base > 0 ? ((curr / base) - 1) * 100 : 0;
        };

        const result = visibleRows.map(row => {
            const date = row.date;
            const overseasVal = syncOverseasFriday(date, overseasMultipliers);

            return {
                date: date,
                isLive: row.isLive || false,
                kospi: calcRelReturn(getIndexPrice(kospi, date), kospiBase),
                kosdaq: calcRelReturn(getIndexPrice(kosdaq, date), kosdaqBase),
                nasdaq: calcRelReturn(getIndexPrice(nasdaq, date), nasdaqBase),
                dow: calcRelReturn(getIndexPrice(dow, date), dowBase),
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
