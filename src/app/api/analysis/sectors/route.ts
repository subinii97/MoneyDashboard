import { NextResponse } from 'next/server';

const TTL = 10 * 1000; // 10 seconds cache
const _cache: Record<string, { data: any; ts: number }> = {};
const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ── US S&P 500 Sectors ────────────────────────────────────────────────────────
const US_SECTORS: Array<{
    id: string; name: string; weight: number; etf: string;
    stocks: Array<{ symbol: string; name: string; cap: number }>;
}> = [
    {
        id: 'tech', name: 'Technology', weight: 29.8, etf: 'XLK',
        stocks: [
            { symbol: 'AAPL', name: 'AAPL', cap: 3000 }, { symbol: 'MSFT', name: 'MSFT', cap: 3200 },
            { symbol: 'NVDA', name: 'NVDA', cap: 3000 }, { symbol: 'AVGO', name: 'AVGO', cap: 640 },
            { symbol: 'ADBE', name: 'ADBE', cap: 240 },   { symbol: 'CRM', name: 'CRM', cap: 230 },
            { symbol: 'CSCO', name: 'CSCO', cap: 190 },   { symbol: 'ACN', name: 'ACN', cap: 210 },
            { symbol: 'INTC', name: 'INTC', cap: 140 },   { symbol: 'QCOM', name: 'QCOM', cap: 180 },
        ],
    },
    {
        id: 'fin', name: 'Financials', weight: 13.1, etf: 'XLF',
        stocks: [
            { symbol: 'JPM', name: 'JPM', cap: 550 },     { symbol: 'V', name: 'V', cap: 550 },
            { symbol: 'MA', name: 'MA', cap: 450 },       { symbol: 'BAC', name: 'BAC', cap: 320 },
            { symbol: 'WFC', name: 'WFC', cap: 230 },      { symbol: 'GS', name: 'GS', cap: 200 },
            { symbol: 'MS', name: 'MS', cap: 190 },        { symbol: 'AXP', name: 'AXP', cap: 180 },
            { symbol: 'C', name: 'C', cap: 150 },
        ],
    },
    {
        id: 'health', name: 'Healthcare', weight: 11.5, etf: 'XLV',
        stocks: [
            { symbol: 'LLY', name: 'LLY', cap: 700 },   { symbol: 'JNJ', name: 'JNJ', cap: 380 },
            { symbol: 'ABBV', name: 'ABBV', cap: 310 },  { symbol: 'MRK', name: 'MRK', cap: 280 },
            { symbol: 'UNH', name: 'UNH', cap: 500 },    { symbol: 'TMO', name: 'TMO', cap: 200 },
            { symbol: 'AMGN', name: 'AMGN', cap: 160 },  { symbol: 'PFE', name: 'PFE', cap: 150 },
            { symbol: 'GILD', name: 'GILD', cap: 110 },  { symbol: 'ABT', name: 'ABT', cap: 220 },
        ],
    },
    {
        id: 'cons_cyc', name: 'Consumer Cycl.', weight: 10.2, etf: 'XLY',
        stocks: [
            { symbol: 'AMZN', name: 'AMZN', cap: 2100 }, { symbol: 'TSLA', name: 'TSLA', cap: 800 },
            { symbol: 'HD', name: 'HD', cap: 380 },       { symbol: 'MCD', name: 'MCD', cap: 220 },
            { symbol: 'LOW', name: 'LOW', cap: 160 },     { symbol: 'BKNG', name: 'BKNG', cap: 160 },
            { symbol: 'TJX', name: 'TJX', cap: 140 },    { symbol: 'NKE', name: 'NKE', cap: 120 },
            { symbol: 'SBUX', name: 'SBUX', cap: 95 },   { symbol: 'CMG', name: 'CMG', cap: 80 },
        ],
    },
    {
        id: 'comm', name: 'Communication', weight: 8.9, etf: 'XLC',
        stocks: [
            { symbol: 'META', name: 'META', cap: 1500 }, { symbol: 'GOOGL', name: 'GOOGL', cap: 2000 },
            { symbol: 'NFLX', name: 'NFLX', cap: 380 },  { symbol: 'DIS', name: 'DIS', cap: 200 },
            { symbol: 'T', name: 'T', cap: 180 },         { symbol: 'VZ', name: 'VZ', cap: 160 },
            { symbol: 'TMUS', name: 'TMUS', cap: 240 },   { symbol: 'EA', name: 'EA', cap: 45 },
        ],
    },
    {
        id: 'indust', name: 'Industrials', weight: 8.3, etf: 'XLI',
        stocks: [
            { symbol: 'GE', name: 'GE', cap: 230 },   { symbol: 'CAT', name: 'CAT', cap: 190 },
            { symbol: 'RTX', name: 'RTX', cap: 180 },  { symbol: 'HON', name: 'HON', cap: 130 },
            { symbol: 'UNP', name: 'UNP', cap: 140 },  { symbol: 'LMT', name: 'LMT', cap: 105 },
            { symbol: 'BA', name: 'BA', cap: 130 },    { symbol: 'DE', name: 'DE', cap: 130 },
            { symbol: 'UPS', name: 'UPS', cap: 95 },   { symbol: 'WM', name: 'WM', cap: 85 },
        ],
    },
    {
        id: 'cons_def', name: 'Consumer Def.', weight: 5.8, etf: 'XLP',
        stocks: [
            { symbol: 'WMT', name: 'WMT', cap: 700 }, { symbol: 'PG', name: 'PG', cap: 370 },
            { symbol: 'COST', name: 'COST', cap: 400 }, { symbol: 'KO', name: 'KO', cap: 280 },
            { symbol: 'PEP', name: 'PEP', cap: 220 },   { symbol: 'PM', name: 'PM', cap: 200 },
            { symbol: 'MO', name: 'MO', cap: 90 },
        ],
    },
    {
        id: 'energy', name: 'Energy', weight: 4.2, etf: 'XLE',
        stocks: [
            { symbol: 'XOM', name: 'XOM', cap: 480 }, { symbol: 'CVX', name: 'CVX', cap: 280 },
            { symbol: 'COP', name: 'COP', cap: 120 },   { symbol: 'EOG', name: 'EOG', cap: 75 },
            { symbol: 'SLB', name: 'SLB', cap: 55 },    { symbol: 'OXY', name: 'OXY', cap: 50 },
        ],
    },
    {
        id: 'util', name: 'Utilities', weight: 2.6, etf: 'XLU',
        stocks: [
            { symbol: 'NEE', name: 'NEE', cap: 106 }, { symbol: 'SO', name: 'SO', cap: 77 },
            { symbol: 'DUK', name: 'DUK', cap: 66 },  { symbol: 'AEP', name: 'AEP', cap: 53 },
            { symbol: 'D', name: 'D', cap: 47 },
        ],
    },
    {
        id: 'materials', name: 'Basic Materials', weight: 2.4, etf: 'XLB',
        stocks: [
            { symbol: 'LIN', name: 'LIN', cap: 220 }, { symbol: 'SHW', name: 'SHW', cap: 88 },
            { symbol: 'APD', name: 'APD', cap: 63 },  { symbol: 'ECL', name: 'ECL', cap: 57 },
            { symbol: 'FCX', name: 'FCX', cap: 55 },  { symbol: 'NEM', name: 'NEM', cap: 54 },
        ],
    },
    {
        id: 'realestate', name: 'Real Estate', weight: 2.2, etf: 'XLRE',
        stocks: [
            { symbol: 'PLD', name: 'PLD', cap: 100 }, { symbol: 'AMT', name: 'AMT', cap: 87 },
            { symbol: 'EQIX', name: 'EQIX', cap: 80 }, { symbol: 'WELL', name: 'WELL', cap: 55 },
            { symbol: 'SPG', name: 'SPG', cap: 57 },
        ],
    },
];

