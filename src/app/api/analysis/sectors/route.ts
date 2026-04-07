import { NextResponse } from 'next/server';
import { fetchQuote, fetchMarketIndex } from '@/lib/stock';
import { US_SECTORS, KR_SECTORS, KOSDAQ_SECTORS } from '@/lib/sectors-data';

const TTL = 10000;
const _cache: Record<string, { data: any; ts: number }> = {};

const getS = (s: string) => fetchQuote(s).then(d => (!d || d.error) ? null : ({ cp: d.changePercent, pr: d.price, name: d.name, ms: d.marketStatus === 'OPEN' ? 'OPEN' : 'CLOSED', s: d.overMarketSession, op: d.overMarketPrice, ocp: d.overMarketChangePercent, tv: d.tradingValue, marketCap: d.marketCap }));

export async function GET(request: Request) {
    const market = (new URL(request.url).searchParams.get('market') || 'US') as 'US' | 'KR' | 'KOSDAQ';
    if (_cache[market] && Date.now() - _cache[market].ts < TTL) return NextResponse.json(_cache[market].data);

    try {
        const source = market === 'US' ? US_SECTORS : market === 'KR' ? KR_SECTORS : KOSDAQ_SECTORS;
        
        // Fetch actual market index in parallel
        const indexCode = market === 'US' ? 'S&P500' : (market === 'KR' ? 'KOSPI' : 'KOSDAQ');
        const indexResPromise = fetchMarketIndex(indexCode === 'S&P500' ? '.INX' : indexCode);

        const results = await Promise.all(source.map(async (sec) => {
            const etf = (sec as any).etf ? await getS((sec as any).etf) : null;
            const stockRes = await Promise.all(sec.stocks.map(s => getS(s.symbol)));
            const stocks = sec.stocks.map((s, i) => {
                const r = stockRes[i]; 
                let actualCap = s.cap;
                if (r && r.marketCap) {
                    actualCap = market === 'US' ? (r.marketCap / 100000000) : (r.marketCap / 100000000000);
                }
                return { symbol: s.symbol, name: r?.name || s.name, cap: actualCap, changePercent: r?.cp ?? 0, price: r?.pr ?? 0, overMarketSession: r?.s, overMarketPrice: r?.op, overMarketChangePercent: r?.ocp, tradingValue: r?.tv ?? 0 };
            }).filter(s => s.price > 0);
            const totalCap = stocks.reduce((a, s) => a + s.cap, 0) || 1;
            const sectorChange = etf?.cp ?? stocks.reduce((a, s) => a + s.changePercent * (s.cap / totalCap), 0);
            return { id: sec.id, name: sec.name, weight: totalCap, changePercent: sectorChange || 0, stocks };
        }));

        const indexRes = await indexResPromise;
        const indexChange = indexRes?.changePercent ?? 0;

        let status = 'CLOSED';
        const now = new Date();
        if (market === 'US') {
            const nyc = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
            const nycDay = nyc.getDay(), nycTime = nyc.getHours() + nyc.getMinutes() / 60;
            if (nycDay >= 1 && nycDay <= 5) {
                if (nycTime >= 9.5 && nycTime < 16) status = 'OPEN';
                else if (nycTime >= 4 && nycTime < 9.5) status = 'PRE_MARKET';
                else if (nycTime >= 16 && nycTime < 20) status = 'AFTER_MARKET';
            }
        } else {
            const kst = new Date(now.getTime() + 9 * 3600000);
            const d = kst.getUTCDay(), t = kst.getUTCHours() + kst.getUTCMinutes() / 60;
            if (d >= 1 && d <= 5) { if (t >= 9 && t < 15.6) status = 'OPEN'; else if (t >= 16 && t < 20) status = 'AFTER_MARKET'; }
        }

        const data = { 
            market, 
            status, 
            indexChange,
            sectors: results.filter(s => s.stocks.length > 0) 
        };
        _cache[market] = { data, ts: Date.now() };
        return NextResponse.json(data);
    } catch (e) { console.error(e); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
