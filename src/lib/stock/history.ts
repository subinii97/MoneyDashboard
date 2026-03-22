import * as cheerio from 'cheerio';

const yahooCache: Record<string, any> = {};
const naverCache: Record<string, any> = {};

export async function fetchHistoricalClosePrice(symbol: string, targetDateStr: string, isDomestic: boolean) {
    const targetDate = new Date(targetDateStr + 'T00:00:00Z');
    
    if (isDomestic) {
        const code = symbol.replace('.KS', '').replace('.KQ', '');
        
        try {
            if (!naverCache[code]) {
                const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=day&count=100&requestType=0`;
                const response = await fetch(url);
                const xml = await response.text();
                naverCache[code] = xml;
            }
            const xml = naverCache[code];
            const $ = cheerio.load(xml, { xmlMode: true });
            const items = $('item').toArray();
            
            let bestPrice = 0;
            let bestDateDiff = Infinity;

            for (const el of items) {
                const row = $(el).attr('data') || '';
                const parts = row.split('|');
                if (parts.length >= 5) {
                    const dateStr = parts[0]; // 20260320
                    const y = dateStr.substring(0, 4);
                    const m = dateStr.substring(4, 6);
                    const d = dateStr.substring(6, 8);
                    const rowDate = new Date(`${y}-${m}-${d}T00:00:00Z`);
                    
                    const diff = targetDate.getTime() - rowDate.getTime();
                    // We want the most recent trading day on or BEFORE the target date.
                    if (diff >= 0 && diff < bestDateDiff) {
                        bestDateDiff = diff;
                        bestPrice = parseFloat(parts[4]); // Close price
                    }
                }
            }
            return bestPrice > 0 ? bestPrice : null;
        } catch (e) {
            console.error(`Error fetching domestic history for ${symbol}:`, e);
            return null;
        }
    } else {
        // Overseas -> Yahoo Finance
        let yahooSymbol = symbol;
        if (symbol.includes('.')) {
            yahooSymbol = symbol.split('.')[0]; // e.g. TSLA.O -> TSLA
        }
        
        try {
            if (!yahooCache[yahooSymbol]) {
                const url = `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=3mo`;
                const response = await fetch(url);
                const data = await response.json();
                yahooCache[yahooSymbol] = data;
            }
            
            const data = yahooCache[yahooSymbol];
            if (!data.chart || !data.chart.result || !data.chart.result[0].timestamp) return null;
            
            const timestamps = data.chart.result[0].timestamp;
            const closes = data.chart.result[0].indicators.quote[0].close;
            
            let bestPrice = 0;
            let bestDateDiff = Infinity;
            
            for (let i = 0; i < timestamps.length; i++) {
                const ts = timestamps[i];
                const closePrice = closes[i];
                if (closePrice === null || closePrice === undefined) continue;
                
                const rowDateObj = new Date(ts * 1000);
                const rowDateStr = rowDateObj.toISOString().substring(0, 10);
                const rowDate = new Date(rowDateStr + 'T00:00:00Z');
                
                const diff = targetDate.getTime() - rowDate.getTime();
                if (diff >= 0 && diff < bestDateDiff) {
                    bestDateDiff = diff;
                    bestPrice = closePrice;
                }
            }
            return bestPrice > 0 ? bestPrice : null;
        } catch (e) {
            console.error(`Error fetching overseas history for ${symbol}:`, e);
            return null;
        }
    }
}
