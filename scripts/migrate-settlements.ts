import { repo } from '../src/lib/db';
import { fetchHistoricalClosePrice } from '../src/lib/stock/history';

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrate() {
    console.log('Starting migration to true historical closing prices...');

    const history = repo.history.getAll(true) as any[];
    let modifiedCount = 0;

    for (let h of history) {
        if (!h.holdings || h.holdings.length === 0) continue;
        
        let newTotalInvValue = 0;
        let changed = false;

        console.log(`Processing date ${h.date}...`);

        const rate = h.exchangeRate || 1350;

        for (let inv of h.holdings) {
            const isDomestic = inv.marketType === 'Domestic' || ['Domestic Stock'].includes(inv.category);
            const closePrice = await fetchHistoricalClosePrice(inv.symbol, h.date, isDomestic);
            
            if (closePrice !== null && inv.currentPrice !== closePrice) {
                inv.currentPrice = closePrice;
                inv.isOverMarket = false;
                inv.overMarketChange = undefined;
                inv.overMarketPrice = undefined;
                inv.overMarketChangePercent = undefined;
                changed = true;
            } else if (closePrice === null) {
                console.warn(`Could not fetch history for ${inv.symbol} on ${h.date}`);
            }

            const val = (inv.currentPrice || inv.avgPrice) * inv.shares;
            newTotalInvValue += (inv.currency === 'USD' ? val * rate : val);
            await sleep(200); 
        }

        const totalOtherValue = (h.allocations || [])
            .filter((a: any) => ![
                    'Domestic Stock', 'Overseas Stock',
                    'Domestic Index', 'Overseas Index',
                    'Domestic Bond', 'Overseas Bond'
                ].includes(a.category))
                .reduce((acc: number, a: any) => {
                    let val = a.value || 0;
                    if (a.details && a.details.length > 0) {
                        val = a.details.reduce((sum: number, d: any) => {
                            const dVal = d.value || 0;
                            const dRate = (d.currency === 'USD' ? rate : 1);
                            const aRate = (a.currency === 'USD' ? rate : 1);
                            return sum + (dVal * dRate / aRate);
                        }, 0);
                    }
                    return acc + (a.currency === 'USD' ? val * rate : val);
                }, 0);

            h.allocations = (h.allocations || []).map((alc: any) => {
                const isInvCat = [
                    'Domestic Stock', 'Overseas Stock',
                    'Domestic Index', 'Overseas Index',
                    'Domestic Bond', 'Overseas Bond'
                ].includes(alc.category);

                if (isInvCat) {
                    const categoryValue = h.holdings
                        .filter((inv: any) => inv.category === alc.category || (alc.category === 'Domestic Stock' && inv.marketType === 'Domestic') || (alc.category === 'Overseas Stock' && inv.marketType === 'Overseas'))
                        .reduce((sum: number, inv: any) => {
                            const val = (inv.currentPrice || inv.avgPrice) * inv.shares;
                            return sum + (inv.currency === 'USD' ? val * rate : val);
                        }, 0);
                    return { ...alc, value: categoryValue / (alc.currency === 'USD' ? rate : 1) };
                }

                if (alc.details && alc.details.length > 0) {
                    const sumValue = alc.details.reduce((sum: number, d: any) => {
                        const dVal = d.value || 0;
                        const dRate = (d.currency === 'USD' ? rate : 1);
                        const aRate = (alc.currency === 'USD' ? rate : 1);
                        return sum + (dVal * dRate / aRate);
                    }, 0);
                    return { ...alc, value: sumValue };
                }
                return alc;
            });

            h.totalValue = totalOtherValue + newTotalInvValue;
            h.snapshotValue = h.totalValue;
            
            if (!h.meta) h.meta = {};
            h.meta.domesticSettled = true;
            h.meta.overseasSettled = true;

            repo.history.upsert(h);
            modifiedCount++;
            console.log(`Updated ${h.date}`);
    }

    console.log(`Migration complete. Updated ${modifiedCount} rows.`);
}

migrate();
