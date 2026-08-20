import type { TokenStore } from '@/auth/token-store';
import type { LoginResponse, User } from '@/api/types';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  tokenStore: TokenStore;
  fetchImpl?: typeof fetch;
  onLogout?: () => void;
};

export type ApiClient = {
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  get(path: string): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
  del(path: string): Promise<unknown>;
};

export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl, tokenStore, onLogout } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  let refreshing: Promise<boolean> | null = null;

  async function throwApiError(res: Response): Promise<never> {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.detail === 'string') detail = body.detail;
    } catch {
      // body is not JSON — keep the generic detail
    }
    throw new ApiError(detail, res.status);
  }

  async function rawRequest(path: string, init: RequestInit = {}, token?: string) {
    const headers: Record<string, string> = {
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchImpl(`${baseUrl}${path}`, { ...init, headers });
  }

  async function refresh(): Promise<boolean> {
    const tokens = await tokenStore.get();
    if (!tokens) return false;
    const res = await rawRequest('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    await tokenStore.set({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    });
    return true;
  }

  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const tokens = await tokenStore.get();
    let res = await rawRequest(path, init, tokens?.access_token);

    if (res.status === 401 && tokens) {
      if (!refreshing) {
        refreshing = refresh().finally(() => {
          refreshing = null;
        });
      }
      const refreshed = await refreshing;
      if (!refreshed) {
        await tokenStore.clear();
        onLogout?.();
        throw new ApiError('Session expired', 401);
      }
      const fresh = await tokenStore.get();
      res = await rawRequest(path, init, fresh?.access_token);
    }

    if (!res.ok) await throwApiError(res);
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    async login(email, password) {
      const res = await rawRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) await throwApiError(res);
      const body = (await res.json()) as LoginResponse;
      await tokenStore.set({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
      return body.user;
    },

    async logout() {
      await tokenStore.clear();
      onLogout?.();
    },

    get: (path) => request(path),
    post: (path, body) =>
      request(path, {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    del: (path) => request(path, { method: 'DELETE' }),
  };
}
