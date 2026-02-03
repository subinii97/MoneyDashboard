import fs from 'fs';
import path from 'path';
import db from '../src/lib/db.ts';

const DATA_DIR = path.join(process.cwd(), 'data');

async function migrate() {
    console.log('Starting migration...');

    // 1. Migrate Assets (investments and allocations)
    const assetsPath = path.join(DATA_DIR, 'assets.json');
    if (fs.existsSync(assetsPath)) {
        console.log('Migrating assets...');
        const assets = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));

        const insertInvestment = db.prepare(`
            INSERT OR REPLACE INTO investments (id, symbol, name, shares, avgPrice, currency, exchange, marketType, category, purchaseDate, targetWeight)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertAllocation = db.prepare(`
            INSERT OR REPLACE INTO allocations (id, category, value, currency, targetWeight, details)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        db.transaction(() => {
            for (const inv of (assets.investments || [])) {
                insertInvestment.run(
                    inv.id, inv.symbol, inv.name || null, inv.shares, inv.avgPrice,
                    inv.currency || null, inv.exchange || null, inv.marketType,
                    inv.category || null, inv.purchaseDate || null, inv.targetWeight || 0
                );
            }
            for (const alc of (assets.allocations || [])) {
                insertAllocation.run(
                    alc.id, alc.category, alc.value, alc.currency, alc.targetWeight,
                    alc.details ? JSON.stringify(alc.details) : null
                );
            }
        })();
    }

    // 2. Migrate Transactions
    const txPath = path.join(DATA_DIR, 'transactions.json');
    if (fs.existsSync(txPath)) {
        console.log('Migrating transactions...');
        const transactions = JSON.parse(fs.readFileSync(txPath, 'utf8'));

        const insertTx = db.prepare(`
            INSERT OR REPLACE INTO transactions (id, date, type, symbol, amount, shares, price, currency, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        db.transaction(() => {
            for (const tx of transactions) {
                insertTx.run(
                    tx.id, tx.date, tx.type, tx.symbol || null, tx.amount,
                    tx.shares || null, tx.price || null, tx.currency, tx.notes || null
                );
            }
        })();
    }

    // 3. Migrate History
    const historyPath = path.join(DATA_DIR, 'history.json');
    if (fs.existsSync(historyPath)) {
        console.log('Migrating history...');
        const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));

        const insertHistory = db.prepare(`
            INSERT OR REPLACE INTO history (date, totalValue, snapshotValue, manualAdjustment, exchangeRate, holdings, allocations)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const insertRate = db.prepare(`
            INSERT OR IGNORE INTO currency_rates (date, rate)
            VALUES (?, ?)
        `);

        db.transaction(() => {
            for (const entry of history) {
                insertHistory.run(
                    entry.date, entry.totalValue, entry.snapshotValue || null,
                    entry.manualAdjustment || 0, entry.exchangeRate || null,
                    entry.holdings ? JSON.stringify(entry.holdings) : null,
                    entry.allocations ? JSON.stringify(entry.allocations) : null
                );

                if (entry.exchangeRate) {
                    insertRate.run(entry.date, entry.exchangeRate);
                }
            }
        })();
    }

    console.log('Migration completed successfully!');
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
