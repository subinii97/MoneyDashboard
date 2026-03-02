import * as cheerio from 'cheerio';
import { extractNumber, DEFAULT_USER_AGENT, MOBILE_USER_AGENT } from './utils';

export async function fetchExchangeRate(forceRefresh = false) {
    try {
        const url = 'https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW';
        const response = await fetch(url, {
            headers: { 'User-Agent': DEFAULT_USER_AGENT },
            cache: forceRefresh ? 'no-store' : undefined,
            next: forceRefresh ? undefined : { revalidate: 60 }
        });

        const contentType = response.headers.get('content-type');
        const charset = contentType?.includes('charset=')
            ? contentType.split('charset=')[1].split(';')[0].trim().toLowerCase()
            : 'euc-kr';

        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder(charset);
        const html = decoder.decode(buffer);
        const $ = cheerio.load(html);

        const rateText = $('.today .no_today').first().text() || $('.head_info .value').first().text();
        let rateValue = extractNumber(rateText);

        if (rateValue === 0) {
            $('.head_info, .today').find('em, span, strong').each((i, el) => {
                const val = extractNumber($(el).text());
                if (val > 1000 && val < 2000) {
                    rateValue = val;
                    return false;
                }
            });
        }

        const timeText = $('.exchange_info .date').first().text().trim() || $('.date').first().text().trim();
        return {
            rate: rateValue || 1350,
            time: timeText || ''
        };
    } catch (e) {
        console.error('Exchange rate fetch error:', e);
        return { rate: 1350, time: '' };
    }
}

export async function fetchMarketExchangeRate(code: string, forceRefresh = false) {
    // Specialized handling for EURUSD
    if (code === 'FX_EURUSD') {
        const yahooPrice = await fetchEURUSDFromYahoo();
        if (yahooPrice) return yahooPrice;
    }

    const url = `https://api.stock.naver.com/marketindex/exchange/${code}`;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': MOBILE_USER_AGENT },
            cache: 'no-cache'
        });
        if (!response.ok) return null;
        const json = await response.json();
        const target = json.exchangeInfo || (json.result ? json.result : json);

        let name = target.currencyName || target.itemSymbol || target.itemCode || target.name || code;
        if (code === 'FX_USDKRW') name = '원달러 (USD/KRW)';
        if (code === 'FX_EURKRW') name = '원유로 (EUR/KRW)';
        if (code === 'FX_JPYKRW') name = '원엔 (JPY/KRW 100)';
        if (code === 'FX_EURUSD') name = '유로달러 (EUR/USD)';

        return {
            name,
            price: extractNumber(target.closePrice || target.calcPrice || target.nowValue || target.closePriceRaw),
            change: extractNumber(String(target.fluctuations || target.compareToPreviousClosePriceBase || target.compareToPreviousClosePrice || target.compareToPreviousCloseValue || '0')),
            changePercent: extractNumber(String(target.fluctuationsRatio || '0')),
            time: target.localTradedAt || target.time || new Date().toISOString()
        };
    } catch (e) {
        console.error(`Error fetching exchange rate ${code}:`, e);
        return null;
    }
}

async function fetchEURUSDFromYahoo() {
    try {
        const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X', {
            cache: 'no-store'
        });
        if (res.ok) {
            const json = await res.json();
            const result = json.chart?.result?.[0];
            if (result && result.meta) {
                const price = result.meta.regularMarketPrice;
                const previousClose = result.meta.previousClose;
                const change = price - previousClose;
                let changePercent = 0;
                if (previousClose !== 0) {
                    changePercent = (change / previousClose) * 100;
                }

                return {
                    name: '유로달러 (EUR/USD)',
                    price,
                    change,
                    changePercent,
                    time: new Date().toISOString()
                };
            }
        }
    } catch (e) {
        console.error('Yahoo EURUSD fetch error:', e);
    }
    return null;
}
