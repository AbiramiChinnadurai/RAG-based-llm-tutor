'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import ReactMarkdown from 'react-markdown'

export default function SubjectLearnPage() {
    const { uid } = useAuth()
    const params = useParams()
    const subject = decodeURIComponent(params.subject as string)

    const [topics, setTopics] = useState<string[]>([])
    const [topic, setTopic] = useState('')
    const [tab, setTab] = useState<'chat' | 'quiz' | 'practice'>('chat')
    const [isLoadingTopics, setIsLoadingTopics] = useState(true)

    const isCode = /python|java|dsa|data structure|algorithm|programming|code|c\+\+|javascript/i.test(subject)

    const [roadmapOpen, setRoadmapOpen] = useState(false)
    const [roadmapPct, setRoadmapPct] = useState<number | null>(null)

    useEffect(() => {
        if (!uid) return
        
        // 1. Instant load from cache
        const cacheKey = `llmits_subjects_${uid}`
        try {
            const cached = localStorage.getItem(cacheKey)
            if (cached) {
                const subjects = JSON.parse(cached)
                const found = subjects.find((s: any) => s.name === subject)
                if (found?.topics?.length) {
                    setTopics(found.topics)
                    const lastTopic = localStorage.getItem(`last_topic_${uid}_${subject}`)
                    setTopic(lastTopic && found.topics.includes(lastTopic) ? lastTopic : found.topics[0])
                    setIsLoadingTopics(false)
                }
            }
        } catch (e) {}

        // 2. Fetch fresh in background
        api.subjects.list(uid).then(subjects => {
            const found = subjects.find(s => s.name === subject)
            if (found?.topics?.length) {
                setTopics(found.topics)
                if (!topic) {
                    const lastTopic = localStorage.getItem(`last_topic_${uid}_${subject}`)
                    setTopic(lastTopic && found.topics.includes(lastTopic) ? lastTopic : found.topics[0])
                }
            }
            setIsLoadingTopics(false)
        }).catch(() => setIsLoadingTopics(false))

        fetch(`http://127.0.0.1:8000/api/plan/${uid}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.days?.length > 0) {
                    const completed = data.days.filter((d: any) => d.status === 'completed').length
                    setRoadmapPct(Math.round((completed / data.days.length) * 100))
                }
            }).catch(() => {})
    }, [uid, subject])

    return (
        <AppLayout>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: '28px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Learning</p>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{subject}</h1>
                </div>

                {/* Topic selector */}
                {(isLoadingTopics && topics.length === 0) ? (
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Loading Topics...</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="shimmer" style={{ width: `${80 + (i % 3) * 20}px`, height: '32px', borderRadius: '20px' }} />
                            ))}
                        </div>
                    </div>
                ) : topics.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Topic</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {topics.map(t => (
                                <button
                                    key={t}
                                    onClick={() => {
                                        setTopic(t)
                                        localStorage.setItem(`last_topic_${uid}_${subject}`, t)
                                    }}
                                    style={{
                                        padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                        fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                                        background: topic === t ? 'var(--brand)' : 'var(--bg-2)',
                                        color: topic === t ? '#fff' : 'var(--text-secondary)',
                                    }}
                                >
                                    {t.length > 40 ? t.slice(0, 40) + '…' : t}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--bg-2)', borderRadius: '10px', marginBottom: '24px', width: 'fit-content' }}>
                    {(['chat', 'quiz', 'practice'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: '8px 28px', borderRadius: '8px', border: 'none',
                            fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                            background: tab === t ? 'var(--brand)' : 'transparent',
                            color: tab === t ? '#fff' : 'var(--text-muted)',
                        }}>
                            {t === 'chat' ? '💬 Chat' : t === 'quiz' ? '🧠 Quiz' : '✍️ Practice'}
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
                {topic && tab === 'practice' && <PracticePanel uid={uid!} subject={subject} topic={topic} mode={isCode ? 'code' : 'written'} />}

                {/* Floating Roadmap Button */}
                <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50 }}>
                    <button
                        onClick={() => setRoadmapOpen(true)}
                        title="View Roadmap"
                        style={{
                            width: '52px', height: '52px', borderRadius: '50%', background: 'var(--brand)',
                            color: '#fff', border: 'none', cursor: 'pointer', fontSize: '24px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'transform 0.2s',
                            position: 'relative'
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        🗺️
                        {roadmapPct !== null && (
                            <div style={{
                                position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444',
                                color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px',
                                borderRadius: '10px', border: '2px solid var(--bg-1)'
                            }}>
                                {roadmapPct}%
                            </div>
                        )}
                    </button>
                </div>
            </div>
            
            <RoadmapSlidePanel uid={uid!} open={roadmapOpen} onClose={() => setRoadmapOpen(false)} onUpdatePct={setRoadmapPct} />
        </AppLayout>
    )
}

// ── Practice Panel ────────────────────────────────────────────────────────────
function PracticePanel({ uid, subject, topic, mode }: { uid: string; subject: string; topic: string; mode: 'code' | 'written' }) {
    const [question, setQuestion] = useState<any>(null)
    const [answer, setAnswer] = useState('')
    const [feedback, setFeedback] = useState('')
    const [loading, setLoading] = useState(false)
    const [evaluating, setEvaluating] = useState(false)

    useEffect(() => { setQuestion(null); setAnswer(''); setFeedback(''); }, [topic])

    const loadQuestion = async () => {
        setLoading(true); setAnswer(''); setFeedback('')
        try {
            const q = await api.quiz.generate({ uid, subject, topic, previous_questions: [], type: mode })
            if (q.question) {
                setQuestion(q)
            } else {
                throw new Error("Failed to generate question.")
            }
        } catch (e: any) { alert(e.message) }
        finally { setLoading(false) }
    }

    const evaluate = async () => {
        if (!answer.trim() || !question || evaluating) return
        setEvaluating(true)
        setFeedback('')
        
        const query = `Evaluate my answer for this problem:\n\nPROBLEM:\n${question.question}\n\nMY ANSWER:\n${answer}\n\nProvide feedback and a score out of 10.`
        
        try {
            const res = await api.chat.stream({ uid, subject, query, history: [] })
            const reader = res.body!.getReader()
            if (!reader) throw new Error("Stream failed")
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
                            setFeedback(prev => prev + data.text)
                        }
                    } catch { }
                }
            }
        } catch (e: any) {
            setFeedback('Error: ' + e.message)
        } finally { setEvaluating(false) }
    }

    const editorStyle = mode === 'code' 
        ? { background: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace', padding: '16px', borderRadius: '8px', minHeight: '200px', border: '1px solid #333', width: '100%', resize: 'vertical' as const, fontSize: '14px', lineHeight: 1.5, }
        : { background: 'var(--bg-2)', color: 'var(--text-primary)', padding: '16px', borderRadius: '8px', minHeight: '150px', border: '1px solid var(--border)', width: '100%', resize: 'vertical' as const, fontSize: '14px', lineHeight: 1.5, }

    const mdComponents = {
        p: ({ node, ...props }: any) => <p style={{ margin: '0 0 8px 0' }} {...props} />,
        pre: ({ node, ...props }: any) => <pre style={{ background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '6px', overflowX: 'auto', margin: '8px 0', fontSize: '13px' }} {...props} />,
        code: ({ node, inline, className, ...props }: any) => (
            inline || !className ? (
                <code style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '4px', fontSize: '13px' }} {...props} />
            ) : (
                <code className={className} {...props} />
            )
        )
    };

    return (
        <div>
            {loading ? (
                <div className="card" style={{ padding: '28px' }}>
                    <div className="shimmer" style={{ height: '24px', width: '60%', marginBottom: '20px', borderRadius: '4px' }} />
                    <div className="shimmer" style={{ height: '150px', width: '100%', marginBottom: '16px', borderRadius: '8px' }} />
                    <div className="shimmer" style={{ height: '40px', width: '120px', borderRadius: '8px' }} />
                </div>
            ) : !question ? (
                <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
                    <div style={{ fontSize: '40px', marginBottom: '16px' }}>{mode === 'code' ? '💻' : '✍️'}</div>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '14px' }}>
                        Ready for a <strong style={{ color: 'var(--text-secondary)' }}>{mode === 'code' ? 'Coding Challenge' : 'Written Test'}</strong> on {topic}?
                    </p>
                    <button className="btn-primary" style={{ width: 'auto', padding: '10px 32px' }} onClick={loadQuestion} disabled={loading}>
                        {loading ? 'Generating...' : 'Start Practice →'}
                    </button>
                </div>
            ) : (
                <div className="card" style={{ padding: '28px' }}>
                    <div className="markdown-prose" style={{ marginBottom: '20px', fontSize: '15px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                        <ReactMarkdown components={mdComponents}>{question.question}</ReactMarkdown>
                    </div>
                    
                    <textarea 
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        placeholder={mode === 'code' ? "Write your code solution here..." : "Type your answer here..."}
                        style={editorStyle}
                        disabled={evaluating}
                    />
                    
                    <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                        <button className="btn-primary" style={{ width: 'auto', padding: '10px 28px' }} onClick={evaluate} disabled={!answer.trim() || evaluating}>
                            {evaluating ? 'Evaluating...' : (mode === 'code' ? 'Check Code' : 'Submit Answer')}
                        </button>
                        {(feedback || answer) && !evaluating && (
                            <button style={{ width: 'auto', padding: '10px 28px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }} onClick={loadQuestion}>
                                Next Problem →
                            </button>
                        )}
                    </div>

                    {feedback && (
                        <div style={{ marginTop: '24px', padding: '20px', background: 'rgba(13,150,104,0.05)', borderRadius: '8px', border: '1px solid rgba(13,150,104,0.2)' }}>
                            <h4 style={{ margin: '0 0 12px 0', color: 'var(--brand)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Feedback</h4>
                            <div className="markdown-prose" style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                                <ReactMarkdown components={mdComponents}>{feedback}</ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Chat Panel ────────────────────────────────────────────────────────────────
function ChatPanel({ uid, subject, topic }: { uid: string; subject: string; topic: string }) {
    const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [isThinking, setIsThinking] = useState(false)
    const [initialized, setInitialized] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Load history or generate intro
    useEffect(() => {
        setInitialized(false)
        setMessages([])
        
        const storageKey = `chat_${uid}_${subject}_${topic}`.replace(/ /g, '_')
        const cached = localStorage.getItem(storageKey)
        if (cached) {
            try {
                setMessages(JSON.parse(cached))
                setInitialized(true)
            } catch (e) {
                setInitialized(true)
            }
        } else {
            const introMsg = { role: 'ai' as const, text: '' }
            setMessages([introMsg])
            setLoading(true)
            
            const query = `Introduce me to ${topic} in ${subject}. Give me a brief overview and the key concept to understand first.`
            
            api.chat.stream({ uid, subject, query, history: [] }).then(async res => {
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
                                    u[0] = { role: 'ai', text: u[0].text + data.text }
                                    return u
                                })
                            }
                        } catch { }
                    }
                }
            }).catch(e => {
                setMessages([{ role: 'ai', text: 'Error generating intro: ' + e.message }])
            }).finally(() => {
                setLoading(false)
                setInitialized(true)
            })
        }
    }, [uid, subject, topic])

    // Save to local storage whenever messages change
    useEffect(() => {
        if (!initialized) return
        const storageKey = `chat_${uid}_${subject}_${topic}`.replace(/ /g, '_')
        let msgsToSave = messages
        if (msgsToSave.length > 50) {
            msgsToSave = msgsToSave.slice(msgsToSave.length - 50)
        }
        try {
            localStorage.setItem(storageKey, JSON.stringify(msgsToSave))
        } catch (e) {}
    }, [messages, initialized, uid, subject, topic])

    const clearChat = () => {
        const storageKey = `chat_${uid}_${subject}_${topic}`.replace(/ /g, '_')
        localStorage.removeItem(storageKey)
        setMessages([])
        setInitialized(false)
    }

    const send = async () => {
        if (!input.trim() || loading) return
        const query = input.trim()
        setInput('')

        const history: { student: string; tutor: string }[] = []
        let lastStudent = ''
        for (const m of messages) {
            if (m.role === 'user') lastStudent = m.text
            else if (m.role === 'ai' && lastStudent) {
                history.push({ student: lastStudent, tutor: m.text })
                lastStudent = ''
            }
        }

        let mState = [...messages, { role: 'user' as const, text: query }, { role: 'ai' as const, text: '' }]
        if (mState.length > 50) mState = mState.slice(mState.length - 50)
        setMessages(mState)
        setLoading(true)
        setIsThinking(true)

        try {
            const res = await api.chat.stream({ uid, subject, query, history })
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
                            setIsThinking(false)
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
        } finally { 
            setLoading(false)
            setIsThinking(false)
        }
    }

    const mdComponents = {
        p: ({ node, ...props }: any) => <p style={{ margin: '0 0 8px 0' }} {...props} />,
        pre: ({ node, ...props }: any) => <pre style={{ background: 'var(--bg-1)', padding: '14px', borderRadius: '10px', overflowX: 'auto', margin: '12px 0', fontSize: '13px', border: '1px solid var(--border)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)' }} {...props} />,
        code: ({ node, inline, className, ...props }: any) => (
            inline || !className ? (
                <code style={{ background: 'var(--bg-3)', padding: '2px 6px', borderRadius: '6px', fontSize: '13px', color: 'var(--brand-light)' }} {...props} />
            ) : (
                <code className={className} style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--brand-light)' }} {...props} />
            )
        )
    }

    return (
        <div className="animate-slide-up delay-1" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                <button onClick={clearChat} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#f87171'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                    ✕ Clear chat
                </button>
            </div>

            {/* Chat Container */}
            <div className="card" style={{ 
                padding: '24px', minHeight: '440px', maxHeight: '520px', overflowY: 'auto', marginBottom: '16px', position: 'relative',
                background: 'var(--bg-glass)', backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
                backgroundSize: '40px 40px', backgroundPosition: 'center'
            }}>
                {messages.length > 0 && (
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, background: 'var(--bg-2)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            Today
                        </span>
                    </div>
                )}
                
                {messages.map((m, i) => (
                    <div key={i} className="animate-slide-up" style={{ marginBottom: '24px', display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: '12px' }}>
                        
                        {/* AI Avatar */}
                        {m.role === 'ai' && (
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-dim), var(--brand))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#000', flexShrink: 0, boxShadow: '0 4px 12px rgba(0, 220, 130, 0.2)' }}>
                                AI
                            </div>
                        )}

                        {/* Message Bubble */}
                        <div className="markdown-prose" style={{
                            maxWidth: '75%', padding: '14px 20px', borderRadius: '16px', fontSize: '14px', lineHeight: 1.6,
                            background: m.role === 'user' ? 'linear-gradient(135deg, var(--brand-dim), var(--brand))' : 'var(--bg-glass)',
                            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                            color: m.role === 'user' ? '#000' : 'var(--text-primary)',
                            border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                            borderTopRightRadius: m.role === 'user' ? '4px' : '16px',
                            borderTopLeftRadius: m.role === 'ai' ? '4px' : '16px',
                            boxShadow: m.role === 'user' ? '0 8px 24px rgba(0, 220, 130, 0.2)' : '0 4px 16px rgba(0,0,0,0.2)',
                            overflowX: 'auto', fontWeight: m.role === 'user' ? 500 : 400
                        }}>
                            {m.text ? (
                                <ReactMarkdown components={mdComponents}>{m.text}</ReactMarkdown>
                            ) : null}
                            {isThinking && i === messages.length - 1 && !m.text && (
                                <div style={{ display: 'flex', gap: '4px', padding: '4px 0' }}>
                                    {[0, 1, 2].map(dot => (
                                        <div key={dot} style={{
                                            width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand-light)',
                                            animation: 'pulseGlow 1.2s infinite', animationDelay: `${dot * 0.2}s`
                                        }} />
                                    ))}
                                </div>
                            )}
                            {loading && !isThinking && i === messages.length - 1 && !m.text && (
                                <span style={{ display: 'inline-block', width: '8px', height: '16px', background: 'var(--brand-light)', animation: 'pulseGlow 1s infinite alternate', verticalAlign: 'middle', borderRadius: '2px' }} />
                            )}
                        </div>

                        {/* User Avatar */}
                        {m.role === 'user' && (
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                                You
                            </div>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-glass)', gap: '12px', boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.2)' }}>
                <input
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '15px', outline: 'none' }}
                    placeholder={`Ask the tutor about ${topic}...`}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    disabled={loading}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: input.trim() ? 'block' : 'none' }}>↵ to send</span>
                <button
                    style={{
                        width: '36px', height: '36px', borderRadius: '10px', border: 'none', background: input.trim() ? 'var(--brand)' : 'var(--bg-3)',
                        color: input.trim() ? '#000' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: input.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: input.trim() ? 'scale(1)' : 'scale(0.95)',
                        boxShadow: input.trim() ? '0 4px 12px rgba(0, 220, 130, 0.3)' : 'none'
                    }}
                    onClick={send}
                    disabled={loading || !input.trim()}
                    onMouseOver={e => input.trim() && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseOut={e => input.trim() && (e.currentTarget.style.transform = 'scale(1)')}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
    )
}

// ── Quiz Panel ────────────────────────────────────────────────────────────────
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

            {loading ? (
                <div className="card" style={{ padding: '28px' }}>
                    <div className="shimmer" style={{ height: '20px', width: '80%', marginBottom: '24px', borderRadius: '4px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="shimmer" style={{ height: '44px', width: '100%', borderRadius: '8px' }} />
                        ))}
                    </div>
                </div>
            ) : !question ? (
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
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px', fontSize: '15px', lineHeight: 1.6 }}>
                        {question.question}
                    </p>
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

// ── Roadmap Slide Panel ───────────────────────────────────────────────────────
function RoadmapSlidePanel({ uid, open, onClose, onUpdatePct }: { uid: string, open: boolean, onClose: () => void, onUpdatePct: (pct: number) => void }) {
    const [days, setDays] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [toast, setToast] = useState('')

    useEffect(() => {
        if (open && uid) {
            setLoading(true)
            fetch(`http://127.0.0.1:8000/api/plan/${uid}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data && data.days) {
                        setDays(data.days)
                        const completed = data.days.filter((d: any) => d.status === 'completed').length
                        onUpdatePct(Math.round((completed / data.days.length) * 100))
                    }
                }).catch(() => {})
                .finally(() => setLoading(false))
        }
    }, [open, uid, onUpdatePct])

    const markComplete = async (dayNum: number) => {
        try {
            await fetch(`http://127.0.0.1:8000/api/plan/${uid}/day/${dayNum}/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'completed' })
            })
            setDays(prev => {
                const updated = prev.map(d => d.day_number === dayNum ? { ...d, status: 'completed' } : d)
                const completed = updated.filter(d => d.status === 'completed').length
                onUpdatePct(Math.round((completed / updated.length) * 100))
                return updated
            })
            setToast('🎉 +20 XP')
            setTimeout(() => setToast(''), 3000)
        } catch {}
    }

    const total = days.length
    const completed = days.filter(d => d.status === 'completed').length
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0

    const firstPendingIdx = days.findIndex(d => d.status === 'pending')
    const currentDay = firstPendingIdx >= 0 ? days[firstPendingIdx] : null
    const upNext = firstPendingIdx >= 0 ? days.slice(firstPendingIdx + 1, firstPendingIdx + 3) : []
    const recent = days.filter(d => d.status === 'completed').slice(-2).reverse()

    return (
        <>
            {/* Overlay */}
            <div 
                style={{ 
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    background: 'rgba(0,0,0,0.4)', zIndex: 100,
                    opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
                    transition: 'opacity 0.3s'
                }} 
                onClick={onClose} 
            />
            {/* Panel */}
            <div 
                style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px',
                    background: 'var(--bg-1)', borderLeft: '1px solid var(--border)',
                    zIndex: 101, transform: open ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.2)'
                }}
            >
                {/* Toast */}
                {toast && (
                    <div style={{ position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)', background: '#fbbf24', color: '#000', padding: '8px 16px', borderRadius: '20px', fontWeight: 800, fontSize: '14px', zIndex: 110, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                        {toast}
                    </div>
                )}

                <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)' }}>Your Roadmap</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer' }}>×</button>
                </div>

                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    {loading ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>Loading...</div>
                    ) : days.length === 0 ? (
                        <div style={{ textAlign: 'center', marginTop: '60px' }}>
                            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🗺️</div>
                            <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>No roadmap yet</h3>
                            <Link href="/roadmap" style={{ color: 'var(--brand-light)', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>Go generate one →</Link>
                        </div>
                    ) : (
                        <>
                            {/* Progress bar */}
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{completed} of {total} completed</span>
                                    <span style={{ color: 'var(--brand-light)', fontWeight: 700 }}>{pct}%</span>
                                </div>
                                <div style={{ height: '6px', background: 'var(--bg-3)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand-light)', borderRadius: '3px', transition: 'width 0.5s' }} />
                                </div>
                            </div>

                            {/* Current */}
                            {currentDay && (
                                <div style={{ marginBottom: '24px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Current</div>
                                    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--brand)', borderRadius: '12px', padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <div style={{ background: 'rgba(13,150,104,0.15)', color: 'var(--brand-light)', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, border: '1px solid rgba(13,150,104,0.3)' }}>TODAY</div>
                                            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{currentDay.day_label}</div>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                                            {currentDay.content.replace(/\*\*/g, '').replace(/#{1,3}\s/g, '')}
                                        </div>
                                        <button 
                                            onClick={() => markComplete(currentDay.day_number)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--brand)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            ✓ Mark Today Complete
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Up Next */}
                            {upNext.length > 0 && (
                                <div style={{ marginBottom: '24px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Up Next</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {upNext.map(d => (
                                            <div key={d.day_number} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 16px' }}>
                                                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{d.day_label}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {d.content.split('\n')[0].replace(/[*#-]/g, '').trim()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recent */}
                            {recent.length > 0 && (
                                <div style={{ marginBottom: '24px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Recent</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {recent.map(d => (
                                            <div key={d.day_number} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px', opacity: 0.7 }}>
                                                <div style={{ color: 'var(--brand)', fontWeight: 800 }}>✓</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', textDecoration: 'line-through' }}>{d.day_label}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ textAlign: 'center', marginTop: '32px' }}>
                                <Link href="/roadmap" style={{ color: 'var(--text-muted)', textDecoration: 'underline', fontSize: '13px' }}>
                                    View Full Roadmap
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}