import { describe, expect, it } from 'vitest';
import { Address } from '@ton/core';
import { renderEscrowAddress } from './escrow.js';

// Arbitrary non-zero account in workchain 0.
const ADDR = Address.parse(`0:${'1'.repeat(64)}`);

describe('renderEscrowAddress — network-correct escrow address form', () => {
  it('mainnet → friendly, non-testnet-flagged form', () => {
    const s = renderEscrowAddress(ADDR, 'mainnet');
    expect(Address.isFriendly(s)).toBe(true);
    const parsed = Address.parseFriendly(s);
    expect(parsed.isTestOnly).toBe(false);
    expect(parsed.isBounceable).toBe(false); // escrow deposits must not bounce
    expect(parsed.address.equals(ADDR)).toBe(true);
  });

  it('testnet → testnet-flagged form', () => {
    const s = renderEscrowAddress(ADDR, 'testnet');
    expect(Address.parseFriendly(s).isTestOnly).toBe(true);
  });

  it('the two forms differ — the regression the fix closes (was hardcoded testnet)', () => {
    expect(renderEscrowAddress(ADDR, 'mainnet')).not.toBe(renderEscrowAddress(ADDR, 'testnet'));
  });
});
