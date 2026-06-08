import { describe, it, expect, afterEach } from 'vitest';
import { loadOnchainConfig } from './config.js';
import { resolveNetwork } from '../../config/network.js';

const orig = process.env.TON_NETWORK;
afterEach(() => {
  if (orig === undefined) delete process.env.TON_NETWORK;
  else process.env.TON_NETWORK = orig;
});

// Regression: this module used to hard-code its own `testnet` default for
// TON_NETWORK while config/network.ts defaulted `mainnet` — a split-brain when
// the var was unset. The two must now resolve to the same network.
describe('loadOnchainConfig network — single source with config/network.ts', () => {
  it('defaults to mainnet when TON_NETWORK is unset, and matches resolveNetwork', () => {
    delete process.env.TON_NETWORK;
    expect(loadOnchainConfig().network).toBe('mainnet');
    expect(loadOnchainConfig().network).toBe(resolveNetwork());
  });

  it('resolves testnet (and matches resolveNetwork) when TON_NETWORK=testnet', () => {
    process.env.TON_NETWORK = 'testnet';
    expect(loadOnchainConfig().network).toBe('testnet');
    expect(loadOnchainConfig().network).toBe(resolveNetwork());
  });

  it('resolves mainnet when TON_NETWORK=mainnet', () => {
    process.env.TON_NETWORK = 'mainnet';
    expect(loadOnchainConfig().network).toBe('mainnet');
  });
});
