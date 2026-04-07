import { repo } from '../src/lib/db';
import { fetchHistoricalClosePrice } from '../src/lib/stock/history';

async function fixApril1st() {
    const dates = ['2026-04-01'];
    console.log('--- Starting April 1st History Fix ---');

    for (const date of dates) {
        const row = repo.history.getByDate(date);
        if (!row) {
            console.log(`[${date}] No record found, skipping.`);
            continue;
        }

        console.log(`[${date}] Settling ALL assets...`);
        const holdings = row.holdings || [];
        const updatedHoldings = await Promise.all(holdings.map(async (inv: any) => {
            const isDomestic = inv.marketType === 'Domestic' || ['Domestic Stock', 'Domestic Index', 'Domestic Bond'].includes(inv.category);
            const price = await fetchHistoricalClosePrice(inv.symbol, date, isDomestic);
            if (price !== null) {
                return { 
                    ...inv, 
                    currentPrice: price,
                    isOverMarket: false,
                    overMarketPrice: undefined,
                    overMarketChange: undefined,
                    marketStatus: 'CLOSED'
                };
            }
            return inv;
        }));

        const invValue = updatedHoldings.reduce((acc, inv) => {
            const val = (inv.currentPrice || inv.avgPrice) * inv.shares;
            const rate = row.exchangeRate || 1350;
            return acc + (inv.currency === 'USD' ? val * rate : val);
        }, 0);

        const otherValue = (row.allocations || [])
            .filter((a: any) => !['Domestic Stock', 'Overseas Stock', 'Domestic Index', 'Overseas Index', 'Domestic Bond', 'Overseas Bond'].includes(a.category))
            .reduce((acc: number, a: any) => {
                const rate = row.exchangeRate || 1350;
                return acc + (a.currency === 'USD' ? (a.value * rate) : a.value);
            }, 0);

        const totalValue = invValue + otherValue;
        
        const newMeta = { 
            ...(row.meta || {}), 
            domesticSettled: true, 
            overseasSettled: true 
        };

        const newEntry = {
            ...row,
            holdings: updatedHoldings,
            totalValue: totalValue,
            snapshotValue: totalValue,
            meta: newMeta
        };

        repo.history.upsert(newEntry);
        console.log(`[${date}] Updated! New Total: ${totalValue.toLocaleString()} | Meta: ${JSON.stringify(newMeta)}`);
    }

    console.log('--- April 1st History Fix Complete ---');
}

fixApril1st().catch(console.error);
