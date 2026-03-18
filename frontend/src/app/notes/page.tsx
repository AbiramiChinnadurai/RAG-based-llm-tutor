'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/lib/auth'

export default function NotesPage() {
    const { uid, profile } = useAuth()
    const [notes, setNotes] = useState<{ id: string; subject: string; topic: string; content: string; created_at: string }[]>([])
    const [subject, setSubject] = useState('')
    const [topic, setTopic] = useState('')
    const [content, setContent] = useState('')
    const [search, setSearch] = useState('')

    const subjects = profile?.subjects_list ?? []

    // Load notes from localStorage (no backend endpoint needed)
    useEffect(() => {
        if (!uid) return
        const stored = localStorage.getItem(`notes_${uid}`)
        if (stored) setNotes(JSON.parse(stored))
        if (subjects.length) setSubject(subjects[0])
    }, [uid])

    const save = (updated: typeof notes) => {
        setNotes(updated)
        localStorage.setItem(`notes_${uid}`, JSON.stringify(updated))
    }

    const addNote = () => {
        if (!content.trim()) return
        const note = {
            id: Date.now().toString(),
            subject, topic, content,
            created_at: new Date().toLocaleString(),
        }
        save([note, ...notes])
        setContent('')
        setTopic('')
    }

    const deleteNote = (id: string) => save(notes.filter(n => n.id !== id))

    const filtered = notes.filter(n =>
        n.content.toLowerCase().includes(search.toLowerCase()) ||
        n.subject.toLowerCase().includes(search.toLowerCase()) ||
        n.topic.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <AppLayout>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Notes</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Your personal study notes</p>

                {/* Add note */}
                <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>✏️ New Note</div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <select className="input" style={{ width: 'auto' }} value={subject} onChange={e => setSubject(e.target.value)}>
                            {subjects.map(s => <option key={s}>{s}</option>)}
                        </select>
                        <input className="input" style={{ width: 'auto', flex: 1 }} placeholder="Topic (optional)" value={topic} onChange={e => setTopic(e.target.value)} />
                    </div>
                    <textarea
                        className="input"
                        rows={4}
                        style={{ resize: 'none', marginBottom: '12px' }}
                        placeholder="Write your note here..."
                        value={content}
                        onChange={e => setContent(e.target.value)}
                    />
                    <button className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={addNote} disabled={!content.trim()}>
                        Save Note
                    </button>
                </div>

                {/* Search */}
                <input
                    className="input"
                    placeholder="🔍 Search notes..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ marginBottom: '20px' }}
                />

                {/* Notes list */}
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px' }}>
                        {notes.length === 0 ? 'No notes yet — add your first one!' : 'No notes match your search'}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filtered.map(n => (
                            <div key={n.id} className="card" style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <span className="badge badge-green">{n.subject}</span>
                                        {n.topic && <span className="badge badge-blue" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>{n.topic}</span>}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{n.created_at}</span>
                                        <button onClick={() => deleteNote(n.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '16px' }}>×</button>
                                    </div>
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{n.content}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}