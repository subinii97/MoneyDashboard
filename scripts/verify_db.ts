import db from '../src/lib/db.ts';

function verify() {
    console.log('Verifying SQL database...');

    const counts = {
        investments: db.prepare('SELECT COUNT(*) as count FROM investments').get(),
        allocations: db.prepare('SELECT COUNT(*) as count FROM allocations').get(),
        history: db.prepare('SELECT COUNT(*) as count FROM history').get(),
        transactions: db.prepare('SELECT COUNT(*) as count FROM transactions').get(),
        currency_rates: db.prepare('SELECT COUNT(*) as count FROM currency_rates').get()
    };

    console.log('Row counts:', JSON.stringify(counts, null, 2));

    if ((counts.investments as any).count > 0) {
        console.log('Sample investment:', db.prepare('SELECT * FROM investments LIMIT 1').get());
    }
    if ((counts.history as any).count > 0) {
        console.log('Sample history entry:', db.prepare('SELECT * FROM history LIMIT 1').get());
    }
    if ((counts.currency_rates as any).count > 0) {
        console.log('Sample currency rate:', db.prepare('SELECT * FROM currency_rates LIMIT 1').get());
    }

    console.log('Verification script finished.');
}

verify();
