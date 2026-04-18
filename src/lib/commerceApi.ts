import { logger } from './logger';
import { getJwt } from './appwriteAuth';
import type {
  CommerceConfigResponse,
  CommerceListingPublic,
  CreateOrderResponse,
  OrderStatusResponse,
} from '../domain/commerce/types';

function commerceBaseUrl(): string {
  const raw = import.meta.env.VITE_COMMERCE_API_URL || 'http://localhost:8081';
  return raw.replace(/\/$/, '');
}

export function commerceUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${commerceBaseUrl()}/api/v1/commerce${p}`;
}

function networkHeader(): Record<string, string> {
  try {
    const stored = localStorage.getItem('ton_network');
    if (stored === 'testnet') return { 'X-Ton-Network': 'testnet' };
  } catch { /* noop */ }
  return {};
}

async function authHeader(): Promise<Record<string, string>> {
  const jwt = await getJwt();
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

async function parseJson<T>(
  response: Response
): Promise<{ ok: true; data: T } | { ok: false; error: string; code?: string }> {
  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (!response.ok) {
    const err = typeof body.error === 'string' ? body.error : 'Request failed';
    const code = typeof body.code === 'string' ? body.code : undefined;
    return { ok: false, error: err, code };
  }
  return { ok: true, data: body as T };
}

interface CommerceError {
  message: string;
  code?: string;
}

class CommerceApiError extends Error {
  code?: string;
  constructor({ message, code }: CommerceError) {
    super(code ? `${message} (${code})` : message);
    this.name = 'CommerceApiError';
    this.code = code;
  }
}

async function commerceAuthFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const auth = await authHeader();
  const headers: Record<string, string> = { ...networkHeader(), ...auth };
  if (init.body && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const existingHeaders = init.headers as Record<string, string> | undefined;
  if (existingHeaders) Object.assign(headers, existingHeaders);

  const res = await fetch(commerceUrl(path), { ...init, headers });
  const parsed = await parseJson<T>(res);
  if (!parsed.ok) throw new CommerceApiError({ message: parsed.error, code: parsed.code });
  return parsed.data;
}

// ─── Public (unauthenticated) ────────────────────────────────────────

export async function fetchCommerceConfig(): Promise<CommerceConfigResponse | null> {
  try {
    const res = await fetch(commerceUrl('/config'));
    const parsed = await parseJson<{ data: CommerceConfigResponse }>(res);
    if (!parsed.ok) {
      logger.warn('[commerce] config', parsed.error);
      return null;
    }
    return parsed.data.data;
  } catch (e) {
    logger.warn('[commerce] config network', e);
    return null;
  }
}

export async function fetchListingsForCatalog(
  catalogProductId: string
): Promise<{ listings: CommerceListingPublic[]; primary: CommerceListingPublic | null }> {
  const res = await fetch(commerceUrl(`/listings/catalog/${encodeURIComponent(catalogProductId)}`));
  const parsed = await parseJson<{
    data: { listings: CommerceListingPublic[]; primary: CommerceListingPublic | null };
  }>(res);
  if (!parsed.ok) throw new CommerceApiError({ message: parsed.error });
  return parsed.data.data;
}

export async function fetchSellerListings(wallet: string): Promise<CommerceListingPublic[]> {
  const res = await fetch(commerceUrl(`/sellers/${encodeURIComponent(wallet)}/listings`));
  const parsed = await parseJson<{ data: { listings: CommerceListingPublic[] } }>(res);
  if (!parsed.ok) throw new CommerceApiError({ message: parsed.error });
  return parsed.data.data.listings;
}

// ─── Authenticated (JWT via commerceAuthFetch) ───────────────────────

export async function createCommerceOrder(
  listingId: string,
  buyerWallet: string
): Promise<CreateOrderResponse> {
  const result = await commerceAuthFetch<{ data: CreateOrderResponse }>('/orders', {
    method: 'POST',
    body: JSON.stringify({ listingId, buyerWallet }),
  });
  return result.data;
}

export async function confirmCommerceOrder(
  orderId: string,
  buyerWallet: string,
  txHash: string
): Promise<{ state: string; entitlement?: { deliveryPayload: string } }> {
  const result = await commerceAuthFetch<{
    data: { state: string; entitlement?: { deliveryPayload: string } };
  }>(`/orders/${encodeURIComponent(orderId)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ buyerWallet, txHash }),
  });
  return result.data;
}

