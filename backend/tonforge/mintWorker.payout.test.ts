import { describe, it, expect, vi, beforeEach } from 'vitest';

// The seller payout cycle releases escrowed funds via TimeoutRelease after the
// trial window. Before doing so it MUST re-screen the seller (sanctions + AML) —
// a wallet that was clean at listing time may be designated later. This pins
// that compliance HOLD, the highest business-risk branch of the money path.

vi.mock('../commerce/licenseRepository.js', () => ({
  listMintCandidates: vi.fn().mockResolvedValue([]),
  listRefundCandidates: vi.fn().mockResolvedValue([]),
  listRefundPending: vi.fn().mockResolvedValue([]),
  listPayoutCandidates: vi.fn(),
  updateLicense: vi.fn().mockResolvedValue({}),
}));
vi.mock('../commerce/distributedLock.js', () => ({
  withLock: (_name: string, _ttl: number, fn: () => Promise<void>) => fn(),
}));
vi.mock('./onchain/config.js', () => ({ loadOnchainConfig: vi.fn() }));
vi.mock('./onchain/mintLicense.js', () => ({ mintLicense: vi.fn(), pollItemDeployed: vi.fn() }));
vi.mock('./onchain/registerLicense.js', () => ({ registerLicense: vi.fn() }));
vi.mock('./onchain/oracleRefund.js', () => ({ pollEscrowSettled: vi.fn() }));
vi.mock('./onchain/timeoutRelease.js', () => ({ timeoutRelease: vi.fn(), checkEscrowAlive: vi.fn() }));
vi.mock('../commerce/handlers/finalizeOrderRefund.js', () => ({ finalizeOrderRefund: vi.fn() }));
vi.mock('../sanctions/screen.js', () => ({ screenWallet: vi.fn() }));
vi.mock('../aml/amlbot.js', () => ({ checkWalletAml: vi.fn() }));

import { triggerPayoutLoop } from './mintWorker.js';
import { loadOnchainConfig } from './onchain/config.js';
import { listPayoutCandidates, updateLicense } from '../commerce/licenseRepository.js';
import { timeoutRelease, checkEscrowAlive } from './onchain/timeoutRelease.js';
import { pollEscrowSettled } from './onchain/oracleRefund.js';
import { screenWallet } from '../sanctions/screen.js';
import { checkWalletAml } from '../aml/amlbot.js';

const m = (f: unknown) => f as unknown as ReturnType<typeof vi.fn>;
const LICENSE = { $id: 'lic1', escrowAddress: 'EQescrow', sellerWallet: 'EQseller' };

beforeEach(() => {
  vi.clearAllMocks();
  m(loadOnchainConfig).mockReturnValue({ enabled: true });
  m(listPayoutCandidates).mockResolvedValue([LICENSE]);
  m(checkEscrowAlive).mockResolvedValue('active');
  m(screenWallet).mockReturnValue({ ok: true });
  m(checkWalletAml).mockResolvedValue({ ok: true });
  m(timeoutRelease).mockResolvedValue({ txSeqno: 1 });
  m(pollEscrowSettled).mockResolvedValue(true);
});

describe('triggerPayoutLoop — compliance gate before seller payout', () => {
  it('no-ops when on-chain integration is disabled', async () => {
    m(loadOnchainConfig).mockReturnValue({ enabled: false });
    await triggerPayoutLoop();
    expect(listPayoutCandidates).not.toHaveBeenCalled();
    expect(timeoutRelease).not.toHaveBeenCalled();
  });

  it('releases to the seller when sanctions + AML screening pass', async () => {
    await triggerPayoutLoop();
    expect(timeoutRelease).toHaveBeenCalledTimes(1);
    expect(updateLicense).toHaveBeenCalledWith('lic1', expect.objectContaining({ releasedAt: expect.any(String) }));
  });

  it('HOLDS the payout (no TimeoutRelease, no releasedAt) when the seller fails AML', async () => {
    m(checkWalletAml).mockResolvedValue({ ok: false, riskScore: 90 });
    await triggerPayoutLoop();
    expect(timeoutRelease).not.toHaveBeenCalled();
    expect(updateLicense).not.toHaveBeenCalledWith('lic1', expect.objectContaining({ releasedAt: expect.anything() }));
  });

  it('HOLDS the payout when the seller is sanctioned, before the (paid) AML call', async () => {
    m(screenWallet).mockReturnValue({ ok: false, reason: 'OFAC_SDN' });
    await triggerPayoutLoop();
    expect(checkWalletAml).not.toHaveBeenCalled(); // sanctions checked first (O(1), free)
    expect(timeoutRelease).not.toHaveBeenCalled();
  });

  it('stamps releasedAt without releasing again when the escrow is already destroyed', async () => {
    m(checkEscrowAlive).mockResolvedValue('destroyed');
    await triggerPayoutLoop();
    expect(timeoutRelease).not.toHaveBeenCalled();
    expect(updateLicense).toHaveBeenCalledWith('lic1', expect.objectContaining({ releasedAt: expect.any(String) }));
  });
});
