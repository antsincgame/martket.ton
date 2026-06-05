/**
 * Тесты AML-модуля: чистые функции контракта + fail-open поведение
 * checkWalletAml без реальных Appwrite/AMLBot (env вычищается, fetch стабится).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';
import {
  buildCheckPayload,
  parseRiskScore,
  evaluateVerdict,
  isCacheFresh,
  checkWalletAml,
} from './amlbot.js';

const RAW_ZERO_ADDR = `0:${'0'.repeat(64)}`;

const ENV_KEYS = [
  'AMLBOT_ACCESS_ID',
  'AMLBOT_ACCESS_KEY',
  'AMLBOT_API_URL',
  'AMLBOT_ASSET',
  'AML_RISK_THRESHOLD',
  'AML_CACHE_HOURS',
  // Вычищаем Appwrite, чтобы кэш-операции гарантированно падали в fail-open
  // и тесты не писали в реальную базу при наличии локального .env.
  'APPWRITE_ENDPOINT',
  'APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'VITE_APPWRITE_ENDPOINT',
  'VITE_APPWRITE_PROJECT_ID',
];

let envBackup: Record<string, string | undefined> = {};

beforeEach(() => {
  envBackup = {};
  for (const k of ENV_KEYS) {
    envBackup[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    const v = envBackup[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.unstubAllGlobals();
});

describe('buildCheckPayload', () => {
  // Контракт сверен с production-интеграциями AMLBot (shkeeper, premiumbox):
  // hash = сам адрес, token = md5(`${hash}:${accessKey}:${accessId}`).
  it('hash = сам адрес, token = md5(address:accessKey:accessId)', () => {
    const p = buildCheckPayload('addr1', 'TON', 'acc1', 'key1');
    expect(p.get('hash')).toBe('addr1');
    expect(p.get('token')).toBe(createHash('md5').update('addr1:key1:acc1').digest('hex'));
    expect(p.get('asset')).toBe('TON');
    expect(p.get('accessId')).toBe('acc1');
    expect(p.get('flow')).toBe('fast');
  });

  it('без accessKey подпись строится с пустым средним сегментом', () => {
    const p = buildCheckPayload('addr1', 'TON', 'acc1');
    expect(p.get('token')).toBe(createHash('md5').update('addr1::acc1').digest('hex'));
  });
});

describe('parseRiskScore', () => {
  it('доля 0..1 конвертируется в проценты', () => {
    expect(parseRiskScore(0.42)).toBe(42);
    expect(parseRiskScore(1)).toBe(100);
  });

  it('значение в процентах остаётся как есть', () => {
    expect(parseRiskScore(73)).toBe(73);
  });

  it('строковое значение парсится', () => {
    expect(parseRiskScore('0.5')).toBe(50);
  });

  it('мусор и выход за диапазон → null', () => {
    expect(parseRiskScore('x')).toBeNull();
    expect(parseRiskScore('')).toBeNull();
    expect(parseRiskScore(-1)).toBeNull();
    expect(parseRiskScore(250)).toBeNull();
    expect(parseRiskScore(undefined)).toBeNull();
    expect(parseRiskScore(null)).toBeNull();
  });
});

describe('evaluateVerdict', () => {
  it('score >= порога → high_risk, ниже → ok', () => {
    expect(evaluateVerdict(70, 70)).toBe('high_risk');
    expect(evaluateVerdict(69, 70)).toBe('ok');
    expect(evaluateVerdict(100, 70)).toBe('high_risk');
    expect(evaluateVerdict(0, 70)).toBe('ok');
  });
});

describe('isCacheFresh', () => {
  it('свежая запись валидна, протухшая и мусорная — нет', () => {
    expect(isCacheFresh(new Date().toISOString(), 168)).toBe(true);
    expect(isCacheFresh(new Date(Date.now() - 200 * 3600 * 1000).toISOString(), 168)).toBe(false);
    expect(isCacheFresh('garbage', 168)).toBe(false);
    expect(isCacheFresh(null, 168)).toBe(false);
    expect(isCacheFresh(undefined, 168)).toBe(false);
  });
});

describe('checkWalletAml', () => {
  it('без AMLBOT_ACCESS_ID выключено → fail-open ok', async () => {
    const v = await checkWalletAml(RAW_ZERO_ADDR);
    expect(v.ok).toBe(true);
    expect(v.source).toBe('disabled');
    expect(v.riskScore).toBeNull();
  });

  it('невалидный адрес → fail-open (отбракует валидация роутов)', async () => {
    process.env.AMLBOT_ACCESS_ID = 'test-access';
    const v = await checkWalletAml('not-a-ton-address');
    expect(v.ok).toBe(true);
    expect(v.source).toBe('bad_address');
  });

  it('высокий риск от провайдера блокирует кошелёк', async () => {
    process.env.AMLBOT_ACCESS_ID = 'test-access';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: true, data: { riskscore: 0.92 } }),
      }),
    );
    const v = await checkWalletAml(RAW_ZERO_ADDR);
    expect(v.ok).toBe(false);
    expect(v.riskScore).toBe(92);
    expect(v.reason).toBe('AML_HIGH_RISK');
    expect(v.source).toBe('amlbot');
  });

  it('низкий риск пропускает кошелёк', async () => {
    process.env.AMLBOT_ACCESS_ID = 'test-access';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: true, data: { riskscore: 0.12 } }),
      }),
    );
    const v = await checkWalletAml(RAW_ZERO_ADDR);
    expect(v.ok).toBe(true);
    expect(v.riskScore).toBe(12);
    expect(v.source).toBe('amlbot');
  });

  it('ошибка провайдера → fail-open ok', async () => {
    process.env.AMLBOT_ACCESS_ID = 'test-access';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const v = await checkWalletAml(RAW_ZERO_ADDR);
    expect(v.ok).toBe(true);
    expect(v.source).toBe('error');
  });

  it('нечитаемый ответ провайдера → fail-open ok', async () => {
    process.env.AMLBOT_ACCESS_ID = 'test-access';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: false, description: 'invalid hash' }),
      }),
    );
    const v = await checkWalletAml(RAW_ZERO_ADDR);
    expect(v.ok).toBe(true);
    expect(v.source).toBe('error');
  });
});
