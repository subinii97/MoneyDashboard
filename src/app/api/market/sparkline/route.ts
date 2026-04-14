import { NextResponse } from 'next/server';
import { MOBILE_USER_AGENT } from '@/lib/stock/utils';

export const dynamic = 'force-dynamic';

// In-memory cache (5min TTL)
const sparkCache: Record<string, { data: number[], timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Fetch intraday sparkline data for market items.
 * Returns normalized price arrays for mini chart rendering.
 */

// ── KOSPI / KOSDAQ (네이버 국내지수 일봉) ──
async function fetchDomesticIndexSpark(code: string): Promise<number[]> {
    try {
        // 네이버 국내지수 일간 차트 (최근 14일)
        const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=day&count=14&requestType=0`;
        const res = await fetch(url, { cache: 'no-store' });
        const xml = await res.text();

        // Parse XML: <item data="20260312|2670.12|2672.30|2665.50|2668.80|..." />
        const matches = [...xml.matchAll(/data="([^"]+)"/g)];
        if (matches.length === 0) return [];

        const prices = matches.map(m => {
            const parts = m[1].split('|');
            return parseFloat(parts[4]); // close price
        }).filter(p => !isNaN(p));

        // 데이터가 모자라거나 너무 많지 않으면 그대로 스파크라인 포인트로 사용
        return prices;
    } catch (e) {
        console.error(`Spark error ${code}:`, e);
        return [];
    }
}

// ── NASDAQ / DOW (네이버 해외지수 일봉) ──
async function fetchOverseasIndexSpark(code: string): Promise<number[]> {
    try {
        const symbol = code === 'NASDAQ' ? 'NAS@IXIC' : 'DJI@DJI';
        // 네이버 해외지수 일별 데이터 (최근 14일로 sparkline 표현)
        const url = `https://finance.naver.com/world/worldDayListJson.naver?symbol=${symbol}&fdtc=0&page=1`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store'
        });
        const data = await res.json();

        if (!Array.isArray(data)) return [];

        // 최근 14개 (역순으로 오므로 reverse)
        const prices = data
            .slice(0, 14)
            .reverse()
            .map((item: any) => parseFloat(String(item.clos).replace(/,/g, '')))
            .filter((p: number) => !isNaN(p));

        return prices;
    } catch (e) {
        console.error(`Spark error ${code}:`, e);
        return [];
    }
}

// ── 환율 (네이버 환율 차트) ──
async function fetchExchangeRateSpark(code: string): Promise<number[]> {
    try {
        // 네이버 환율 차트 API (일봉 14일치)
        const url = `https://api.stock.naver.com/marketindex/exchange/${code}/prices?page=1&pageSize=14`;
        const res = await fetch(url, {
            headers: { 'User-Agent': MOBILE_USER_AGENT },
            cache: 'no-store'
        });
        if (!res.ok) return [];
        const json = await res.json();

        const items = json.priceInfos || json.prices || json || [];
        if (!Array.isArray(items)) return [];

        // closePrice 값에 ','가 포함되어 있을 수 있으므로 제거 후 파싱
        const prices = items
            .map((item: any) => {
                const pStr = String(item.closePrice || item.calcPrice || item.price || '0').replace(/,/g, '');
                return parseFloat(pStr);
            })
            .filter((p: number) => !isNaN(p) && p > 0)
            .reverse(); // 과거 -> 현재 순서로 정렬

        return prices;
    } catch (e) {
        console.error(`Spark error ${code}:`, e);
        return [];
    }
}

// ── 가상화폐 (Binance klines) ──
async function fetchCryptoSpark(symbol: string): Promise<number[]> {
    try {
        // 1일봉 14개 = 최근 2주
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=14`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();

        return data.map((k: any) => parseFloat(k[4])); // close price
    } catch (e) {
        console.error(`Spark error crypto ${symbol}:`, e);
        return [];
    }
}

// ── Commodity (Yahoo Finance chart API) ──
async function fetchCommoditySpark(yahooSymbol: string): Promise<number[]> {
    try {
        // 1일봉 14일
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=14d`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return [];
        const json = await res.json();
        const result = json.chart?.result?.[0];
        if (!result) return [];

        const closes = result.indicators?.quote?.[0]?.close || [];
        return closes.filter((p: any) => p !== null && !isNaN(p));
    } catch (e) {
        console.error(`Spark error commodity ${yahooSymbol}:`, e);
        return [];
    }
}

function sampleArray(arr: number[], maxPoints: number): number[] {
    if (arr.length <= maxPoints) return arr;
    const step = arr.length / maxPoints;
    const result: number[] = [];
    for (let i = 0; i < maxPoints; i++) {
        result.push(arr[Math.floor(i * step)]);
    }
    return result;
}

export async function GET() {
    try {
        const items: Record<string, { fetch: () => Promise<number[]> }> = {
            'KOSPI': { fetch: () => fetchDomesticIndexSpark('KOSPI') },
            'KOSDAQ': { fetch: () => fetchDomesticIndexSpark('KOSDAQ') },
            'NASDAQ': { fetch: () => fetchOverseasIndexSpark('NASDAQ') },
            'DOW': { fetch: () => fetchOverseasIndexSpark('DOW') },
            '나스닥': { fetch: () => fetchOverseasIndexSpark('NASDAQ') },
            '다우존스': { fetch: () => fetchOverseasIndexSpark('DOW') },
            'USDKRW': { fetch: () => fetchExchangeRateSpark('FX_USDKRW') },
            'EURKRW': { fetch: () => fetchExchangeRateSpark('FX_EURKRW') },
            'EURUSD': { fetch: () => fetchCommoditySpark('EURUSD=X') },
            'JPYKRW': { fetch: () => fetchExchangeRateSpark('FX_JPYKRW') },
            'CNYKRW': { fetch: () => fetchExchangeRateSpark('FX_CNYKRW') },
            'BTC': { fetch: () => fetchCryptoSpark('BTCUSDT') },
            'ETH': { fetch: () => fetchCryptoSpark('ETHUSDT') },
            'GOLD': { fetch: () => fetchCommoditySpark('GC=F') },
            'SILVER': { fetch: () => fetchCommoditySpark('SI=F') },
            'COPPER': { fetch: () => fetchCommoditySpark('HG=F') },
            'WTI': { fetch: () => fetchCommoditySpark('CL=F') },
            'BRENT': { fetch: () => fetchCommoditySpark('BZ=F') },
            'IRON': { fetch: () => fetchCommoditySpark('TIO=F') },
            'S&P 500': { fetch: () => fetchCommoditySpark('^GSPC') },
            '니케이 225': { fetch: () => fetchCommoditySpark('^N225') },
            '상해종합': { fetch: () => fetchCommoditySpark('000001.SS') },
            '항셍지수': { fetch: () => fetchCommoditySpark('^HSI') },
            '독일 DAX': { fetch: () => fetchCommoditySpark('^GDAXI') },
            '영국 FTSE 100': { fetch: () => fetchCommoditySpark('^FTSE') },
        };

        const result: Record<string, number[]> = {};

        await Promise.all(
            Object.entries(items).map(async ([key, { fetch: fetchFn }]) => {
                // Check cache
                const cached = sparkCache[key];
                if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                    result[key] = cached.data;
                    return;
                }

                const data = await fetchFn();
                if (data.length > 0) {
                    sparkCache[key] = { data, timestamp: Date.now() };
                }
                result[key] = data;
            })
        );

        return NextResponse.json(result);
    } catch (error) {
        console.error('Sparkline API error:', error);
        return NextResponse.json({}, { status: 500 });
    }
}
