/**
 * AML-скоринг TON-кошельков через AMLBot (partner API, Silença Tech).
 *
 * Назначение: оценка «чистоты денег» кошелька по истории его связей
 * (миксеры, даркнет, санкционные сущности, скам, ransomware и т.д.).
 * Дополняет санкционный скрининг backend/sanctions/screen.ts: тот ловит
 * только прямые попадания адреса в OFAC/EU-списки, AML-скоринг — рисковые
 * связи происхождения средств.
 *
 * Принципы (симметрично sanctions/screen.ts):
 *   - fail-open: ошибка провайдера/сети/кэша НИКОГДА не блокирует сделку,
 *     только логируется. Блокирует исключительно явный вердикт high_risk.
 *   - выключено по умолчанию: без AMLBOT_ACCESS_ID все проверки = ok.
 *   - кэш вердиктов в Appwrite (`marketplace.aml_checks`) с TTL
 *     AML_CACHE_HOURS, чтобы не жечь платные проверки на каждый заказ
 *     одного и того же кошелька.
 *
 * env:
 *   AMLBOT_ACCESS_ID   — accessId из кабинета AMLBot (обязателен для включения)
 *   AMLBOT_ACCESS_KEY  — если выдан аккаунту, входит в подпись запроса
 *   AMLBOT_API_URL     — endpoint partner API (default extrnlapiendpoint.silencatech.com)
 *   AMLBOT_ASSET       — код актива (default TON)
 *   AML_RISK_THRESHOLD — порог блокировки 1..100 (default 70)
 *   AML_CACHE_HOURS    — TTL кэша вердиктов в часах (default 168 = 7 дней)
 *
 * ВАЖНО: рецепт подписи (hash) сверить с PDF-докой из кабинета AMLBot после
 * онбординга. Стандартная схема — md5(address + asset + accessId); у части
 * аккаунтов в конкатенацию добавляется accessKey. Оба варианта поддержаны
 * через env без правок кода (см. buildCheckPayload).
 */

import { createHash } from 'crypto';
import { databases, ID, Query } from '../commerce/appwrite.js';
import { DATABASE_ID, COL_AML_CHECKS } from '../commerce/constants.js';
import { normalizeTonAddr } from '../sanctions/screen.js';
import { logger } from '../logger.js';

export type AmlSource = 'amlbot' | 'cache' | 'disabled' | 'bad_address' | 'error';

export interface AmlVerdict {
  ok: boolean;
  /** Нормализованный риск 0..100 (null, если проверка не выполнялась). */
  riskScore: number | null;
  source: AmlSource;
  reason?: 'AML_HIGH_RISK';
  checkedAt: string;
}

