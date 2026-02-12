import * as cheerio from 'cheerio';
import { fetchNaverQuote, fetchDomesticIndex } from './stock/domestic';
import { fetchNaverOverseasQuote, fetchOverseasIndex } from './stock/overseas';
import { fetchExchangeRate as fetchNavRate, fetchMarketExchangeRate as fetchMktRate } from './stock/exchange';
import { extractNumber } from './stock/utils';

// In-memory cache
const quoteCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 30 * 1000;

let rateCacheObj: { data: any, timestamp: number } | null = null;
const RATE_CACHE_TTL = 60 * 1000;

/**
 * Main entry point for fetching stock quotes.
 */
export async function fetchQuote(symbol: string, forceRefresh = false) {
    if (!forceRefresh) {
        const cached = quoteCache[symbol];
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
    }

    let cleanSymbol = symbol.toUpperCase().trim();
    if (cleanSymbol.includes(':')) {
        cleanSymbol = cleanSymbol.split(':')[1];
    }

    let res;
    if (cleanSymbol.endsWith('.KS') || cleanSymbol.endsWith('.KQ') || /^\d{6}/.test(cleanSymbol)) {
        res = await fetchNaverQuote(cleanSymbol, forceRefresh);
    } else {
        res = await fetchNaverOverseasQuote(cleanSymbol, forceRefresh);
    }

    if (res) {
        res.symbol = symbol;
        quoteCache[symbol] = { data: res, timestamp: Date.now() };
    }
    return res;
}

export async function fetchExchangeRate(forceRefresh = false) {
    if (!forceRefresh && rateCacheObj && Date.now() - rateCacheObj.timestamp < RATE_CACHE_TTL) {
        return rateCacheObj.data;
    }
    const data = await fetchNavRate(forceRefresh);
    rateCacheObj = { data, timestamp: Date.now() };
    return data;
}

export async function fetchMarketIndex(code: string, forceRefresh = false) {
    const isDomestic = !code.startsWith('.');
    if (isDomestic) return fetchDomesticIndex(code);
    return fetchOverseasIndex(code);
}

export async function fetchMarketExchangeRate(code: string) {
    return fetchMktRate(code);
}

/**
 * Historical index data fetching (KOSPI, KOSDAQ, NASDAQ, DOW)
 */
export async function fetchMarketIndexHistory(code: string, days: number = 30) {
    if (code === 'KOSPI' || code === 'KOSDAQ') {
        const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=day&count=${days}&requestType=0`;
        try {
            const response = await fetch(url);
            const xml = await response.text();
            const $ = cheerio.load(xml, { xmlMode: true });
            const items = $('item');
            const data: { date: string, close: number }[] = [];
            items.each((i, el) => {
                const row = $(el).attr('data') || '';
                const parts = row.split('|');
                if (parts.length >= 5) {
                    const dateStr = parts[0];
                    const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                    data.push({ date: formattedDate, close: parseFloat(parts[4]) });
                }
            });
            return data;
        } catch (e) {
            console.error(`Error fetching historical index ${code}:`, e);
            return [];
        }
    } else if (code === 'NASDAQ' || code === 'DOW') {
        const symbol = code === 'NASDAQ' ? 'NAS@IXIC' : 'DJI@DJI';
        try {
            const pages = [1, 2, 3, 4, 5];
            const allItems = await Promise.all(pages.map(async (page) => {
                const url = `https://finance.naver.com/world/worldDayListJson.naver?symbol=${symbol}&fdtc=0&page=${page}`;
                const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                return response.json();
            }));

            const flattened = allItems.flat();
            return flattened.map((item: any) => ({
                date: `${item.xymd.substring(0, 4)}-${item.xymd.substring(4, 6)}-${item.xymd.substring(6, 8)}`,
                close: parseFloat(item.clos)
            })).sort((a, b) => a.date.localeCompare(b.date));
        } catch (e) {
            console.error(`Error fetching historical ${code}:`, e);
            return [];
        }
    }
    return [];
}
