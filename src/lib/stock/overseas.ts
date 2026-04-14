import { extractNumber, parseTradingValue, MOBILE_USER_AGENT } from './utils';

const overseasSymbolMap: Record<string, string> = {};

export async function fetchNaverOverseasQuote(symbol: string, forceRefresh = false) {
    const tryFetch = async (sym: string) => {
        const url = `https://polling.finance.naver.com/api/realtime/worldstock/stock/${sym}`;
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': MOBILE_USER_AGENT },
                cache: forceRefresh ? 'no-store' : undefined,
                next: forceRefresh ? undefined : { revalidate: 30 }
            });
            if (!response.ok) return null;
            const json = await response.json();
            const data = json.datas?.[0];
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
            const suffixes = ['.O', '.N', '.A', '.K', ''];
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
    let change = extractNumber(String(data.compareToPreviousClosePrice || '0'));
    let changePercent = extractNumber(String(data.fluctuationsRatio || '0'));
    const tradingValue = parseTradingValue(data.accumulatedTradingValue);

    let isOverMarket = false;
    let overMarketSession = '';
    let overMarketPrice: number | undefined;
    let overMarketChange: number | undefined;
    let overMarketChangePercent: number | undefined;

    // Naver worldstock API usually replaces price with Pre/After market price if active.
    // If it is NOT OPEN (Pre/After), we want to preserve the regular session change.
    if (data.marketStatus !== 'OPEN' && data.overMarketPriceInfo) {
        const over = data.overMarketPriceInfo;
        if (over.overPrice && over.overPrice !== '0' && over.overPrice !== '') {
            isOverMarket = true;
            overMarketSession = over.tradingSessionType;
            overMarketPrice = extractNumber(over.overPrice);
            overMarketChange = extractNumber(String(over.compareToPreviousClosePrice || '0'));
            overMarketChangePercent = extractNumber(String(over.fluctuationsRatio || '0'));
            
            // In Pre/After market, Naver often sets 'price' and 'change' to the Over-market data.
            // But sometimes 'price' is the regular close and 'over' is the extra move.
            // If they are different, it confirms we have both.
            if (overMarketPrice !== price) {
                // If overMarketPrice is active, 'price' usually represents the regular close.
                // So 'change/changePercent' from the main 'data' are the regular session values.
            } else {
                // If they are same, it means Naver replaced main data with over-market data.
                // In this case, we might have lost the regular session change in this specific API call.
                // We'll try to keep it if we can.
            }
        }
    }

    // Heuristic: If we are in PRE_MARKET, Naver's main 'change' is often the Pre-market only move.
    // But once regular starts, it becomes total daily move.
    // If user wants regular session +16% even in Pre-market today, we need the Tuesday data.

    const previousClose = price - change;

    return {
        symbol: finalSymbol,
        price,
        currency: data.currencyType?.name || 'USD',
        exchange: data.stockExchangeName || 'Overseas',
        name: data.stockName || symbol,
        change: isNaN(change) ? 0 : change,
        changePercent: isNaN(changePercent) ? 0 : changePercent,
        tradingValue,
        previousClose: isNaN(previousClose) ? price : previousClose,
        marketStatus: data.marketStatus || 'CLOSE',
        marketCap: data.marketValueFullRaw !== undefined ? extractNumber(String(data.marketValueFullRaw)) : undefined,
        isOverMarket,
        overMarketSession,
        overMarketPrice,
        overMarketChange,
        overMarketChangePercent
    };
}

export async function fetchOverseasIndex(code: string) {
    const tryEndpoints = [
        `https://polling.finance.naver.com/api/realtime/worldstock/index/${code}`,
        `https://polling.finance.naver.com/api/realtime/worldstock/stock/${code}`
    ];

    let data: any = null;
    for (const url of tryEndpoints) {
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': MOBILE_USER_AGENT },
                cache: 'no-cache'
            });
            if (!response.ok) continue;
            const json = await response.json();
            const d = (json.datas && json.datas[0]) || (json.result && json.result[0]) || json;
            if (d && (d.nowValue || d.closePrice)) {
                data = d;
                break;
            }
        } catch (e) {
            console.error(`Error fetching overseas index ${code} from ${url}:`, e);
        }
    }
    // Reliable fallback using worldDayListJson (works for indices like Nikkei, Shanghai, etc.)
    if (!data) {
        try {
            // Map code to worldDayList symbol if needed
            let sym = code;
            if (code === '.NI225') sym = 'NII@NI225';
            if (code === '.SSEC') sym = 'SHAS@000001';
            if (code === '.HSI') sym = 'HSI@HSI';
            if (code === '.INX') sym = 'SPI@SPX';
            if (code === '.IXIC') sym = 'NAS@IXIC';
            if (code === '.DJI') sym = 'DJI@DJI';
            if (code === '.GDAXI') sym = 'XTR@DAX';
            if (code === '.FTSE') sym = 'LSE@UKX';

            const url = `https://finance.naver.com/world/worldDayListJson.naver?symbol=${sym}&fdtc=0&page=1`;
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list) && list.length > 0) {
                    const latest = list[0];
                    let timeStr = latest.xymd;
                    if (timeStr && timeStr.length === 8) {
                        timeStr = `${timeStr.substring(0, 4)}-${timeStr.substring(4, 6)}-${timeStr.substring(6, 8)}T15:00:00`; // Default to 3 PM for indices
                    }
                    data = {
                        indexName: code,
                        nowValue: latest.clos,
                        compareToPreviousCloseValue: latest.diff,
                        fluctuationsRatio: latest.rate,
                        marketStatus: 'CLOSE',
                        localTradedAt: timeStr
                    };
                }
            }
        } catch (e) {
            console.error(`Error fetching fallback index ${code}:`, e);
        }
    }

    if (!data) return null;

    let name = data.indexName || data.stockName || data.itemCode || code;
    if (code === '.IXIC') name = '나스닥';
    if (code === '.DJI') name = '다우존스';
    if (code === '.INX') name = 'S&P 500';
    if (code === '.NI225' || code === 'NII@NI225') name = '니케이 225';
    if (code === '.SSEC' || code === 'SHAS@000001') name = '상해종합';
    if (code === '.HSI' || code === 'HSI@HSI') name = '항셍지수';
    if (code === '.GDAXI' || code === 'XTR@DAX') name = '독일 DAX';
    if (code === '.FTSE' || code === 'LSE@UKX') name = '영국 FTSE 100';

    const price = extractNumber(data.nowValue || data.nowPrice || data.closePrice || data.closePriceRaw);
    
    let change = 0;
    const cObj = data.compareToPreviousClosePrice || data.compareToPreviousPrice || data.compareToPreviousCloseValue;
    if (typeof cObj === 'object' && cObj !== null) {
        change = extractNumber(String(cObj.value || cObj.price || '0'));
        if (cObj.direction === 'FALL' || cObj.direction === 'DOWN') change = -Math.abs(change);
    } else {
        change = extractNumber(String(cObj || '0'));
    }

    const changePercent = extractNumber(String(data.fluctuationsRatio || data.fluctuationsRatioRaw || '0'));

    return {
        name,
        price,
        change,
        changePercent,
        status: data.marketStatus,
        time: data.localTradedAt || data.time || new Date().toISOString()
    };
}
