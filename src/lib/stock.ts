import * as cheerio from 'cheerio';

export async function fetchGoogleQuote(symbol: string) {
    // Domestic stock check: .KS, .KQ or 6-digit number
    if (symbol.endsWith('.KS') || symbol.endsWith('.KQ') || /^\d{6}/.test(symbol)) {
        return fetchNaverQuote(symbol);
    }

    let googleSymbol = symbol;

    // Convert Yahoo suffix to Google suffix
    if (symbol.endsWith('.KS')) {
        googleSymbol = symbol.replace('.KS', ':KRX');
    } else if (symbol.endsWith('.KQ')) {
        googleSymbol = symbol.replace('.KQ', ':KOSDAQ');
    } else if (!symbol.includes(':') && !symbol.includes('-')) {
        // Try to guess exchange or let Google try
        googleSymbol = `${symbol}:NASDAQ`;
    }

    const url = `https://www.google.com/finance/quote/${googleSymbol}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            next: { revalidate: 30 } // Cache for 30 seconds
        });

        if (!response.ok) {
            // Try NYSE for US stocks if NASDAQ fails
            if (!symbol.includes('.') && googleSymbol.endsWith(':NASDAQ')) {
                const nyseUrl = `https://www.google.com/finance/quote/${symbol}:NYSE`;
                const nyseRes = await fetch(nyseUrl);
                if (nyseRes.ok) return await parseHTML(await nyseRes.text(), symbol);
            }
            return { symbol, error: 'Not found' };
        }

        const html = await response.text();
        return await parseHTML(html, symbol);
    } catch (error) {
        console.error(`Error scraping ${symbol}:`, error);
        return { symbol, error: 'Scraping failed' };
    }
}

async function parseHTML(html: string, originalSymbol: string) {
    const $ = cheerio.load(html);

    const priceText = $('.YMlKec.fxKbKc').text().replace(/[^0-9.]/g, '');
    const name = $('.zzDege').text();
    const currency = $('[data-currency-code]').first().attr('data-currency-code');
    const exchange = $('[data-exchange]').first().attr('data-exchange');

    // Improved selectors and logic
    const changeEl = $('.P2Luy.Ebnabc.ZYVHBb').first();
    const changePercentEl = $('.JwB6zf').first();

    const changeText = changeEl.text().replace(/[^-0-9.]/g, '');
    const changePercentText = changePercentEl.text().replace(/[^-0-9.]/g, '');

    const change = parseFloat(changeText);
    const changePercent = parseFloat(changePercentText);

    // Previous close is in the sidebar info
    let previousClose = 0;
    $('div, span').each((i, el) => {
        const text = $(el).text();
        if (text === 'Previous close' || text === '전일 종가' || text === '이전 종가') {
            const nextVal = $(el).next().text() || $(el).parent().next().text();
            if (nextVal) {
                const parsed = parseFloat(nextVal.replace(/[^0-9.]/g, ''));
                if (!isNaN(parsed) && parsed > 0) previousClose = parsed;
            }
        }
    });

    if (!priceText) return { symbol: originalSymbol, error: 'Price not found' };

    const price = parseFloat(priceText);

    // Fallback: If change amount is 0/NaN or suspiciously large, calculate it
    let finalChange = isNaN(change) ? 0 : change;

    if (previousClose !== 0) {
        finalChange = price - previousClose;
    } else if (finalChange === 0 && !isNaN(changePercent) && changePercent !== 0) {
        // changePercent = (price - prev) / prev * 100
        const estPrev = price / (1 + (changePercent / 100));
        finalChange = price - estPrev;
        previousClose = estPrev;
    }

    if (previousClose === 0 && !isNaN(price) && !isNaN(finalChange)) {
        previousClose = price - finalChange;
    }

    return {
        symbol: originalSymbol,
        price,
        currency: currency || (originalSymbol.includes('.') ? 'KRW' : 'USD'),
        exchange: exchange,
        name: name || originalSymbol,
        change: finalChange,
        changePercent: isNaN(changePercent) ? 0 : changePercent,
        previousClose: previousClose
    };
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

        // Naver encoding check
        const contentType = response.headers.get('content-type');
        const charset = contentType?.includes('charset=')
            ? contentType.split('charset=')[1].split(';')[0].trim().toLowerCase()
            : 'utf-8'; // Match Naver's current UTF-8 or fallback

        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder(charset || 'utf-8');
        const html = decoder.decode(buffer);
        const $ = cheerio.load(html);

        const name = $('.wrap_company h2 a').text().trim() || $('.wrap_company h2').text().trim();
        const priceText = $('.no_today .blind').first().text();
        const price = extractNumber(priceText);

        if (price === 0) return { symbol, error: 'Price not found on Naver' };

        // Change info parsing
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
            : 'euc-kr'; // Naver Market Index often remains EUC-KR

        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder(charset);
        const html = decoder.decode(buffer);
        const $ = cheerio.load(html);

        const rateText = $('.spot .no_today').first().text();
        let rateValue = extractNumber(rateText);

        // Fallback: Try the calculator's select box which is often more stable
        if (rateValue === 0) {
            const selectValue = $('#select_to option').filter((i, el) => $(el).text().includes('미국 달러')).val();
            if (selectValue) {
                rateValue = parseFloat(String(selectValue).replace(/,/g, ''));
            }
        }

        const timeText = $('.exchange_info .date').first().text().trim();

        return {
            rate: rateValue || 1350,
            time: timeText || ''
        };
    } catch (e) {
        console.error('Naver Finance fetch error:', e);
        return { rate: 1350, time: '' };
    }
}
