/**
 * BYOS storage credentials API.
 *
 * The browser never persists credentials locally — they are sent once to the
 * backend, encrypted server-side (AES-256-GCM), and stored in Appwrite. Reads
 * return only metadata (status, account, bucket) — never the secret key.
 */

import { commerceUrl } from './commerceApi';
import { getJwt } from './appwriteAuth';

export type StorageProvider = 'cloudflare-r2' | 's3' | 'b2';
export type StorageStatus = 'connected' | 'error' | 'revoked' | 'unconfigured';

export interface StorageView {
  status: StorageStatus;
  provider: StorageProvider | null;
  accountId: string | null;
  bucket: string | null;
  endpoint: string | null;
  publicBaseUrl: string | null;
  lastCheckAt: string | null;
  lastError: string | null;
}

export interface SetStorageInput {
  wallet: string;
  provider: StorageProvider;
  accountId: string;
  bucket: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const jwt = await getJwt();
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

async function jsonFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(commerceUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (body.error as string) || 'Storage API error';
    const code = body.code as string | undefined;
    throw new Error(code ? `${err} (${code})` : err);
  }
  return body as T;
}

export async function getStorageConfig(wallet: string): Promise<StorageView> {
  const r = await jsonFetch<{ data: StorageView }>(`/storage?wallet=${encodeURIComponent(wallet)}`);
  return r.data;
}

export async function saveStorageConfig(input: SetStorageInput): Promise<StorageView> {
  const r = await jsonFetch<{ data: StorageView }>('/storage', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return r.data;
}

export async function testStorageConfig(wallet: string): Promise<{ status: StorageStatus; lastError: string; lastCheckAt: string }> {
  const r = await jsonFetch<{ data: { status: StorageStatus; lastError: string; lastCheckAt: string } }>('/storage/test', {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  });
  return r.data;
}

export async function revokeStorageConfig(wallet: string): Promise<{ status: StorageStatus }> {
  const r = await jsonFetch<{ data: { status: StorageStatus } }>(`/storage?wallet=${encodeURIComponent(wallet)}`, {
    method: 'DELETE',
  });
  return r.data;
}
