import { NextResponse } from 'next/server';

const TTL = 10 * 1000; // 10 seconds cache
const _cache: Record<string, { data: any; ts: number }> = {};

// ── US S&P 500 Sectors ────────────────────────────────────────────────────────
const US_SECTORS: Array<{
    id: string; name: string; weight: number; etf: string;
    stocks: Array<{ symbol: string; name: string; cap: number }>;
}> = [
    {
        id: 'tech', name: 'Technology', weight: 30.2, etf: 'XLK',
        stocks: [
            { symbol: 'AAPL', name: 'Apple', cap: 3500 }, { symbol: 'MSFT', name: 'Microsoft', cap: 3200 },
            { symbol: 'NVDA', name: 'NVIDIA', cap: 3300 }, { symbol: 'AVGO', name: 'Broadcom', cap: 750 },
            { symbol: 'ORCL', name: 'Oracle', cap: 450 }, { symbol: 'ADBE', name: 'Adobe', cap: 240 },
            { symbol: 'CRM', name: 'Salesforce', cap: 260 }, { symbol: 'AMD', name: 'AMD', cap: 280 },
            { symbol: 'CSCO', name: 'Cisco', cap: 200 }, { symbol: 'ACN', name: 'Accenture', cap: 210 },
            { symbol: 'INTC', name: 'Intel', cap: 140 }, { symbol: 'QCOM', name: 'Qualcomm', cap: 190 },
            { symbol: 'NOW', name: 'ServiceNow', cap: 160 }, { symbol: 'IBM', name: 'IBM', cap: 170 },
            { symbol: 'PANW', name: 'Palo Alto', cap: 110 }, { symbol: 'SNPS', name: 'Synopsys', cap: 95 },
            { symbol: 'CDNS', name: 'Cadence', cap: 85 }, { symbol: 'MU', name: 'Micron', cap: 110 },
            { symbol: 'AMAT', name: 'Applied Mat.', cap: 130 }, { symbol: 'KLAC', name: 'KLA', cap: 95 },
            { symbol: 'LRCX', name: 'Lam Res.', cap: 105 }, { symbol: 'ADI', name: 'Analog Dev.', cap: 90 },
            { symbol: 'TXN', name: 'Texas Inst.', cap: 160 }, { symbol: 'V', name: 'Visa', cap: 580 },
            { symbol: 'MA', name: 'Mastercard', cap: 420 }, { symbol: 'FI', name: 'Fiserv', cap: 95 },
            { symbol: 'INTU', name: 'Intuit', cap: 180 }, { symbol: 'ROP', name: 'Roper', cap: 55 },
            { symbol: 'ADSK', name: 'Autodesk', cap: 52 }, { symbol: 'TEL', name: 'TE Conn.', cap: 48 },
        ],
    },
    {
        id: 'fin', name: 'Financials', weight: 12.8, etf: 'XLF',
        stocks: [
            { symbol: 'BRK-B', name: 'Berkshire', cap: 920 }, { symbol: 'JPM', name: 'JPMorgan', cap: 600 },
            { symbol: 'BAC', name: 'BofA', cap: 320 }, { symbol: 'WFC', name: 'Wells Fargo', cap: 240 },
            { symbol: 'GS', name: 'Goldman S.', cap: 165 }, { symbol: 'MS', name: 'Morgan St.', cap: 155 },
            { symbol: 'AXP', name: 'Amex', cap: 170 }, { symbol: 'C', name: 'Citigroup', cap: 120 },
            { symbol: 'BLK', name: 'BlackRock', cap: 135 }, { symbol: 'SCHW', name: 'Schwab', cap: 130 },
            { symbol: 'PGR', name: 'Progressive', cap: 120 }, { symbol: 'CB', name: 'Chubb', cap: 110 },
            { symbol: 'MMC', name: 'Marsh McL.', cap: 105 }, { symbol: 'BX', name: 'Blackstone', cap: 160 },
            { symbol: 'SPGI', name: 'S&P Global', cap: 145 }, { symbol: 'CME', name: 'CME Group', cap: 75 },
            { symbol: 'USB', name: 'US Bancorp', cap: 65 }, { symbol: 'TFC', name: 'Truist', cap: 55 },
            { symbol: 'PNC', name: 'PNC', cap: 62 }, { symbol: 'MCO', name: 'Moodys', cap: 82 },
        ],
    },
    {
        id: 'health', name: 'Healthcare', weight: 11.2, etf: 'XLV',
        stocks: [
            { symbol: 'LLY', name: 'Eli Lilly', cap: 880 }, { symbol: 'UNH', name: 'UnitedHealth', cap: 480 },
            { symbol: 'JNJ', name: 'J&J', cap: 380 }, { symbol: 'ABBV', name: 'AbbVie', cap: 310 },
            { symbol: 'MRK', name: 'Merck', cap: 315 }, { symbol: 'TMO', name: 'Thermo Fish.', cap: 220 },
            { symbol: 'ABT', name: 'Abbott', cap: 190 }, { symbol: 'AMGN', name: 'Amgen', cap: 165 },
            { symbol: 'DHR', name: 'Danaher', cap: 185 }, { symbol: 'SYK', name: 'Stryker', cap: 135 },
            { symbol: 'ISRG', name: 'Intuitive S.', cap: 160 }, { symbol: 'VRTX', name: 'Vertex', cap: 120 },
            { symbol: 'BSX', name: 'Boston Sci.', cap: 115 }, { symbol: 'REGN', name: 'Regeneron', cap: 105 },
            { symbol: 'CI', name: 'Cigna', cap: 95 }, { symbol: 'ELV', name: 'Elevance', cap: 115 },
            { symbol: 'PFE', name: 'Pfizer', cap: 160 }, { symbol: 'GILD', name: 'Gilead', cap: 85 },
            { symbol: 'BMY', name: 'Bristol M.', cap: 95 }, { symbol: 'MDT', name: 'Medtronic', cap: 108 },
            { symbol: 'ZTS', name: 'Zoetis', cap: 88 }, { symbol: 'HCA', name: 'HCA Health', cap: 82 },
            { symbol: 'MCK', name: 'McKesson', cap: 75 }, { symbol: 'BDX', name: 'Becton D.', cap: 68 },
            { symbol: 'HUM', name: 'Humana', cap: 45 },
        ],
    },
    {
        id: 'cons_cyc', name: 'Consumer Cycl.', weight: 10.5, etf: 'XLY',
        stocks: [
            { symbol: 'AMZN', name: 'Amazon', cap: 1900 }, { symbol: 'TSLA', name: 'Tesla', cap: 850 },
            { symbol: 'HD', name: 'Home Depot', cap: 380 }, { symbol: 'MCD', name: 'McD', cap: 210 },
            { symbol: 'NKE', name: 'Nike', cap: 140 }, { symbol: 'LOW', name: 'Lowes', cap: 135 },
            { symbol: 'BKNG', name: 'Booking', cap: 130 }, { symbol: 'SBUX', name: 'Starbucks', cap: 110 },
            { symbol: 'TJX', name: 'TJX Cos.', cap: 120 }, { symbol: 'CMG', name: 'Chipotle', cap: 85 },
            { symbol: 'MAR', name: 'Marriott', cap: 72 }, { symbol: 'HLT', name: 'Hilton', cap: 55 },
            { symbol: 'LULU', name: 'Lululemon', cap: 58 }, { symbol: 'DASH', name: 'DoorDash', cap: 48 },
            { symbol: 'AZO', name: 'AutoZone', cap: 55 }, { symbol: 'ORLY', name: 'OREilly', cap: 62 },
            { symbol: 'EBAY', name: 'eBay', cap: 28 }, { symbol: 'GRMN', name: 'Garmin', cap: 32 },
            { symbol: 'TSCO', name: 'Tractor Sup.', cap: 28 }, { symbol: 'ABNB', name: 'Airbnb', cap: 95 },
        ],
    },
    {
        id: 'comm', name: 'Communication', weight: 9.2, etf: 'XLC',
        stocks: [
            { symbol: 'META', name: 'Meta', cap: 1400 }, { symbol: 'GOOGL', name: 'Alphabet A', cap: 1950 },
            { symbol: 'GOOG', name: 'Alphabet C', cap: 1940 }, { symbol: 'NFLX', name: 'Netflix', cap: 320 },
            { symbol: 'DIS', name: 'Disney', cap: 180 }, { symbol: 'TMUS', name: 'T-Mobile', cap: 220 },
            { symbol: 'VZ', name: 'Verizon', cap: 170 }, { symbol: 'T', name: 'AT&T', cap: 145 },
            { symbol: 'CHTR', name: 'Charter', cap: 45 }, { symbol: 'WBD', name: 'Warner Bros', cap: 22 },
            { symbol: 'FOXA', name: 'Fox Corp', cap: 18 }, { symbol: 'CMCSA', name: 'Comcast', cap: 165 },
            { symbol: 'EA', name: 'EA Games', cap: 42 }, { symbol: 'TTWO', name: 'Take-Two', cap: 28 },
            { symbol: 'MTCH', name: 'Match Grp', cap: 10 },
        ],
    },
    {
        id: 'indust', name: 'Industrials', weight: 8.5, etf: 'XLI',
        stocks: [
            { symbol: 'GE', name: 'GE Aerosp.', cap: 210 }, { symbol: 'CAT', name: 'Caterpillar', cap: 185 },
            { symbol: 'RTX', name: 'RTX Corp', cap: 155 }, { symbol: 'HON', name: 'Honeywell', cap: 135 },
            { symbol: 'UNP', name: 'Union Pac.', cap: 145 }, { symbol: 'LMT', name: 'Lockheed', cap: 115 },
            { symbol: 'BA', name: 'Boeing', cap: 105 }, { symbol: 'DE', name: 'John Deere', cap: 112 },
            { symbol: 'UPS', name: 'UPS', cap: 125 }, { symbol: 'FDX', name: 'FedEx', cap: 65 },
            { symbol: 'NSC', name: 'Norfolk S.', cap: 55 }, { symbol: 'CSX', name: 'CSX Corp', cap: 72 },
            { symbol: 'EMR', name: 'Emerson', cap: 62 }, { symbol: 'ITW', name: 'Ill. Tool', cap: 78 },
            { symbol: 'ETN', name: 'Eaton', cap: 130 },
        ],
    },
    {
        id: 'cons_def', name: 'Consumer Def.', weight: 6.0, etf: 'XLP',
        stocks: [
            { symbol: 'WMT', name: 'Walmart', cap: 820 }, { symbol: 'PG', name: 'P&G', cap: 390 },
            { symbol: 'COST', name: 'Costco', cap: 360 }, { symbol: 'KO', name: 'Coca-Cola', cap: 280 },
            { symbol: 'PEP', name: 'PepsiCo', cap: 235 }, { symbol: 'PM', name: 'Philip Mor.', cap: 165 },
            { symbol: 'MO', name: 'Altria', cap: 85 }, { symbol: 'MDLZ', name: 'Mondelez', cap: 95 },
            { symbol: 'CL', name: 'Colgate', cap: 80 }, { symbol: 'TGT', name: 'Target', cap: 75 },
        ],
    },
    {
        id: 'energy', name: 'Energy', weight: 4.2, etf: 'XLE',
        stocks: [
            { symbol: 'XOM', name: 'ExxonMobil', cap: 520 }, { symbol: 'CVX', name: 'Chevron', cap: 290 },
            { symbol: 'COP', name: 'ConocoPhil', cap: 135 }, { symbol: 'EOG', name: 'EOG Res.', cap: 78 },
            { symbol: 'SLB', name: 'Schlumb.', cap: 72 }, { symbol: 'OXY', name: 'Occidental', cap: 55 },
            { symbol: 'MPC', name: 'Marathon', cap: 68 }, { symbol: 'VLO', name: 'Valero', cap: 52 },
        ],
    },
    {
        id: 'util', name: 'Utilities', weight: 2.5, etf: 'XLU',
        stocks: [
            { symbol: 'NEE', name: 'NextEra', cap: 155 }, { symbol: 'SO', name: 'Southern Co', cap: 82 },
            { symbol: 'DUK', name: 'Duke Energy', cap: 78 }, { symbol: 'AEP', name: 'Am. Elec.', cap: 55 },
            { symbol: 'D', name: 'Dominion', cap: 48 }, { symbol: 'SRE', name: 'Sempra', cap: 52 },
            { symbol: 'CEG', name: 'Constell.', cap: 68 },
        ],
    },
    {
        id: 'materials', name: 'Basic Materials', weight: 2.3, etf: 'XLB',
        stocks: [
            { symbol: 'LIN', name: 'Linde', cap: 225 }, { symbol: 'SHW', name: 'Sherwin-W.', cap: 85 },
            { symbol: 'APD', name: 'Air Prod.', cap: 65 }, { symbol: 'ECL', name: 'Ecolab', cap: 62 },
            { symbol: 'FCX', name: 'Freeport', cap: 62 }, { symbol: 'NEM', name: 'Newmont', cap: 58 },
            { symbol: 'DD', name: 'DuPont', cap: 35 },
        ],
    },
    {
        id: 'realestate', name: 'Real Estate', weight: 2.1, etf: 'XLRE',
        stocks: [
            { symbol: 'PLD', name: 'Prologis', cap: 105 }, { symbol: 'AMT', name: 'Am. Tower', cap: 88 },
            { symbol: 'EQIX', name: 'Equinix', cap: 82 }, { symbol: 'WELL', name: 'Welltower', cap: 65 },
            { symbol: 'SPG', name: 'Simon Prop.', cap: 58 }, { symbol: 'DLR', name: 'Digital Re.', cap: 52 },
            { symbol: 'CCI', name: 'Crown Cast.', cap: 45 },
        ],
    },
];

