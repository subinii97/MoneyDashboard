import * as cheerio from 'cheerio';
import { extractNumber, DEFAULT_USER_AGENT, MOBILE_USER_AGENT } from './utils';

export async function fetchNaverQuote(symbol: string, forceRefresh = false) {
    const code = symbol.split('.')[0];
    const url = `https://finance.naver.com/item/main.naver?code=${code}`;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': DEFAULT_USER_AGENT },
            cache: forceRefresh ? 'no-store' : undefined,
            next: forceRefresh ? undefined : { revalidate: 30 }
        });

        if (!response.ok) return { symbol, error: 'Naver Finance access failed' };

        const contentType = response.headers.get('content-type');
        const charset = contentType?.includes('charset=')
            ? contentType.split('charset=')[1].split(';')[0].trim().toLowerCase()
            : 'utf-8';

        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder(charset || 'utf-8');
        const html = decoder.decode(buffer);
        const $ = cheerio.load(html);

        const name = $('.wrap_company h2 a').text().trim() || $('.wrap_company h2').text().trim();
        const priceText = $('.no_today .blind').first().text() || $('.no_today em').first().text();
        const price = extractNumber(priceText);

        if (price === 0) return { symbol, error: 'Price not found on Naver' };

        const previousCloseText = $('.no_info td.first em').first().text() || $('.no_info tr:nth-of-type(1) td em').first().text();
        const previousClose = extractNumber(previousCloseText);

        const change = price - previousClose;
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

        return {
            symbol,
            price,
            currency: 'KRW',
            exchange: symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KRX',
            name: name || symbol,
            change,
            changePercent,
            previousClose
        };
    } catch (error) {
        console.error(`Error scraping Naver for ${symbol}:`, error);
        return { symbol, error: 'Naver scraping failed' };
    }
}

export async function fetchDomesticIndex(code: string) {
    const url = `https://polling.finance.naver.com/api/realtime/domestic/index/${code}`;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': MOBILE_USER_AGENT },
            cache: 'no-cache'
        });
        if (!response.ok) return null;
        const json = await response.json();
        const data = (json.datas && json.datas[0]) || (json.result && json.result[0]) || json;

        let name = data.stockName || data.indexName || data.itemCode || data.symbolCode || code;
        if (code === 'KOSPI') name = '코스피';
        if (code === 'KOSDAQ') name = '코스닥';

        return {
            name,
            price: extractNumber(data.closePriceRaw || data.closePrice || data.nowValue),
            change: extractNumber(String(data.compareToPreviousClosePriceRaw || data.compareToPreviousClosePrice || data.compareToPreviousCloseValue || '0')),
            changePercent: extractNumber(String(data.fluctuationsRatioRaw || data.fluctuationsRatio || '0')),
            status: data.marketStatus,
            time: data.localTradedAt || data.time || new Date().toISOString()
        };
    } catch (e) {
        console.error(`Error fetching domestic index ${code}:`, e);
        return null;
    }
}
