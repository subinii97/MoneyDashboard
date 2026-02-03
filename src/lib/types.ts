export type MarketType = 'Domestic' | 'Overseas';

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

export type AssetCategory =
    | 'Cash'
    | 'Savings'
    | 'Domestic Stock'
    | 'Domestic Index'
    | 'Domestic Bond'
    | 'Overseas Stock'
    | 'Overseas Bond'
    | 'Overseas Index';

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
    'Cash': '#10b981',           // Emerald
    'Savings': '#34d399',         // Medium Emerald/Green
    'Domestic Stock': '#3b82f6',  // Blue
    'Domestic Index': '#60a5fa',  // Light Blue
    'Domestic Bond': '#93c5fd',   // Very Light Blue
    'Overseas Stock': '#8b5cf6',  // Violet
    'Overseas Bond': '#a78bfa',   // Light Violet
    'Overseas Index': '#c4b5fd'    // Very Light Violet
};

export interface AssetDetail {
    id: string;
    name: string;
    value: number;
    currency?: 'KRW' | 'USD';
}

export interface AssetAllocation {
    id: string;
    category: AssetCategory;
    value: number; // Sum of details or manual value if no details
    currency: 'KRW' | 'USD';
    targetWeight: number;
    details?: AssetDetail[];
}

export interface Assets {
    investments: Investment[];
    allocations: AssetAllocation[];
}

export type TransactionType = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAW';

export interface Transaction {
    id: string;
    date: string;
    type: TransactionType;
    symbol?: string; // For BUY/SELL
    amount: number; // For DEPOSIT/WITHDRAW or total price for BUY/SELL
    shares?: number; // For BUY/SELL
    price?: number; // For BUY/SELL
    currency: 'KRW' | 'USD';
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
}
