import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Transaction } from '@/lib/types';

const DATA_PATH = path.join(process.cwd(), 'data/transactions.json');

export async function GET() {
    try {
        const data = await fs.readFile(DATA_PATH, 'utf8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        const newTx = await request.json();
        let transactions: Transaction[] = [];
        try {
            const data = await fs.readFile(DATA_PATH, 'utf8');
            transactions = JSON.parse(data);
        } catch (e) { }

        transactions.push(newTx);
        await fs.writeFile(DATA_PATH, JSON.stringify(transactions, null, 2));
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to save transaction' }, { status: 500 });
    }
}
