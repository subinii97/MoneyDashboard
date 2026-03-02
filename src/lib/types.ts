// ── Primitive types ──────────────────────────────────────────────────────────
export type MarketType = 'Domestic' | 'Overseas';
export type TransactionType = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW';
export type Currency = 'KRW' | 'USD';

export type AssetCategory =
    | 'Cash'
    | 'Savings'
    | 'Domestic Stock'
    | 'Domestic Index'
    | 'Domestic Bond'
    | 'Overseas Stock'
    | 'Overseas Bond'
    | 'Overseas Index';

// ── Constants ────────────────────────────────────────────────────────────────
export const CATEGORY_MAP: Record<AssetCategory, string> = {
    'Cash': '현금',
    'Savings': '예적금',
    'Domestic Stock': '국내 주식',
    'Domestic Index': '국내 지수',
    'Domestic Bond': '국내 채권',
    'Overseas Stock': '해외 주식',
    'Overseas Bond': '해외 채권',
    'Overseas Index': '해외 지수'
};

export const CATEGORY_COLORS: Record<AssetCategory, string> = {
    'Cash': '#059669',
    'Savings': '#34d399',
    'Domestic Stock': '#2563eb',
    'Domestic Index': '#3b82f6',
    'Domestic Bond': '#93c5fd',
    'Overseas Stock': '#8b5cf6',
    'Overseas Bond': '#a78bfa',
    'Overseas Index': '#c4b5fd'
};

// ── Core domain interfaces ────────────────────────────────────────────────────
export interface Investment {
    id: string;
    symbol: string;
    name?: string;
    shares: number;
    avgPrice: number;
    currentPrice?: number;
    currency?: string;
    exchange?: string;
    marketType: MarketType;
    category?: AssetCategory;
    purchaseDate?: string;
    targetWeight?: number;
    change?: number;
    changePercent?: number;
    previousClose?: number;
}

export interface AssetDetail {
    id: string;
    name: string;
    value: number;
    currency?: Currency;
}

export interface AssetAllocation {
    id: string;
    category: AssetCategory;
    value: number;
    currency: Currency;
    targetWeight: number;
    details?: AssetDetail[];
}

export interface Assets {
    investments: Investment[];
    allocations: AssetAllocation[];
}

export interface Transaction {
    id: string;
    date: string;
    type: TransactionType;
    symbol?: string;
    amount: number;
    shares?: number;
    price?: number;
    currency: Currency;
    notes?: string;
}

export interface HistoryEntry {
    date: string;
    totalValue: number;
    snapshotValue?: number;
    manualAdjustment?: number;
    holdings?: Investment[];
    allocations?: AssetAllocation[];
    transactions?: Transaction[];
    exchangeRate?: number;
    isLive?: boolean;
}

// ── Settlement types ──────────────────────────────────────────────────────────
export interface SettlementMetric {
    current: number;
    change: number;
    percent: number;
}

export interface FullSettlementMetrics {
    cash: SettlementMetric;
    domStock: SettlementMetric;
    domIndex: SettlementMetric;
    domBond: SettlementMetric;
    osStock: SettlementMetric;
    osIndex: SettlementMetric;
    osBond: SettlementMetric;
    domestic: SettlementMetric;
    overseas: SettlementMetric;
}

export interface DailySettlement extends HistoryEntry {
    change: number;
    changePercent: number;
    metrics: FullSettlementMetrics;
}

export interface WeeklySettlement {
    period: string;
    value: number;
    change: number;
    changePercent: number;
    metrics: FullSettlementMetrics;
}

export interface MonthlySettlement {
    month: string;
    value: number;
    cashSavings: number;
    domestic: number;
    overseas: number;
    change: number;
    changePercent: number;
    metrics: {
        cash: number;
        domStock: number;
        domIndex: number;
        domBond: number;
        osStock: number;
        osIndex: number;
        osBond: number;
    };
    isManual?: boolean;
}
