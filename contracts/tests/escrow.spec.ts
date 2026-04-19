/**
 * Escrow v2 contract sandbox tests.
 *
 * v2 removes disputes. Adds RegisterLicense + RefundOnBurn for trustless
 * buyer-initiated burn-and-refund.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Blockchain, type SandboxContract, type TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import '@ton/test-utils';
import { Escrow } from '../build/Escrow_Escrow';

describe('Escrow v2 Contract', () => {
  let blockchain: Blockchain;
  let buyer: SandboxContract<TreasuryContract>;
  let seller: SandboxContract<TreasuryContract>;
  let treasury: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let escrow: SandboxContract<Escrow>;

  const ORDER_ID = 1n;
  const AMOUNT = toNano('1');
  const FEE_BPS = 500n;
  const TRIAL_WINDOW = 3600n;

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
      TRIAL_WINDOW,
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
    expect(details.trialWindowSec).toBe(TRIAL_WINDOW);
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

  // ─── RegisterLicense ──────────────────────────────────────────────

  it('treasury can register license address', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    const fakeAddr = outsider.address;
    const result = await escrow.send(
      treasury.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: fakeAddr },
    );
    expect(result.transactions).toHaveTransaction({
      from: treasury.address,
      to: escrow.address,
      success: true,
    });

    const lic = await escrow.getLicenseAddress();
    expect(lic.equals(fakeAddr)).toBe(true);
  });

  it('rejects RegisterLicense from non-treasury', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    const result = await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: outsider.address },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: escrow.address,
      success: false,
    });
  });

  it('rejects RegisterLicense when not funded', async () => {
    const result = await escrow.send(
      treasury.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: outsider.address },
    );
    expect(result.transactions).toHaveTransaction({
      from: treasury.address,
      to: escrow.address,
      success: false,
    });
  });

  it('rejects RegisterLicense if license already registered (no overwrite)', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    await escrow.send(
      treasury.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: outsider.address },
    );

    const secondAddr = buyer.address;
    const result = await escrow.send(
      treasury.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: secondAddr },
    );
    expect(result.transactions).toHaveTransaction({
      from: treasury.address,
      to: escrow.address,
      success: false,
    });

    const lic = await escrow.getLicenseAddress();
    expect(lic.equals(outsider.address)).toBe(true);
  });

  // ─── RefundOnBurn ─────────────────────────────────────────────────

  it('rejects RefundOnBurn from non-registered address', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    await escrow.send(
      treasury.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: outsider.address },
    );

    const result = await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RefundOnBurn' },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: false,
    });
  });

  it('rejects RefundOnBurn when not funded', async () => {
    const result = await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RefundOnBurn' },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: escrow.address,
      success: false,
    });
  });

  // ─── OracleRefund (mint never registered → refund buyer) ───────

  it('treasury can OracleRefund when license never registered', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    const buyerBalanceBefore = await buyer.getBalance();
    const result = await escrow.send(
      treasury.getSender(),
      { value: toNano('0.05') },
      { $$type: 'OracleRefund' },
    );
    expect(result.transactions).toHaveTransaction({
      from: treasury.address,
      to: escrow.address,
      success: true,
    });
    expect(result.transactions).toHaveTransaction({
      from: escrow.address,
      to: buyer.address,
      success: true,
    });
    const buyerBalanceAfter = await buyer.getBalance();
    expect(buyerBalanceAfter).toBeGreaterThan(buyerBalanceBefore);
  });

  it('rejects OracleRefund from non-treasury', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    const result = await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'OracleRefund' },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: escrow.address,
      success: false,
    });
  });

  it('rejects OracleRefund when not funded', async () => {
    const result = await escrow.send(
      treasury.getSender(),
      { value: toNano('0.05') },
      { $$type: 'OracleRefund' },
    );
    expect(result.transactions).toHaveTransaction({
      from: treasury.address,
      to: escrow.address,
      success: false,
    });
  });

  it('rejects OracleRefund after license is registered', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    await escrow.send(
      treasury.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: outsider.address },
    );
    const result = await escrow.send(
      treasury.getSender(),
      { value: toNano('0.05') },
      { $$type: 'OracleRefund' },
    );
    expect(result.transactions).toHaveTransaction({
      from: treasury.address,
      to: escrow.address,
      success: false,
    });
  });

  // ─── Timeout release ───────────────────────────────────────────

  it('should allow timeout release after trial window', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    blockchain.now = blockchain.now! + Number(TRIAL_WINDOW) + 1;

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
