import { describe, expect, it } from 'vitest';
import { getNetworkConfig } from './network.js';

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
