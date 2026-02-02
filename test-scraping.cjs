const cheerio = require('cheerio');

async function testNaverScrape(code) {
    const url = `https://finance.naver.com/item/main.naver?code=${code}`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });

    console.log('Content-Type:', response.headers.get('content-type'));

    const buffer = await response.arrayBuffer();

    // Test both decodings
    const eucKr = new TextDecoder('euc-kr').decode(buffer);
    const utf8 = new TextDecoder('utf-8').decode(buffer);

    const $euc = cheerio.load(eucKr);
    const $utf = cheerio.load(utf8);

    const nameEuc = $euc('.wrap_company h2 a').text().trim();
    const nameUtf = $utf('.wrap_company h2 a').text().trim();

    console.log('Name (EUC-KR):', nameEuc);
    console.log('Name (UTF-8):', nameUtf);

    const extractNumber = (text) => {
        const match = text.replace(/,/g, '').match(/[-+]?[0-9.]+/);
        return match ? parseFloat(match[0]) : 0;
    };

    const priceText = $euc('.no_today .blind').first().text();
    const price = extractNumber(priceText);

    const changeText = $euc('.no_exday em:nth-of-type(1)').text();
    const change = extractNumber(changeText);

    console.log({
        price,
        change,
        changeRaw: changeText
    });
}

testNaverScrape('005930'); // Samsung Electronics
