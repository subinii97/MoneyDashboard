import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';

interface Memo {
    id: string;
    title: string;
    content: string;
    date: string;
}

interface MemoPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export function MemoPanel({ isOpen, onClose }: MemoPanelProps) {
    const [memos, setMemos] = useState<Memo[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchMemos();
        }
    }, [isOpen]);

    const fetchMemos = async () => {
        try {
            const res = await fetch('/api/memos');
            if (res.ok) {
                const data = await res.json();
                setMemos(data);
            }
        } catch (e) {
            console.error('Failed to fetch memos', e);
        }
    };

    const handleCreate = async () => {
        if (!title.trim() || !content.trim()) return;

        try {
            const res = await fetch('/api/memos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });

            if (res.ok) {
                const newMemo = await res.json();
                setMemos([newMemo, ...memos]);
                setIsCreating(false);
                setTitle('');
                setContent('');
            }
        } catch (e) {
            console.error('Failed to create memo', e);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const res = await fetch(`/api/memos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMemos(memos.filter(m => m.id !== id));
            }
        } catch (e) {
            console.error('Failed to delete memo', e);
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editTitle.trim() || !editContent.trim()) return;

        try {
            const res = await fetch(`/api/memos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: editTitle, content: editContent })
            });

            if (res.ok) {
                const updatedMemo = await res.json();
                setMemos(memos.map(m => m.id === id ? updatedMemo : m));
                setEditingId(null);
            }
        } catch (e) {
            console.error('Failed to update memo', e);
        }
    };

    const startEditing = (memo: Memo, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(memo.id);
        setEditTitle(memo.title);
        setEditContent(memo.content);
        setExpandedId(memo.id);
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const toggleExpand = (id: string) => {
        setExpandedId(prev => (prev === id ? null : id));
    };

    return (
        <div 
            style={{ 
                position: 'fixed', 
                top: 0, 
                right: isOpen ? 0 : '-400px', 
                width: '400px', 
                height: '100vh', 
                backgroundColor: 'var(--background)', 
                borderLeft: '1px solid var(--border)', 
                transition: 'right 0.3s ease', 
                zIndex: 100, 
                display: 'flex', 
                flexDirection: 'column',
                boxShadow: isOpen ? '-5px 0 15px rgba(0,0,0,0.1)' : 'none'
            }}
            className="glass"
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>메모</h2>
                <button onClick={onClose} style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'var(--foreground)' }}>
                    <X size={24} />
                </button>
            </div>

            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                {!isCreating ? (
                    <button 
                        onClick={() => setIsCreating(true)}
                        className="glass"
                        style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--primary)', cursor: 'pointer', fontWeight: '500' }}
                    >
                        <Plus size={18} /> 새 메모 작성
                    </button>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <input 
                            placeholder="제목을 입력하세요" 
                            style={{ padding: '0.5rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.9rem' }}
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            autoFocus
                        />
                        <textarea 
                            placeholder="내용을 입력하세요" 
                            style={{ padding: '0.5rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', minHeight: '80px', resize: 'vertical', fontSize: '0.9rem' }}
                            value={content}
                            onChange={e => setContent(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                            <button 
                                onClick={() => { setIsCreating(false); setTitle(''); setContent(''); }}
                                style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--foreground)', fontSize: '0.85rem' }}
                            >
                                취소
                            </button>
                            <button 
                                onClick={handleCreate}
                                style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}
                            >
                                저장
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {memos.length === 0 && !isCreating && (
                    <p style={{ textAlign: 'center', color: 'var(--muted)', marginTop: '2rem' }}>저장된 메모가 없습니다.</p>
                )}
                {memos.map(memo => (
                    <div key={memo.id} className="glass" style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <div 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => {
                                if (editingId !== memo.id) {
                                    toggleExpand(memo.id);
                                }
                            }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600' }}>
                                    {expandedId === memo.id ? <ChevronDown size={16} style={{ flexShrink: 0 }} /> : <ChevronRight size={16} style={{ flexShrink: 0 }} />}
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{memo.title}</span>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '1.4rem' }}>
                                    {formatDate(memo.date)}
                                </span>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                                <button 
                                    onClick={(e) => startEditing(memo, e)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
                                    title="수정"
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button 
                                    onClick={(e) => handleDelete(memo.id, e)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
                                    title="삭제"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        {expandedId === memo.id && (
                            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)' }}>
                                {editingId === memo.id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <input 
                                            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.9rem' }}
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                        />
                                        <textarea 
                                            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', minHeight: '60px', resize: 'vertical', fontSize: '0.9rem' }}
                                            value={editContent}
                                            onChange={e => setEditContent(e.target.value)}
                                        />
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                                            <button 
                                                onClick={() => setEditingId(null)}
                                                style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--foreground)', fontSize: '0.8rem' }}
                                            >
                                                취소
                                            </button>
                                            <button 
                                                onClick={() => handleUpdate(memo.id)}
                                                style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: '500', fontSize: '0.8rem' }}
                                            >
                                                완료
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: 'var(--muted)', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                        {memo.content}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
