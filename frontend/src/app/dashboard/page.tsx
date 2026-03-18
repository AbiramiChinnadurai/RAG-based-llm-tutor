'use client'
import { useEffect, useState } from 'react'
import AppLayout from '../../components/AppLayout'
import { useAuth } from '../../lib/auth'
import { api } from '../../lib/api'

const LEVEL_LABELS = ['', 'I', 'II', 'III', 'IV', 'V']

function useGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
}

function formatDate() {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
}

export default function DashboardPage() {
    const { uid, profile } = useAuth()
    const [stats, setStats] = useState<any>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        if (!uid) return
        api.profile.stats(uid).then(setStats).catch(console.error)
    }, [uid])

    const greeting = useGreeting()

    if (!stats) return (
        <AppLayout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '14px', animation: 'shimmer 2s infinite linear', background: 'linear-gradient(90deg, var(--text-muted) 0%, #fff 50%, var(--text-muted) 100%)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Loading your profile...
                </div>
            </div>
        </AppLayout>
    )

    const strengthTheme: any = {
        Strong: { color: 'var(--brand-light)', bg: 'rgba(0, 220, 130, 0.1)', grad: 'linear-gradient(90deg, var(--brand-dim), var(--brand-light))' },
        Moderate: { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', grad: 'linear-gradient(90deg, #d97706, #fbbf24)' },
        Weak: { color: '#f87171', bg: 'rgba(248, 113, 113, 0.1)', grad: 'linear-gradient(90deg, #b91c1c, #f87171)' }
    }

    return (
        <AppLayout>
            <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>

                {/* Hero section */}
                <div className="animate-slide-up" style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 600 }}>{formatDate()}</p>
                        <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                            {greeting}, <span style={{ background: 'linear-gradient(90deg, var(--text-primary), var(--brand-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{profile?.name}</span>
                        </h1>
                    </div>
                    {stats.current_streak > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-glass)', padding: '12px 20px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(249, 115, 22, 0.12)' }}>
                            <div style={{ fontSize: '28px', animation: 'pulseGlow 2s infinite', borderRadius: '50%' }}>🔥</div>
                            <div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: '#f97316', lineHeight: 1 }}>{stats.current_streak}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: '2px' }}>Day Streak</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                    {[
                        { label: 'Total XP', value: stats.total_xp, unit: 'pts', icon: '✨', color: '#fbbf24', bg: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.05))', delay: 'delay-1' },
                        { label: 'Current Level', value: stats.level, unit: '', icon: '⭐', color: 'var(--brand-light)', bg: 'linear-gradient(135deg, rgba(0,220,130,0.2), rgba(0,220,130,0.05))', delay: 'delay-2' },
                        { label: 'Best Streak', value: stats.longest_streak, unit: 'days', icon: '⚡', color: '#f97316', bg: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.05))', delay: 'delay-3' },
                        { label: 'Quizzes Taken', value: stats.quiz_attempts, unit: '', icon: '🎯', color: '#60a5fa', bg: 'linear-gradient(135deg, rgba(96,165,250,0.2), rgba(96,165,250,0.05))', delay: 'delay-4' },
                    ].map(({ label, value, unit, icon, color, bg, delay }) => (
                        <div key={label} className={`card card-3d animate-slide-up ${delay}`} style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', border: `1px solid ${color}30` }}>
                                    {icon}
                                </div>
                                <div style={{ background: `${color}15`, color: color, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span>↗</span> 12%
                                </div>
                            </div>
                            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                                {value}<span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>{unit}</span>
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 500 }}>{label}</div>
                            
                            {/* Decorative background glow */}
                            <div style={{ position: 'absolute', bottom: '-20px', right: '-20px', width: '100px', height: '100px', background: color, filter: 'blur(60px)', opacity: 0.15, pointerEvents: 'none' }} />
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 4fr)', gap: '24px' }}>
                    
                    {/* XP Progress section */}
                    <div className="card animate-slide-up delay-4" style={{ padding: '32px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '8px' }}>Level Progress</div>
                                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Level {stats.level}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px' }}><span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{stats.xp_in_level}</span> / {stats.xp_needed} XP</div>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--brand-light)' }}>{stats.xp_progress_pct}%</div>
                            </div>
                        </div>

                        {/* Animated Shimmer Progress Bar */}
                        <div style={{ height: '8px', background: 'var(--bg-3)', borderRadius: '4px', overflow: 'hidden', marginBottom: '24px', position: 'relative' }}>
                            <div style={{ 
                                height: '100%', width: mounted ? `${stats.xp_progress_pct}%` : '0%', 
                                background: 'linear-gradient(90deg, var(--brand-dim) 0%, var(--brand-light) 50%, var(--brand-dim) 100%)', 
                                backgroundSize: '200% auto',
                                borderRadius: '4px', transition: 'width 1.5s cubic-bezier(0.16, 1, 0.3, 1)',
                                animation: 'shimmer 3s infinite linear'
                            }} />
                        </div>

                        {/* Level Nodes */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                            {/* Connecting background line */}
                            <div style={{ position: 'absolute', top: '14px', left: '20px', right: '20px', height: '2px', background: 'var(--bg-3)', zIndex: 0 }} />
                            
                            {[1, 2, 3, 4, 5].map(l => {
                                const isCompleted = l < stats.level
                                const isCurrent = l === stats.level
                                return (
                                    <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: '8px' }}>
                                        <div style={{ 
                                            width: '30px', height: '30px', borderRadius: '50%', 
                                            background: isCompleted ? 'var(--brand)' : isCurrent ? 'var(--bg-1)' : 'var(--bg-3)',
                                            border: `2px solid ${isCompleted || isCurrent ? 'var(--brand)' : 'var(--border)'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                            fontSize: '12px', fontWeight: 800, color: isCompleted ? '#000' : isCurrent ? 'var(--brand-light)' : 'var(--text-muted)',
                                            boxShadow: isCurrent ? '0 0 16px rgba(0, 220, 130, 0.3)' : 'none',
                                            transition: 'all 0.3s ease'
                                        }}>
                                            {isCompleted ? '✓' : LEVEL_LABELS[l]}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Subject mastery */}
                    {stats.summaries?.length > 0 && (
                        <div className="card animate-slide-up delay-5" style={{ padding: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Subject Mastery</div>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {stats.summaries.slice(0, 4).map((s: any, idx: number) => {
                                    const theme = strengthTheme[s.strength_label] || strengthTheme.Moderate
                                    return (
                                        <div key={s.subject}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.subject}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: theme.bg, color: theme.color }}>{s.strength_label}</span>
                                                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', width: '40px', textAlign: 'right' }}>{s.avg_accuracy.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                            <div style={{ height: '6px', background: 'var(--bg-2)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ 
                                                    height: '100%', width: mounted ? `${s.avg_accuracy}%` : '0%', 
                                                    background: theme.grad, 
                                                    borderRadius: '3px', transition: `width 1.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.1 * idx}s`
                                                }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </AppLayout>
    )
}