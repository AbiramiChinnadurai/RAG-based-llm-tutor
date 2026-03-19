'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface Profile {
    uid: string
    name: string
    age: number
    education_level: string
    subject_list: string
    subjects_list: string[]
    daily_hours: number
    deadline: string
    learning_goals: string
}

interface AuthState {
    uid: string | null
    profile: Profile | null
    login: (uid: string, profile: Profile) => void
    logout: () => void
}

const AuthContext = createContext<AuthState>({
    uid: null, profile: null,
    login: () => { }, logout: () => { },
})

export function AuthProvider({ children }: { children: ReactNode }) {
    const [uid, setUid] = useState<string | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)

    useEffect(() => {
        const storedUid = localStorage.getItem('llmits_uid')
        const storedProf = localStorage.getItem('llmits_profile')
        if (storedUid && storedProf) {
            setUid(storedUid)
            setProfile(JSON.parse(storedProf))
        }
    }, [])

    const login = (uid: string, profile: Profile) => {
        localStorage.setItem('llmits_uid', uid)
        localStorage.setItem('llmits_profile', JSON.stringify(profile))
        setUid(uid)
        setProfile(profile)
    }

    const logout = () => {
        localStorage.removeItem('llmits_uid')
        localStorage.removeItem('llmits_profile')
        setUid(null)
        setProfile(null)
    }

    return (
        <AuthContext.Provider value={{ uid, profile, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
export type { Profile }