/**
 * Minimal VirusTotal API v3 client.
 *
 * Flow:
 *   1) `lookupByHash(sha256)` — free, returns existing report if any.
 *   2) `submitFile(buffer, filename)` — uploads (≤32 MB direct, larger via /files/upload_url).
 *   3) `pollAnalysis(analysisId)` — polls /analyses/{id} until completed.
 *
 * Rate limits (free tier): 4 req/min, 500/day. Worker is responsible for throttling.
 */

import { logger } from '../logger.js';

const VT_BASE = 'https://www.virustotal.com/api/v3';
const LARGE_FILE_THRESHOLD = 32 * 1024 * 1024; // 32 MB
const REQUEST_TIMEOUT_MS = 30_000;
/** Free tier: 4 req/min => 1 req per 15s. We add a small safety buffer. */
const MIN_INTERVAL_MS = 16_000;

let lastRequestAt = 0;
let throttleChain: Promise<void> = Promise.resolve();

/**
 * Throttles outbound VT requests to respect the free tier (4 req/min).
 * Serializes through a single promise chain so concurrent callers wait
 * their turn rather than firing all at once.
 */
async function throttle(): Promise<void> {
  const next = throttleChain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - now);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  throttleChain = next.catch(() => undefined);
  return next;
}

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Computes how long to wait after an HTTP 429.
 *
 * Honours the `Retry-After` header when present and parsable; otherwise
 * falls back to a linear backoff based on attempt number. Negative or
 * non-numeric `Retry-After` values are treated as "header missing" — never
 * trust unbounded server input directly.
 *
 * Exported for unit tests; production callers go through `vtCall`.
 */
export function parseRetryAfterMs(headerValue: string | null, attempt: number): number {
  const retryAfter = parseInt(headerValue || '', 10);
  if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter < 3600) {
    return retryAfter * 1000;
  }
  // Linear backoff capped to attempt index — keeps worst case bounded.
  return MIN_INTERVAL_MS * Math.max(1, attempt + 1);
}

/**
 * Wraps a single VT call: throttle + timeout + automatic retry on HTTP 429.
 */
async function vtCall(input: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle();
    const res = await fetchWithTimeout(input, init);
    if (res.status !== 429) return res;
    const backoff = parseRetryAfterMs(res.headers.get('retry-after'), attempt);
    logger.warn(`[vt] HTTP 429, backing off ${backoff}ms (attempt ${attempt + 1}/3)`);
    await new Promise((r) => setTimeout(r, backoff));
  }
  return fetchWithTimeout(input, init);
}

/** Parses an env-defined integer threshold, falling back if missing/NaN. */
function parseThreshold(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export interface VtStats {
  malicious: number;
  suspicious: number;
  undetected: number;
  harmless: number;
  timeout: number;
  failure: number;
  'type-unsupported'?: number;
  [key: string]: number | undefined;
}

export interface VtFileReport {
  analysisId: string | null;
  status: 'queued' | 'in-progress' | 'completed';
  stats: VtStats;
  totalEngines: number;
}

function apiKey(): string {
  const key = process.env.VIRUSTOTAL_API_KEY;
  if (!key) throw new Error('VIRUSTOTAL_API_KEY is not configured');
  return key;
}

function headersJson(): Record<string, string> {
  return { 'x-apikey': apiKey(), accept: 'application/json' };
}

function sumEngines(stats: VtStats | undefined): number {
  if (!stats) return 0;
  return Object.values(stats).reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
}

function emptyStats(): VtStats {
  return { malicious: 0, suspicious: 0, undetected: 0, harmless: 0, timeout: 0, failure: 0 };
}

/** Returns existing file report (if VT already saw this hash), else null. */
export async function lookupByHash(sha256: string): Promise<VtFileReport | null> {
  const res = await vtCall(`${VT_BASE}/files/${sha256}`, { headers: headersJson() });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`VT lookup failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { attributes?: Record<string, unknown> } };
  const stats = (json.data?.attributes?.['last_analysis_stats'] as VtStats | undefined) ?? emptyStats();
  return {
    analysisId: null,
    status: 'completed',
    stats,
    totalEngines: sumEngines(stats),
  };
}

async function getUploadUrlForLargeFile(): Promise<string> {
  const res = await vtCall(`${VT_BASE}/files/upload_url`, { headers: headersJson() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`VT upload_url failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: string };
  if (!json.data) throw new Error('VT upload_url: empty response');
  return json.data;
}

/**
 * Uploads file to VirusTotal. Returns analysis id used for polling.
 * For files larger than 32 MB, performs the upload-url handshake transparently.
 */
export async function submitFile(buffer: Buffer, filename: string, contentType?: string): Promise<string> {
  const url = buffer.byteLength > LARGE_FILE_THRESHOLD
    ? await getUploadUrlForLargeFile()
    : `${VT_BASE}/files`;

  const fd = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType || 'application/octet-stream' });
  fd.append('file', blob, filename);

  const res = await vtCall(url, {
    method: 'POST',
    headers: { 'x-apikey': apiKey() },
    body: fd,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`VT submit failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { id?: string } };
  if (!json.data?.id) throw new Error('VT submit: empty analysis id');
  return json.data.id;
}

/** Single read of analysis state. Use the worker loop to schedule retries. */
export async function getAnalysis(analysisId: string): Promise<VtFileReport> {
  const res = await vtCall(`${VT_BASE}/analyses/${analysisId}`, { headers: headersJson() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`VT analysis failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: { attributes?: { status?: string; stats?: VtStats } };
  };
  const status = (json.data?.attributes?.status ?? 'queued') as VtFileReport['status'];
  const stats = json.data?.attributes?.stats ?? emptyStats();
  return {
    analysisId,
    status,
    stats,
    totalEngines: sumEngines(stats),
  };
}

export interface ScanVerdictThresholds {
  malicious: number;
  suspicious: number;
}

export function thresholdsFromEnv(): ScanVerdictThresholds {
  return {
    malicious: parseThreshold(process.env.VIRUSTOTAL_THRESHOLD_MALICIOUS, 1),
    suspicious: parseThreshold(process.env.VIRUSTOTAL_THRESHOLD_SUSPICIOUS, 3),
  };
}

export type ScanVerdict = 'clean' | 'suspicious' | 'malicious';

export function verdictFromStats(stats: VtStats, thresholds: ScanVerdictThresholds): ScanVerdict {
  if (stats.malicious >= thresholds.malicious) return 'malicious';
  if (stats.suspicious >= thresholds.suspicious) return 'suspicious';
  return 'clean';
}

export function isVtConfigured(): boolean {
  return !!process.env.VIRUSTOTAL_API_KEY;
}

export function logVtConfig(): void {
  if (isVtConfigured()) {
    const t = thresholdsFromEnv();
    logger.info(`VirusTotal: configured (thresholds malicious≥${t.malicious}, suspicious≥${t.suspicious})`);
  } else {
    logger.warn('VirusTotal: API key not configured — uploaded builds will stay in scanning status');
  }
}