// ── Korean KOSPI Sectors ───────────────────────────────────────────────────────
const KR_SECTORS: Array<{
    id: string; name: string; weight: number;
    stocks: Array<{ symbol: string; name: string; cap: number }>;
}> = [
    {
        id: 'kr-elec', name: '전기전자', weight: 32.0,
        stocks: [
            { symbol: '005930', name: '삼성전자', cap: 3500 },
            { symbol: '000660', name: 'SK하이닉스', cap: 1300 },
            { symbol: '373220', name: 'LG에너지솔루션', cap: 700 },
            { symbol: '006400', name: '삼성SDI', cap: 280 },
            { symbol: '066570', name: 'LG전자', cap: 160 },
            { symbol: '042700', name: '한미반도체', cap: 110 },
            { symbol: '009150', name: '삼성전기', cap: 90 },
        ],
    },
    {
        id: 'kr-heavy', name: '운송장비/방산', weight: 14.0,
        stocks: [
            { symbol: '005380', name: '현대차', cap: 500 },
            { symbol: '000270', name: '기아', cap: 460 },
            { symbol: '012450', name: '한화에어로스페이스', cap: 180 },
            { symbol: '012330', name: '현대모비스', cap: 120 },
            { symbol: '009540', name: 'HD한국조선해양', cap: 150 },
            { symbol: '034020', name: '두산에너빌리티', cap: 110 },
            { symbol: '047810', name: '한국항공우주', cap: 60 },
        ],
    },
    {
        id: 'kr-finance', name: '금융/지주', weight: 12.0,
        stocks: [
            { symbol: '105560', name: 'KB금융', cap: 300 },
            { symbol: '055550', name: '신한지주', cap: 280 },
            { symbol: '086790', name: '하나금융지주', cap: 180 },
            { symbol: '316140', name: '우리금융지주', cap: 145 },
            { symbol: '402340', name: 'SK스퀘어', cap: 120 },
            { symbol: '028260', name: '삼성물산', cap: 150 },
        ],
    },
    {
        id: 'kr-it', name: '서비스/IT', weight: 10.0,
        stocks: [
            { symbol: '035420', name: 'NAVER', cap: 320 },
            { symbol: '035720', name: '카카오', cap: 180 },
            { symbol: '259960', name: '크래프톤', cap: 140 },
            { symbol: '018260', name: '삼성SDS', cap: 110 },
            { symbol: '251270', name: '넷마블', cap: 45 },
        ],
    },
    {
        id: 'kr-bio', name: '바이오/의약', weight: 9.0,
        stocks: [
            { symbol: '207940', name: '삼성바이오로직스', cap: 620 },
            { symbol: '068270', name: '셀트리온', cap: 240 },
            { symbol: '000100', name: '유한양행', cap: 80 },
            { symbol: '326030', name: 'SK바이오팜', cap: 50 },
        ],
    },
    {
        id: 'kr-chem', name: '화학/소재', weight: 8.0,
        stocks: [
            { symbol: '051910', name: 'LG화학', cap: 220 },
            { symbol: '003670', name: '포스코퓨처엠', cap: 130 },
            { symbol: '096770', name: 'SK이노베이션', cap: 110 },
            { symbol: '010950', name: 'S-Oil', cap: 85 },
            { symbol: '453340', name: '에코프로머티', cap: 60 },
        ],
    },
    {
        id: 'kr-steel', name: '철강/기계', weight: 6.0,
        stocks: [
            { symbol: '005490', name: 'POSCO홀딩스', cap: 320 },
            { symbol: '010130', name: '고려아연', cap: 140 },
            { symbol: '004020', name: '현대제철', cap: 45 },
        ],
    },
    {
        id: 'kr-consumer', name: '유통/소비재', weight: 5.0,
        stocks: [
            { symbol: '033780', name: 'KT&G', cap: 120 },
            { symbol: '097950', name: 'CJ제일제당', cap: 60 },
            { symbol: '090430', name: '아모레퍼시픽', cap: 90 },
            { symbol: '051900', name: 'LG생활건강', cap: 70 },
            { symbol: '271560', name: '오리온', cap: 40 },
        ],
    },
    {
        id: 'kr-util', name: '통신/전력/운수', weight: 4.5,
        stocks: [
            { symbol: '017670', name: 'SK텔레콤', cap: 130 },
            { symbol: '030200', name: 'KT', cap: 90 },
            { symbol: '015760', name: '한국전력', cap: 140 },
            { symbol: '011200', name: 'HMM', cap: 100 },
            { symbol: '003490', name: '대한항공', cap: 80 },
            { symbol: '086280', name: '현대글로비스', cap: 75 },
        ],
    },
    {
        id: 'kr-const', name: '보험/증권/건설', weight: 4.0,
        stocks: [
            { symbol: '032830', name: '삼성생명', cap: 150 },
            { symbol: '000810', name: '삼성화재', cap: 145 },
            { symbol: '006800', name: '미래에셋증권', cap: 65 },
            { symbol: '000720', name: '현대건설', cap: 45 },
        ],
    },
];

