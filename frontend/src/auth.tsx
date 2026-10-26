import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getAccessToken, setAccessToken, type User } from './api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      api.refresh()
        .then((result) => setAccessToken(result.access_token))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(username: string, password: string): Promise<void> {
    const result = await api.login(username, password);
    setAccessToken(result.access_token);
    setUser(result.user);
  }

  async function logout(): Promise<void> {
    try {
      await api.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}