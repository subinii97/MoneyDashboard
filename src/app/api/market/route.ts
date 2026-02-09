import { NextResponse } from 'next/server';
import { fetchMarketIndex, fetchMarketExchangeRate } from '@/lib/stock';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    try {
        const indices = [
            { id: 'KOSPI', code: 'KOSPI' },
            { id: 'KOSDAQ', code: 'KOSDAQ' },
            { id: 'NASDAQ', code: '.IXIC' },
            { id: 'DOW', code: '.DJI' }
        ];

        const exchangeRates = [
            { id: 'USDKRW', code: 'FX_USDKRW' },
            { id: 'EURKRW', code: 'FX_EURKRW' },
            { id: 'EURUSD', code: 'FX_EURUSD' },
            { id: 'JPYKRW', code: 'FX_JPYKRW' }
        ];

        const [indexResults, rateResults] = await Promise.all([
            Promise.all(indices.map(idx => fetchMarketIndex(idx.code, forceRefresh))),
            Promise.all(exchangeRates.map(rate => fetchMarketExchangeRate(rate.code, forceRefresh)))
        ]);

        return NextResponse.json({
            indices: indices.map((idx, i) => ({ ...idx, ...indexResults[i] })),
            rates: exchangeRates.map((rate, i) => ({ ...rate, ...rateResults[i] }))
        });
    } catch (error) {
        console.error('Market API error', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
