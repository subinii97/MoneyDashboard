import * as cheerio from 'cheerio';

// In-memory cache for stock quotes and exchange rates
const quoteCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Main entry point for fetching stock quotes using Naver Finance.
 * Automatically handles both domestic (KRX/KOSDAQ) and overseas stocks.
 */
export async function fetchQuote(symbol: string, forceRefresh = false) {
    if (!forceRefresh) {
        const cached = quoteCache[symbol];
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
    }

    // Sanitize symbol: handle Google Finance style prefixes (e.g., NASDAQ:AAPL -> AAPL)
    let cleanSymbol = symbol.toUpperCase().trim();
    if (cleanSymbol.includes(':')) {
        cleanSymbol = cleanSymbol.split(':')[1];
    }

    let res;
    // Domestic: Ends with .KS/.KQ or is 6 digits
    if (cleanSymbol.endsWith('.KS') || cleanSymbol.endsWith('.KQ') || /^\d{6}/.test(cleanSymbol)) {
        res = await fetchNaverQuote(cleanSymbol, forceRefresh);
    } else {
        // Overseas
        res = await fetchNaverOverseasQuote(cleanSymbol, forceRefresh);
    }

    if (res) {
        res.symbol = symbol; // Keep original symbol for mapping back in frontend
        quoteCache[symbol] = { data: res, timestamp: Date.now() };
    }
    return res;
}

const extractNumber = (text: string) => {
    const cleaned = text.replace(/,/g, '').trim();
    const match = cleaned.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (!match) return 0;

    const valString = match[0];

    // Naver Double Fix: if the string is like "65006500" or "4.114.11"
    if (valString.length >= 2 && valString.length % 2 === 0) {
        const half = valString.length / 2;
        const firstHalf = valString.substring(0, half);
        const secondHalf = valString.substring(half);
        if (firstHalf === secondHalf) {
            return parseFloat(firstHalf);
        }
    }

    return parseFloat(valString);
};

export async function fetchNaverQuote(symbol: string, forceRefresh = false) {
    const code = symbol.split('.')[0];
    const url = `https://finance.naver.com/item/main.naver?code=${code}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
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

// Persistent mapping for resolved overseas symbols
const overseasSymbolMap: Record<string, string> = {};

/**
 * Fetches overseas stock quotes from Naver Finance API.
 * Handles NASDAQ (.O), NYSE (.N), and AMEX (.A) suffixes.
 */
export async function fetchNaverOverseasQuote(symbol: string, forceRefresh = false) {
    const tryFetch = async (sym: string) => {
        const url = `https://api.stock.naver.com/stock/${sym}/basic`;
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
                },
                cache: forceRefresh ? 'no-store' : undefined,
                next: forceRefresh ? undefined : { revalidate: 30 }
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (!data || !data.closePrice) return null;
            return data;
        } catch {
            return null;
        }
    };

    let data = null;
    let finalSymbol = symbol;

    // 0. Use mapping if already resolved
    if (overseasSymbolMap[symbol]) {
        data = await tryFetch(overseasSymbolMap[symbol]);
        if (data) {
            finalSymbol = overseasSymbolMap[symbol];
        }
    }

    if (!data) {
        // 1. Try with suffixes if not provided
        if (!symbol.includes('.')) {
            const suffixes = ['.O', '.N', '.A'];
            for (const suffix of suffixes) {
                data = await tryFetch(symbol + suffix);
                if (data) {
                    finalSymbol = symbol + suffix;
                    overseasSymbolMap[symbol] = finalSymbol;
                    break;
                }
            }
        } else {
            // Already has a suffix or dot notation
            data = await tryFetch(symbol);

            // Handle common dot notation issue (e.g., BRK.B -> BRK_B.N)
            if (!data && symbol.includes('.')) {
                const parts = symbol.split('.');
                const base = parts[0];
                const sub = parts[1];
                // Try common Naver formats for tickers with classes
                const altSyms = [`${base}_${sub}.N`, `${base}_${sub}.O`, `${base}.${sub}`];
                for (const alt of altSyms) {
                    data = await tryFetch(alt);
                    if (data) {
                        finalSymbol = alt;
                        overseasSymbolMap[symbol] = finalSymbol;
                        break;
                    }
                }
            }
        }
    }

    if (!data) {
        return { symbol, error: 'Data not found in Naver API' };
    }

    // Use overMarketPrice if regular market is not open and over-market data exists
    let price = extractNumber(data.closePrice);

    // Naver Overseas API provides signed strings (e.g. "-8.53"), so we just need extractNumber
    let change = extractNumber(String(data.compareToPreviousClosePrice || '0'));
    let changePercent = extractNumber(String(data.fluctuationsRatio || '0'));

    if (data.marketStatus !== 'OPEN' && data.overMarketPriceInfo) {
        const over = data.overMarketPriceInfo;
        if (over.overMarketPrice && over.overMarketPrice !== '0' && over.overMarketPrice !== '') {
            price = extractNumber(over.overMarketPrice);
            change = extractNumber(String(over.compareToPreviousClosePrice || '0'));
            changePercent = extractNumber(String(over.fluctuationsRatio || '0'));
        }
    }

    const name = data.stockName || symbol;
    const currency = data.currencyType?.name || 'USD';
    const exchange = data.stockExchangeName || 'Overseas';

    // Fallback: if previousClose is needed but missing, calculate from change
    const previousClose = price - change;

    return {
        symbol: finalSymbol,
        price,
        currency,
        exchange,
        name,
        change: isNaN(change) ? 0 : change,
        changePercent: isNaN(changePercent) ? 0 : changePercent,
        previousClose: isNaN(previousClose) ? price : previousClose
    };
}

let rateCacheObj: { data: any, timestamp: number } | null = null;
const RATE_CACHE_TTL = 30 * 1000;

export async function fetchExchangeRate(forceRefresh = false) {
    if (!forceRefresh) {
        if (rateCacheObj && Date.now() - rateCacheObj.timestamp < RATE_CACHE_TTL) {
            return rateCacheObj.data;
        }
    }

    try {
        const url = 'https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW';
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
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
        const data = {
            rate: rateValue || 1350,
            time: timeText || ''
        };

        rateCacheObj = { data, timestamp: Date.now() };
        return data;
    } catch (e) {
        console.error('Naver Finance fetch error:', e);
        return { rate: 1350, time: '' };
    }
}
