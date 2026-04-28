import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  username: string
  isAuthenticated: boolean
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          })

          if (!response.ok) return false

          const data = await response.json()
          localStorage.setItem('token', data.token)

          set({
            user: { username, isAuthenticated: true },
            isAuthenticated: true,
          })

          return true
        } catch {
          return false
        }
      },

      logout: () => {
        localStorage.removeItem('token')
        set({ user: null, isAuthenticated: false })
      },
    }),
    { name: 'docker-auth-storage' }
  )
)
