import { describe, expect, it, afterEach } from 'vitest';
import type { Request } from 'express';
import { getNetworkConfig, resolveNetwork } from './network.js';

describe('getNetworkConfig', () => {
  it('returns mainnet config by default', () => {
    const cfg = getNetworkConfig('mainnet');
    expect(cfg.network).toBe('mainnet');
    expect(cfg.tonapiBase).toContain('tonapi.io');
    expect(typeof cfg.trialWindowSec).toBe('number');
    expect(cfg.trialWindowSec).toBeGreaterThan(0);
  });

  it('returns testnet config with testnet base URL', () => {
    const cfg = getNetworkConfig('testnet');
    expect(cfg.network).toBe('testnet');
    expect(cfg.tonapiBase).toContain('testnet');
  });
});

describe('resolveNetwork (server-pinned, ignores client header)', () => {
  const orig = process.env.TON_NETWORK;
  afterEach(() => {
    if (orig === undefined) delete process.env.TON_NETWORK;
    else process.env.TON_NETWORK = orig;
  });

  function reqWith(headerVal?: string): Request {
    return {
      get: (h: string) => (h.toLowerCase() === 'x-ton-network' ? headerVal : undefined),
      query: {},
    } as unknown as Request;
  }

  it('ignores a client header asking for testnet when pinned to mainnet', () => {
    process.env.TON_NETWORK = 'mainnet';
    expect(resolveNetwork(reqWith('testnet'))).toBe('mainnet');
  });

  it('returns testnet only when the server is pinned to testnet', () => {
    process.env.TON_NETWORK = 'testnet';
    expect(resolveNetwork(reqWith(undefined))).toBe('testnet');
    expect(resolveNetwork(reqWith('mainnet'))).toBe('testnet');
  });

  it('defaults to mainnet when TON_NETWORK is unset, regardless of header', () => {
    delete process.env.TON_NETWORK;
    expect(resolveNetwork(reqWith('testnet'))).toBe('mainnet');
  });
});
