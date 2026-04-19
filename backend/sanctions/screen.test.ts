import { describe, expect, it, beforeEach } from 'vitest';
import { Address } from '@ton/core';
import {
  normalizeTonAddr,
  screenWallet,
  sanctionsStatus,
  _setBlocklistForTest,
} from './screen.js';

// Real valid TON addresses (passing checksum, generated via @ton/core).
const VALID_EQ = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
const VALID_OTHER = 'EQAREREREREREREREREREREREREREREREREREREREREREeYT';
// Same wallet as VALID_EQ but in non-bounceable user-friendly form.
const VALID_UQ = Address.parse(VALID_EQ).toString({ bounceable: false });

beforeEach(() => {
  _setBlocklistForTest([]);
});

describe('normalizeTonAddr', () => {
  it('returns null for invalid input', () => {
    expect(normalizeTonAddr('')).toBeNull();
    expect(normalizeTonAddr(null)).toBeNull();
    expect(normalizeTonAddr(undefined)).toBeNull();
    expect(normalizeTonAddr('not-a-ton-address')).toBeNull();
  });

  it('returns 0:hex form for a valid user-friendly address', () => {
    const norm = normalizeTonAddr(VALID_EQ);
    expect(norm).not.toBeNull();
    expect(norm).toMatch(/^0:[0-9a-f]{64}$/);
  });

  it('collapses bounceable and non-bounceable forms of the same wallet', () => {
    const eq = normalizeTonAddr(VALID_EQ);
    const uq = normalizeTonAddr(VALID_UQ);
    expect(eq).toBe(uq);
  });
});

describe('screenWallet', () => {
  it('passes when blocklist is empty', () => {
    expect(screenWallet(VALID_EQ).ok).toBe(true);
  });

  it('passes invalid input fail-open (caller validates separately)', () => {
    expect(screenWallet('').ok).toBe(true);
    expect(screenWallet('garbage').ok).toBe(true);
  });

  it('blocks an OFAC-listed wallet and returns the source', () => {
    _setBlocklistForTest([
      { addr: VALID_EQ, source: 'OFAC_SDN', listedAt: '2024-01-15' },
    ]);
    const r = screenWallet(VALID_EQ);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('OFAC_SDN');
    expect(r.listedAt).toBe('2024-01-15');
  });

  it('matches the same wallet via a non-bounceable form', () => {
    _setBlocklistForTest([{ addr: VALID_EQ, source: 'EU_CONSOLIDATED' }]);
    expect(screenWallet(VALID_UQ).ok).toBe(false);
    expect(screenWallet(VALID_UQ).reason).toBe('EU_CONSOLIDATED');
  });

  it('does not match a different wallet', () => {
    _setBlocklistForTest([{ addr: VALID_EQ, source: 'OFAC_SDN' }]);
    expect(screenWallet(VALID_OTHER).ok).toBe(true);
  });
});

describe('sanctionsStatus', () => {
  it('reports the size of the in-memory blocklist', () => {
    _setBlocklistForTest([
      { addr: VALID_EQ, source: 'OFAC_SDN' },
    ]);
    expect(sanctionsStatus().entries).toBe(1);
  });

  it('skips entries with unparseable addresses', () => {
    _setBlocklistForTest([
      { addr: VALID_EQ, source: 'OFAC_SDN' },
      { addr: 'garbage', source: 'OFAC_SDN' },
    ]);
    expect(sanctionsStatus().entries).toBe(1);
  });
});
