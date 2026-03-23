import { NextResponse } from 'next/server';
import { fetchMarketIndexHistory } from '@/lib/stock';

export const dynamic = 'force-dynamic';

function getReturns(data: { date: string; close: number }[]) {
    const returns: { [date: string]: number } = {};
    for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1].close;
        const curr = data[i].close;
        const ret = prev > 0 ? (curr - prev) / prev : 0;
        returns[data[i].date] = ret;
    }
    return returns;
}

function calculatePearson(x: number[], y: number[]) {
    if (x.length < 5 || x.length !== y.length) return 0;
    const n = x.length;
    const mux = x.reduce((a, b) => a + b, 0) / n;
    const muy = y.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
        const dx = x[i] - mux;
        const dy = y[i] - muy;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
    }

    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : num / den;
}

export async function GET() {
    try {
        // Fetch last 120 days to get around 90 pairs of returns
        const [usData, krData] = await Promise.all([
            fetchMarketIndexHistory('S&P500', 120),
            fetchMarketIndexHistory('KOSPI', 120)
        ]);

        if (!usData.length || !krData.length) {
            return NextResponse.json({ error: 'No data' }, { status: 404 });
        }

        const usReturns = getReturns(usData);
        const krReturns = getReturns(krData);

        // Find common dates
        const commonDates = Object.keys(usReturns)
            .filter(d => krReturns[d] !== undefined)
            .sort();

        const x = commonDates.map(d => usReturns[d]);
        const y = commonDates.map(d => krReturns[d]);

        const corr = calculatePearson(x, y);

        // Also calculate with a 1-day lag (US T-1 vs KR T)
        // often US market affects KR the NEXT day
        const lagX: number[] = [];
        const lagY: number[] = [];
        
        // Find kr_date such that us_date = prev_business_day(kr_date)
        const krDates = Object.keys(krReturns).sort();
        const usDates = Object.keys(usReturns).sort();
        
        for (let i = 0; i < krDates.length; i++) {
            const dKR = krDates[i];
            // Find the most recent US date strictly before dKR
            const dUSIdx = usDates.findIndex(d => d >= dKR) - 1;
            if (dUSIdx >= 0) {
                lagX.push(usReturns[usDates[dUSIdx]]);
                lagY.push(krReturns[dKR]);
            }
        }
        
        const corrLag = calculatePearson(lagX, lagY);

        return NextResponse.json({
            correlation: corr,
            correlationLag: corrLag, // US(T-1) -> KR(T)
            sampleSize: commonDates.length,
            period: '90 days'
        });
    } catch (e) {
        console.error('Correlation calc failed', e);
        return NextResponse.json({ error: 'Failure' }, { status: 500 });
    }
}
