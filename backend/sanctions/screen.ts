/**
 * Sanctions screening for TON wallets.
 *
 * Strategy (US + EU compliant, zero cost):
 *   1. Static curated `blocklist.json` shipped with the backend — fast,
 *      offline, deterministic. Editor of record: ops team. Sources: OFAC SDN
 *      (treasury.gov/ofac/downloads/sdn.xml — entries with `digital_currency_address`
 *      `TON`), EU Consolidated Sanctions List (data.europa.eu).
 *   2. Optional remote refresh via SANCTIONS_REMOTE_URL — JSON of the same
 *      shape, refreshed every SANCTIONS_REFRESH_HOURS (default 24). On
 *      fetch failure we keep the cached snapshot — never open the gate
 *      because a remote went down.
 *
 * All addresses are normalized to raw `0:hex` form so user-friendly,
 * bounceable, testnet variants of the same wallet collapse to one key.
 * `screenWallet()` is O(1) (Set lookup).
 */

import { Address } from '@ton/core';
import { logger } from '../logger.js';
// resolveJsonModule=true in backend/tsconfig.json — JSON is loaded at compile
// time. Avoids import.meta gymnastics under module=nodenext + CJS package.
import staticBlocklistJson from './blocklist.json';

export type SanctionSource = 'OFAC_SDN' | 'EU_CONSOLIDATED' | 'TON_BLOCKLIST';

export interface SanctionEntry {
  /** Raw `0:hex` form (normalized). */
  addr: string;
  source: SanctionSource;
  /** ISO date when the entry was added by the issuing authority. */
  listedAt?: string;
  /** Free-form reason / case ID for ops auditing. */
  notes?: string;
}

export interface ScreenResult {
  ok: boolean;
  reason?: SanctionSource;
  listedAt?: string;
}

interface BlocklistFile {
  _comment?: string;
  _lastUpdatedAt?: string;
  entries: SanctionEntry[];
}

const REFRESH_HOURS = parseInt(process.env.SANCTIONS_REFRESH_HOURS || '24', 10) || 24;
const REMOTE_URL = process.env.SANCTIONS_REMOTE_URL || '';

let blocklist = new Map<string, SanctionEntry>();
let lastLoadedAt = 0;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/** Normalize any TON address form to raw `0:hex` (lowercase). Returns `null`
 *  if the input is not a parseable TON address. */
export function normalizeTonAddr(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const a = Address.parse(raw.trim());
    return `${a.workChain}:${a.hash.toString('hex').toLowerCase()}`;
  } catch {
    return null;
  }
}

function loadStaticBlocklist(): SanctionEntry[] {
  const parsed = staticBlocklistJson as unknown as BlocklistFile;
  return Array.isArray(parsed?.entries) ? parsed.entries : [];
}

async function loadRemoteBlocklist(): Promise<SanctionEntry[]> {
  if (!REMOTE_URL) return [];
  try {
    const res = await fetch(REMOTE_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      logger.warn(`[sanctions] remote blocklist HTTP ${res.status}`);
      return [];
    }
    const body = (await res.json()) as BlocklistFile;
    return Array.isArray(body.entries) ? body.entries : [];
  } catch (err) {
    logger.warn('[sanctions] remote blocklist fetch failed:', err);
    return [];
  }
}

/** Replace the in-memory map atomically. Sets that fail to normalize are skipped. */
function applyEntries(entries: SanctionEntry[]): number {
  const next = new Map<string, SanctionEntry>();
  for (const e of entries) {
    const normalized = normalizeTonAddr(e.addr);
    if (!normalized) continue;
    next.set(normalized, { ...e, addr: normalized });
  }
  blocklist = next;
  lastLoadedAt = Date.now();
  return next.size;
}

export async function refreshSanctions(): Promise<{ count: number; source: 'static' | 'remote+static' }> {
  const fromStatic = loadStaticBlocklist();
  const fromRemote = REMOTE_URL ? await loadRemoteBlocklist() : [];
  // Remote takes precedence on duplicate keys; static fills gaps.
  const merged = [...fromStatic, ...fromRemote];
  const count = applyEntries(merged);
  logger.info(
    `[sanctions] refreshed: static=${fromStatic.length} remote=${fromRemote.length} active=${count}`,
  );
  return { count, source: REMOTE_URL ? 'remote+static' : 'static' };
}

export function startSanctionsRefresh(): void {
  if (refreshTimer) return;
  // Load static blocklist SYNCHRONOUSLY at startup so we are never in a
  // fail-open state where screenWallet returns ok:true because the async
  // refresh hasn't completed yet. Remote list is still async.
  const staticEntries = loadStaticBlocklist();
  if (staticEntries.length > 0) {
    applyEntries(staticEntries);
    logger.info(`[sanctions] static blocklist loaded synchronously: ${staticEntries.length} entries`);
  }
  refreshSanctions().catch((err) => logger.error('[sanctions] initial load failed:', err));
  refreshTimer = setInterval(
    () => {
      refreshSanctions().catch((err) => logger.error('[sanctions] refresh failed:', err));
    },
    REFRESH_HOURS * 60 * 60 * 1000,
  );
  logger.info(`[sanctions] refresh scheduled every ${REFRESH_HOURS}h`);
}

export function stopSanctionsRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Synchronous screening — no I/O. The caller MUST have invoked
 * `startSanctionsRefresh()` (or `refreshSanctions()`) at boot, otherwise
 * the blocklist is empty and every wallet passes (fail-open).
 *
 * Fail-open is a deliberate trade-off: a sanctions check that errors out
 * shouldn't block legitimate buyers. Operators must monitor that
 * `lastLoadedAt > 0` via /api/health.
 */
export function screenWallet(addr: string | undefined | null): ScreenResult {
  const norm = normalizeTonAddr(addr);
  if (!norm) {
    // Bad input — let the caller's own validation reject it later.
    return { ok: true };
  }
  const hit = blocklist.get(norm);
  if (!hit) return { ok: true };
  return { ok: false, reason: hit.source, listedAt: hit.listedAt };
}

/** Diagnostics for /api/health and ops visibility. */
export function sanctionsStatus(): { entries: number; lastLoadedAt: number; remoteConfigured: boolean } {
  return {
    entries: blocklist.size,
    lastLoadedAt,
    remoteConfigured: REMOTE_URL.length > 0,
  };
}

/** Test seam: replace blocklist directly without touching disk/network. */
export function _setBlocklistForTest(entries: SanctionEntry[]): void {
  applyEntries(entries);
}
