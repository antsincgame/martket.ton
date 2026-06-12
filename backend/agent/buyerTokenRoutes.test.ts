import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../tonforge/onchain/verifyOwnership.js', () => ({
  verifyLicenseOwner: vi.fn(),
}));

import { verifyLicenseOwner } from '../tonforge/onchain/verifyOwnership.js';
import { proveAgentWalletOwnership } from './buyerTokenRoutes.js';
import { BUYER_TOKEN_SCOPES, SELLER_GRANTABLE_SCOPES, ALL_SCOPES } from './scopes.js';

const mockVerify = vi.mocked(verifyLicenseOwner);

describe('buyer / seller scope separation', () => {
  it('buyer token grants the buy capability plus read-only orientation, never seller writes', () => {
    expect(BUYER_TOKEN_SCOPES).toContain('orders:buy');
    expect(BUYER_TOKEN_SCOPES).toContain('instructions:read');
    for (const s of BUYER_TOKEN_SCOPES) {
      // Any future addition here must stay read-only or buy-side: a buyer
      // token must never be able to mutate listings, products, or storage.
      expect(['orders:buy', 'instructions:read']).toContain(s);
    }
  });

  it('the seller token route cannot grant orders:buy', () => {
    // Least privilege: orders:buy is issuable ONLY via the buyer-token route
    // (Lite KYC + on-chain wallet-ownership proof). It must not leak into the
    // seller-grantable set, or those gates could be sidestepped.
    expect(SELLER_GRANTABLE_SCOPES).not.toContain('orders:buy');
    // ...but it stays a real, parseable scope for the buyer surface.
    expect(ALL_SCOPES).toContain('orders:buy');
    // Every other scope is still seller-grantable (no accidental drop).
    for (const s of ALL_SCOPES) {
      if (s !== 'orders:buy') expect(SELLER_GRANTABLE_SCOPES).toContain(s);
    }
  });
});

describe('proveAgentWalletOwnership', () => {
  beforeEach(() => {
    mockVerify.mockReset();
    delete process.env.BUYER_AGENT_OWNERSHIP_CHECK;
  });
  afterEach(() => {
    delete process.env.BUYER_AGENT_OWNERSHIP_CHECK;
  });

  it("accepts the caller's own wallet without a chain call", async () => {
    const r = await proveAgentWalletOwnership('WALLET_A', 'WALLET_A');
    expect(r.ok).toBe(true);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('accepts an agentic wallet whose on-chain owner is the caller', async () => {
    mockVerify.mockResolvedValue({ ok: true });
    const r = await proveAgentWalletOwnership('AGENTIC_WALLET', 'WALLET_A');
    expect(r.ok).toBe(true);
    expect(mockVerify).toHaveBeenCalledWith('AGENTIC_WALLET', 'WALLET_A');
  });

  it('enforces the collection pin when BUYER_AGENT_WALLET_COLLECTION is set', async () => {
    process.env.BUYER_AGENT_WALLET_COLLECTION = 'EQrealcollection';
    // owner matches but the contract is NOT from the pinned agentic-wallet collection
    mockVerify.mockResolvedValue({ ok: true, collection: 'EQlookalike' });
    const bad = await proveAgentWalletOwnership('AGENTIC_WALLET', 'WALLET_A');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe('AGENT_WALLET_WRONG_COLLECTION');
    // a wallet from the pinned collection passes
    mockVerify.mockResolvedValue({ ok: true, collection: 'EQrealcollection' });
    const good = await proveAgentWalletOwnership('AGENTIC_WALLET', 'WALLET_A');
    expect(good.ok).toBe(true);
    delete process.env.BUYER_AGENT_WALLET_COLLECTION;
  });

  it("rejects binding a stranger's wallet (on-chain owner differs)", async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: 'OWNER_MISMATCH' });
    const r = await proveAgentWalletOwnership('VICTIM_WALLET', 'ATTACKER_WALLET');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('AGENT_WALLET_NOT_OWNED');
      expect(r.detail).toBe('OWNER_MISMATCH');
    }
  });

  it('fails CLOSED when the chain lookup itself fails', async () => {
    mockVerify.mockResolvedValue({ ok: false, reason: 'CONTRACT_LOOKUP_FAILED' });
    const r = await proveAgentWalletOwnership('AGENTIC_WALLET', 'WALLET_A');
    expect(r.ok).toBe(false);
  });

  it('BUYER_AGENT_OWNERSHIP_CHECK=off skips the chain proof (testnet only)', async () => {
    process.env.BUYER_AGENT_OWNERSHIP_CHECK = 'off';
    const r = await proveAgentWalletOwnership('ANY_WALLET', 'OTHER_WALLET');
    expect(r.ok).toBe(true);
    expect(mockVerify).not.toHaveBeenCalled();
  });
});
