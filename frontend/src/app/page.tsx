'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

export default function HomePage() {
  const { uid, login } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { 
    setMounted(true)
    if (uid) router.replace('/dashboard') 
  }, [uid, router])

  if (!mounted) return null

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'radial-gradient(ellipse at 60% 0%, rgba(13,150,104,0.12) 0%, transparent 60%), var(--bg)',
    }}>
      {/* Left panel */}
      <div style={{ flex: 1, display: 'none' }} className="left-panel">
      </div>

      {/* Right panel - auth */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Logo */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎓</div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>LLM Tutor</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Your AI-powered study companion</p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--bg-2)', borderRadius: '12px', marginBottom: '28px' }}>
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                background: tab === t ? 'var(--brand)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-muted)',
              }}>
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {tab === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>
    </div>
  )
}

function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return }
    setLoading(true); setError('')
    try {
      // Look up profile by email stored in localStorage registry
      const registry = JSON.parse(localStorage.getItem('llmits_registry') || '{}')
      const entry = registry[email.toLowerCase()]
      if (!entry) { setError('No account found with this email'); setLoading(false); return }
      if (entry.password !== btoa(password)) { setError('Incorrect password'); setLoading(false); return }
      const res = await api.auth.login(entry.uid) as any
      login(res.uid, res.profile)
      router.push('/dashboard')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={labelStyle}>Email</label>
        <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
      </div>
      <div>
        <label style={labelStyle}>Password</label>
        <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
      </div>
      {error && <p style={{ color: '#f87171', fontSize: '13px' }}>{error}</p>}
      <button className="btn-primary" onClick={handleLogin} disabled={loading} style={{ marginTop: '4px' }}>
        {loading ? 'Signing in...' : 'Sign In →'}
      </button>
    </div>
  )
}

function RegisterForm() {
  const { login } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    age: 20, education_level: 'Undergraduate',
    daily_hours: 2, deadline: '', goals: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password) { setError('Name, email and password are required'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    try {
      const res = await api.auth.register({
        name: form.name, age: form.age,
        education_level: form.education_level,
        subjects: ['General'],
        daily_hours: form.daily_hours,
        deadline: form.deadline || '2026-12-31',
        goals: form.goals || 'Study effectively',
      }) as any

      // Store email→uid mapping locally
      const registry = JSON.parse(localStorage.getItem('llmits_registry') || '{}')
      registry[form.email.toLowerCase()] = { uid: res.uid, password: btoa(form.password) }
      localStorage.setItem('llmits_registry', JSON.stringify(registry))

      login(res.uid, res.profile)
      router.push('/dashboard')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label style={labelStyle}>Full Name *</label>
        <input className="input" placeholder="Your name" value={form.name} onChange={e => set('name', e.target.value)} />
      </div>
      <div>
        <label style={labelStyle}>Email *</label>
        <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Password *</label>
          <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Confirm Password *</label>
          <input className="input" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Age</label>
          <input className="input" type="number" min={10} max={60} value={form.age} onChange={e => set('age', +e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Education Level</label>
          <select className="input" value={form.education_level} onChange={e => set('education_level', e.target.value)}>
            {['Secondary School', 'Undergraduate', 'Postgraduate', 'Professional'].map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle}>Learning Goals</label>
        <input className="input" placeholder="e.g. Prepare for exams" value={form.goals} onChange={e => set('goals', e.target.value)} />
      </div>
      {error && <p style={{ color: '#f87171', fontSize: '13px' }}>{error}</p>}
      <button className="btn-primary" onClick={handleRegister} disabled={loading} style={{ marginTop: '4px' }}>
        {loading ? 'Creating account...' : 'Create Account →'}
      </button>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: 'var(--text-muted)',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600,
}