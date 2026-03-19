import { NextResponse } from 'next/server';
import { repo } from '@/lib/db';

export async function GET() {
    try {
        const investments = repo.investments.getAll();
        const allocations = repo.allocations.getAll();
        return NextResponse.json({ investments, allocations });
    } catch (error) {
        console.error('Failed to fetch assets:', error);
        return NextResponse.json({ investments: [], allocations: [] }, { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        const { investments, allocations } = await request.json();

        if (investments) {
            repo.investments.saveAll(investments);
        }
        if (allocations) {
            repo.allocations.saveAll(allocations);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save assets:', error);
        return NextResponse.json({ success: false, error: 'Failed to save data' }, { status: 500 });
    }
}
