const BASE_URL = '/api/v1';
const SESSION_KEY = 'mm.session';

export type Session = { accessToken: string; refreshToken: string; expiresAt?: number };
export type User = { id: string; username: string; email: string; phone: string };
export type AssetType = 'cash' | 'investment';
export type Asset = {
  id: string;
  type: AssetType;
  name: string;
  category: string;
  balance: number;
  created_at: string;
  updated_at: string;
};
export type BalanceChange = {
  id: number;
  assetId: string;
  /** null = saldo awal saat aset dibuat */
  previousBalance: number | null;
  newBalance: number;
  delta: number;
  changedAt: string;
};
export type Summary = {
  cash: number;
  investment: number;
  networth: number;
  byCategory: { type: AssetType; category: string; total: number }[];
};
export type Range = '1M' | '3M' | '6M' | '1Y' | '2Y';
export type HistoryPoint = { date: string; cash: number; investment: number; networth: number };
export type History = { range: Range; startDate: string; endDate: string; points: HistoryPoint[] };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

export const sessionStore = {
  get(): Session | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  },
  set(session: Session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },
  clear() {
    localStorage.removeItem(SESSION_KEY);
  },
};

/** Dipanggil saat sesi benar-benar habis (refresh gagal). */
let onSessionExpired: () => void = () => {};
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

async function rawRequest(path: string, init: RequestInit, token?: string) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${BASE_URL}${path}`, { ...init, headers });
}

let refreshing: Promise<Session | null> | null = null;
function refreshSession(): Promise<Session | null> {
  // Satu refresh untuk banyak request paralel.
  refreshing ??= (async () => {
    const current = sessionStore.get();
    if (!current) return null;
    const res = await rawRequest('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    if (!res.ok) return null;
    const { session } = (await res.json()) as { session: Session };
    sessionStore.set(session);
    return session;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  let token = auth ? sessionStore.get()?.accessToken : undefined;
  let res = await rawRequest(path, init, token);

  if (auth && res.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      sessionStore.clear();
      onSessionExpired();
      throw new ApiError(401, 'SESSION_EXPIRED', 'Sesi berakhir, silakan login ulang');
    }
    token = refreshed.accessToken;
    res = await rawRequest(path, init, token);
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? 'Terjadi kesalahan', err.details);
  }
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

export const api = {
  register: (data: { username: string; email: string; phone: string; password: string }) =>
    request<{ user: User; session: Session }>('/auth/register', json('POST', data), false),
  login: (data: { username: string; password: string }) =>
    request<{ user: User; session: Session }>('/auth/login', json('POST', data), false),
  me: () => request<{ user: User }>('/auth/me'),

  listAssets: (type: AssetType) => request<{ items: Asset[] }>(`/assets?type=${type}`),
  createAsset: (data: { type: AssetType; name: string; category: string; balance: number }) =>
    request<{ item: Asset }>('/assets', json('POST', data)),
  updateAsset: (id: string, data: Partial<Pick<Asset, 'name' | 'category' | 'balance'>>) =>
    request<{ item: Asset }>(`/assets/${encodeURIComponent(id)}`, json('PATCH', data)),
  deleteAsset: (id: string) => request<void>(`/assets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  updateBalance: (id: string, balance: number) =>
    request<{ item: Asset; change: BalanceChange }>(
      `/assets/${encodeURIComponent(id)}/balance`,
      json('POST', { balance }),
    ),
  listBalanceChanges: (id: string, limit = 20) =>
    request<{ items: BalanceChange[] }>(`/assets/${encodeURIComponent(id)}/balance-changes?limit=${limit}`),

  summary: () => request<Summary>('/networth/summary'),
  history: (range: Range) => request<History>(`/networth/history?range=${range}`),
};
