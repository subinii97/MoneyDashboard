import { NextResponse } from 'next/server';
import { repo } from '@/lib/db';

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { title, content } = body;

        if (!id || !title || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const date = new Date().toISOString();
        repo.memos.save({ id, title, content, date });

        const updatedMemo = repo.memos.getById(id);
        if (!updatedMemo) {
            return NextResponse.json({ error: 'Memo not found' }, { status: 404 });
        }
        
        return NextResponse.json(updatedMemo);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Memo ID required' }, { status: 400 });
        }

        repo.memos.delete(id);
        return NextResponse.json({ success: true, id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
