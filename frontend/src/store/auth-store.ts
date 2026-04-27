import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  username: string;
  isAuthenticated: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (username: string, password: string) => {
        // Mock authentication - in production, this would call an API
        if (username === 'admin' && password === 'admin123') {
          set({ 
            user: { username, isAuthenticated: true }, 
            isAuthenticated: true 
          });
          return true;
        }
        return false;
      },
      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'docker-auth-storage',
    }
  )
);
