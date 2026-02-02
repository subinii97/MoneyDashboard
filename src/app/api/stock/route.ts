import { NextResponse } from 'next/server';
import { fetchGoogleQuote, fetchExchangeRate } from '@/lib/stock';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    if (!symbolsParam) {
        return NextResponse.json({ error: 'Missing symbols' }, { status: 400 });
    }

    const symbols = symbolsParam.split(',');

    try {
        const [exchangeRate, ...stockResults] = await Promise.all([
            fetchExchangeRate(),
            ...symbols.map(s => fetchGoogleQuote(s))
        ]);

        return NextResponse.json({
            results: stockResults,
            exchangeRate
        });
    } catch (error) {
        console.error('Stock API error', error);
        return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
    }
}
