'use client'
import { useAuth } from '../lib/auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { uid } = useAuth()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
    const storedUid = typeof window !== 'undefined' ? localStorage.getItem('llmits_uid') : null;
    if (!uid && !storedUid) router.replace('/')
  }, [uid, router])

  if (!ready) return null
  if (!uid) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: '240px', padding: '32px', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}