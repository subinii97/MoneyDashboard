import { NextResponse } from 'next/server';
import { fetchMarketIndex, fetchMarketExchangeRate } from '@/lib/stock';
import { extractNumber } from '@/lib/stock/utils';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

async function fetchCrypto() {
    try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22%5D', { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        return data.map((d: any) => {
            const isBTC = d.symbol === 'BTCUSDT';
            return {
                id: isBTC ? 'BTC' : 'ETH',
                name: isBTC ? '비트코인' : '이더리움',
                price: parseFloat(d.lastPrice),
                change: parseFloat(d.priceChange),
                changePercent: parseFloat(d.priceChangePercent),
                time: new Date(d.closeTime).toISOString()
            };
        });
    } catch (e) {
        console.error('Crypto fetch error', e);
        return [];
    }
}

async function fetchCommodity(url: string, id: string, name: string) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        const html = await res.text();
        const $ = cheerio.load(html);

        const priceText = $('[data-test="instrument-price-last"]').text();
        const changeText = $('[data-test="instrument-price-change"]').text();
        const changePctText = $('[data-test="instrument-price-change-percent"]').text();

        if (!priceText) return null;

        const price = extractNumber(priceText);
        const change = extractNumber(changeText);
        const changePercent = extractNumber(changePctText);

        return {
            id,
            name,
            price,
            change,
            changePercent,
            time: new Date().toISOString()
        };
    } catch (e) {
        console.error('Commodity fetch error', id, e);
        return null;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    try {
        const indices = [
            { id: 'KOSPI', code: 'KOSPI' },
            { id: 'KOSDAQ', code: 'KOSDAQ' },
            { id: 'S&P 500', code: '.INX' },
            { id: '나스닥', code: '.IXIC' },
            { id: '다우존스', code: '.DJI' },
            { id: '니케이 225', code: '.NI225' },
            { id: '상해종합', code: '.SSEC' },
            { id: '항셍지수', code: '.HSI' },
            { id: '독일 DAX', code: '.GDAXI' },
            { id: '영국 FTSE 100', code: '.FTSE' }
        ];

        const exchangeRates = [
            { id: 'USDKRW', code: 'FX_USDKRW' },
            { id: 'EURKRW', code: 'FX_EURKRW' },
            { id: 'EURUSD', code: 'FX_EURUSD' },
            { id: 'JPYKRW', code: 'FX_JPYKRW' },
            { id: 'CNYKRW', code: 'FX_CNYKRW', name: '원/위안 (CNY/KRW)' }
        ];

        const commoditiesInfo = [
            { url: 'https://www.investing.com/commodities/gold', id: 'GOLD', name: '금' },
            { url: 'https://www.investing.com/commodities/silver', id: 'SILVER', name: '은' },
            { url: 'https://www.investing.com/commodities/copper', id: 'COPPER', name: '구리' },
            { url: 'https://www.investing.com/commodities/iron-ore-62-cfr-futures', id: 'IRON', name: '철광석' },
            { url: 'https://www.investing.com/commodities/brent-oil', id: 'BRENT', name: '브렌트유' },
            { url: 'https://www.investing.com/commodities/crude-oil', id: 'WTI', name: 'WTI 원유' }
        ];

        const [indexResults, rateResults, cryptoResults, commodityResults] = await Promise.all([
            Promise.all(indices.map(idx => fetchMarketIndex(idx.code, forceRefresh))),
            Promise.all(exchangeRates.map(rate => fetchMarketExchangeRate(rate.code, forceRefresh))),
            fetchCrypto(),
            Promise.all(commoditiesInfo.map(c => fetchCommodity(c.url, c.id, c.name)))
        ]);

        return NextResponse.json({
            indices: indices.map((idx, i) => ({ ...idx, ...indexResults[i] })),
            rates: exchangeRates.map((rate, i) => ({ ...rate, ...rateResults[i] })),
            crypto: cryptoResults,
            commodities: commodityResults.filter(Boolean)
        });
    } catch (error) {
        console.error('Market API error', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
