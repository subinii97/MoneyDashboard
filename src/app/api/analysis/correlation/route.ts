import { NextResponse } from 'next/server';
import { fetchMarketIndexHistory } from '@/lib/stock';
import { load } from 'cheerio';

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

const SECTOR_ETFS = [
    { id: 'tech', etf: 'XLK' }, { id: 'fin', etf: 'XLF' }, { id: 'health', etf: 'XLV' },
    { id: 'cons_cyc', etf: 'XLY' }, { id: 'comm', etf: 'XLC' }, { id: 'indust', etf: 'XLI' },
    { id: 'cons_def', etf: 'XLP' }, { id: 'energy', etf: 'XLE' }, { id: 'util', etf: 'XLU' },
    { id: 'materials', etf: 'XLB' }, { id: 'realestate', etf: 'XLRE' },
];

const KR_SECTOR_PROXIES = [
    { id: 'kr-elec', symbol: '005930' }, { id: 'kr-heavy', symbol: '005380' },
    { id: 'kr-finance', symbol: '105560' }, { id: 'kr-it', symbol: '035420' },
    { id: 'kr-bio', symbol: '207940' }, { id: 'kr-chem', symbol: '051910' },
    { id: 'kr-steel', symbol: '005490' }, { id: 'kr-consumer', symbol: '033780' },
    { id: 'kr-util', symbol: '017670' }, { id: 'kr-const', symbol: '032830' },
];

const KQ_SECTOR_PROXIES = [
    { id: 'kq-pharma', symbol: '196170' }, { id: 'kq-elec', symbol: '247540' },
    { id: 'kq-heavy', symbol: '277810' }, { id: 'kq-chem', symbol: '086520' },
    { id: 'kq-it', symbol: '263750' }, { id: 'kq-med', symbol: '214150' },
];

async function fetchTickerHistory(symbol: string, isDomestic = false) {
    if (isDomestic) {
        // Use Naver FChart for domestic history
        const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${symbol}&timeframe=day&count=20&requestType=0`;
        try {
            const res = await fetch(url);
            const xml = await res.text();
            const $ = load(xml, { xmlMode: true });
            const data: { date: string; close: number }[] = [];
            $('item').each((_: number, el: any) => {
                const row = $(el).attr('data') || '';
                const parts = row.split('|');
                if (parts.length >= 5) {
                    const d = parts[0];
                    data.push({ 
                        date: `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`, 
                        close: parseFloat(parts[4]) 
                    });
                }
            });
            return data;
        } catch { return []; }
    } else {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`;
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
            if (!res.ok) return [];
            const json = await res.json();
            const result = json.chart?.result?.[0];
            if (!result || !result.timestamp) return [];
            const timestamps = result.timestamp;
            const closes = result.indicators.quote[0].close;
            const data: { date: string; close: number }[] = [];
            for (let i = 0; i < timestamps.length; i++) {
                if (closes[i] === null || closes[i] === undefined) continue;
                data.push({ date: new Date(timestamps[i] * 1000).toISOString().substring(0, 10), close: closes[i] });
            }
            return data;
        } catch { return []; }
    }
}

