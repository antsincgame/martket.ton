import { describe, it, expect } from 'vitest';
import { resolveNextSeqno, type SeqnoSource } from './oracleWallet.js';

/** Mock wallet whose getSeqno walks a scripted sequence of values. */
function walletReturning(values: number[]): SeqnoSource & { calls: number } {
  const w = {
    calls: 0,
    async getSeqno() {
      const v = values[Math.min(this.calls, values.length - 1)]!;
      this.calls += 1;
      return v;
    },
  };
  return w;
}

describe('resolveNextSeqno (B-1 oracle serialization)', () => {
  it('uses the fresh on-chain seqno when there is no prior send', async () => {
    const w = walletReturning([7]);
    expect(await resolveNextSeqno(w, null)).toBe(7);
  });

  it('uses the on-chain seqno when it has already advanced past the prior send', async () => {
    // prior send used seqno 7; chain now reports 8 → confirmed, use 8.
    const w = walletReturning([8]);
    expect(await resolveNextSeqno(w, 7)).toBe(8);
  });

  it('WAITS for the chain to confirm the prior send before reading a fresh seqno', async () => {
    // getSeqno: first read still stale (7), then confirms (8) on the wait poll,
    // then the post-confirm read (8). Without the wait, the next send would reuse 7.
    const w = walletReturning([7, 8, 8]);
    const seqno = await resolveNextSeqno(w, 7, { timeoutMs: 1000, intervalMs: 5 });
    expect(seqno).toBe(8);
    expect(w.calls).toBeGreaterThanOrEqual(3);
  });

  it('throws when the prior send never confirms (stuck) — refuses to risk a collision', async () => {
    const w = walletReturning([7]); // stays at 7 forever
    await expect(resolveNextSeqno(w, 7, { timeoutMs: 30, intervalMs: 5 })).rejects.toThrow(/not confirmed/);
  });
});
