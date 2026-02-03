import * as cheerio from 'cheerio';

/**
 * Main entry point for fetching stock quotes.
 * Prefers Naver Finance for both domestic and overseas stocks.
 */
export async function fetchQuote(symbol: string) {
    if (symbol.endsWith('.KS') || symbol.endsWith('.KQ') || /^\d{6}/.test(symbol)) {
        return fetchNaverQuote(symbol);
    }
    return fetchNaverOverseasQuote(symbol);
}

// Keep fetchGoogleQuote for backward compatibility or as a future fallback if needed
export async function fetchGoogleQuote(symbol: string) {
    return fetchQuote(symbol);
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

export async function fetchNaverQuote(symbol: string) {
    const code = symbol.split('.')[0];
    const url = `https://finance.naver.com/item/main.naver?code=${code}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            next: { revalidate: 30 }
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
        const priceText = $('.no_today .blind').first().text();
        const price = extractNumber(priceText);

        if (price === 0) return { symbol, error: 'Price not found on Naver' };

        const isDown = $('.no_exday .ico.down').length > 0 || $('.no_exday .no_down').length > 0;
        const isUp = $('.no_exday .ico.up').length > 0 || $('.no_exday .no_up').length > 0;

        const changeText = $('.no_exday em:nth-of-type(1)').text();
        const changePercentText = $('.no_exday em:nth-of-type(2)').text();

        const changeValue = extractNumber(changeText);
        const changePercentValue = extractNumber(changePercentText);

        const change = changeValue * (isDown ? -1 : (isUp ? 1 : 0));
        const changePercent = changePercentValue * (isDown ? -1 : (isUp ? 1 : 0));

        const previousCloseText = $('.no_info tr:nth-of-type(1) td em').first().text();
        const previousClose = extractNumber(previousCloseText);

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

/**
 * Fetches overseas stock quotes from Naver Finance API.
 */
export async function fetchNaverOverseasQuote(symbol: string) {
    let naverSymbol = symbol;
    if (!symbol.includes('.')) {
        naverSymbol = `${symbol}.O`;
    }

    const url = `https://api.stock.naver.com/stock/${naverSymbol}/basic`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
            },
            next: { revalidate: 30 }
        });

        if (!response.ok) return { symbol, error: 'Naver Overseas API failed' };

        const data = await response.json();

        if (!data || !data.closePrice) {
            return { symbol, error: 'Data not found in Naver API' };
        }

        const price = parseFloat(data.closePrice.replace(/,/g, ''));
        const change = parseFloat(String(data.compareToPreviousClosePrice || '0'));
        const changePercent = parseFloat(String(data.fluctuationsRatio || '0'));
        const name = data.stockName || symbol;
        const currency = data.currencyType?.name || 'USD';
        const exchange = data.stockExchangeName || 'Overseas';

        if (isNaN(price)) {
            return { symbol, error: 'Price is NaN' };
        }

        return {
            symbol,
            price,
            currency,
            exchange,
            name,
            change: isNaN(change) ? 0 : change,
            changePercent: isNaN(changePercent) ? 0 : changePercent,
            previousClose: price - (isNaN(change) ? 0 : change)
        };
    } catch (error) {
        console.error(`Error fetching Naver Overseas API for ${symbol}:`, error);
        return { symbol, error: 'Naver Overseas API error' };
    }
}

export async function fetchExchangeRate() {
    try {
        const url = 'https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW';
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            next: { revalidate: 60 }
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
        console.error('Naver Finance fetch error:', e);
        return { rate: 1350, time: '' };
    }
}