export async function fetchCommerceOrder(
  orderId: string,
  buyerWallet: string
): Promise<OrderStatusResponse> {
  const q = new URLSearchParams({ buyerWallet });
  const result = await commerceAuthFetch<{ data: OrderStatusResponse }>(
    `/orders/${encodeURIComponent(orderId)}?${q}`,
  );
  return result.data;
}

export async function registerSeller(wallet: string, displayName: string, bio?: string): Promise<void> {
  await commerceAuthFetch<unknown>('/sellers/register', {
    method: 'POST',
    body: JSON.stringify({ wallet, displayName, bio }),
  });
}

export async function createListing(body: Record<string, unknown>): Promise<CommerceListingPublic> {
  const result = await commerceAuthFetch<{ data: { listing: CommerceListingPublic } }>('/listings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return result.data.listing;
}

export interface SellerOrderRow {
  id: string;
  listingId: string;
  listingTitle: string | null;
  buyerWallet: string;
  state: string;
  amountRaw: string;
  currency: string;
  memo: string;
  tonTxHash: string | null;
  createdAt: string;
}

export async function fetchSellerOrders(
  wallet: string,
  explicitAuth?: string,
  limit = 100,
): Promise<SellerOrderRow[]> {
  if (explicitAuth) {
    const res = await fetch(commerceUrl(`/sellers/${encodeURIComponent(wallet)}/orders?limit=${limit}`), {
      headers: { Authorization: explicitAuth },
    });
    const parsed = await parseJson<{ data: { orders: SellerOrderRow[] } }>(res);
    if (!parsed.ok) throw new CommerceApiError({ message: parsed.error });
    return parsed.data.data.orders;
  }
  const result = await commerceAuthFetch<{ data: { orders: SellerOrderRow[] } }>(
    `/sellers/${encodeURIComponent(wallet)}/orders?limit=${limit}`,
  );
  return result.data.orders;
}

export async function uploadListingAsset(
  listingId: string,
  sellerWallet: string,
  file: File
): Promise<{ fileId: string; bucketId: string }> {
  const auth = await authHeader();
  const body = new FormData();
  body.append('sellerWallet', sellerWallet);
  body.append('file', file);
  const res = await fetch(commerceUrl(`/listings/${encodeURIComponent(listingId)}/asset`), {
    method: 'POST',
    headers: { ...auth },
    body,
  });
  const parsed = await parseJson<{ data: { fileId: string; bucketId: string } }>(res);
  if (!parsed.ok) throw new CommerceApiError({ message: parsed.error });
  return parsed.data.data;
}

export interface BuyerOrderRow {
  id: string;
  listingId: string;
  listingTitle: string | null;
  state: string;
  amountRaw: string;
  currency: string;
  memo: string;
  tonTxHash: string | null;
  createdAt: string;
}

export async function fetchBuyerOrders(): Promise<BuyerOrderRow[]> {
  const result = await commerceAuthFetch<{ data: { orders: BuyerOrderRow[] } }>('/buyers/me/orders');
  return result.data.orders;
}

/** Админ: заголовок X-Commerce-Admin-Secret задаётся вручную (оператор). */
export async function adminCommerceFetch(
  path: string,
  secret: string,
  init?: RequestInit
): Promise<unknown> {
  const merged = new Headers(init?.headers);
  merged.set('X-Commerce-Admin-Secret', secret);
  if (init?.body && typeof init.body === 'string' && !merged.has('Content-Type')) {
    merged.set('Content-Type', 'application/json');
  }
  const res = await fetch(commerceUrl(path), { ...init, headers: merged });
  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  if (!res.ok) {
    const err = typeof json.error === 'string' ? json.error : 'Admin request failed';
    throw new CommerceApiError({ message: err });
  }
  return json;
}

export { CommerceApiError };
