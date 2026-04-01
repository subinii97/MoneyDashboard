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
    
    // Weights: EMA-like weights to give more importance to recent days, but more smoothly
    // w_i = e^(0.15 * i)
    const weights = Array.from({ length: n }, (_, i) => Math.exp(0.15 * i));
    const sumW = weights.reduce((a, b) => a + b, 0);

    const mux = x.reduce((a, b, i) => a + (b * weights[i]), 0) / sumW;
    const muy = y.reduce((a, b, i) => a + (b * weights[i]), 0) / sumW;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
        const w = weights[i];
        const dx = x[i] - mux;
        const dy = y[i] - muy;
        num += w * dx * dy;
        denX += w * dx * dx;
        denY += w * dy * dy;
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
    { id: 'kr-finance', symbol: '105560' }, { id: 'kr-it-service', symbol: '035420' },
    { id: 'kr-bio', symbol: '207940' }, { id: 'kr-chem', symbol: '051910' },
    { id: 'kr-steel', symbol: '005490' }, { id: 'kr-consumer', symbol: '033780' },
];

const KQ_SECTOR_PROXIES = [
    { id: 'kq-pharma', symbol: '196170' }, { id: 'kq-it', symbol: '058470' },
    { id: 'kq-battery', symbol: '247540' }, { id: 'kq-heavy', symbol: '277810' },
    { id: 'kq-culture', symbol: '263750' }, { id: 'kq-fin', symbol: '086520' },
];

async function fetchTickerHistory(symbol: string, isDomestic = false) {
    if (isDomestic) {
        // Use Naver FChart for domestic history
        const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${symbol}&timeframe=day&count=60&requestType=0`;
        try {
            const res = await fetch(url, { cache: 'no-store' });
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
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
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
            fetchMarketIndexHistory('KOSPI', 65),
            fetchMarketIndexHistory('S&P500', 65),
            fetchMarketIndexHistory('KOSDAQ', 65),
            ...SECTOR_ETFS.map((s: any) => fetchTickerHistory(s.etf, false)),
            ...KR_SECTOR_PROXIES.map((s: any) => fetchTickerHistory(s.symbol, true)),
            ...KQ_SECTOR_PROXIES.map((s: any) => fetchTickerHistory(s.symbol, true))
        ]);

        const etfHistories = histories.slice(0, SECTOR_ETFS.length);
        const krProxies = histories.slice(SECTOR_ETFS.length, SECTOR_ETFS.length + KR_SECTOR_PROXIES.length);
        const kqProxies = histories.slice(SECTOR_ETFS.length + KR_SECTOR_PROXIES.length);

        if (!usData.length || !krData.length) return NextResponse.json({ error: 'No data' }, { status: 404 });

        const krReturns = getReturns(krData);
        const krDates = Object.keys(krReturns).sort();
        const kqReturns = getReturns(kqData);

        const calculateLagCorr = (uData: { date: string; close: number }[], kRet = krReturns, kDatesInput = krDates) => {
            const uReturns = getReturns(uData);
            const uDates = Object.keys(uReturns).sort();
            const lagX: number[] = [];
            const lagY: number[] = [];
            for (let i = 0; i < kDatesInput.length; i++) {
                const dk = kDatesInput[i];
                // US market closes before KR market opens for the same business date (in Korea time)
                // Find US return that happened most recently before day dk
                const dUSIdx = uDates.findIndex(d => d >= dk) - 1;
                if (dUSIdx >= 0) {
                    const uRetVal = uReturns[uDates[dUSIdx]];
                    const kRetVal = kRet[dk];
                    if (uRetVal !== undefined && kRetVal !== undefined) {
                      lagX.push(uRetVal);
                      lagY.push(kRetVal);
                    }
                }
            }
            return calculatePearson(lagX, lagY);
        };

        const windowSize = 14; // Increase window size for more robust estimation
        const currentWindow = krDates.slice(-windowSize);
        const prevWindow = krDates.slice(-windowSize - 1, -1);

        const globalCorrLag = calculateLagCorr(usData, krReturns, currentWindow);
        const correlationLagPrev = calculateLagCorr(usData, krReturns, prevWindow);
        
        // Calculate Trend (Last 14 trading days)
        const lagTrend: { date: string, value: number }[] = [];
        for (let i = Math.max(windowSize, krDates.length - 14); i < krDates.length; i++) {
            const trendWindow = krDates.slice(i - windowSize + 1, i + 1);
            lagTrend.push({
                date: krDates[i],
                value: calculateLagCorr(usData, krReturns, trendWindow)
            });
        }

        const sectorCorrelations: Record<string, number> = {};
        SECTOR_ETFS.forEach((s: any, i: number) => {
            if (etfHistories[i]?.length > 5) sectorCorrelations[s.id] = calculateLagCorr(etfHistories[i] as any);
        });

        const krSectorCorrelations: Record<string, number> = {};
        KR_SECTOR_PROXIES.forEach((s: any, i: number) => {
            const hist = krProxies[i] as any;
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
        KQ_SECTOR_PROXIES.forEach((s: any, i: number) => {
            const hist = kqProxies[i] as any;
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

        const sectorSync: Record<string, number> = {};
        // Map KR Proxy ID to US Sector Index in SECTOR_ETFS
        const SYNC_MAP: Record<string, number> = {
            'kr-elec': 0,      // XLK (Tech)
            'kr-finance': 1,   // XLF (Financials)
            'kr-bio': 2,       // XLV (Health)
            'kr-heavy': 5,     // XLI (Industrials)
            'kr-it-service': 4, // XLC (Communication)
            'kr-chem': 9,      // XLB (Materials)
            'kr-steel': 9,     // XLB (Materials)
            'kr-consumer': 6,  // XLP (Cons. Def)
            'kq-pharma': 2,    // XLV (Health)
            'kq-it': 0,        // XLK (Tech)
            'kq-battery': 9,   // XLB (Materials)
            'kq-heavy': 5,     // XLI (Industrials)
        };

        [...KR_SECTOR_PROXIES, ...KQ_SECTOR_PROXIES].forEach((s: any, i: number) => {
            const usIdx = SYNC_MAP[s.id];
            if (usIdx === undefined) return;

            const krHist = (i < KR_SECTOR_PROXIES.length ? krProxies[i] : kqProxies[i - KR_SECTOR_PROXIES.length]) as any;
            const usHist = etfHistories[usIdx] as any;

            if (krHist && usHist && krHist.length > 5 && usHist.length > 5) {
                const sRet = getReturns(krHist);
                const sDates = Object.keys(sRet).sort();
                
                // Use the same lagged correlation logic as the global index
                sectorSync[s.id] = calculateLagCorr(usHist, sRet, sDates.slice(-14));
            }
        });

        const sameDayReturnsUS = getReturns(usData);
        const commonDates = Object.keys(sameDayReturnsUS).filter(d => krReturns[d] !== undefined).sort();
        const globalCorrSameDay = calculatePearson(
            commonDates.map((d: any) => sameDayReturnsUS[d]),
            commonDates.map((d: any) => krReturns[d])
        );

        return NextResponse.json({
            correlation: globalCorrSameDay,
            correlationLag: globalCorrLag,
            correlationLagHistory: lagTrend,
            correlationLagPrev,
            sectorCorrelations,
            krSectorCorrelations,
            kqSectorCorrelations,
            sectorSync,
            sampleSize: commonDates.length,
        });
    } catch {
        return NextResponse.json({ error: 'Failure' }, { status: 500 });
    }
}