// ── Korean KOSPI Sectors ───────────────────────────────────────────────────────
const KR_SECTORS: Array<{
    id: string; name: string; weight: number;
    stocks: Array<{ symbol: string; name: string; cap: number }>;
}> = [
    {
        id: 'kr-elec', name: 'IT/반도체/가전', weight: 35.0,
        stocks: [
            { symbol: '005930', name: '삼성전자', cap: 4500 }, { symbol: '000660', name: 'SK하이닉스', cap: 1600 },
            { symbol: '373220', name: 'LG에너지솔루션', cap: 900 }, { symbol: '006400', name: '삼성SDI', cap: 320 },
            { symbol: '066570', name: 'LG전자', cap: 180 }, { symbol: '042700', name: '한미반도체', cap: 120 },
            { symbol: '009150', name: '삼성전기', cap: 110 }, { symbol: '402340', name: 'SK스퀘어', cap: 115 },
            { symbol: '010120', name: 'LS ELECTRIC', cap: 55 }, { symbol: '001440', name: '대한전선', cap: 35 },
            { symbol: '003550', name: 'LG', cap: 110 }, { symbol: '011070', name: 'LG이노텍', cap: 45 },
            { symbol: '034220', name: 'LG디스플레이', cap: 42 }, { symbol: '000990', name: 'DB하이텍', cap: 22 },
        ],
    },
    {
        id: 'kr-heavy', name: '자동차/조선/방산', weight: 16.0,
        stocks: [
            { symbol: '005380', name: '현대차', cap: 620 }, { symbol: '000270', name: '기아', cap: 580 },
            { symbol: '012450', name: '한화에어로스페이스', cap: 210 }, { symbol: '012330', name: '현대모비스', cap: 220 },
            { symbol: '329180', name: 'HD현대중공업', cap: 160 }, { symbol: '010140', name: '삼성중공업', cap: 95 },
            { symbol: '042660', name: '한화오션', cap: 85 }, { symbol: '047810', name: '한국항공우주', cap: 78 },
            { symbol: '079550', name: 'LIG넥스원', cap: 55 }, { symbol: '009540', name: 'HD한국조선', cap: 115 },
            { symbol: '267250', name: 'HD현대', cap: 80 }, { symbol: '011210', name: '현대위아', cap: 18 },
            { symbol: '064350', name: '현대로템', cap: 42 },
        ],
    },
    {
        id: 'kr-finance', name: '금융/지주/증권', weight: 14.0,
        stocks: [
            { symbol: '105560', name: 'KB금융', cap: 410 }, { symbol: '055550', name: '신한지주', cap: 380 },
            { symbol: '086790', name: '하나금융지주', cap: 230 }, { symbol: '316140', name: '우리금융지주', cap: 165 },
            { symbol: '032830', name: '삼성생명', cap: 185 }, { symbol: '000810', name: '삼성화재', cap: 175 },
            { symbol: '028260', name: '삼성물산', cap: 240 }, { symbol: '006800', name: '미래에셋증권', cap: 95 },
            { symbol: '138040', name: '메리츠금융', cap: 170 }, { symbol: '024110', name: '기업은행', cap: 110 },
            { symbol: '071050', name: '한국금융지주', cap: 48 }, { symbol: '029780', name: '삼성카드', cap: 45 },
            { symbol: '088350', name: '한화생명', cap: 32 }, { symbol: '003470', name: '유안타증권', cap: 15 },
        ],
    },
    {
        id: 'kr-it-service', name: 'IT서비스/게임', weight: 10.0,
        stocks: [
            { symbol: '035420', name: 'NAVER', cap: 310 }, { symbol: '035720', name: '카카오', cap: 190 },
            { symbol: '259960', name: '크래프톤', cap: 150 }, { symbol: '018260', name: '삼성SDS', cap: 125 },
            { symbol: '323410', name: '카카오뱅크', cap: 115 }, { symbol: '377300', name: '카카오페이', cap: 55 },
            { symbol: '251270', name: '넷마블', cap: 50 }, { symbol: '036570', name: '엔씨소프트', cap: 45 },
        ],
    },
    {
        id: 'kr-bio', name: '바이오/의약', weight: 8.5,
        stocks: [
            { symbol: '207940', name: '삼성바이오', cap: 780 }, { symbol: '068270', name: '셀트리온', cap: 410 },
            { symbol: '000100', name: '유한양행', cap: 110 }, { symbol: '326030', name: 'SK바이오팜', cap: 85 },
            { symbol: '128940', name: '한미약품', cap: 42 }, { symbol: '185750', name: '종근당', cap: 18 },
            { symbol: '302440', name: 'SK바이오사이언스', cap: 45 },
        ],
    },
    {
        id: 'kr-chem', name: '정유/화학/소재', weight: 8.5,
        stocks: [
            { symbol: '051910', name: 'LG화학', cap: 280 }, { symbol: '003670', name: '포스코퓨처엠', cap: 180 },
            { symbol: '096770', name: 'SK이노베이션', cap: 140 }, { symbol: '010950', name: 'S-Oil', cap: 95 },
            { symbol: '009830', name: '한화솔루션', cap: 75 }, { symbol: '011780', name: '금호석유', cap: 45 },
            { symbol: '453340', name: '에코프로머티', cap: 85 }, { symbol: '267260', name: 'HD현대일렉', cap: 105 },
            { symbol: '051900', name: 'LG생활건강', cap: 85 }, { symbol: '090430', name: '아모레퍼시픽', cap: 105 },
        ],
    },
    {
        id: 'kr-steel', name: '철강/에너지/건설', weight: 8.0,
        stocks: [
            { symbol: '005490', name: 'POSCO홀딩스', cap: 350 }, { symbol: '010130', name: '고려아연', cap: 160 },
            { symbol: '034020', name: '두산에너빌리티', cap: 145 }, { symbol: '015760', name: '한국전력', cap: 155 },
            { symbol: '000720', name: '현대건설', cap: 48 }, { symbol: '028050', name: '삼성엔지니어링', cap: 52 },
            { symbol: '004020', name: '현대제철', cap: 45 }, { symbol: '006360', name: 'GS건설', cap: 22 },
            { symbol: '000670', name: '영풍', cap: 15 },
        ],
    },
    {
        id: 'kr-consumer', name: '유통/통신/운수', weight: 5.0,
        stocks: [
            { symbol: '033780', name: 'KT&G', cap: 140 }, { symbol: '097950', name: 'CJ제일제당', cap: 55 },
            { symbol: '017670', name: 'SK텔레콤', cap: 125 }, { symbol: '030200', name: 'KT', cap: 95 },
            { symbol: '032640', name: 'LG유플러스', cap: 45 }, { symbol: '011200', name: 'HMM', cap: 110 },
            { symbol: '003490', name: '대한항공', cap: 95 }, { symbol: '086280', name: '현대글로비스', cap: 80 },
            { symbol: '139480', name: '이마트', cap: 22 }, { symbol: '008770', name: '호텔신라', cap: 25 },
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
            { symbol: '196170', name: '알테오젠', cap: 210 }, { symbol: '000250', name: '삼천당제약', cap: 220 },
            { symbol: '298380', name: '에이비엘바이오', cap: 100 }, { symbol: '083320', name: '펩트론', cap: 110 },
            { symbol: '141080', name: '리가켐바이오', cap: 80 }, { symbol: '028300', name: 'HLB', cap: 80 },
            { symbol: '145020', name: '휴젤', cap: 50 }, { symbol: '068760', name: '셀트리온제약', cap: 45 },
            { symbol: '237690', name: '에스티팜', cap: 35 }, { symbol: '214370', name: '케어젠', cap: 65 },
            { symbol: '304100', name: '보로노이', cap: 40 }, { symbol: '039200', name: '오스코텍', cap: 28 },
            { symbol: '086900', name: '메디톡스', cap: 25 }, { symbol: '085660', name: '차바이오텍', cap: 22 },
            { symbol: '214450', name: '파마리서치', cap: 35 }, { symbol: '096530', name: '씨젠', cap: 20 },
            { symbol: '340570', name: '티앤엘', cap: 18 }, { symbol: '145720', name: 'HK이노엔', cap: 25 },
        ],
    },
    {
        id: 'kq-it', name: '반도체/IT장비', weight: 22.0,
        stocks: [
            { symbol: '058470', name: '리노공업', cap: 75 }, { symbol: '403870', name: 'HPSP', cap: 50 },
            { symbol: '039030', name: '이오테크닉스', cap: 52 }, { symbol: '030530', name: '원익IPS', cap: 58 },
            { symbol: '357780', name: '솔브레인', cap: 32 }, { symbol: '005290', name: '동진쎄미켐', cap: 35 },
            { symbol: '056190', name: '에스에프에이', cap: 28 }, { symbol: '036930', name: '주성엔지니어링', cap: 30 },
            { symbol: '319660', name: '피에스케이', cap: 18 }, { symbol: '084370', name: '유진테크', cap: 15 },
            { symbol: '166090', name: '하나머티리얼즈', cap: 16 }, { symbol: '095340', name: 'ISC', cap: 20 },
            { symbol: '440110', name: '파두', cap: 25 }, { symbol: '131970', name: '두산테스나', cap: 22 },
            { symbol: '222800', name: '심텍', cap: 12 }, { symbol: '064760', name: '티씨케이', cap: 18 },
            { symbol: '089030', name: '테크윙', cap: 32 }, { symbol: '058970', name: '엠로', cap: 15 },
            { symbol: '399720', name: '가온칩스', cap: 18 }, { symbol: '394280', name: '오픈에지테크', cap: 12 },
        ],
    },
    {
        id: 'kq-battery', name: '2차전지/소재', weight: 18.0,
        stocks: [
            { symbol: '247540', name: '에코프로비엠', cap: 210 }, { symbol: '290650', name: '엔켐', cap: 70 },
            { symbol: '078600', name: '대주전자재료', cap: 38 }, { symbol: '278280', name: '천보', cap: 25 },
            { symbol: '121600', name: '나노신소재', cap: 18 }, { symbol: '281740', name: '레이크머티리얼즈', cap: 26 },
            { symbol: '137400', name: '피엔티', cap: 28 }, { symbol: '372170', name: '윤성에프앤씨', cap: 12 },
            { symbol: '043370', name: '피에이치에이', cap: 8 }, { symbol: '015750', name: '성우하이텍', cap: 10 },
            { symbol: '213420', name: '덕산네오룩스', cap: 15 }, { symbol: '178920', name: 'PI첨단소재', cap: 14 },
        ],
    },
    {
        id: 'kq-heavy', name: '기계/로봇/부품', weight: 12.0,
        stocks: [
            { symbol: '277810', name: '레인보우로보틱스', cap: 140 }, { symbol: '270870', name: '로보티즈', cap: 15 },
            { symbol: '348340', name: '뉴로메카', cap: 10 }, { symbol: '204270', name: '제이앤티씨', cap: 25 },
            { symbol: '178320', name: '서진시스템', cap: 18 }, { symbol: '039440', name: '에스티아이', cap: 12 },
            { symbol: '166030', name: '파크시스템스', cap: 22 }, { symbol: '183300', name: '코미코', cap: 15 },
            { symbol: '126340', name: '비나텍', cap: 8 }, { symbol: '272290', name: '이녹스첨단', cap: 12 },
            { symbol: '000490', name: '대동', cap: 10 },
        ],
    },
    {
        id: 'kq-culture', name: '게임/엔터/미디어', weight: 11.0,
        stocks: [
            { symbol: '263750', name: '펄어비스', cap: 35 }, { symbol: '293490', name: '카카오게임즈', cap: 30 },
            { symbol: '035900', name: 'JYP Ent.', cap: 28 }, { symbol: '041510', name: '에스엠', cap: 25 },
            { symbol: '122870', name: '와이지엔터', cap: 18 }, { symbol: '112040', name: '위메이드', cap: 20 },
            { symbol: '078340', name: '컴투스', cap: 12 }, { symbol: '034230', name: '파라다이스', cap: 22 },
            { symbol: '253450', name: '스튜디오드래곤', cap: 28 }, { symbol: '067160', name: 'SOOP', cap: 18 },
            { symbol: '035760', name: 'CJ ENM', cap: 25 }, { symbol: '217270', name: '넵튠', cap: 8 },
        ],
    },
    {
        id: 'kq-fin', name: '금융/지주/의료', weight: 9.0,
        stocks: [
            { symbol: '086520', name: '에코프로', cap: 215 }, { symbol: '214150', name: '클래시스', cap: 40 },
            { symbol: '003380', name: '하림지주', cap: 35 }, { symbol: '328130', name: '루닛', cap: 22 },
            { symbol: '032190', name: '다우데이타', cap: 25 }, { symbol: '041190', name: '우리기술투자', cap: 30 },
            { symbol: '338220', name: '뷰노', cap: 12 }, { symbol: '042000', name: '카페24', cap: 15 },
            { symbol: '021080', name: '에이티넘인베스트', cap: 12 }, { symbol: '027360', name: '아주IB투자', cap: 10 },
        ],
    },
];

