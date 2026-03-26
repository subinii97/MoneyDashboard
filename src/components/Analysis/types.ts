export interface Stock {
    symbol: string;
    name: string;
    cap: number;
    changePercent: number;
    price: number;
    tradingValue: number;
    overMarketSession?: string;
    overMarketPrice?: number;
    overMarketChangePercent?: number;
}

export interface Sector {
    id: string;
    name: string;
    weight: number;
    changePercent: number;
    stocks: Stock[];
}
