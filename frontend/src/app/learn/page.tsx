'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import AppLayout from '../../components/AppLayout'
import { useAuth } from '../../lib/auth'
import { api } from '../../lib/api'

function formatMessage(text: string): string {
    const parts = text.split(/(```[\s\S]*?```)/g)
    return parts.map(part => {
        if (part.startsWith('```')) {
            const code = part.replace(/^```\w*\n?/, '').replace(/```$/, '')
            return `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
        }
        return part
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br/>')
    }).join('')
}

const EMOTION_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
    frustration: { emoji: '😤', color: '#f87171', bg: 'rgba(239,68,68,0.1)' },
    confusion: { emoji: '😕', color: '#fbbf24', bg: 'rgba(245,158,11,0.1)' },
    anxiety: { emoji: '😰', color: '#c084fc', bg: 'rgba(192,132,252,0.1)' },
    boredom: { emoji: '😐', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
    confidence: { emoji: '😊', color: '#26b882', bg: 'rgba(13,150,104,0.1)' },
    neutral: { emoji: '😶', color: '#7a9980', bg: 'rgba(122,153,128,0.08)' },
}

const MODALITY_LABELS: Record<number, string> = {
    0: 'Standard',
    1: 'Step-by-Step',
    2: 'Analogy',
    3: 'Worked Example',
    4: 'Simplified',
}

export default function SubjectLearnPage() {
    const { uid } = useAuth()
    const params = useParams()
    const subject = decodeURIComponent(params.subject as string)

    const [topics, setTopics] = useState<string[]>([])
    const [topic, setTopic] = useState('')
    const [tab, setTab] = useState<'chat' | 'quiz'>('chat')

    useEffect(() => {
        if (!uid) return
        api.subjects.list(uid).then(subjects => {
            const found = subjects.find(s => s.name === subject)
            if (found?.topics?.length) {
                setTopics(found.topics)
                setTopic(found.topics[0])
            }
        })
    }, [uid, subject])

    return (
        <AppLayout>
            <div style={{ maxWidth: '960px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: '24px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Learning</p>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{subject}</h1>
                </div>

                {/* Topic pills */}
                {topics.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Topic</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {topics.map(t => (
                                <button key={t} onClick={() => setTopic(t)} style={{
                                    padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                    fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                                    background: topic === t ? 'var(--brand)' : 'var(--bg-2)',
                                    color: topic === t ? '#fff' : 'var(--text-secondary)',
                                }}>
                                    {t.length > 40 ? t.slice(0, 40) + '…' : t}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--bg-2)', borderRadius: '10px', marginBottom: '24px', width: 'fit-content' }}>
                    {(['chat', 'quiz'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: '8px 28px', borderRadius: '8px', border: 'none',
                            fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                            background: tab === t ? 'var(--brand)' : 'transparent',
                            color: tab === t ? '#fff' : 'var(--text-muted)',
                        }}>
                            {t === 'chat' ? '💬 Chat' : '🧠 Quiz'}
                        </button>
                    ))}
                </div>

                {!topic && (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                        No topics found. Upload a syllabus PDF in the Subjects page first.
                    </div>
                )}

                {topic && tab === 'chat' && <ChatPanel uid={uid!} subject={subject} topic={topic} />}
                {topic && tab === 'quiz' && <QuizPanel uid={uid!} subject={subject} topic={topic} />}
            </div>
        </AppLayout>
    )
}

function ChatPanel({ uid, subject, topic }: { uid: string; subject: string; topic: string }) {
    const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
    useEffect(() => { setMessages([]) }, [topic])

    const send = async () => {
        if (!input.trim() || loading) return
        const query = input.trim()
        setInput('')
        setMessages(m => [...m, { role: 'user', text: query }, { role: 'ai', text: '' }])
        setLoading(true)
        try {
            const res = await api.chat.stream({ uid, subject, query, history: [] })
            const reader = res.body!.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const data = JSON.parse(line.slice(6))
                        if (data.type === 'token') {
                            setMessages(m => {
                                const u = [...m]
                                u[u.length - 1] = { role: 'ai', text: u[u.length - 1].text + data.text }
                                return u
                            })
                        }
                    } catch { }
                }
            }
        } catch (e: any) {
            setMessages(m => { const u = [...m]; u[u.length - 1] = { role: 'ai', text: 'Error: ' + e.message }; return u })
        } finally { setLoading(false) }
    }

    return (
        <div>
            <div className="card" style={{ padding: '20px', minHeight: '420px', maxHeight: '520px', overflowY: 'auto', marginBottom: '12px' }}>
                {messages.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '100px', fontSize: '14px' }}>
                        Ask anything about <strong style={{ color: 'var(--text-secondary)' }}>{topic}</strong>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} style={{ marginBottom: '16px', display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div className={m.role === 'ai' ? 'chat-ai' : ''} style={{
                            maxWidth: '80%', padding: '12px 16px', borderRadius: '12px',
                            fontSize: '14px', lineHeight: 1.7,
                            background: m.role === 'user' ? 'var(--brand)' : 'var(--bg-2)',
                            color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                            borderBottomRightRadius: m.role === 'user' ? '4px' : '12px',
                            borderBottomLeftRadius: m.role === 'ai' ? '4px' : '12px',
                        }}>
                            {m.role === 'ai' && m.text ? (
                                <div dangerouslySetInnerHTML={{ __html: formatMessage(m.text) }} />
                            ) : (
                                m.text || (loading && i === messages.length - 1 ? '▋' : '')
                            )}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    className="input"
                    placeholder={`Ask about ${topic}...`}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    disabled={loading}
                />
                <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={send} disabled={loading || !input.trim()}>
                    {loading ? '...' : 'Send'}
                </button>
            </div>
        </div>
    )
}

// ── Quiz Panel (unchanged) ────────────────────────────────────────────────────
function QuizPanel({ uid, subject, topic }: { uid: string; subject: string; topic: string }) {
    const [question, setQuestion] = useState<any>(null)
    const [selected, setSelected] = useState<number | null>(null)
    const [submitted, setSubmitted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [score, setScore] = useState({ correct: 0, total: 0 })

    useEffect(() => { setQuestion(null); setSelected(null); setSubmitted(false) }, [topic])

    const loadQuestion = async () => {
        setLoading(true); setSelected(null); setSubmitted(false)
        try {
            const q = await api.quiz.generate({ uid, subject, topic, previous_questions: [] })
            setQuestion(q)
        } catch (e: any) { alert(e.message) }
        finally { setLoading(false) }
    }

    const submit = async () => {
        if (selected === null || !question) return
        const correct = selected === question.correct_index
        setSubmitted(true)
        setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }))
        await api.quiz.submit({ uid, subject, topic, question: question.question, selected_index: selected, correct_index: question.correct_index, is_correct: correct })
    }

    return (
        <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <span className="badge badge-green">✓ {score.correct} correct</span>
                <span className="badge badge-amber">Total: {score.total}</span>
            </div>

            {!question ? (
                <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
                    <div style={{ fontSize: '40px', marginBottom: '16px' }}>🧠</div>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '14px' }}>
                        Ready to test your knowledge on <strong style={{ color: 'var(--text-secondary)' }}>{topic}</strong>?
                    </p>
                    <button className="btn-primary" style={{ width: 'auto', padding: '10px 32px' }} onClick={loadQuestion} disabled={loading}>
                        {loading ? 'Generating...' : 'Start Quiz →'}
                    </button>
                </div>
            ) : (
                <div className="card" style={{ padding: '28px' }}>
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px', fontSize: '15px', lineHeight: 1.6 }}>{question.question}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                        {question.options.map((opt: string, i: number) => {
                            let bg = 'var(--bg-2)', border = 'var(--border)', color = 'var(--text-primary)'
                            if (submitted) {
                                if (i === question.correct_index) { bg = 'rgba(13,150,104,0.15)'; border = 'var(--brand)'; color = 'var(--brand-light)' }
                                else if (i === selected) { bg = 'rgba(239,68,68,0.1)'; border = '#ef4444'; color = '#f87171' }
                            } else if (i === selected) { bg = 'rgba(13,150,104,0.1)'; border = 'var(--brand)' }
                            return (
                                <button key={i} onClick={() => !submitted && setSelected(i)} style={{
                                    padding: '12px 16px', borderRadius: '8px', border: `1px solid ${border}`,
                                    background: bg, color, fontSize: '14px', textAlign: 'left',
                                    cursor: submitted ? 'default' : 'pointer', transition: 'all 0.15s', lineHeight: 1.5,
                                }}>
                                    {opt}
                                </button>
                            )
                        })}
                    </div>
                    {submitted && (
                        <div style={{ padding: '14px', background: 'var(--bg-2)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            💡 {question.explanation}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {!submitted
                            ? <button className="btn-primary" style={{ width: 'auto', padding: '10px 28px' }} onClick={submit} disabled={selected === null}>Submit</button>
                            : <button className="btn-primary" style={{ width: 'auto', padding: '10px 28px' }} onClick={loadQuestion} disabled={loading}>Next →</button>
                        }
                    </div>
                </div>
            )}
        </div>
    )
}