// ── Korean KOSDAQ Sectors ──────────────────────────────────────────────────────
const KOSDAQ_SECTORS: Array<{
    id: string; name: string; weight: number;
    stocks: Array<{ symbol: string; name: string; cap: number }>;
}> = [
    {
        id: 'kq-pharma', name: '제약/바이오', weight: 28.0,
        stocks: [
            { symbol: '196170', name: '알테오젠', cap: 180 },
            { symbol: '000250', name: '삼천당제약', cap: 120 },
            { symbol: '298380', name: '에이비엘바이오', cap: 60 },
            { symbol: '083320', name: '펩트론', cap: 55 },
            { symbol: '028300', name: 'HLB', cap: 110 },
            { symbol: '214370', name: '케어젠', cap: 45 },
            { symbol: '068760', name: '셀트리온제약', cap: 40 },
            { symbol: '145020', name: '휴젤', cap: 35 },
            { symbol: '237690', name: '에스티팜', cap: 30 },
            { symbol: '141080', name: '리가켐바이오', cap: 80 },
            { symbol: '304100', name: '보로노이', cap: 40 },
        ],
    },
    {
        id: 'kq-elec', name: '전기·전자', weight: 22.0,
        stocks: [
            { symbol: '247540', name: '에코프로비엠', cap: 220 },
            { symbol: '058470', name: '리노공업', cap: 45 },
            { symbol: '032820', name: '우리기술', cap: 15 },
            { symbol: '078600', name: '대주전자재료', cap: 35 },
            { symbol: '000660', name: 'SK하이닉스', cap: 0 }, // Wait, SK is KOSPI. 
            { symbol: '290650', name: '엔켐', cap: 65 },
        ],
    },
    {
        id: 'kq-heavy', name: '기계·장비', weight: 18.0,
        stocks: [
            { symbol: '277810', name: '레인보우로보틱스', cap: 45 },
            { symbol: '403870', name: 'HPSP', cap: 40 },
            { symbol: '030530', name: '원익IPS', cap: 25 },
            { symbol: '039030', name: '이오테크닉스', cap: 28 },
            { symbol: '270870', name: '로보티즈', cap: 12 },
            { symbol: '065680', name: '우진엔텍', cap: 10 },
        ],
    },
    {
        id: 'kq-chem', name: '화학/소재', weight: 12.0,
        stocks: [
            { symbol: '086520', name: '에코프로', cap: 180 },
            { symbol: '003380', name: '하림지주', cap: 35 },
            { symbol: '357780', name: '솔브레인', cap: 32 },
            { symbol: '281740', name: '레이크머티리얼즈', cap: 20 },
        ],
    },
    {
        id: 'kq-it', name: 'IT 서비스/게임', weight: 10.0,
        stocks: [
            { symbol: '263750', name: '펄어비스', cap: 32 },
            { symbol: '293490', name: '카카오게임즈', cap: 28 },
            { symbol: '035900', name: 'JYP Ent.', cap: 26 },
            { symbol: '041510', name: '에스엠', cap: 22 },
        ],
    },
    {
        id: 'kq-med', name: '의료·정밀기기', weight: 10.0,
        stocks: [
            { symbol: '214150', name: '클래시스', cap: 35 },
            { symbol: '328130', name: '루닛', cap: 18 },
            { symbol: '338220', name: '뷰노', cap: 10 },
        ],
    },
];

