import { extractNumber, parseTradingValue, DEFAULT_USER_AGENT, MOBILE_USER_AGENT } from './utils';

export async function fetchNaverQuote(symbol: string, forceRefresh = false) {
    const code = symbol.split('.')[0];
    const url = `https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': MOBILE_USER_AGENT },
            cache: forceRefresh ? 'no-store' : undefined,
            next: forceRefresh ? undefined : { revalidate: 30 }
        });

        if (!response.ok) return { symbol, error: 'Naver Finance API access failed' };

        const json = await response.json();
        const data = json.datas?.[0];
        if (!data) return { symbol, error: 'No data' };

        const name = data.stockName || symbol;
        const price = extractNumber(data.closePrice);
        const changeMagnitude = extractNumber(data.compareToPreviousClosePrice);
        const changePercentMagnitude = extractNumber(data.fluctuationsRatio);

        const dirName: string = data.compareToPreviousPrice?.name || '';
        const changeSign = (dirName === 'FALLING' || dirName === 'LOWER_LIMIT') ? -1
            : (dirName === 'RISING' || dirName === 'UPPER_LIMIT') ? 1 : 0;

        const change = Math.abs(changeMagnitude) * changeSign;
        const changePercent = Math.abs(changePercentMagnitude) * changeSign;
        const tradingValue = parseTradingValue(data.accumulatedTradingValue);

        let isOverMarket = false;
        let overMarketSession = '';
        let overMarketPrice: number | undefined;
        let overMarketChange: number | undefined;
        let overMarketChangePercent: number | undefined;

        if (data.marketStatus !== 'OPEN' && data.overMarketPriceInfo) {
            const over = data.overMarketPriceInfo;
            if (over.overPrice && over.overPrice !== '0' && over.overPrice !== '') {
                // KR After-market limit: 8 PM KST
                const now = new Date();
                const kstOffset = 9 * 60 * 60 * 1000;
                const kstDate = new Date(now.getTime() + kstOffset);
                const hour = kstDate.getUTCHours();
                const minute = kstDate.getUTCMinutes();
                const timeVal = hour + minute / 60;

                if (timeVal >= 15.6 && timeVal < 20) {
                    overMarketPrice = extractNumber(over.overPrice);
                    overMarketChange = extractNumber(String(over.compareToPreviousClosePrice || '0'));
                    overMarketChangePercent = extractNumber(String(over.fluctuationsRatio || '0'));
                    isOverMarket = true;
                    overMarketSession = 'AFTER_MARKET';
                }
            }
        }

        const quote: any = {
            symbol,
            price,
            currency: 'KRW',
            exchange: symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KRX',
            name,
            change,
            changePercent,
            tradingValue,
            marketStatus: data.marketStatus || 'CLOSE',
            isOverMarket,
            overMarketSession,
            overMarketPrice,
            overMarketChange,
            overMarketChangePercent
        };

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
