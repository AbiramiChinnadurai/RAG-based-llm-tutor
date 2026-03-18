'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { useEffect, useState } from 'react'

const ICONS: Record<string, any> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  roadmap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  ),
  subjects: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  notes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/roadmap', label: 'Roadmap', icon: 'roadmap' },
  { href: '/notes', label: 'Notes', icon: 'notes' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { uid, profile, logout } = useAuth()
  const [subjects, setSubjects] = useState<{ name: string; index_ready: boolean }[]>([])
  const [open, setOpen] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const savedTheme = localStorage.getItem('llmits_theme') as 'dark' | 'light'
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('llmits_theme', newTheme)
  }

  const fetchSubjects = async (force = false) => {
    if (!uid) return
    
    // Cache logic: 5 minute expiry
    const cacheKey = `llmits_subjects_${uid}`
    const timeKey = `llmits_subjects_time_${uid}`
    const now = Date.now()
    const cachedTime = localStorage.getItem(timeKey)
    const isFresh = cachedTime && (now - parseInt(cachedTime)) < 300000 // 5 mins
    
    if (isFresh && !force) {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        setSubjects(JSON.parse(cached))
        return
      }
    }

    try {
      const data = await api.subjects.list(uid)
      setSubjects(data)
      localStorage.setItem(cacheKey, JSON.stringify(data))
      localStorage.setItem(timeKey, now.toString())
    } catch (e) {}
  }

  useEffect(() => {
    if (!uid) return
    
    // Initial load from cache (instant)
    const cacheKey = `llmits_subjects_${uid}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      setSubjects(JSON.parse(cached))
    }
    
    // Always fetch fresh in background if not fresh
    fetchSubjects()
  }, [uid])

  const prefetchSubject = (sname: string) => {
    // When hovering, we fetch all subjects (which populates the cache for details)
    fetchSubjects()
  }

  const handleLogout = () => { logout(); router.push('/') }

  const activeSubject = pathname.startsWith('/learn/')
    ? decodeURIComponent(pathname.split('/learn/')[1])
    : null

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100vh', width: '260px',
      background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 40, overflowY: 'auto',
      transition: 'background 0.3s ease, border-color 0.3s ease'
    }}>
      {/* Logo */}
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '20px', fontWeight: 800, background: 'linear-gradient(90deg, var(--brand-light), var(--brand))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            LLM Tutor
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 220, 130, 0.1)', padding: '4px 8px', borderRadius: '20px', border: '1px solid rgba(0, 220, 130, 0.2)' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand)', animation: 'pulseGlow 2s infinite' }} />
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--brand-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live</span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>Intelligent Tutor</div>
      </div>

      {/* Main nav */}
      <nav style={{ padding: '16px 12px', flexShrink: 0 }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', paddingLeft: '8px', fontWeight: 600 }}>Menu</div>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', padding: '10px', borderRadius: '10px',
              marginBottom: '4px', fontSize: '14px', fontWeight: active ? 700 : 500,
              textDecoration: 'none', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              background: active ? 'rgba(0, 220, 130, 0.1)' : 'transparent',
              color: active ? 'var(--brand-light)' : 'var(--text-secondary)',
              borderLeft: active ? '3px solid var(--brand)' : '3px solid transparent',
              transform: !active ? 'translateX(0)' : 'translateX(4px)'
            }}
            onMouseOver={e => !active && (e.currentTarget.style.transform = 'translateX(4px)')}
            onMouseOut={e => !active && (e.currentTarget.style.transform = 'translateX(0)')}>
              <div style={{
                width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginRight: '12px', borderRadius: '6px', background: active ? 'var(--brand)' : 'var(--bg-2)',
                color: active ? '#000' : 'var(--text-muted)', transition: 'all 0.2s ease'
              }}>
                <div style={{ width: '14px', height: '14px' }}>{ICONS[icon]}</div>
              </div>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Subjects section */}
      <div style={{ padding: '0 12px 16px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px 12px', userSelect: 'none' }}>
          <span onClick={() => setOpen(o => !o)} style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', flex: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            My Subjects 
            <span style={{ background: 'var(--bg-2)', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', color: 'var(--text-secondary)' }}>{subjects.length}</span>
            <span style={{ transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>▸</span>
          </span>
          <Link href="/subjects" title="Manage Subjects" style={{
            width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', color: 'var(--text-secondary)', background: 'var(--bg-2)', borderRadius: '6px',
            textDecoration: 'none', transition: 'all 0.2s'
          }} onMouseOver={e => { e.currentTarget.style.background = 'var(--brand)'; e.currentTarget.style.color = '#000' }} onMouseOut={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
            +
          </Link>
        </div>

        <div style={{
          maxHeight: open ? '500px' : '0', overflow: 'hidden', transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex', flexDirection: 'column', gap: '2px'
        }}>
          {subjects.map(s => {
            const href = `/learn/${encodeURIComponent(s.name)}`
            const active = activeSubject === s.name
            return (
              <Link key={s.name} href={href} 
                onMouseEnter={() => prefetchSubject(s.name)}
                style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: active ? 700 : 500,
                textDecoration: 'none', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                background: active ? 'rgba(0, 220, 130, 0.1)' : 'transparent',
                color: active ? 'var(--brand-light)' : 'var(--text-secondary)',
                borderLeft: active ? '3px solid var(--brand)' : '3px solid transparent',
              }} onMouseOver={e => !active && (e.currentTarget.style.background = 'var(--bg-2)')} onMouseOut={e => !active && (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: active ? 'var(--brand)' : 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? '#000' : 'var(--text-muted)' }}>
                    <div style={{ width: '12px', height: '12px' }}>{ICONS.subjects}</div>
                  </div>
                  <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '140px' }}>{s.name}</span>
                </div>
                {s.index_ready
                  ? <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand)' }} title="Indexed" />
                  : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)' }} title="Not indexed" />
                }
              </Link>
            )
          })}
        </div>
      </div>

      {/* Theme Toggle & Profile */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        
        {/* Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '0 4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Theme</span>
          <button onClick={toggleTheme} style={{
            width: '44px', height: '24px', borderRadius: '12px', background: 'var(--bg-2)', border: '1px solid var(--border)',
            position: 'relative', cursor: 'pointer', outline: 'none', transition: 'all 0.3s'
          }}>
            <div style={{
              position: 'absolute', top: '2px', left: theme === 'dark' ? '2px' : '22px', 
              width: '18px', height: '18px', borderRadius: '50%', background: theme === 'dark' ? 'var(--text-secondary)' : 'var(--brand)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {theme === 'dark' ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              )}
            </div>
          </button>
        </div>

        {/* Profile Card */}
        {profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-2)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-dim), var(--brand))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '16px', fontWeight: 800
            }}>
              {profile.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{profile.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Student</div>
            </div>
            <button onClick={handleLogout} title="Sign out" style={{
              width: '32px', height: '32px', borderRadius: '8px', background: 'transparent', border: 'none',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171' }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}