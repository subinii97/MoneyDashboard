import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) return NextResponse.json({ results: [] });

    try {
        const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });

        if (!response.ok) {
            return NextResponse.json({ results: [] });
        }

        const data = await response.json();

        const results = (data.quotes || [])
            .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
            .map((q: any) => ({
                symbol: q.symbol,
                name: q.shortname || q.longname,
                exchange: q.exchange,
                isDomestic: q.symbol.endsWith('.KS') || q.symbol.endsWith('.KQ')
            }));

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
    }
}
