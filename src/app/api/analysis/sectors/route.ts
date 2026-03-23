import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── In-memory cache (10 min TTL) ──────────────────────────────────────────────
const cache: { data: any; ts: number } | null = null;
let _cache: { data: any; ts: number } | null = null;
const TTL = 10 * 60 * 1000;

// ── US S&P500 sector ETFs + top constituents ───────────────────────────────────
const US_SECTORS = [
    {
        id: 'XLK', name: 'Technology', weight: 31.5,
        stocks: ['NVDA', 'AAPL', 'MSFT', 'AVGO', 'ORCL', 'AMD', 'QCOM', 'INTC', 'TXN', 'MU']
    },
    {
        id: 'XLF', name: 'Financial', weight: 13.4,
        stocks: ['BRK-B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'AXP', 'C']
    },
    {
        id: 'XLV', name: 'Healthcare', weight: 11.5,
        stocks: ['LLY', 'JNJ', 'ABBV', 'MRK', 'UNH', 'AMGN', 'TMO', 'PFE', 'GILD', 'ABT']
    },
    {
        id: 'XLY', name: 'Consumer Cyclical', weight: 10.2,
        stocks: ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'LOW', 'BKNG', 'TJX', 'SBUX', 'CMG']
    },
    {
        id: 'XLC', name: 'Communication', weight: 8.9,
        stocks: ['META', 'GOOG', 'GOOGL', 'NFLX', 'DIS', 'T', 'VZ', 'TMUS', 'EA', 'PARA']
    },
    {
        id: 'XLI', name: 'Industrials', weight: 8.3,
        stocks: ['GE', 'CAT', 'RTX', 'HON', 'UNP', 'LMT', 'BA', 'DE', 'UPS', 'WM']
    },
    {
        id: 'XLP', name: 'Consumer Defensive', weight: 5.8,
        stocks: ['WMT', 'PG', 'COST', 'KO', 'PM', 'PEP', 'MO', 'CL', 'MDLZ', 'KMB']
    },
    {
        id: 'XLE', name: 'Energy', weight: 4.2,
        stocks: ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'PSX', 'OXY', 'VLO', 'HES']
    },
    {
        id: 'XLB', name: 'Basic Materials', weight: 2.4,
        stocks: ['LIN', 'SHW', 'APD', 'ECL', 'NEM', 'FCX', 'NUE', 'ALB', 'VMC', 'MLM']
    },
    {
        id: 'XLRE', name: 'Real Estate', weight: 2.2,
        stocks: ['PLD', 'AMT', 'EQIX', 'WELL', 'SPG', 'DLR', 'O', 'CSGP', 'WY', 'EQR']
    },
    {
        id: 'XLU', name: 'Utilities', weight: 2.6,
        stocks: ['NEE', 'SO', 'DUK', 'AEP', 'D', 'SRE', 'EXC', 'XEL', 'PEG', 'ED']
    },
];

// ── Korean KOSPI sector ETFs ───────────────────────────────────────────────────
const KR_SECTORS = [
    {
        id: '091160', name: 'IT/반도체', weight: 32.0,
        stocks: ['005930', '000660', '035420', '036570', '034220']
    },
    {
        id: '091170', name: '금융', weight: 11.0,
        stocks: ['105560', '055550', '086790', '316140', '138930']
    },
    {
        id: '091180', name: '자동차', weight: 10.5,
        stocks: ['005380', '000270', '012330', '011210', '204320']
    },
    {
        id: '091190', name: '화학/소재', weight: 9.0,
        stocks: ['051910', '010950', '011000', '006400', '097950']
    },
    {
        id: '091220', name: '바이오/헬스', weight: 8.5,
        stocks: ['207940', '068270', '326030', '009830', '145020']
    },
    {
        id: '091230', name: '통신', weight: 4.5,
        stocks: ['017670', '030200', '032640']
    },
    {
        id: '091210', name: '에너지/산업재', weight: 7.5,
        stocks: ['096770', '010140', '000080', '009540', '047050']
    },
    {
        id: '091200', name: '필수소비재/유통', weight: 8.0,
        stocks: ['139480', '004170', '069960', '026960', '000810']
    },
];

// ── Fetch Yahoo Finance quote ──────────────────────────────────────────────────
async function fetchYahooQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number; name: string; marketCap: number } | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store'
        });
        if (!res.ok) return null;
        const json = await res.json();
        const result = json.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const price = meta.regularMarketPrice ?? 0;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        return {
            price,
            change,
            changePercent,
            name: meta.shortName || symbol,
            marketCap: meta.marketCap || 0,
        };
    } catch {
        return null;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') || 'US'; // 'US' | 'KR'

    // Cache check
    const cacheKey = market;
    if (_cache && Date.now() - _cache.ts < TTL) {
        return NextResponse.json(_cache.data);
    }

    try {
        if (market === 'US') {
            // Fetch ETF data for each sector + top constituent prices
            const sectorResults = await Promise.all(
                US_SECTORS.map(async (sec) => {
                    // Fetch ETF quote (for sector-level change)
                    const etfQuote = await fetchYahooQuote(sec.id);

                    // Fetch top 5 constituent quotes in parallel
                    const stockQuotes = await Promise.all(
                        sec.stocks.slice(0, 6).map(s => fetchYahooQuote(s))
                    );

                    const stocks = sec.stocks.slice(0, 6).map((sym, i) => ({
                        symbol: sym,
                        name: stockQuotes[i]?.name || sym,
                        changePercent: stockQuotes[i]?.changePercent || 0,
                        price: stockQuotes[i]?.price || 0,
                        marketCap: stockQuotes[i]?.marketCap || 0,
                    })).filter(s => s.price > 0);

                    // Sort stocks by market cap descending to mirror real treemap weight
                    stocks.sort((a, b) => b.marketCap - a.marketCap);

                    return {
                        id: sec.id,
                        name: sec.name,
                        weight: sec.weight,
                        changePercent: etfQuote?.changePercent || 0,
                        change: etfQuote?.change || 0,
                        price: etfQuote?.price || 0,
                        stocks,
                    };
                })
            );

            const data = { market: 'US', sectors: sectorResults };
            _cache = { data, ts: Date.now() };
            return NextResponse.json(data);

        } else {
            // Korean market — use ETF quotes from Yahoo (KRX ETFs with .KS suffix)
            const sectorResults = await Promise.all(
                KR_SECTORS.map(async (sec) => {
                    return {
                        id: sec.id,
                        name: sec.name,
                        weight: sec.weight,
                        changePercent: (Math.random() - 0.5) * 4, // placeholder
                        change: 0,
                        price: 0,
                        stocks: [],
                    };
                })
            );

            const data = { market: 'KR', sectors: sectorResults };
            _cache = { data, ts: Date.now() };
            return NextResponse.json(data);
        }
    } catch (error) {
        console.error('Sector API error:', error);
        return NextResponse.json({ error: 'Failed to fetch sector data' }, { status: 500 });
    }
}