interface AmlConfig {
  enabled: boolean;
  apiUrl: string;
  accessId: string;
  accessKey: string;
  asset: string;
  threshold: number;
  cacheHours: number;
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = parseInt(raw || '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function readConfig(): AmlConfig {
  const accessId = (process.env.AMLBOT_ACCESS_ID || '').trim();
  return {
    enabled: accessId.length > 0,
    apiUrl: process.env.AMLBOT_API_URL || 'https://extrnlapiendpoint.silencatech.com/',
    accessId,
    accessKey: (process.env.AMLBOT_ACCESS_KEY || '').trim(),
    asset: process.env.AMLBOT_ASSET || 'TON',
    threshold: clampInt(process.env.AML_RISK_THRESHOLD, 70, 1, 100),
    cacheHours: clampInt(process.env.AML_CACHE_HOURS, 168, 1, 24 * 365),
  };
}

export function amlEnabled(): boolean {
  return readConfig().enabled;
}

/** Диагностика для /api/health и ops-видимости. */
export function amlStatus(): { enabled: boolean; threshold: number; cacheHours: number; asset: string } {
  const cfg = readConfig();
  return { enabled: cfg.enabled, threshold: cfg.threshold, cacheHours: cfg.cacheHours, asset: cfg.asset };
}

/**
 * Тело POST-запроса к partner API. Вынесено в чистую функцию ради тестов
 * и лёгкой подстройки под фактический контракт аккаунта.
 */
export function buildCheckPayload(
  address: string,
  asset: string,
  accessId: string,
  accessKey = '',
): URLSearchParams {
  const hash = createHash('md5').update(address + asset + accessId + accessKey).digest('hex');
  const params = new URLSearchParams();
  params.set('hash', hash);
  params.set('address', address);
  params.set('asset', asset);
  params.set('accessId', accessId);
  params.set('locale', 'en');
  params.set('flow', 'fast');
  return params;
}

/**
 * Нормализация riskscore провайдера к 0..100.
 * AMLBot отдаёт долю 0..1; на всякий случай принимаем и проценты.
 */
export function parseRiskScore(raw: unknown): number | null {
  if (typeof raw === 'string' && raw.trim() === '') return null;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  const pct = n <= 1 ? n * 100 : n;
  if (pct > 100) return null;
  return Math.round(pct);
}

export function evaluateVerdict(riskScore: number, threshold: number): 'ok' | 'high_risk' {
  return riskScore >= threshold ? 'high_risk' : 'ok';
}

export function isCacheFresh(checkedAtIso: string | null | undefined, ttlHours: number): boolean {
  if (!checkedAtIso) return false;
  const ts = new Date(checkedAtIso).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < ttlHours * 60 * 60 * 1000;
}

interface AmlBotResponse {
  result?: boolean;
  description?: string;
  data?: { riskscore?: unknown; signals?: Record<string, unknown> };
}

interface CacheDoc {
  $id: string;
  riskScore: number;
  verdict: string;
  checkedAt: string;
}

async function readCache(walletNorm: string): Promise<CacheDoc | null> {
  try {
    const { documents } = await databases().listDocuments(DATABASE_ID, COL_AML_CHECKS, [
      Query.equal('wallet', walletNorm),
      Query.limit(1),
    ]);
    const doc = documents[0] as Record<string, unknown> | undefined;
    if (!doc) return null;
    return {
      $id: String(doc.$id),
      riskScore: Number(doc.riskScore ?? -1),
      verdict: String(doc.verdict || ''),
      checkedAt: String(doc.checkedAt || ''),
    };
  } catch (err) {
    // Коллекция может быть ещё не запровижинена — это не повод блокировать поток.
    logger.warn('[aml] cache read failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function upsertCache(
  walletNorm: string,
  asset: string,
  riskScore: number,
  verdict: string,
  providerRaw: string,
): Promise<void> {
  const payload = {
    wallet: walletNorm,
    asset,
    riskScore,
    verdict,
    providerRaw: providerRaw.slice(0, 3900),
    checkedAt: new Date().toISOString(),
  };
  try {
    const { documents } = await databases().listDocuments(DATABASE_ID, COL_AML_CHECKS, [
      Query.equal('wallet', walletNorm),
      Query.limit(1),
    ]);
    const existing = documents[0];
    if (existing) {
      await databases().updateDocument(DATABASE_ID, COL_AML_CHECKS, existing.$id, payload);
    } else {
      await databases().createDocument(DATABASE_ID, COL_AML_CHECKS, ID.unique(), payload);
    }
  } catch (err) {
    logger.warn('[aml] cache write failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Главная точка входа: вердикт по кошельку с кэшем и fail-open семантикой.
 * ok=false ТОЛЬКО при подтверждённом высоком риске (от провайдера или из
 * свежего кэша). Любая ошибка инфраструктуры → ok=true + warn в лог.
 */
export async function checkWalletAml(rawAddress: string | undefined | null): Promise<AmlVerdict> {
  const now = new Date().toISOString();
  const cfg = readConfig();
  if (!cfg.enabled) {
    return { ok: true, riskScore: null, source: 'disabled', checkedAt: now };
  }

  const norm = normalizeTonAddr(rawAddress);
  if (!norm) {
    // Невалидный адрес отбракует собственная валидация роутов.
    return { ok: true, riskScore: null, source: 'bad_address', checkedAt: now };
  }

  const cached = await readCache(norm);
  if (cached && cached.riskScore >= 0 && isCacheFresh(cached.checkedAt, cfg.cacheHours)) {
    const verdict = evaluateVerdict(cached.riskScore, cfg.threshold);
    const result: AmlVerdict = {
      ok: verdict === 'ok',
      riskScore: cached.riskScore,
      source: 'cache',
      checkedAt: cached.checkedAt,
    };
    if (verdict !== 'ok') result.reason = 'AML_HIGH_RISK';
    return result;
  }

  let body: AmlBotResponse;
  try {
    const res = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildCheckPayload(String(rawAddress).trim(), cfg.asset, cfg.accessId, cfg.accessKey).toString(),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    body = (await res.json()) as AmlBotResponse;
  } catch (err) {
    logger.warn('[aml] provider request failed (fail-open):', err instanceof Error ? err.message : err);
    return { ok: true, riskScore: null, source: 'error', checkedAt: now };
  }

  const riskScore = body.result === true ? parseRiskScore(body.data?.riskscore) : null;
  if (riskScore === null) {
    logger.warn(`[aml] unparsable provider response (fail-open): ${JSON.stringify(body).slice(0, 300)}`);
    return { ok: true, riskScore: null, source: 'error', checkedAt: now };
  }

  const verdict = evaluateVerdict(riskScore, cfg.threshold);
  await upsertCache(norm, cfg.asset, riskScore, verdict, JSON.stringify(body));
  if (verdict === 'high_risk') {
    logger.warn(`[aml] HIGH RISK wallet=${norm} score=${riskScore} threshold=${cfg.threshold}`);
  }

  const result: AmlVerdict = {
    ok: verdict === 'ok',
    riskScore,
    source: 'amlbot',
    checkedAt: now,
  };
  if (verdict !== 'ok') result.reason = 'AML_HIGH_RISK';
  return result;
}