// ── Yahoo Finance quote ─────────────────────────────────────────────────────────
// ── Robust Quote Fetch (using Naver Overseas API) ──────────────────────────────
async function fetchRobustQuote(symbol: string): Promise<{ changePercent: number; price: number; name: string; status?: string } | null> {
    const tryFetch = async (sym: string) => {
        const url = `https://api.stock.naver.com/stock/${sym}/basic`;
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': DEFAULT_UA },
                cache: 'no-store',
            });
            if (!res.ok) return null;
            const data = await res.json();
            if (!data || !data.closePrice) return null;
            return data;
        } catch {
            return null;
        }
    };

    let data = null;
    let finalSymbol = symbol;

    if (!symbol.includes('.')) {
        const suffixes = ['.O', '.N', '.A', '.K', ''];
        for (const suffix of suffixes) {
            data = await tryFetch(symbol + suffix);
            if (data) {
                finalSymbol = symbol + suffix;
                break;
            }
        }
    } else {
        data = await tryFetch(symbol);
    }

    if (!data) return null;

    const extractNumber = (v: any) => {
        if (v === undefined || v === null) return 0;
        const s = String(v).replace(/,/g, '');
        return parseFloat(s) || 0;
    };

    const price = extractNumber(data.closePrice);
    let changePercent = extractNumber(data.fluctuationsRatio);
    const name = data.stockName || symbol;
    
    // Check direction name as backup/override
    const dirName = (data.compareToPreviousClosePrice?.name || '').toUpperCase();
    if (dirName.includes('FALLING') || dirName.includes('LOWER')) {
        changePercent = -Math.abs(changePercent);
    } else if (dirName.includes('RISING') || dirName.includes('UPPER')) {
        changePercent = Math.abs(changePercent);
    }

    // If market is CLOSED, the change for CURRENT day is technically 0 
    // until the new session starts. (Prevents yesterday's move from sticking around)
    const isLive = data.marketStatus === 'OPEN';
    return { 
        changePercent, 
        price, 
        name,
        status: isLive ? 'OPEN' : 'CLOSED'
    };
}

