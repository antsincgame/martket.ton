import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../tonforge/onchain/verifyOwnership.js', () => ({
  verifyLicenseOwner: vi.fn(),
}));

import { verifyLicenseOwner } from '../tonforge/onchain/verifyOwnership.js';
import { proveAgentWalletOwnership } from './buyerTokenRoutes.js';

const mockVerify = vi.mocked(verifyLicenseOwner);

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
