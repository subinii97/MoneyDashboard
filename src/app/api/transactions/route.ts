import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        const transactions = db.prepare('SELECT * FROM transactions ORDER BY date DESC').all();
        return NextResponse.json(transactions);
    } catch (error) {
        console.error('Failed to fetch transactions:', error);
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        const tx = await request.json();

        const insertTx = db.prepare(`
            INSERT OR REPLACE INTO transactions (id, date, type, symbol, amount, shares, price, currency, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertTx.run(
            tx.id, tx.date, tx.type, tx.symbol || null, tx.amount,
            tx.shares || null, tx.price || null, tx.currency, tx.notes || null
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save transaction:', error);
        return NextResponse.json({ success: false, error: 'Failed to save transaction' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete transaction:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete transaction' }, { status: 500 });
    }
}
