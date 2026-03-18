'use client'
import { useState, useEffect } from 'react'
import AppLayout from '../../components/AppLayout'
import { useAuth } from '../../lib/auth'
import { api } from '../../lib/api'

interface Day {
    day_number: number
    day_label: string
    content: string
    status: 'pending' | 'completed' | 'skipped'
}

export default function RoadmapPage() {
    const { uid, profile } = useAuth()
    const [days, setDays] = useState<Day[]>([])
    const [planText, setPlanText] = useState('')
    const [planId, setPlanId] = useState<string | null>(null)
    const [stats, setStats] = useState<any>(null)
    const [generating, setGenerating] = useState(false)
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<number | null>(null)
    const [message, setMessage] = useState('')

    const loadPlan = async () => {
        if (!uid) return
        try {
            const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'
            const res = await fetch(`${BASE}/api/plan/${uid}`)
            if (res.ok) {
                const data = await res.json()
                setPlanText(data.plan_text)
                setPlanId(data.plan_id)
                setDays(data.days || parseDays(data.plan_text))
            }
        } catch { }
        finally { setLoading(false) }
    }

    const loadStats = async () => {
        if (!uid) return
        try { const s = await api.profile.stats(uid); setStats(s) } catch { }
    }

    useEffect(() => { loadPlan(); loadStats() }, [uid])

    const parseDays = (text: string): Day[] => {
        const matches = text.match(/(?:^|\n)\s*\*{0,2}(Day\s+\d+)\*{0,2}[:\-–]?\s*(.*?)(?=\n\s*\*{0,2}Day\s+\d+|$)/gi)
        if (matches) {
            return matches.map((m, i) => {
                const lines = m.trim().split('\n')
                return { day_number: i + 1, day_label: `Day ${i + 1}`, content: lines.slice(1).join('\n').trim() || lines[0], status: 'pending' }
            })
        }
        const lines = text.split('\n').filter(l => l.trim())
        const size = Math.max(3, Math.floor(lines.length / 7))
        return Array.from({ length: Math.ceil(lines.length / size) }, (_, i) => ({
            day_number: i + 1, day_label: `Day ${i + 1}`,
            content: lines.slice(i * size, (i + 1) * size).join('\n'),
            status: 'pending' as const,
        }))
    }

    const generate = async () => {
        setGenerating(true); setMessage('')
        try {
            const res = await api.plan.generate(uid!)
            setPlanText(res.plan)
            const parsed = parseDays(res.plan)
            setDays(parsed)
            setMessage('✅ Roadmap generated based on your performance!')
            await loadPlan()
        } catch (e: any) { setMessage('❌ ' + e.message) }
        finally { setGenerating(false) }
    }

    const updateStatus = async (dayNum: number, status: 'completed' | 'skipped' | 'pending') => {
        const updated = days.map(d => d.day_number === dayNum ? { ...d, status } : d)
        setDays(updated)
        try {
            const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'
            await fetch(`${BASE}/api/plan/${uid}/day/${dayNum}/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })
            if (status === 'completed') { setMessage('🎉 +20 XP earned!'); setTimeout(() => setMessage(''), 3000) }
            await loadStats()
        } catch { }
    }

    const completed = days.filter(d => d.status === 'completed').length
    const skipped = days.filter(d => d.status === 'skipped').length
    const total = days.length
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0

    const strengthColor: any = { Strong: '#26b882', Moderate: '#fbbf24', Weak: '#f87171' }

    return (
        <AppLayout>
            <div style={{ maxWidth: '960px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Personalized</p>
                        <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Learning Roadmap</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
                            Generated from your quiz performance, weak topics, and mastery levels
                        </p>
                    </div>
                    <button
                        className="btn-primary"
                        style={{ width: 'auto', padding: '12px 24px', whiteSpace: 'nowrap' }}
                        onClick={generate}
                        disabled={generating}
                    >
                        {generating ? '⏳ Generating...' : planText ? '🔄 Regenerate' : '🤖 Generate Roadmap'}
                    </button>
                </div>

                {message && (
                    <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', background: message.startsWith('❌') ? 'rgba(239,68,68,0.1)' : 'rgba(13,150,104,0.1)', color: message.startsWith('❌') ? '#f87171' : 'var(--brand-light)', border: `1px solid ${message.startsWith('❌') ? 'rgba(239,68,68,0.2)' : 'rgba(13,150,104,0.2)'}` }}>
                        {message}
                    </div>
                )}

                {/* Stats row */}
                {stats && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                        {[
                            { label: 'Days Total', value: total, color: '#60a5fa' },
                            { label: 'Completed', value: completed, color: '#26b882' },
                            { label: 'Remaining', value: total - completed - skipped, color: '#fbbf24' },
                            { label: 'XP from Plan', value: `${completed * 20}`, color: '#f97316' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="card" style={{ padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: color }} />
                                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Progress bar */}
                {total > 0 && (
                    <div className="card" style={{ padding: '20px 24px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{completed} of {total} days completed</span>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--brand-light)' }}>{pct}%</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--bg-3)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--brand-dim), var(--brand-light))', borderRadius: '4px', transition: 'width 0.8s ease' }} />
                        </div>
                        {pct === 100 && <div style={{ marginTop: '10px', color: '#fbbf24', fontWeight: 700, fontSize: '14px' }}>🏆 Roadmap Complete! You're exam ready!</div>}
                        {pct >= 75 && pct < 100 && <div style={{ marginTop: '8px', color: '#f97316', fontSize: '13px' }}>🔥 Final stretch — almost there!</div>}
                        {pct >= 50 && pct < 75 && <div style={{ marginTop: '8px', color: '#fbbf24', fontSize: '13px' }}>⭐ Halfway done — keep the momentum!</div>}
                    </div>
                )}

                {/* Subject mastery sidebar */}
                {stats?.summaries?.length > 0 && (
                    <div className="card" style={{ padding: '20px 24px', marginBottom: '24px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>Current Mastery</div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {stats.summaries.map((s: any) => (
                                <div key={s.subject} style={{ padding: '10px 16px', borderRadius: '10px', background: 'var(--bg-2)', border: `1px solid ${strengthColor[s.strength_label]}44` }}>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.subject}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                        <span style={{ fontSize: '16px', fontWeight: 800, color: strengthColor[s.strength_label] }}>{s.avg_accuracy.toFixed(0)}%</span>
                                        <span style={{ fontSize: '11px', color: strengthColor[s.strength_label] }}>{s.strength_label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* No plan state */}
                {!loading && !planText && (
                    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🗺️</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>No roadmap yet</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
                            Complete some quizzes first, then generate your personalized roadmap based on your performance.
                        </div>
                        <button className="btn-primary" style={{ width: 'auto', padding: '12px 32px' }} onClick={generate} disabled={generating}>
                            {generating ? '⏳ Generating...' : '🤖 Generate My Roadmap'}
                        </button>
                    </div>
                )}

                {/* Day cards */}
                {days.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {days.map((day, idx) => {
                            const isActive = day.status === 'pending' && days.slice(0, idx).every(d => d.status !== 'pending')
                            const isExpanded = expanded === day.day_number

                            // Milestone markers
                            const milestones: Record<number, string> = {}
                            if (total > 0) {
                                milestones[Math.round(total * 0.25)] = '🚩 25% Milestone'
                                milestones[Math.round(total * 0.50)] = '⭐ Halfway Point'
                                milestones[Math.round(total * 0.75)] = '🔥 Final Stretch'
                                milestones[total] = '🏆 Exam Ready!'
                            }

                            return (
                                <div key={day.day_number}>
                                    {milestones[day.day_number] && (
                                        <div style={{ textAlign: 'center', padding: '8px', fontSize: '12px', color: '#fbbf24', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
                                            {milestones[day.day_number]}
                                        </div>
                                    )}
                                    <div
                                        className="card"
                                        style={{
                                            padding: '0',
                                            border: isActive ? '1px solid var(--brand)' : day.status === 'completed' ? '1px solid rgba(13,150,104,0.3)' : day.status === 'skipped' ? '1px solid rgba(100,100,100,0.2)' : '1px solid var(--border)',
                                            opacity: day.status === 'skipped' ? 0.6 : 1,
                                        }}
                                    >
                                        {/* Day header */}
                                        <div
                                            onClick={() => setExpanded(isExpanded ? null : day.day_number)}
                                            style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}
                                        >
                                            {/* Status circle */}
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                                                background: day.status === 'completed' ? 'var(--brand)' : day.status === 'skipped' ? 'var(--bg-3)' : isActive ? 'rgba(13,150,104,0.15)' : 'var(--bg-2)',
                                                border: `2px solid ${day.status === 'completed' ? 'var(--brand)' : day.status === 'skipped' ? 'var(--bg-3)' : isActive ? 'var(--brand)' : 'var(--border)'}`,
                                                color: day.status === 'completed' ? '#fff' : 'var(--text-muted)',
                                            }}>
                                                {day.status === 'completed' ? '✓' : day.status === 'skipped' ? '–' : day.day_number}
                                            </div>

                                            {/* Label */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{day.day_label}</span>
                                                    {isActive && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(13,150,104,0.15)', color: 'var(--brand-light)', border: '1px solid rgba(13,150,104,0.3)', fontWeight: 600 }}>TODAY</span>}
                                                    {day.status === 'completed' && <span style={{ fontSize: '10px', color: 'var(--brand-light)' }}>+20 XP</span>}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    {day.content.split('\n')[0].replace(/[*#-]/g, '').trim().slice(0, 80)}...
                                                </div>
                                            </div>

                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{isExpanded ? '▲' : '▼'}</span>
                                        </div>

                                        {/* Expanded content */}
                                        {isExpanded && (
                                            <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
                                                <div style={{ paddingTop: '16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                                    {day.content.replace(/\*\*/g, '').replace(/#{1,3}\s/g, '')}
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                                    {day.status !== 'completed' && (
                                                        <button
                                                            onClick={() => updateStatus(day.day_number, 'completed')}
                                                            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--brand)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                                        >
                                                            ✓ Mark Complete
                                                        </button>
                                                    )}
                                                    {day.status !== 'skipped' && day.status !== 'completed' && (
                                                        <button
                                                            onClick={() => updateStatus(day.day_number, 'skipped')}
                                                            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                                        >
                                                            Skip
                                                        </button>
                                                    )}
                                                    {day.status !== 'pending' && (
                                                        <button
                                                            onClick={() => updateStatus(day.day_number, 'pending')}
                                                            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                                        >
                                                            ↩ Undo
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}