export async function GET() {
    try {
        const [krData, usData, kqData, ...histories] = await Promise.all([
            fetchMarketIndexHistory('KOSPI', 40),
            fetchMarketIndexHistory('S&P500', 40),
            fetchMarketIndexHistory('KOSDAQ', 40),
            ...SECTOR_ETFS.map(s => fetchTickerHistory(s.etf, false)),
            ...KR_SECTOR_PROXIES.map(s => fetchTickerHistory(s.symbol, true)),
            ...KQ_SECTOR_PROXIES.map(s => fetchTickerHistory(s.symbol, true))
        ]);

        const etfHistories = histories.slice(0, SECTOR_ETFS.length);
        const krProxies = histories.slice(SECTOR_ETFS.length, SECTOR_ETFS.length + KR_SECTOR_PROXIES.length);
        const kqProxies = histories.slice(SECTOR_ETFS.length + KR_SECTOR_PROXIES.length);

        if (!usData.length || !krData.length) return NextResponse.json({ error: 'No data' }, { status: 404 });

        const krReturns = getReturns(krData);
        const krDates = Object.keys(krReturns).sort();
        const kqReturns = getReturns(kqData);
        const kqDates = Object.keys(kqReturns).sort();

        const calculateLagCorr = (uData: { date: string; close: number }[], kRet = krReturns, kDatesInput = krDates) => {
            const uReturns = getReturns(uData);
            const uDates = Object.keys(uReturns).sort();
            const lagX: number[] = [];
            const lagY: number[] = [];
            for (let i = 0; i < kDatesInput.length; i++) {
                const dk = kDatesInput[i];
                const dUSIdx = uDates.findIndex(d => d >= dk) - 1;
                if (dUSIdx >= 0) {
                    lagX.push(uReturns[uDates[dUSIdx]]);
                    lagY.push(kRet[dk]);
                }
            }
            return calculatePearson(lagX, lagY);
        };

        const globalCorrLag = calculateLagCorr(usData);
        
        // Calculate Trend (Last 14 days)
        const lagTrend: { date: string, value: number }[] = [];
        const windowSize = 10; // Use a sliding window of the previous 10 trading days
        for (let i = Math.max(0, krDates.length - 14); i < krDates.length; i++) {
            const windowDates = krDates.slice(Math.max(0, i - windowSize + 1), i + 1);
            if (windowDates.length >= 5) { // Ensure enough data points for correlation
                lagTrend.push({
                    date: krDates[i],
                    value: calculateLagCorr(usData, krReturns, windowDates)
                });
            }
        }
        const correlationLagPrev = lagTrend.length > 1 ? lagTrend[lagTrend.length - 2].value : 0;

        const sectorCorrelations: Record<string, number> = {};
        SECTOR_ETFS.forEach((s, i) => {
            if (etfHistories[i]?.length > 5) sectorCorrelations[s.id] = calculateLagCorr(etfHistories[i]);
        });

        const krSectorCorrelations: Record<string, number> = {};
        KR_SECTOR_PROXIES.forEach((s, i) => {
            const hist = krProxies[i];
            if (hist && hist.length > 5) {
                const sRet = getReturns(hist);
                const sDates = Object.keys(sRet).sort();
                const x: number[] = [];
                const y: number[] = [];
                for (const d of sDates) {
                    if (krReturns[d] !== undefined) {
                      x.push(krReturns[d]);  // KOSPI Index
                      y.push(sRet[d]);       // Sector
                    }
                }
                krSectorCorrelations[s.id] = calculatePearson(x, y);
            }
        });

        const kqSectorCorrelations: Record<string, number> = {};
        KQ_SECTOR_PROXIES.forEach((s, i) => {
            const hist = kqProxies[i];
            if (hist && hist.length > 5) {
                const sRet = getReturns(hist);
                const sDates = Object.keys(sRet).sort();
                const x: number[] = [];
                const y: number[] = [];
                for (const d of sDates) {
                    if (kqReturns[d] !== undefined) {
                      x.push(kqReturns[d]);  // KOSDAQ Index
                      y.push(sRet[d]);       // Sector
                    }
                }
                kqSectorCorrelations[s.id] = calculatePearson(x, y);
            }
        });

        const sameDayReturnsUS = getReturns(usData);
        const commonDates = Object.keys(sameDayReturnsUS).filter(d => krReturns[d] !== undefined).sort();
        const globalCorrSameDay = calculatePearson(
            commonDates.map(d => sameDayReturnsUS[d]),
            commonDates.map(d => krReturns[d])
        );

        return NextResponse.json({
            correlation: globalCorrSameDay,
            correlationLag: globalCorrLag,
            correlationLagHistory: lagTrend,
            correlationLagPrev,
            sectorCorrelations,
            krSectorCorrelations,
            kqSectorCorrelations,
            sampleSize: commonDates.length,
        });
    } catch {
        return NextResponse.json({ error: 'Failure' }, { status: 500 });
    }
}


