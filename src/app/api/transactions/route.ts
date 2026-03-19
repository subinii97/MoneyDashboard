import { NextResponse } from 'next/server';
import { repo } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        if (date) {
            const transactions = repo.transactions.getByDate(date);
            return NextResponse.json(transactions);
        }

        const transactions = repo.transactions.getAll();
        return NextResponse.json(transactions);
    } catch (error) {
        console.error('Failed to fetch transactions:', error);
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        const tx = await request.json();
        repo.transactions.save(tx);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save transaction:', error);
        return NextResponse.json({ success: false, error: 'Failed to save transaction' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        repo.transactions.delete(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete transaction:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete transaction' }, { status: 500 });
    }
}
