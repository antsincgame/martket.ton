import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IndexType } from 'node-appwrite';

const { mCreateIndex } = vi.hoisted(() => ({ mCreateIndex: vi.fn() }));
vi.mock('./db.js', () => ({ databases: () => ({ createIndex: mCreateIndex }) }));

import { ensureSearchIndex } from './ensureSearchIndex.js';
import { logger } from '../logger.js';

beforeEach(() => { mCreateIndex.mockReset(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('ensureSearchIndex', () => {
  it('creates the fulltext index on legacy_products.name with the expected args', async () => {
    mCreateIndex.mockResolvedValue({});
    await ensureSearchIndex();
    expect(mCreateIndex).toHaveBeenCalledWith(
      'core', 'legacy_products', 'idx_name_fulltext', IndexType.Fulltext, ['name'],
    );
  });

  it('logs at info (not debug) when the index already exists (409) — ops visibility', async () => {
    const infoSpy = vi.spyOn(logger, 'info');
    mCreateIndex.mockRejectedValue({ code: 409 });
    await expect(ensureSearchIndex()).resolves.toBeUndefined();
    expect(infoSpy.mock.calls.some((c) => String(c[0]).includes('already exists'))).toBe(true);
  });

  it('warns and never throws on a non-409 failure (search falls back to in-memory)', async () => {
    const warnSpy = vi.spyOn(logger, 'warn');
    mCreateIndex.mockRejectedValue(new Error('appwrite down'));
    await expect(ensureSearchIndex()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });
});
