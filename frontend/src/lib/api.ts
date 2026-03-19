const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }
  return res.json()
}

export const api = {
  auth: {
    register: (data: any) =>
      request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (uid: string) =>
      request('/api/auth/login', { method: 'POST', body: JSON.stringify({ uid }) }),
    profiles: () =>
      request<{ uid: string; name: string }[]>('/api/auth/profiles'),
  },
  profile: {
    get:   (uid: string) => request<any>(`/api/profile/${uid}`),
    stats: (uid: string) => request<any>(`/api/profile/${uid}/stats`),
  },
  chat: {
    stream: (data: { uid: string; subject: string; query: string; history: any[] }) =>
      fetch(`${BASE}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      }),
  },
  quiz: {
    generate: (data: any) =>
      request<any>('/api/quiz/generate', { method: 'POST', body: JSON.stringify(data) }),
    submit: (data: any) =>
      request<any>('/api/quiz/submit', { method: 'POST', body: JSON.stringify(data) }),
  },
  plan: {
    generate: (uid: string) =>
      request<any>('/api/plan/generate', { method: 'POST', body: JSON.stringify({ uid }) }),
  },
  subjects: {
    list: (uid: string) => request<any[]>(`/api/subjects/${uid}`),
    update: (uid: string, subjects: string[]) =>
      request<any>('/api/profile/subjects', { method: 'POST', body: JSON.stringify({ uid, subjects }) }),
    upload: (uid: string, subject: string, file: File) => {
      const form = new FormData()
      form.append('uid', uid)
      form.append('subject', subject)
      form.append('file', file)
      return fetch(`${BASE}/api/syllabus/upload`, { method: 'POST', body: form }).then(r => r.json())
    },
  },
  xai:     { explain: (data: any) => request<any>('/api/xai/explain', { method: 'POST', body: JSON.stringify(data) }) },
  emotion: { detect:  (text: string) => request<any>('/api/emotion/detect', { method: 'POST', body: JSON.stringify({ text }) }) },
  kg:      { get: (subject: string) => request<any>(`/api/kg/${subject}`) },
  health:  () => request<any>('/api/health'),
}