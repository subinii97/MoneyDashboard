export interface Stock {
    symbol: string;
    name: string;
    cap: number;
    changePercent: number;
    price: number;
}

export interface Sector {
    id: string;
    name: string;
    weight: number;
    changePercent: number;
    stocks: Stock[];
}
