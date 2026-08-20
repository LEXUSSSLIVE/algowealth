import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { createApiClient, type ApiClient } from '@/api/client';
import { API_BASE_URL } from '@/api/config';
import type { User } from '@/api/types';
import { SecureTokenStore } from './secure-token-store';

type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'guest'; user: null }
  | { status: 'authed'; user: User };

type SessionContextValue = SessionState & {
  api: ApiClient;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', user: null });

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: API_BASE_URL,
        tokenStore: new SecureTokenStore(),
        onLogout: () => setState({ status: 'guest', user: null }),
      }),
    [],
  );

  const applyUser = useCallback((user: User) => {
    setState({ status: 'authed', user });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = (await api.get('/me')) as User;
        if (!cancelled) applyUser(user);
      } catch {
        if (!cancelled) setState({ status: 'guest', user: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, applyUser]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...state,
      api,
      async login(email, password) {
        const user = await api.login(email, password);
        applyUser(user);
      },
      async logout() {
        await api.logout();
      },
    }),
    [state, api, applyUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
