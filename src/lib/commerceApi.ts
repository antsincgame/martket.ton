import { logger } from './logger';
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
    const err = typeof body.error === 'string' ? body.error : 'Запрос не выполнен';
    const code = typeof body.code === 'string' ? body.code : undefined;
    return { ok: false, error: err, code };
  }
  return { ok: true, data: body as T };
}

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
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data.data;
}

export async function createCommerceOrder(
  listingId: string,
  buyerWallet: string
): Promise<CreateOrderResponse> {
  const res = await fetch(commerceUrl('/orders'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId, buyerWallet }),
  });
  const parsed = await parseJson<{ data: CreateOrderResponse }>(res);
  if (!parsed.ok) throw new Error(parsed.code ? `${parsed.error} (${parsed.code})` : parsed.error);
  return parsed.data.data;
}

export async function confirmCommerceOrder(
  orderId: string,
  buyerWallet: string,
  txHash: string
): Promise<{ state: string; entitlement?: { deliveryPayload: string } }> {
  const res = await fetch(commerceUrl(`/orders/${encodeURIComponent(orderId)}/confirm`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buyerWallet, txHash }),
  });
  const parsed = await parseJson<{
    data: { state: string; entitlement?: { deliveryPayload: string } };
  }>(res);
  if (!parsed.ok) throw new Error(parsed.code ? `${parsed.error} (${parsed.code})` : parsed.error);
  return parsed.data.data;
}

export async function fetchCommerceOrder(
  orderId: string,
  buyerWallet: string
): Promise<OrderStatusResponse> {
  const q = new URLSearchParams({ buyerWallet });
  const res = await fetch(`${commerceUrl(`/orders/${encodeURIComponent(orderId)}`)}?${q}`);
  const parsed = await parseJson<{ data: OrderStatusResponse }>(res);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data.data;
}

export async function openCommerceDispute(
  orderId: string,
  openedByWallet: string,
  reason: string
): Promise<void> {
  const res = await fetch(commerceUrl('/disputes'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, openedByWallet, reason }),
  });
  const parsed = await parseJson<unknown>(res);
  if (!parsed.ok) throw new Error(parsed.error);
}

export async function registerSeller(wallet: string, displayName: string, bio?: string): Promise<void> {
  const res = await fetch(commerceUrl('/sellers/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, displayName, bio }),
  });
  const parsed = await parseJson<unknown>(res);
  if (!parsed.ok) throw new Error(parsed.error);
}

export async function createListing(body: Record<string, unknown>): Promise<CommerceListingPublic> {
  const res = await fetch(commerceUrl('/listings'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = await parseJson<{ data: { listing: CommerceListingPublic } }>(res);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data.data.listing;
}

export async function fetchSellerListings(wallet: string): Promise<CommerceListingPublic[]> {
  const res = await fetch(commerceUrl(`/sellers/${encodeURIComponent(wallet)}/listings`));
  const parsed = await parseJson<{ data: { listings: CommerceListingPublic[] } }>(res);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data.data.listings;
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
  authHeader?: string,
  limit = 100,
): Promise<SellerOrderRow[]> {
  const res = await fetch(commerceUrl(`/sellers/${encodeURIComponent(wallet)}/orders?limit=${limit}`), {
    headers: authHeader ? { Authorization: authHeader } : undefined,
  });
  const parsed = await parseJson<{ data: { orders: SellerOrderRow[] } }>(res);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data.data.orders;
}

export interface SellerDisputeRow {
  id: string;
  orderId: string;
  buyerWallet: string;
  reason: string;
  status: string;
  resolutionNote: string;
  createdAt: string;
  order: {
    listingTitle: string | null;
    amountRaw: string;
    currency: string;
    state: string;
  } | null;
}

export async function fetchSellerDisputes(
  wallet: string,
  authHeader?: string,
): Promise<SellerDisputeRow[]> {
  const res = await fetch(commerceUrl(`/sellers/${encodeURIComponent(wallet)}/disputes`), {
    headers: authHeader ? { Authorization: authHeader } : undefined,
  });
  const parsed = await parseJson<{ data: { disputes: SellerDisputeRow[] } }>(res);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data.data.disputes;
}

export async function uploadListingAsset(
  listingId: string,
  sellerWallet: string,
  file: File
): Promise<{ fileId: string; bucketId: string }> {
  const body = new FormData();
  body.append('sellerWallet', sellerWallet);
  body.append('file', file);
  const res = await fetch(commerceUrl(`/listings/${encodeURIComponent(listingId)}/asset`), {
    method: 'POST',
    body,
  });
  const parsed = await parseJson<{ data: { fileId: string; bucketId: string } }>(res);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data.data;
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
    throw new Error(err);
  }
  return json;
}
