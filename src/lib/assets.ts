import { Investment } from './types';
import { isDomesticSymbol } from './utils';

/**
 * Maps raw investment data with live price information.
 */
export function mapInvestmentWithPrice(inv: Investment, priceData: any) {
    const info = priceData.results?.find((r: any) =>
        r.symbol.trim().toUpperCase() === inv.symbol.trim().toUpperCase()
    );

    return {
        ...inv,
        currentPrice: info?.price || inv.currentPrice || inv.avgPrice,
        currency: info?.currency || inv.currency || (inv.symbol.includes('.') ? 'KRW' : 'USD'),
        exchange: inv.exchange || info?.exchange,
        name: (inv.name && inv.name !== inv.symbol) ? inv.name : (info?.name || inv.name),
        change: info?.change,
        changePercent: info?.changePercent,
        marketType: inv.marketType || (isDomesticSymbol(inv.symbol) || (info && info.exchange === 'KRX') ? 'Domestic' : 'Overseas'),
        isOverMarket: info?.isOverMarket,
        overMarketSession: info?.overMarketSession,
        overMarketPrice: info?.overMarketPrice,
        overMarketChange: info?.overMarketChange,
        overMarketChangePercent: info?.overMarketChangePercent,
        marketStatus: info?.marketStatus
    };
}

/**
 * Standardizes rate extraction from various API response formats.
 */
export function extractExchangeRate(priceData: any): { rate: number, yesterdayRate: number, time: string } {
    if (priceData.exchangeRate) {
        if (typeof priceData.exchangeRate === 'object') {
            return {
                rate: priceData.exchangeRate.rate,
                yesterdayRate: priceData.exchangeRate.yesterdayRate || priceData.exchangeRate.rate,
                time: priceData.exchangeRate.time
            };
        } else {
            return {
                rate: priceData.exchangeRate,
                yesterdayRate: priceData.exchangeRate,
                time: ''
            };
        }
    }
    return { rate: 1350, yesterdayRate: 1350, time: '' };
}
