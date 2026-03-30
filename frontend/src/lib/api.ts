const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(options?.headers as any || {}) }
  
  // Only set application/json if not sending FormData
  if (!(options?.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = typeof err.detail === 'object' ? JSON.stringify(err.detail) : (err.detail ?? 'Request failed')
    throw new Error(detail)
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
    get: (uid: string) => request<any>(`/api/plan/${uid}`),
    updateStatus: (uid: string, dayNum: number, status: string) =>
      request<any>(`/api/plan/${uid}/day/${dayNum}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  },
  subjects: {
    list: (uid: string) => request<any[]>(`/api/profile/${uid}/subjects`),
    update: (uid: string, subjects: string[]) =>
      request<any>('/api/profile/subjects', { method: 'POST', body: JSON.stringify({ uid, subjects }) }),
    upload: (uid: string, subject: string, file: File, deadline: string = '', purpose: string = '') => {
      const fd = new FormData()
      fd.append('uid', uid)
      fd.append('subject', subject)
      fd.append('file', file)
      fd.append('deadline', deadline)
      fd.append('purpose', purpose)
      return request<any>('/api/syllabus/upload', { method: 'POST', body: fd })
    },
  },
  projects: {
    generate: (uid: string, subject: string, topic: string) =>
      request<any>('/api/projects/generate', { method: 'POST', body: JSON.stringify({ uid, subject, topic }) }),
    list: (uid: string, subject: string) =>
      request<any[]>(`/api/projects/${uid}/${subject}`),
    updateStatus: (projectId: number, status: string) =>
      request<any>(`/api/projects/${projectId}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  },
  xai:     { explain: (data: any) => request<any>('/api/xai/explain', { method: 'POST', body: JSON.stringify(data) }) },
  emotion: { detect:  (text: string) => request<any>('/api/emotion/detect', { method: 'POST', body: JSON.stringify({ text }) }) },
  ael:     { override: (data: any) => request('/api/ael/override', { method: 'POST', body: JSON.stringify(data) }) },
  challenge: {
    create:  (data: any) => request<any>('/api/challenge/create', { method: 'POST', body: JSON.stringify(data) }),
    get:     (room_code: string) => request<any>(`/api/challenge/${room_code}`),
    submit:  (room_code: string, data: any) => request<any>(`/api/challenge/${room_code}/submit`, { method: 'POST', body: JSON.stringify(data) }),
    leaderboard: (room_code: string) => request<any[]>(`/api/challenge/${room_code}/leaderboard`)
  },
  kg:      { get: (subject: string) => request<any>(`/api/kg/${subject}`) },
  heatmap: { get: (uid: string, subject: string) => request<any[]>(`/api/profile/${uid}/heatmap/${encodeURIComponent(subject)}`) },

  health:  () => request<any>('/api/health'),
}