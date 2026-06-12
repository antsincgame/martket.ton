import { storeApiUrl } from './storeApi';

interface FetchOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(storeApiUrl(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(
      res.status,
      data.code || 'UNKNOWN',
      data.message || data.error || `${res.status} ${res.statusText}`,
    );
  }

  return res.json() as Promise<T>;
}

// ─── Admin endpoints ────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id: string | null;
  result: string;
  metadata: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export async function fetchAuditLogs(
  token: string,
  limit = 100,
): Promise<AuditLogEntry[]> {
  const res = await apiFetch<{ success: boolean; data: AuditLogEntry[] }>(
    `/api/audit-logs?limit=${limit}`,
    { token },
  );
  return res.data;
}

interface StatsData {
  demiurges: number;
  products: number;
  publishedProducts: number;
  recentActivity: number;
}

export async function fetchAdminStats(token: string): Promise<StatsData> {
  const res = await apiFetch<{ success: boolean; data: StatsData }>(
    '/api/stats',
    { token },
  );
  return res.data;
}

interface UserProfile {
  id: string;
  email: string | null;
  ton_address: string | null;
  display_name: string;
  role: string;
  avatar: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string;
}

export async function fetchUsers(token: string): Promise<UserProfile[]> {
  const res = await apiFetch<{ success: boolean; data: UserProfile[] }>(
    '/api/users',
    { token },
  );
  return res.data;
}

// ─── TON balance ────────────────────────────────────────────────────

export async function fetchTonBalance(address: string): Promise<string> {
  const isTestnet = (() => { try { return localStorage.getItem('ton_network') === 'testnet'; } catch { return false; } })();
  const base = isTestnet ? 'https://testnet.tonapi.io' : 'https://tonapi.io';
  const res = await fetch(`${base}/v2/accounts/${encodeURIComponent(address)}`);
  if (!res.ok) return '0';
  const data = await res.json() as { balance?: string | number };
  if (!data.balance) return '0';
  const nano = BigInt(data.balance);
  const whole = nano / 1_000_000_000n;
  const frac = nano % 1_000_000_000n;
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

// ─── Wishlist / favorites ───────────────────────────────────────────

export async function fetchWishlist(token: string): Promise<string[]> {
  const res = await apiFetch<{ success: boolean; data: { productIds: string[] } }>(
    '/api/session/wishlist',
    { token },
  );
  return res.data.productIds;
}

export async function addWishlistItem(productId: string, token: string): Promise<void> {
  await apiFetch(`/api/session/wishlist/${encodeURIComponent(productId)}`, { method: 'POST', token });
}

export async function removeWishlistItem(productId: string, token: string): Promise<void> {
  await apiFetch(`/api/session/wishlist/${encodeURIComponent(productId)}`, { method: 'DELETE', token });
}

export { apiFetch, ApiError };
export type { AuditLogEntry, StatsData, UserProfile, FetchOptions };
