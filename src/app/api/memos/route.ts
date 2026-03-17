import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export async function GET() {
    try {
        const memos = db.prepare('SELECT * FROM memos ORDER BY date DESC').all();
        return NextResponse.json(memos);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { title, content } = body;
        
        if (!title || !content) {
            return NextResponse.json({ error: 'Title and content required' }, { status: 400 });
        }

        const id = crypto.randomUUID();
        const date = new Date().toISOString();

        db.prepare('INSERT INTO memos (id, title, content, date) VALUES (?, ?, ?, ?)')
          .run(id, title, content, date);

        const newMemo = db.prepare('SELECT * FROM memos WHERE id = ?').get(id);
        
        return NextResponse.json(newMemo);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
