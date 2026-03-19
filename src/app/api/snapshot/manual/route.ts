import { NextResponse } from 'next/server';
import { repo } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, totalValue, allocations } = body;

        if (!date || totalValue === undefined) {
            return NextResponse.json({ error: 'Date and totalValue are required' }, { status: 400 });
        }

        repo.history.upsert({
            date,
            totalValue,
            snapshotValue: totalValue,
            manualAdjustment: 0,
            exchangeRate: 1350, // Default or placeholder
            holdings: [], 
            allocations: allocations || [],
            meta: { domesticSettled: true, overseasSettled: true } // Manual entries are considered settled
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Manual snapshot failed', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
