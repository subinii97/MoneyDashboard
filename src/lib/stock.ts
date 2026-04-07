import * as cheerio from 'cheerio';
import { fetchNaverQuote, fetchDomesticIndex } from './stock/domestic';
import { fetchNaverOverseasQuote, fetchOverseasIndex } from './stock/overseas';
import { fetchExchangeRate as fetchNavRate, fetchMarketExchangeRate as fetchMktRate } from './stock/exchange';
import { extractNumber, formatYmd } from './stock/utils';
import { isDomesticSymbol } from './utils';

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
    if (isDomesticSymbol(cleanSymbol)) {
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
    const isDomestic = code === 'KOSPI' || code === 'KOSDAQ';
    if (isDomestic) return fetchDomesticIndex(code);
    return fetchOverseasIndex(code);
}

export async function fetchMarketExchangeRate(code: string, forceRefresh = false) {
    return fetchMktRate(code, forceRefresh);
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
                    data.push({ date: formatYmd(parts[0]), close: parseFloat(parts[4]) });
                }
            });
            return data;
        } catch (e) {
            console.error(`Error fetching historical index ${code}:`, e);
            return [];
        }
    } else if (code === 'NASDAQ' || code === 'DOW' || code === 'S&P500') {
        const symbol = code === 'NASDAQ' ? 'NAS@IXIC' : (code === 'DOW' ? 'DJI@DJI' : 'SPI@SPX');
        try {
            // Calculate required pages (1 page = 10 items)
            const pagesCount = Math.ceil(days / 10) + 1;
            const pages = Array.from({ length: Math.min(pagesCount, 20) }, (_, i) => i + 1);

            const allItems = await Promise.all(pages.map(async (page) => {
                const url = `https://finance.naver.com/world/worldDayListJson.naver?symbol=${symbol}&fdtc=0&page=${page}`;
                const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                return response.json();
            }));

            const flattened = allItems.flat().filter(item => item && item.xymd && item.clos);
            const data = flattened.map((item: any) => ({
                date: formatYmd(item.xymd),
                close: parseFloat(item.clos)
            }));

            // Remove duplicates and sort
            const uniqueData = Array.from(new Map(data.map(item => [item.date, item])).values());
            return uniqueData.sort((a, b) => a.date.localeCompare(b.date));
        } catch (e) {
            console.error(`Error fetching historical ${code}:`, e);
            return [];
        }
    }
    return [];
}
