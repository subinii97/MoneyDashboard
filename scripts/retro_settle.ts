import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'dashboard.db');
const db = new Database(DB_PATH);

// Helper to fetch historical close price
async function fetchHistoricalClose(symbol: string, date: string, isDomestic: boolean) {
    const market = isDomestic ? 'ks' : 'us';
    const cleanSymbol = isDomestic ? `${symbol}.KS` : symbol;
    const baseUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}`;
    try {
        const d = new Date(date);
        const start = Math.floor(d.getTime() / 1000);
        const end = start + 86400 * 5; // Look ahead several days for weekend/holiday gaps
        
        const res = await fetch(`${baseUrl}?period1=${start}&period2=${end}&interval=1d`);
        if (!res.ok) return null;
        const body = await res.json();
        const data = body.chart.result?.[0];
        if (!data || !data.indicators.quote[0].close) return null;
        
        const timestamps = data.timestamp || [];
        const closes = data.indicators.quote[0].close;
        
        // Find the closest date on or after
        for (let i = 0; i < timestamps.length; i++) {
            const tDate = new Date(timestamps[i] * 1000).toISOString().substring(0, 10);
            if (tDate >= date) return closes[i];
        }
        return closes[0]; 
    } catch (e: any) {
        console.error(`Error for ${symbol}:`, e);
        return null;
    }
}

async function fixSettlement() {
    const targetDates = ['2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27'];
    
    for (const date of targetDates) {
        process.stdout.write(`Settling ${date}... `);
        const row = db.prepare('SELECT * FROM history WHERE date = ?').get(date) as any;
        if (!row) {
            console.log('Not found in DB.');
            continue;
        }

        const holdings = JSON.parse(row.holdings || '[]');
        const rate = row.exchangeRate || 1350;

        const newHoldings: any[] = [];
        for (const h of holdings) {
            const isDomestic = h.marketType === 'Domestic' || ['Domestic Stock', 'Domestic Index', 'Domestic Bond'].includes(h.category);
            const price = await fetchHistoricalClose(h.symbol, date, isDomestic);
            if (price !== null && price !== undefined) {
                newHoldings.push({ ...h, currentPrice: price, change: 0, changePercent: 0 });
            } else {
                newHoldings.push(h);
            }
        }

        const invTotal = newHoldings.reduce((sum: number, h: any) => {
            const isUSD = h.currency === 'USD';
            return sum + (h.currentPrice || 0) * h.shares * (isUSD ? rate : 1);
        }, 0);

        const allocs = JSON.parse(row.allocations || '[]');
        const nonInvTotal = (allocs as any[])
            .filter((a: any) => !['Domestic Stock', 'Overseas Stock', 'Domestic Index', 'Overseas Index', 'Domestic Bond', 'Overseas Bond'].includes(a.category))
            .reduce((sum: number, a: any) => sum + (a.currency === 'USD' ? a.value * rate : a.value), 0);

        const totalValue = invTotal + nonInvTotal;
        const meta = JSON.stringify({ domesticSettled: true, overseasSettled: true });

        db.prepare('UPDATE history SET holdings = ?, totalValue = ?, snapshotValue = ?, meta = ? WHERE date = ?')
            .run(JSON.stringify(newHoldings), totalValue, totalValue, meta, date);
        
        console.log(`Total = ${totalValue.toFixed(0)}`);
    }
}

fixSettlement().then(() => {
    console.log('Done');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