// ── Naver Finance quote (Korean stocks) ────────────────────────────────────────
async function fetchNaverStockChange(symbol: string): Promise<{ changePercent: number; price: number } | null> {
    try {
        const code = symbol.split('.')[0];
        const url = `https://m.stock.naver.com/api/stock/${code}/basic`;
        const res = await fetch(url, {
            headers: { 'User-Agent': DEFAULT_UA },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const data = await res.json();
        const extractNumber = (v: any) => {
            if (!v) return 0;
            return parseFloat(String(v).replace(/,/g, '')) || 0;
        };
        const price = extractNumber(data.closePrice);
        if (price === 0) return null;

        const isLive = data.marketStatus === 'OPEN';
        let finalChange = extractNumber(data.fluctuationsRatio);
        
        const dirName = (data.compareToPreviousPrice?.name || '').toUpperCase();
        if (dirName.includes('FALLING') || dirName.includes('LOWER')) {
            finalChange = -Math.abs(finalChange);
        } else if (dirName.includes('RISING') || dirName.includes('UPPER')) {
            finalChange = Math.abs(finalChange);
        }

        return { changePercent: finalChange, price };
    } catch {
        return null;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const market = (searchParams.get('market') || 'US') as 'US' | 'KR' | 'KOSDAQ';
    const cacheKey = market;

    if (_cache[cacheKey] && Date.now() - _cache[cacheKey].ts < TTL) {
        return NextResponse.json(_cache[cacheKey].data);
    }

    try {
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstDate = new Date(now.getTime() + kstOffset);
        const day = kstDate.getUTCDay();
        const hours = kstDate.getUTCHours();
        const minutes = kstDate.getUTCMinutes();
        const timeVal = hours + minutes / 60;

        let marketStatus = 'CLOSED';

        if (market === 'US') {
            const sectorResults = await Promise.all(
                US_SECTORS.map(async (sec) => {
                    const etfData = await fetchRobustQuote(sec.etf);
                    const stockResults = await Promise.all(
                        sec.stocks.map(s => fetchRobustQuote(s.symbol))
                    );
                    
                    const stocks = sec.stocks.map((s, i) => ({
                        symbol: s.symbol,
                        name: stockResults[i]?.name || s.name,
                        cap: s.cap,
                        changePercent: stockResults[i]?.changePercent ?? 0,
                        price: stockResults[i]?.price ?? 0,
                    })).filter(s => s.price > 0);

                    if (etfData?.status === 'OPEN') marketStatus = 'OPEN';

                    // If ETF data failed, estimate sector change from stocks
                    let sectorChange = etfData?.changePercent;
                    if (sectorChange === undefined || isNaN(sectorChange)) {
                         const totalCap = stocks.reduce((a, s) => a + s.cap, 0) || 1;
                         sectorChange = stocks.reduce((a, s) => a + s.changePercent * (s.cap / totalCap), 0);
                    }

                    return {
                        id: sec.id,
                        name: sec.name,
                        weight: sec.weight,
                        changePercent: sectorChange || 0,
                        stocks: stocks,
                    };
                })
            );

            // Manual fallback status check for US
            const isWeekDay = day >= 2 && day <= 6; 
            const isMarketHours = timeVal >= 22.5 || timeVal < 6;
            if (isWeekDay && isMarketHours) marketStatus = 'OPEN';

            const data = { market: 'US', status: marketStatus, sectors: sectorResults.filter(s => s.stocks.length > 0) };
            _cache[cacheKey] = { data, ts: Date.now() };
            return NextResponse.json(data);
        } else {
            // Korean markets (KOSPI or KOSDAQ)
            const isWeekDay = day >= 1 && day <= 5;
            const isMarketHours = timeVal >= 9 && timeVal < 15.6;
            if (isWeekDay && isMarketHours) marketStatus = 'OPEN';

            const sourceSectors = market === 'KR' ? KR_SECTORS : KOSDAQ_SECTORS;
            const sectorResults = await Promise.all(
                sourceSectors.map(async (sec) => {
                    const stockResults = await Promise.all(
                        sec.stocks.map(s => fetchNaverStockChange(s.symbol))
                    );
                    const stocks = sec.stocks.map((s, i) => ({
                        symbol: s.symbol,
                        name: s.name,
                        cap: s.cap,
                        changePercent: stockResults[i]?.changePercent ?? 0,
                        price: stockResults[i]?.price ?? 0,
                    }));
                    const totalCap = stocks.reduce((a, s) => a + s.cap, 0) || 1;
                    const sectorChange = stocks.reduce((a, s) => a + s.changePercent * (s.cap / totalCap), 0);
                    return {
                        id: sec.id,
                        name: sec.name,
                        weight: sec.weight,
                        changePercent: sectorChange,
                        stocks: stocks.filter(s => s.price > 0),
                    };
                })
            );
            const data = { market, status: marketStatus, sectors: sectorResults.filter(s => s.stocks.length > 0) };
            _cache[cacheKey] = { data, ts: Date.now() };
            return NextResponse.json(data);
        }
    } catch (err) {
        console.error('Sector heatmap API error:', err);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}

