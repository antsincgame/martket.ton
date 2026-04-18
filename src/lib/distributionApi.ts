/**
 * Distribution manifest API.
 *
 * The manifest describes WHERE the build lives (R2 bucket / GitHub Release),
 * but the platform never hosts the file. Verify streams the file from source,
 * computes SHA256, and updates manifest state.
 */

import { commerceUrl } from './commerceApi';
import { getJwt } from './appwriteAuth';

export type ManifestKind = 'r2' | 'github' | 'none';
export type DistributionState = 'draft' | 'verified' | 'manifest_drift' | 'source_unavailable';
export type ScanStatus =
  | 'idle'
  | 'scanning'
  | 'clean'
  | 'suspicious'
  | 'malicious'
  | 'oversize_skip'
  | 'error';

export interface R2Locator {
  bucket: string;
  key: string;
}

export interface GitHubLocator {
  repo: string;
  tag: string;
  asset: string;
}

export interface R2ManifestInput {
  kind: 'r2';
  bucket: string;
  key: string;
  sha256: string;
  filename?: string;
}

export interface GitHubManifestInput {
  kind: 'github';
  repo: string;
  tag: string;
  asset: string;
  sha256: string;
  filename?: string;
}

export type ManifestInput = R2ManifestInput | GitHubManifestInput;

export interface DistributionView {
  kind: ManifestKind;
  state: DistributionState | string;
  sha256: string | null;
  size: number | null;
  filename: string | null;
  ttlSec: number | null;
  verifiedAt: string | null;
  healthStatus: 'ok' | 'degraded' | 'down' | null;
  healthAt: string | null;
  scanStatus: ScanStatus;
  scanAt: string | null;
  scanReportUrl: string | null;
  locator: R2Locator | GitHubLocator | null;
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
    const err = (body.error as string) || 'Distribution API error';
    const code = body.code as string | undefined;
    throw new Error(code ? `${err} (${code})` : err);
  }
  return body as T;
}

export async function getDistribution(listingId: string): Promise<DistributionView> {
  const r = await jsonFetch<{ data: { distribution: DistributionView } }>(
    `/listings/${encodeURIComponent(listingId)}/distribution`,
  );
  return r.data.distribution;
}

export async function setDistribution(
  listingId: string,
  wallet: string,
  manifest: ManifestInput,
  ttlSec?: number,
): Promise<DistributionView> {
  const r = await jsonFetch<{ data: { distribution: DistributionView } }>(
    `/listings/${encodeURIComponent(listingId)}/distribution`,
    {
      method: 'PUT',
      body: JSON.stringify({ wallet, manifest, ttlSec }),
    },
  );
  return r.data.distribution;
}

export async function verifyDistribution(
  listingId: string,
  wallet: string,
): Promise<{ matches: boolean; sha256: string; size: number; verifiedAt: string; state: DistributionState }> {
  const r = await jsonFetch<{
    data: { matches: boolean; sha256: string; size: number; verifiedAt: string; state: DistributionState };
  }>(`/listings/${encodeURIComponent(listingId)}/distribution/verify`, {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  });
  return r.data;
}

// ── Moderator scan ─────────────────────────────────────────────────
export interface ScanView {
  status: ScanStatus;
  cached?: boolean;
  source?: string;
  message?: string;
  analysisId?: string;
  stats?: Record<string, number>;
  totalEngines?: number;
}

export async function triggerScan(listingId: string): Promise<ScanView> {
  const r = await jsonFetch<{ data: ScanView }>(`/listings/${encodeURIComponent(listingId)}/scan`, {
    method: 'POST',
  });
  return r.data;
}

export async function pollScan(listingId: string): Promise<ScanView> {
  const r = await jsonFetch<{ data: ScanView }>(`/listings/${encodeURIComponent(listingId)}/scan`);
  return r.data;
}

// ── Buyer download URL (returns the redirect URL after one round-trip) ─
export function downloadUrl(listingId: string): string {
  return commerceUrl(`/listings/${encodeURIComponent(listingId)}/download`);
}
