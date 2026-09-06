import { create } from 'zustand';
import type { User } from '../types';
import { api, getToken, setToken } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setUser: (user: User | null) => void;
  updateProfile: (patch: Record<string, unknown>) => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  loading: false,
  initialized: false,
  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await api<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      setToken(res.token);
      set({ user: res.user, token: res.token });
    } finally {
      set({ loading: false });
    }
  },
  register: async (username, email, password, displayName) => {
    set({ loading: true });
    try {
      const res = await api<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: { username, email, password, display_name: displayName },
        auth: false,
      });
      setToken(res.token);
      set({ user: res.user, token: res.token });
    } finally {
      set({ loading: false });
    }
  },
  logout: async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network errors on logout
    }
    setToken(null);
    set({ user: null, token: null });
    // clear any cached auth-bearer data
    localStorage.removeItem('phhub_user');
  },
  fetchMe: async () => {
    if (!getToken()) {
      set({ loading: false, initialized: true });
      return;
    }
    set({ loading: true });
    try {
      const user = await api<User>('/api/auth/me');
      set({ user, token: getToken() });
    } catch {
      setToken(null);
      set({ user: null, token: null });
    } finally {
      set({ loading: false, initialized: true });
    }
  },
  setUser: (user) => set({ user }),
  updateProfile: async (patch) => {
    const user = await api<User>('/api/auth/me', { method: 'PATCH', body: patch });
    set({ user });
  },
}));