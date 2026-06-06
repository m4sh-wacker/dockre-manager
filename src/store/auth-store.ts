import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiRequest } from '@/lib/api';

interface User {
  username: string;
  isAuthenticated: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      token: null,
      login: async (username: string, password: string) => {
        try {
          const response = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
          });

          if (!response.ok) {
            return false;
          }

          const data = await response.json();

          if (data.token) {
            set({
              user: { username: data.username || username, isAuthenticated: true },
              isAuthenticated: true,
              token: data.token,
            });
            return true;
          }

          return false;
        } catch {
          return false;
        }
      },
      logout: () => {
        set({ user: null, isAuthenticated: false, token: null });
      },
    }),
    {
      name: 'docker-auth-storage',
    }
  )
);
