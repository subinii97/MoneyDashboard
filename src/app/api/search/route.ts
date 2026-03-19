import { NextResponse } from 'next/server';
import { DEFAULT_USER_AGENT } from '@/lib/stock/utils';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) return NextResponse.json({ results: [] });

    try {
        const url = `https://m.stock.naver.com/front-api/search/autoComplete?query=${encodeURIComponent(query)}&target=stock`;
        const response = await fetch(url, { headers: { 'User-Agent': DEFAULT_USER_AGENT } });

        if (!response.ok) {
            return NextResponse.json({ results: [] });
        }

        const data = await response.json();

        const results = (data.result?.items || []).map((q: any) => {
            const isDomestic = q.nationCode === 'KOR';
            let symbol = q.code;
            if (isDomestic) {
                symbol = q.typeCode === 'KOSDAQ' ? `${q.code}.KQ` : `${q.code}.KS`;
            }

            return {
                symbol,
                name: q.name,
                exchange: q.typeName,
                isDomestic
            };
        });

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
    }
}
