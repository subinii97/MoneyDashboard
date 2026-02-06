import { NextResponse } from 'next/server';
import { fetchQuote, fetchExchangeRate } from '@/lib/stock';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    const isForce = searchParams.get('refresh') === 'true';
    const symbols = symbolsParam ? symbolsParam.split(',').filter(Boolean) : [];

    try {
        const [exchangeRate, ...stockResults] = await Promise.all([
            fetchExchangeRate(isForce),
            ...symbols.map(s => fetchQuote(s, isForce))
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
