import { extractNumber, DEFAULT_USER_AGENT, MOBILE_USER_AGENT } from './utils';

export async function fetchNaverQuote(symbol: string, forceRefresh = false) {
    const code = symbol.split('.')[0];
    const url = `https://m.stock.naver.com/api/stock/${code}/basic`;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': DEFAULT_USER_AGENT },
            cache: forceRefresh ? 'no-store' : undefined,
            next: forceRefresh ? undefined : { revalidate: 30 }
        });

        if (!response.ok) return { symbol, error: 'Naver Finance API access failed' };

        const data = await response.json();

        const name = data.stockName || symbol;
        const price = extractNumber(data.closePrice);

        if (price === 0) return { symbol, error: 'Price not found on Naver API' };

        const changeMagnitude = extractNumber(data.compareToPreviousClosePrice);
        const changePercentMagnitude = extractNumber(data.fluctuationsRatio);

        // UPPER_LIMIT(상한가), RISING → 양수 / LOWER_LIMIT(하한가), FALLING → 음수
        const dirName: string = data.compareToPreviousPrice?.name || '';
        const changeSign = (dirName === 'FALLING' || dirName === 'LOWER_LIMIT') ? -1
            : (dirName === 'RISING' || dirName === 'UPPER_LIMIT') ? 1 : 0;

        const change = Math.abs(changeMagnitude) * changeSign;
        const changePercent = Math.abs(changePercentMagnitude) * changeSign;
        const previousClose = price - change;

        const quote: any = {
            symbol,
            price,
            currency: 'KRW',
            exchange: symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KRX',
            name,
            change,
            changePercent,
            previousClose,
            marketStatus: data.marketStatus || 'CLOSE'
        };

        // Check for over-market (NXT)
        if (data.overMarketPriceInfo && data.overMarketPriceInfo.overMarketStatus === 'OPEN') {
            const overInfo = data.overMarketPriceInfo;
            const sessionType: string = overInfo.tradingSessionType || 'AFTER_MARKET';

            if (sessionType !== 'REGULAR_MARKET') {
                quote.isOverMarket = true;
                quote.overMarketSession = sessionType === 'AFTER_MARKET' ? 'NXT' : sessionType;
                quote.overMarketPrice = extractNumber(overInfo.overPrice);

                const overDirName: string = overInfo.compareToPreviousPrice?.name || '';
                const overChangeSign = (overDirName === 'FALLING' || overDirName === 'LOWER_LIMIT') ? -1
                    : (overDirName === 'RISING' || overDirName === 'UPPER_LIMIT') ? 1 : 0;

                const overChangeMagnitude = extractNumber(overInfo.compareToPreviousClosePrice);
                const overPercentMagnitude = extractNumber(overInfo.fluctuationsRatio);

                quote.overMarketChange = Math.abs(overChangeMagnitude) * overChangeSign;
                quote.overMarketChangePercent = Math.abs(overPercentMagnitude) * overChangeSign;
            }
        }

        return quote;
    } catch (error) {
        console.error(`Error fetching Naver API for ${symbol}:`, error);
        return { symbol, error: 'Naver API failed' };
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
