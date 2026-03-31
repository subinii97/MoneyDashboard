import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'dashboard.db');
const db = new Database(DB_PATH);

const targetDates = ['2026-03-27', '2026-03-28', '2026-03-29'];
const cashVal = 546762;
const savingsVal = 5670000;

function recalcEntry(entry: any) {
    const allocations = JSON.parse(entry.allocations || '[]');
    const holdings = JSON.parse(entry.holdings || '[]');
    const rate = entry.exchangeRate || 1350;

    // 1. Update allocations
    let foundCash = false;
    let foundSavings = false;
    const nextAlloc = allocations.map((a: any) => {
        if (a.category === 'Cash') {
            foundCash = true;
            return { ...a, value: cashVal };
        }
        if (a.category === 'Savings') {
            foundSavings = true;
            return { ...a, value: savingsVal };
        }
        return a;
    });
    if (!foundCash) nextAlloc.push({ category: 'Cash', value: cashVal, currency: 'KRW' });
    if (!foundSavings) nextAlloc.push({ category: 'Savings', value: savingsVal, currency: 'KRW' });

    // 2. Recalculate total value
    const invValue = holdings.reduce((sum: number, h: any) => {
        const val = (h.currentPrice || h.avgPrice) * h.shares;
        return sum + (h.currency === 'USD' ? val * rate : val);
    }, 0);

    const nonInvValue = nextAlloc
        .filter((a: any) => !['Domestic Stock', 'Overseas Stock', 'Domestic Index', 'Overseas Index', 'Domestic Bond', 'Overseas Bond'].includes(a.category))
        .reduce((sum: number, a: any) => {
            const val = a.value || 0;
            return sum + (a.currency === 'USD' ? val * rate : val);
        }, 0);

    const newTotal = invValue + nonInvValue;
    return {
        ...entry,
        allocations: JSON.stringify(nextAlloc),
        totalValue: newTotal,
        snapshotValue: newTotal
    };
}

try {
    const entry27 = db.prepare('SELECT * FROM history WHERE date = ?').get('2026-03-27') as any;
    if (!entry27) {
        console.error('2026-03-27 entry not found');
        process.exit(1);
    }

    const updated27 = recalcEntry(entry27);

    // Perform updates in transaction
    const updateStmt = db.prepare(`
        INSERT OR REPLACE INTO history 
        (date, totalValue, snapshotValue, manualAdjustment, exchangeRate, holdings, allocations, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
        // Update 27th
        updateStmt.run(
            '2026-03-27', updated27.totalValue, updated27.snapshotValue, updated27.manualAdjustment, 
            updated27.exchangeRate, entry27.holdings, updated27.allocations, entry27.meta
        );
        console.log('Updated 2026-03-27: Total = ' + updated27.totalValue);

        // Copy to 28th and 29th
        ['2026-03-28', '2026-03-29'].forEach(date => {
            updateStmt.run(
                date, updated27.totalValue, updated27.snapshotValue, updated27.manualAdjustment, 
                updated27.exchangeRate, entry27.holdings, updated27.allocations, entry27.meta
            );
            console.log('Created/Updated ' + date + ': Total = ' + updated27.totalValue);
        });
    })();

    console.log('Successfully updated history.');
} catch (err) {
    console.error(err);
}
