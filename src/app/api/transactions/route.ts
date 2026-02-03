import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Transaction } from '@/lib/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_PATH = path.join(DATA_DIR, 'transactions.json');

async function ensureDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

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
        await ensureDir();
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
export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        let transactions: Transaction[] = [];
        try {
            const data = await fs.readFile(DATA_PATH, 'utf8');
            transactions = JSON.parse(data);
        } catch (e) { }

        const updated = transactions.filter(tx => tx.id !== id);
        await fs.writeFile(DATA_PATH, JSON.stringify(updated, null, 2));
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to delete transaction' }, { status: 500 });
    }
}
