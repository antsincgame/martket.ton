/**
 * Escrow contract sandbox tests using Tact-generated wrapper.
 *
 * Run `npm run build` in contracts/ directory before running tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Blockchain, type SandboxContract, type TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import '@ton/test-utils';
import { Escrow } from '../build/Escrow_Escrow';

describe('Escrow Contract', () => {
  let blockchain: Blockchain;
  let buyer: SandboxContract<TreasuryContract>;
  let seller: SandboxContract<TreasuryContract>;
  let treasury: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let escrow: SandboxContract<Escrow>;

  const ORDER_ID = 1n;
  const AMOUNT = toNano('1');
  const FEE_BPS = 500n;
  const DISPUTE_WINDOW = 3600n;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = Math.floor(Date.now() / 1000);
    buyer = await blockchain.treasury('buyer');
    seller = await blockchain.treasury('seller');
    treasury = await blockchain.treasury('treasury');
    outsider = await blockchain.treasury('outsider');

    const contract = await Escrow.fromInit(
      ORDER_ID,
      buyer.address,
      seller.address,
      treasury.address,
      AMOUNT,
      FEE_BPS,
      DISPUTE_WINDOW,
    );
    escrow = blockchain.openContract(contract);

    const deployResult = await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'Deploy', queryId: 0n },
    );
    expect(deployResult.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      deploy: true,
      success: true,
    });
  });

  // ─── Initial state ──────────────────────────────────────────────

  it('should deploy in INIT state', async () => {
    const state = await escrow.getState();
    expect(state).toBe(0n);
  });

  it('should store correct parties', async () => {
    const parties = await escrow.getParties();
    expect(parties.buyer.equals(buyer.address)).toBe(true);
    expect(parties.seller.equals(seller.address)).toBe(true);
    expect(parties.treasury.equals(treasury.address)).toBe(true);
  });

  it('should store correct details', async () => {
    const details = await escrow.getDetails();
    expect(details.orderId).toBe(ORDER_ID);
    expect(details.amountNano).toBe(AMOUNT);
    expect(details.feeBps).toBe(FEE_BPS);
    expect(details.disputeWindowSec).toBe(DISPUTE_WINDOW);
    expect(details.state).toBe(0n);
    expect(details.paidAt).toBe(0n);
  });

  // ─── Happy path: pay → confirm → release ────────────────────────

  it('should accept payment from buyer', async () => {
    const result = await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: true,
    });
    expect(await escrow.getState()).toBe(1n);
  });

  it('should release funds on buyer confirm', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    const sellerBalanceBefore = await seller.getBalance();
    const result = await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'ConfirmDelivery' },
    );

    expect(result.transactions).toHaveTransaction({
      from: escrow.address,
      to: seller.address,
      success: true,
    });
    expect(result.transactions).toHaveTransaction({
      from: escrow.address,
      to: treasury.address,
      success: true,
    });

    const sellerBalanceAfter = await seller.getBalance();
    const expectedSellerReceive = AMOUNT - (AMOUNT * FEE_BPS) / 10000n;
    const diff = sellerBalanceAfter - sellerBalanceBefore;
    expect(diff).toBeGreaterThan(expectedSellerReceive - toNano('0.02'));
    expect(diff).toBeLessThan(expectedSellerReceive + toNano('0.02'));
  });

  // ─── Dispute → admin refund ─────────────────────────────────────

  it('should allow buyer to open dispute', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    const result = await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'OpenDispute' },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: true,
    });
    expect(await escrow.getState()).toBe(2n);
  });

  it('should refund buyer on admin resolve_refund', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'OpenDispute' },
    );

    const buyerBalanceBefore = await buyer.getBalance();
    const result = await escrow.send(
      treasury.getSender(),
      { value: toNano('0.05') },
      { $$type: 'ResolveRefund' },
    );
    expect(result.transactions).toHaveTransaction({
      from: escrow.address,
      to: buyer.address,
      success: true,
    });
    const buyerBalanceAfter = await buyer.getBalance();
    expect(buyerBalanceAfter).toBeGreaterThan(buyerBalanceBefore);
  });

  // ─── Dispute → admin release ────────────────────────────────────

  it('should release to seller on admin resolve_release', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'OpenDispute' },
    );

    const sellerBalanceBefore = await seller.getBalance();
    await escrow.send(
      treasury.getSender(),
      { value: toNano('0.05') },
      { $$type: 'ResolveRelease' },
    );
    const sellerBalanceAfter = await seller.getBalance();
    expect(sellerBalanceAfter).toBeGreaterThan(sellerBalanceBefore);
  });

  // ─── Timeout release ───────────────────────────────────────────

  it('should allow timeout release after dispute window', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    blockchain.now = blockchain.now! + Number(DISPUTE_WINDOW) + 1;

    const sellerBalanceBefore = await seller.getBalance();
    await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'TimeoutRelease' },
    );
    expect(await seller.getBalance()).toBeGreaterThan(sellerBalanceBefore);
  });

  // ─── Rejections ─────────────────────────────────────────────────

  it('should reject payment from non-buyer', async () => {
    const result = await escrow.send(
      outsider.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: escrow.address,
      success: false,
    });
  });

  it('should reject double payment', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    const result = await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: false,
    });
  });

  it('should reject insufficient payment', async () => {
    const result = await escrow.send(
      buyer.getSender(),
      { value: AMOUNT / 2n },
      { $$type: 'PayEscrow' },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: false,
    });
  });

  it('should reject dispute from non-buyer', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    const result = await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'OpenDispute' },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: escrow.address,
      success: false,
    });
  });

  it('should reject dispute after window', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    blockchain.now = blockchain.now! + Number(DISPUTE_WINDOW) + 1;
    const result = await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'OpenDispute' },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: false,
    });
  });

  it('should reject resolve from non-admin', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'OpenDispute' },
    );
    const result = await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'ResolveRefund' },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: escrow.address,
      success: false,
    });
  });

  it('should reject timeout release during window', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    const result = await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'TimeoutRelease' },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: escrow.address,
      success: false,
    });
  });

  it('should reject confirm from non-buyer', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    const result = await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'ConfirmDelivery' },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: escrow.address,
      success: false,
    });
  });
});
