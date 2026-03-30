'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '../../../components/AppLayout'
import { useAuth } from '../../../lib/auth'
import { api } from '../../../lib/api'
import ReactMarkdown from 'react-markdown'

export default function ChallengeRoomPage() {
    const { uid, profile } = useAuth()
    const params = useParams()
    const roomCode = decodeURIComponent(params.room_code as string).toUpperCase()
    
    const [room, setRoom] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    
    const [started, setStarted] = useState(false)
    const [currentQIndex, setCurrentQIndex] = useState(0)
    const [selectedOption, setSelectedOption] = useState<number | null>(null)
    const [score, setScore] = useState(0)
    const [finished, setFinished] = useState(false)
    
    const [leaderboard, setLeaderboard] = useState<any[]>([])

    useEffect(() => {
        if (!roomCode) return
        api.challenge.get(roomCode)
            .then(res => {
                setRoom(res)
                setLoading(false)
            })
            .catch(err => {
                setError('Room not found or invalid code.')
                setLoading(false)
            })
    }, [roomCode])

    const handleNext = () => {
        const isCorrect = selectedOption === room.questions[currentQIndex].correct_index
        if (isCorrect) setScore(s => s + 1)
        
        if (currentQIndex < room.questions.length - 1) {
            setCurrentQIndex(i => i + 1)
            setSelectedOption(null)
        } else {
            // Finish
            const finalScore = score + (isCorrect ? 1 : 0)
            setScore(finalScore)
            setFinished(true)
            
            if (uid) {
                api.challenge.submit(roomCode, { uid, score: finalScore, total: room.questions.length })
                    .then(() => fetchLeaderboard())
                    .catch(e => console.error("Submit error:", e))
            }
        }
    }

    const fetchLeaderboard = async () => {
        try {
            const lb = await api.challenge.leaderboard(roomCode)
            setLeaderboard(lb)
        } catch (e) {
            console.error("Leaderboard error", e)
        }
    }

    if (loading) return (
        <AppLayout>
            <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>Loading room...</div>
        </AppLayout>
    )

    if (error) return (
        <AppLayout>
            <div style={{ textAlign: 'center', padding: '100px', color: 'red' }}>{error}</div>
        </AppLayout>
    )

    return (
        <AppLayout>
            <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Challenge Room</div>
                    <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--brand)', letterSpacing: '0.1em' }}>{roomCode}</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                        {room?.subject} • {room?.topic}
                    </div>
                    {room?.creator_name && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Created by {room.creator_name}</div>
                    )}
                </div>

                {!started && !finished && (
                    <div className="card animate-slide-up" style={{ padding: '40px', textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚔️</div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>Ready to challenge?</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                            You will face {room.questions?.length || 5} multiple-choice questions. Score high to climb the leaderboard!
                        </p>
                        <button className="btn btn-primary" onClick={() => setStarted(true)} style={{ padding: '12px 32px', fontSize: '16px' }}>
                            Start Challenge
                        </button>
                    </div>
                )}

                {started && !finished && room?.questions && (
                    <div className="card animate-slide-up">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Question {currentQIndex + 1} of {room.questions.length}
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand)' }}>
                                Score: {score}
                            </div>
                        </div>

                        <div className="prose" style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '32px' }}>
                            <ReactMarkdown>{room.questions[currentQIndex]?.question || ''}</ReactMarkdown>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                            {room.questions[currentQIndex]?.options?.map((opt: string, i: number) => (
                                <button
                                    key={i}
                                    onClick={() => setSelectedOption(i)}
                                    style={{
                                        textAlign: 'left', padding: '16px 20px', borderRadius: '12px',
                                        background: selectedOption === i ? 'var(--brand-dim)' : 'var(--bg-2)',
                                        border: `2px solid ${selectedOption === i ? 'var(--brand)' : 'var(--border)'}`,
                                        color: selectedOption === i ? 'var(--brand-light)' : 'var(--text-secondary)',
                                        fontSize: '15px', fontWeight: selectedOption === i ? 600 : 400,
                                        cursor: 'pointer', transition: 'all 0.15s'
                                    }}
                                >
                                    <ReactMarkdown>{opt}</ReactMarkdown>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleNext}
                            disabled={selectedOption === null}
                            className={`btn ${selectedOption !== null ? 'btn-primary' : ''}`}
                            style={{ 
                                width: '100%', padding: '14px', fontSize: '16px', 
                                opacity: selectedOption === null ? 0.5 : 1,
                                background: selectedOption === null ? 'var(--bg-3)' : '',
                                color: selectedOption === null ? 'var(--text-muted)' : ''
                            }}
                        >
                            {currentQIndex < room.questions.length - 1 ? 'Next Question' : 'Finish Challenge'}
                        </button>
                    </div>
                )}

                {finished && (
                    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>{score === room.questions.length ? '🏆' : '👏'}</div>
                            <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Challenge Complete!</h2>
                            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                                You scored <b>{score}</b> out of <b>{room.questions.length}</b>.
                            </p>
                            <Link href="/dashboard">
                                <button className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '14px' }}>Back to Dashboard</button>
                            </Link>
                        </div>

                        {leaderboard.length > 0 && (
                            <div className="card" style={{ padding: '32px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                                    <span>👑</span> Leaderboard
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {leaderboard.map((entry, idx) => (
                                        <div key={idx} style={{ 
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                            padding: '16px', background: 'var(--bg-2)', borderRadius: '12px',
                                            border: entry.uid === parseInt(uid || '0') ? '1px solid var(--brand)' : '1px solid var(--border)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{ fontSize: '18px', fontWeight: 800, color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--text-muted)', width: '24px', textAlign: 'center' }}>
                                                    {idx + 1}
                                                </div>
                                                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {entry.name || `User ${entry.uid}`}
                                                    {entry.uid === parseInt(uid || '0') && <span style={{ fontSize: '11px', color: 'var(--brand)', marginLeft: '8px', background: 'var(--brand-dim)', padding: '2px 6px', borderRadius: '8px' }}>YOU</span>}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--brand-light)' }}>
                                                {entry.score}/{entry.total}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}
