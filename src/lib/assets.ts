import { Investment, DEFAULT_EXCHANGE_RATE } from './types';
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
    return { rate: DEFAULT_EXCHANGE_RATE, yesterdayRate: DEFAULT_EXCHANGE_RATE, time: '' };
}

/**
 * Resolves the effective price: uses over-market (after-hours/pre-market) price if active.
 */
export function getActivePrice(inv: Investment): number {
    return (inv.isOverMarket && inv.overMarketPrice !== undefined)
        ? inv.overMarketPrice
        : (inv.currentPrice || inv.avgPrice);
}

/**
 * Resolves the absolute change for the current session.
 * For newly bought stocks (on the same day), change is relative to purchase price instead of previous close.
 */
export function getActiveChange(inv: Investment, todayBuySymbols?: Set<string>): number {
    const activePrice = getActivePrice(inv);
    if (todayBuySymbols?.has(inv.symbol?.toUpperCase().trim())) {
        return activePrice - inv.avgPrice;
    }
    return (inv.isOverMarket && inv.overMarketChange !== undefined)
        ? inv.overMarketChange
        : (inv.change || 0);
}

/**
 * Resolves the percentage change for the current session.
 */
export function getActiveChangePercent(inv: Investment, todayBuySymbols?: Set<string>): number {
    if (todayBuySymbols?.has(inv.symbol?.toUpperCase().trim())) {
        return inv.avgPrice > 0 ? ((getActivePrice(inv) - inv.avgPrice) / inv.avgPrice) * 100 : 0;
    }
    return (inv.isOverMarket && inv.overMarketChangePercent !== undefined)
        ? inv.overMarketChangePercent
        : (inv.changePercent || 0);
}
