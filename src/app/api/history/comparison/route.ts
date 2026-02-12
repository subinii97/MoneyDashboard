import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { fetchMarketIndexHistory } from '@/lib/stock';
import { calculateTWRMultipliers, syncOverseasFriday } from '@/lib/settlement';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scope = searchParams.get('scope') || '1m';

        let daysCount = 30;
        if (scope === '1w') daysCount = 7;
        else if (scope === '2w') daysCount = 14;
        else if (scope === '1m') daysCount = 30;
        else if (scope === '3m') daysCount = 90;

        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - daysCount);
        const startDate = start.toISOString().substring(0, 10);

        const [kospi, kosdaq, nasdaq, dow] = await Promise.all([
            fetchMarketIndexHistory('KOSPI', daysCount + 20),
            fetchMarketIndexHistory('KOSDAQ', daysCount + 20),
            fetchMarketIndexHistory('NASDAQ', daysCount + 20),
            fetchMarketIndexHistory('DOW', daysCount + 20)
        ]);

        const allRows = db.prepare('SELECT * FROM history WHERE date >= ? ORDER BY date ASC').all(startDate) as any[];
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

        const domesticMultipliers = calculateTWRMultipliers(allRows, 'Domestic');
        const overseasMultipliers = calculateTWRMultipliers(allRows, 'Overseas');

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
                kospi: calcRelReturn(getIndexPrice(kospi, date), kospiBase),
                kosdaq: calcRelReturn(getIndexPrice(kosdaq, date), kosdaqBase),
                nasdaq: calcRelReturn(getIndexPrice(nasdaq, date), nasdaqBase),
                dow: calcRelReturn(getIndexPrice(dow, date), dowBase),
                myDomestic: calcRelReturn(domesticMultipliers[date] || 1, domesticBase),
                myOverseas: calcRelReturn(overseasVal, overseasBase)
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Comparison API failed:', error);
        return NextResponse.json({ error: 'Failed to fetch comparison data' }, { status: 500 });
    }
}
