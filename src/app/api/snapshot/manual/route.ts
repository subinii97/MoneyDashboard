import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, totalValue, allocations } = body;

        if (!date || totalValue === undefined) {
            return NextResponse.json({ error: 'Date and totalValue are required' }, { status: 400 });
        }

        // Insert or replace a summary record in history
        // holdings will be NULL or empty array string to indicate it's a summary record
        db.prepare(`
            INSERT OR REPLACE INTO history (date, totalValue, snapshotValue, manualAdjustment, exchangeRate, holdings, allocations)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            date,
            totalValue,
            totalValue,
            0,
            1350, // Default or placeholder
            JSON.stringify([]), // No holdings for manual monthly entries
            JSON.stringify(allocations || [])
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Manual snapshot failed', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
