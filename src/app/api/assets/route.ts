import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        const investments = db.prepare('SELECT * FROM investments').all();
        const allocationsRows = db.prepare('SELECT * FROM allocations').all();

        const allocations = allocationsRows.map((row: any) => ({
            ...row,
            details: row.details ? JSON.parse(row.details) : undefined
        }));

        return NextResponse.json({ investments, allocations });
    } catch (error) {
        console.error('Failed to fetch assets:', error);
        return NextResponse.json({ investments: [], allocations: [] }, { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        const { investments, allocations } = await request.json();

        const insertInvestment = db.prepare(`
            INSERT OR REPLACE INTO investments (id, symbol, name, shares, avgPrice, currency, exchange, marketType, category, purchaseDate, targetWeight)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertAllocation = db.prepare(`
            INSERT OR REPLACE INTO allocations (id, category, value, currency, targetWeight, details)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        db.transaction(() => {
            // Delete existing ones to sync properly if needed, 
            // but OR REPLACE might be enough depending on how the frontend sends data.
            // Usually, POST to assets replaces the whole list.
            db.prepare('DELETE FROM investments').run();
            db.prepare('DELETE FROM allocations').run();

            for (const inv of (investments || [])) {
                insertInvestment.run(
                    inv.id, inv.symbol, inv.name || null, inv.shares, inv.avgPrice,
                    inv.currency || null, inv.exchange || null, inv.marketType,
                    inv.category || null, inv.purchaseDate || null, inv.targetWeight || 0
                );
            }
            for (const alc of (allocations || [])) {
                insertAllocation.run(
                    alc.id, alc.category, alc.value, alc.currency, alc.targetWeight,
                    alc.details ? JSON.stringify(alc.details) : null
                );
            }
        })();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save assets:', error);
        return NextResponse.json({ success: false, error: 'Failed to save data' }, { status: 500 });
    }
}
