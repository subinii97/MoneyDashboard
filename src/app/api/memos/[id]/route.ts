import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const id = resolvedParams.id;
        const body = await req.json();
        const { title, content } = body;

        if (!id || !title || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const date = new Date().toISOString();
        const result = db.prepare('UPDATE memos SET title = ?, content = ?, date = ? WHERE id = ?').run(title, content, date, id);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Memo not found' }, { status: 404 });
        }

        const updatedMemo = db.prepare('SELECT * FROM memos WHERE id = ?').get(id);
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
        const resolvedParams = await params;
        const id = resolvedParams.id;
        if (!id) {
            return NextResponse.json({ error: 'Memo ID required' }, { status: 400 });
        }

        const result = db.prepare('DELETE FROM memos WHERE id = ?').run(id);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Memo not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
