import { extractNumber, MOBILE_USER_AGENT } from './utils';

const overseasSymbolMap: Record<string, string> = {};

export async function fetchNaverOverseasQuote(symbol: string, forceRefresh = false) {
    const tryFetch = async (sym: string) => {
        const url = `https://api.stock.naver.com/stock/${sym}/basic`;
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': MOBILE_USER_AGENT },
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

    if (overseasSymbolMap[symbol]) {
        data = await tryFetch(overseasSymbolMap[symbol]);
        if (data) finalSymbol = overseasSymbolMap[symbol];
    }

    if (!data) {
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
            data = await tryFetch(symbol);
            if (!data && symbol.includes('.')) {
                const [base, sub] = symbol.split('.');
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

    if (!data) return { symbol, error: 'Data not found in Naver API' };

    let price = extractNumber(data.closePrice);
    let change = extractNumber(String(data.compareToPreviousClosePricePrice || data.compareToPreviousClosePrice || '0'));
    let changePercent = extractNumber(String(data.fluctuationsRatio || '0'));

    if (data.marketStatus !== 'OPEN' && data.overMarketPriceInfo) {
        const over = data.overMarketPriceInfo;
        if (over.overMarketPrice && over.overMarketPrice !== '0' && over.overMarketPrice !== '') {
            price = extractNumber(over.overMarketPrice);
            change = extractNumber(String(over.compareToPreviousClosePrice || '0'));
            changePercent = extractNumber(String(over.fluctuationsRatio || '0'));
        }
    }

    const previousClose = price - change;

    return {
        symbol: finalSymbol,
        price,
        currency: data.currencyType?.name || 'USD',
        exchange: data.stockExchangeName || 'Overseas',
        name: data.stockName || symbol,
        change: isNaN(change) ? 0 : change,
        changePercent: isNaN(changePercent) ? 0 : changePercent,
        previousClose: isNaN(previousClose) ? price : previousClose
    };
}

export async function fetchOverseasIndex(code: string) {
    const url = `https://polling.finance.naver.com/api/realtime/worldstock/index/${code}`;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': MOBILE_USER_AGENT },
            cache: 'no-cache'
        });
        if (!response.ok) return null;
        const json = await response.json();
        const data = (json.datas && json.datas[0]) || (json.result && json.result[0]) || json;

        let name = data.indexName || data.itemCode || data.stockName || code;
        if (code === '.IXIC') name = '나스닥';
        if (code === '.DJI') name = '다우존스';

        return {
            name,
            price: extractNumber(data.nowValue || data.nowPrice || data.closePrice || data.closePriceRaw),
            change: extractNumber(String(data.compareToPreviousCloseValue || data.compareToPreviousClosePrice || data.compareToPreviousPrice?.value || '0')),
            changePercent: extractNumber(String(data.fluctuationsRatio || data.fluctuationsRatioRaw || '0')),
            status: data.marketStatus,
            time: data.localTradedAt || data.time || new Date().toISOString()
        };
    } catch (e) {
        console.error(`Error fetching overseas index ${code}:`, e);
        return null;
    }
}