import { fetchQuote } from '@/lib/stock';

async function getStockInfo(symbol: string) {
    const data = await fetchQuote(symbol);
    if (!data || data.error) return null;
    return {
        changePercent: data.changePercent,
        price: data.price,
        name: data.name,
        status: data.marketStatus === 'OPEN' ? 'OPEN' : 'CLOSED',
        overMarketSession: data.overMarketSession,
        overMarketPrice: data.overMarketPrice,
        overMarketChangePercent: data.overMarketChangePercent,
        tradingValue: data.tradingValue
    };
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
                    const etfData = await getStockInfo(sec.etf);
                    const stockResults = await Promise.all(
                        sec.stocks.map(s => getStockInfo(s.symbol))
                    );
                    
                    const stocks = sec.stocks.map((s, i) => ({
                        symbol: s.symbol,
                        name: stockResults[i]?.name || s.name,
                        cap: s.cap,
                        changePercent: stockResults[i]?.changePercent ?? 0,
                        price: stockResults[i]?.price ?? 0,
                        overMarketSession: stockResults[i]?.overMarketSession,
                        overMarketPrice: stockResults[i]?.overMarketPrice,
                        overMarketChangePercent: stockResults[i]?.overMarketChangePercent,
                        tradingValue: stockResults[i]?.tradingValue ?? 0,
                    })).filter(s => s.price > 0);



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

            // Robust session check for US
            const nycNow = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric', month: 'numeric', day: 'numeric',
                hour: 'numeric', minute: 'numeric', hour12: false
            }).formatToParts(now);
            
            const nycParts: Record<string, string> = {};
            nycNow.forEach(p => nycParts[p.type] = p.value);
            
            const nycDay = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();
            const nycTime = parseInt(nycParts.hour) + parseInt(nycParts.minute) / 60;
            const isNycWeekDay = nycDay >= 1 && nycDay <= 5;

            // marketStatus determines the "Live" badge color/text
            if (isNycWeekDay && nycTime >= 9.5 && nycTime < 16) {
                marketStatus = 'OPEN';
            } else {
                marketStatus = 'CLOSED';
            }

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
                        sec.stocks.map(s => getStockInfo(s.symbol))
                    );
                    const stocks = sec.stocks.map((s, i) => ({
                        symbol: s.symbol,
                        name: s.name,
                        cap: s.cap,
                        changePercent: stockResults[i]?.changePercent ?? 0,
                        price: stockResults[i]?.price ?? 0,
                        overMarketSession: stockResults[i]?.overMarketSession,
                        overMarketPrice: stockResults[i]?.overMarketPrice,
                        overMarketChangePercent: stockResults[i]?.overMarketChangePercent,
                        tradingValue: stockResults[i]?.tradingValue ?? 0,
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
