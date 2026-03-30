'use client'
import { useState, useEffect, useRef } from 'react'
import AppLayout from '../../components/AppLayout'
import { useAuth } from '../../lib/auth'
import { api } from '../../lib/api'

export default function SubjectsPage() {
    const { uid } = useAuth()
    const [subjects, setSubjects] = useState<any[]>([])
    const [newSubject, setNewSubject] = useState('')
    const [uploading, setUploading] = useState<string | null>(null)
    const [message, setMessage] = useState<{ text: string; type: 'ok' | 'err' } | null>(null)
    const [editingName, setEditingName] = useState<string | null>(null)
    const [editVal, setEditVal] = useState('')
    const [metaInputs, setMetaInputs] = useState<Record<string, { deadline: string; purpose: string }>>({})
    const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

    const load = () => { if (uid) api.subjects.list(uid).then(setSubjects).catch(console.error) }
    useEffect(() => { load() }, [uid])

    const addSubject = async () => {
        if (!uid) { setMessage({ text: 'Error: Not logged in', type: 'err' }); return }
        const name = newSubject.trim()
        if (!name) return
        if (subjects.find(s => s.name.toLowerCase() === name.toLowerCase())) {
            setMessage({ text: 'Subject already exists', type: 'err' }); return
        }
        const updated = [...subjects, { name, index_ready: false, topics: [] }]
        setSubjects(updated)
        setNewSubject('')

        // Sync to backend so sidebar picks it up
        try {
            await api.subjects.update(uid!, updated.map(s => s.name))
        } catch (e: any) {
            console.error("Sync failed", e)
            const detail = e.response?.data?.detail || e.message || JSON.stringify(e)
            setMessage({ text: 'Sync failed: ' + detail, type: 'err' })
        }
    }

    const removeSubject = async (name: string) => {
        if (!uid) return
        const updated = subjects.filter(x => x.name !== name)
        setSubjects(updated)
        setMessage({ text: `"${name}" removed`, type: 'ok' })
        try {
            await api.subjects.update(uid!, updated.map(s => s.name))
        } catch (e: any) {
            console.error("Sync failed", e)
            const detail = e.response?.data?.detail || e.message || JSON.stringify(e)
            setMessage({ text: 'Sync failed: ' + detail, type: 'err' })
        }
    }

    const handleUpload = async (subject: string, file: File) => {
        const meta = metaInputs[subject] || { deadline: '', purpose: '' }
        setUploading(subject); setMessage(null)
        try {
            const res = await api.subjects.upload(uid!, subject, file, meta.deadline, meta.purpose)
            const msg = res.message || `✅ Indexing started in background!`
            setMessage({ text: msg, type: 'ok' })
            load()
        } catch (e: any) {
            setMessage({ text: '❌ ' + e.message, type: 'err' })
        } finally { setUploading(null) }
    }

    const saveEdit = (oldName: string) => {
        const newName = editVal.trim()
        if (!newName || newName === oldName) { setEditingName(null); return }
        setSubjects(s => s.map(x => x.name === oldName ? { ...x, name: newName } : x))
        setEditingName(null)
        setMessage({ text: `Renamed to "${newName}"`, type: 'ok' })
    }

    return (
        <AppLayout>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ marginBottom: '32px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Manage</p>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Subjects</h1>
                </div>

                {/* Add subject */}
                <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>Add New Subject</div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            className="input"
                            placeholder="e.g. Data Structures, Thermodynamics..."
                            value={newSubject}
                            onChange={e => setNewSubject(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addSubject()}
                        />
                        <button
                            className="btn-primary"
                            style={{ width: 'auto', padding: '10px 24px', whiteSpace: 'nowrap' }}
                            onClick={addSubject}
                            disabled={!newSubject.trim()}
                        >
                            + Add
                        </button>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', background: message.type === 'ok' ? 'rgba(13,150,104,0.1)' : 'rgba(239,68,68,0.1)', color: message.type === 'ok' ? 'var(--brand-light)' : '#f87171', border: `1px solid ${message.type === 'ok' ? 'rgba(13,150,104,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                        {message.text}
                    </div>
                )}

                {/* Subjects list */}
                {subjects.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                        No subjects yet — add your first one above!
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {subjects.map(s => (
                            <div key={s.name} className="card" style={{ padding: '20px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>

                                    {/* Name / edit */}
                                    <div style={{ flex: 1 }}>
                                        {editingName === s.name ? (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    className="input"
                                                    value={editVal}
                                                    onChange={e => setEditVal(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(s.name); if (e.key === 'Escape') setEditingName(null) }}
                                                    autoFocus
                                                    style={{ maxWidth: '260px' }}
                                                />
                                                <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }} onClick={() => saveEdit(s.name)}>Save</button>
                                                <button onClick={() => setEditingName(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
                                                    <span className={`badge ${s.index_ready ? 'badge-green' : 'badge-amber'}`}>
                                                        {s.index_ready ? '✓ Indexed' : 'No PDF'}
                                                    </span>
                                                    {s.topics?.length > 0 && (
                                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.topics.length} topics</span>
                                                    )}
                                                </div>
                                                
                                                {/* Metadata Inputs */}
                                                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Target Deadline</div>
                                                        <input 
                                                            className="input" 
                                                            placeholder="e.g. May 15th" 
                                                            style={{ padding: '6px 12px', fontSize: '12px' }}
                                                            value={metaInputs[s.name]?.deadline ?? s.deadline ?? ''}
                                                            onChange={e => setMetaInputs(m => ({ ...m, [s.name]: { ...(m[s.name] || { purpose: s.purpose || '' }), deadline: e.target.value } }))}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 2 }}>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Learning Purpose</div>
                                                        <input 
                                                            className="input" 
                                                            placeholder="e.g. Master algorithms for interviews" 
                                                            style={{ padding: '6px 12px', fontSize: '12px' }}
                                                            value={metaInputs[s.name]?.purpose ?? s.purpose ?? ''}
                                                            onChange={e => setMetaInputs(m => ({ ...m, [s.name]: { ...(m[s.name] || { deadline: s.deadline || '' }), purpose: e.target.value } }))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {editingName !== s.name && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {/* Upload / Re-upload PDF */}
                                            <input
                                                type="file"
                                                accept=".pdf"
                                                style={{ display: 'none' }}
                                                ref={el => { fileRefs.current[s.name] = el }}
                                                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(s.name, f); e.target.value = '' }}
                                            />
                                            <button
                                                onClick={() => fileRefs.current[s.name]?.click()}
                                                disabled={uploading === s.name || s.indexing}
                                                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                                            >
                                                {uploading === s.name || s.indexing ? '⏳ Indexing...' : s.index_ready ? '🔄 Re-upload PDF' : '📄 Upload PDF'}
                                            </button>

                                            {/* Edit name */}
                                            <button
                                                onClick={() => { setEditingName(s.name); setEditVal(s.name) }}
                                                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                ✏️ Edit
                                            </button>

                                            {/* Remove */}
                                            <button
                                                onClick={() => removeSubject(s.name)}
                                                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                🗑 Remove
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Topics preview */}
                                {s.topics?.length > 0 && (
                                    <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {s.topics.slice(0, 8).map((t: string) => (
                                            <span key={t} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', background: 'var(--bg-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{t}</span>
                                        ))}
                                        {s.topics.length > 8 && <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '3px 6px' }}>+{s.topics.length - 8} more</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}