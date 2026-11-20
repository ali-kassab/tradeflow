import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { api, refreshAccessToken, setAccessToken, setSessionExpiredHandler } from '@/lib/api';
import { AuthContext, type AuthContextValue, type LoginInput, type RegisterInput } from './context';
import type { Session } from './types';

type State = { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; session: Session };

async function loadSession(): Promise<Session> {
  const { data } = await api.get<Session>('/auth/me');
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>({ status: 'loading' });

  const clear = useCallback(() => {
    setAccessToken(null);
    queryClient.clear();
    setState({ status: 'anonymous' });
  }, [queryClient]);

  // On first load, the httpOnly refresh cookie (if any) restores the session.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await refreshAccessToken();
      if (cancelled) return;
      if (!token) return setState({ status: 'anonymous' });
      try {
        const session = await loadSession();
        if (!cancelled) setState({ status: 'authenticated', session });
      } catch {
        if (!cancelled) setState({ status: 'anonymous' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(clear);
    return () => setSessionExpiredHandler(null);
  }, [clear]);

  const start = useCallback(async (accessToken: string) => {
    setAccessToken(accessToken);
    const session = await loadSession();
    setState({ status: 'authenticated', session });
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const { data } = await api.post<{ accessToken: string }>('/auth/login', input);
      await start(data.accessToken);
    },
    [start],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { data } = await api.post<{ accessToken: string }>('/auth/register', input);
      await start(data.accessToken);
    },
    [start],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clear();
    }
  }, [clear]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      session: state.status === 'authenticated' ? state.session : null,
      login,
      register,
      logout,
    }),
    [state, login, register, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
