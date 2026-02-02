import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data/assets.json');

export async function GET() {
    try {
        const data = await fs.readFile(DATA_PATH, 'utf8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        return NextResponse.json({ investments: [], allocations: [] }, { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        const newData = await request.json();
        await fs.writeFile(DATA_PATH, JSON.stringify(newData, null, 2));
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to save data' }, { status: 500 });
    }
}
