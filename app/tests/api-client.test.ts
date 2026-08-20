import { createApiClient, ApiError } from '@/api/client';
import { InMemoryTokenStore } from '@/auth/token-store';

const USER = { email: 'a@b.c', group_id: 'g1', role: 'admin', language: 'ru' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  });
  const store = new InMemoryTokenStore();
  const onLogout = jest.fn();
  const client = createApiClient({
    baseUrl: 'https://api.test',
    tokenStore: store,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    onLogout,
  });
  return { client, store, calls, onLogout };
}

test('login stores tokens and returns user', async () => {
  const { client, store } = setup(() =>
    jsonResponse(200, {
      access_token: 'A1', refresh_token: 'R1', token_type: 'bearer', user: USER,
    }));
  const user = await client.login('a@b.c', 'pass');
  expect(user).toEqual(USER);
  expect(await store.get()).toEqual({ access_token: 'A1', refresh_token: 'R1' });
});

test('login failure throws ApiError with server detail', async () => {
  const { client, store } = setup(() =>
    jsonResponse(401, { detail: 'Invalid email or password' }));
  await expect(client.login('a@b.c', 'bad')).rejects.toThrow('Invalid email or password');
  expect(await store.get()).toBeNull();
});

test('request attaches bearer token', async () => {
  const { client, store, calls } = setup(() => jsonResponse(200, { ok: true }));
  await store.set({ access_token: 'A1', refresh_token: 'R1' });
  await client.get('/me');
  expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer A1');
  expect(calls[0].url).toBe('https://api.test/me');
});

test('on 401 refreshes once and retries with new token', async () => {
  const { client, store, calls } = setup((url, init) => {
    if (url.endsWith('/auth/refresh')) {
      return jsonResponse(200, { access_token: 'A2', refresh_token: 'R2', token_type: 'bearer' });
    }
    const auth = (init?.headers as Record<string, string>).Authorization;
    return auth === 'Bearer A2' ? jsonResponse(200, { ok: true }) : jsonResponse(401, { detail: 'x' });
  });
  await store.set({ access_token: 'A1', refresh_token: 'R1' });
  const body = await client.get('/me');
  expect(body).toEqual({ ok: true });
  const urls = calls.map((c) => c.url);
  expect(urls).toEqual(['https://api.test/me', 'https://api.test/auth/refresh', 'https://api.test/me']);
  expect(await store.get()).toEqual({ access_token: 'A2', refresh_token: 'R2' });
});

test('concurrent 401s share a single refresh', async () => {
  const { client, store, calls } = setup((url, init) => {
    if (url.endsWith('/auth/refresh')) {
      return jsonResponse(200, { access_token: 'A2', refresh_token: 'R2', token_type: 'bearer' });
    }
    const auth = (init?.headers as Record<string, string>).Authorization;
    return auth === 'Bearer A2' ? jsonResponse(200, { ok: true }) : jsonResponse(401, { detail: 'x' });
  });
  await store.set({ access_token: 'A1', refresh_token: 'R1' });
  await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);
  const refreshes = calls.filter((c) => c.url.endsWith('/auth/refresh'));
  expect(refreshes).toHaveLength(1);
});

test('failed refresh clears tokens and calls onLogout', async () => {
  const { client, store, onLogout } = setup((url) => {
    if (url.endsWith('/auth/refresh')) return jsonResponse(401, { detail: 'expired' });
    return jsonResponse(401, { detail: 'x' });
  });
  await store.set({ access_token: 'A1', refresh_token: 'R1' });
  await expect(client.get('/me')).rejects.toBeInstanceOf(ApiError);
  expect(await store.get()).toBeNull();
  expect(onLogout).toHaveBeenCalled();
});

test('del sends DELETE with bearer and resolves null on 204', async () => {
  const { client, store, calls } = setup(() => new Response(null, { status: 204 }));
  await store.set({ access_token: 'A1', refresh_token: 'R1' });
  const result = await client.del('/watchlist/AAPL');
  expect(result).toBeNull();
  expect(calls[0].init?.method).toBe('DELETE');
  expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer A1');
});

test('non-401 errors pass through without refresh', async () => {
  const { client, store, calls } = setup(() => jsonResponse(502, { detail: 'service unavailable' }));
  await store.set({ access_token: 'A1', refresh_token: 'R1' });
  await expect(client.get('/quotes')).rejects.toThrow('service unavailable');
  expect(calls).toHaveLength(1);
});
