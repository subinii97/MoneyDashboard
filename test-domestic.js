import * as cheerio from 'cheerio';

const extractNumber = (text) => {
    const cleaned = text.replace(/,/g, '').trim();
    const valString = cleaned.match(/-?\d+(\.\d+)?/)?.[0] || '0';
    return parseFloat(valString);
};

async function testDomestic() {
    const symbol = '005930'; // Samsung
    const url = `https://finance.naver.com/item/main.naver?code=${symbol}`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('euc-kr');
    const html = decoder.decode(buffer);
    const $ = cheerio.load(html);

    const priceText = $('.no_today .blind').first().text();
    const price = extractNumber(priceText);

    // Use the subagent suggested selector
    const prevCloseTextAlt = $('.no_info td.first em').first().text();
    const prevCloseAlt = extractNumber(prevCloseTextAlt);

    // My previous selector
    const prevCloseTextOld = $('.no_info tr:nth-of-type(1) td em').first().text();
    const prevCloseOld = extractNumber(prevCloseTextOld);

    console.log({
        symbol,
        priceText,
        price,
        prevCloseTextAlt,
        prevCloseAlt,
        prevCloseTextOld,
        prevCloseOld
    });
}

testDomestic();
