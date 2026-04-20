/**
 * Escrow v4 contract sandbox tests (Option C — backend-driven mint).
 *
 * Временно: auto-mint через init-hash check отложен. Backend шлёт MintLicense
 * в Collection сам, Escrow просто поддерживает state machine и выплаты.
 *
 * Сохранённая архитектура v4:
 * - amountNano split into sellerAmountNano + feeNano (fee поверх seller price)
 * - RefundIfNotMinted: страховка если backend не mint'нет за grace period
 * - LicenseSpec getter (collectionAddress + transferLimit)
 * - RegisterLicense с sender-check (anti-spoofing)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Blockchain, type SandboxContract, type TreasuryContract } from '@ton/sandbox';
import { beginCell, toNano } from '@ton/core';
import '@ton/test-utils';
import { Escrow } from '../build/Escrow_Escrow';

describe('Escrow v4 Contract', () => {
  let blockchain: Blockchain;
  let buyer: SandboxContract<TreasuryContract>;
  let seller: SandboxContract<TreasuryContract>;
  let treasury: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let fakeCollection: SandboxContract<TreasuryContract>;
  let escrow: SandboxContract<Escrow>;

  const ORDER_ID = 1n;
  const SELLER_AMOUNT = toNano('12.5');
  const FEE_AMOUNT    = toNano('1.875');
  const TOTAL_AMOUNT  = SELLER_AMOUNT + FEE_AMOUNT;
  const TRIAL_WINDOW  = 3600n;
  const TRANSFER_LIMIT = 0n;
  const LICENSE_CONTENT = beginCell().storeStringTail('ipfs://QmTestHash').endCell();

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = Math.floor(Date.now() / 1000);
    buyer = await blockchain.treasury('buyer');
    seller = await blockchain.treasury('seller');
    treasury = await blockchain.treasury('treasury');
    outsider = await blockchain.treasury('outsider');
    fakeCollection = await blockchain.treasury('fakeCollection');

    const contract = await Escrow.fromInit(
      ORDER_ID,
      buyer.address,
      seller.address,
      treasury.address,
      TOTAL_AMOUNT,
      SELLER_AMOUNT,
      FEE_AMOUNT,
      TRIAL_WINDOW,
      fakeCollection.address,
      TRANSFER_LIMIT,
      LICENSE_CONTENT,
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

  it('deploys in INIT state with correct amount split', async () => {
    expect(await escrow.getState()).toBe(0n);
    const details = await escrow.getDetails();
    expect(details.amountNano).toBe(TOTAL_AMOUNT);
    expect(details.sellerAmountNano).toBe(SELLER_AMOUNT);
    expect(details.feeNano).toBe(FEE_AMOUNT);
    expect(details.orderId).toBe(ORDER_ID);
    expect(details.trialWindowSec).toBe(TRIAL_WINDOW);
    expect(details.state).toBe(0n);
    expect(details.paidAt).toBe(0n);
  });

  it('stores correct parties', async () => {
    const parties = await escrow.getParties();
    expect(parties.buyer.equals(buyer.address)).toBe(true);
    expect(parties.seller.equals(seller.address)).toBe(true);
    expect(parties.treasury.equals(treasury.address)).toBe(true);
  });

  it('stores license spec', async () => {
    const spec = await escrow.getLicenseSpec();
    expect(spec.collectionAddress.equals(fakeCollection.address)).toBe(true);
    expect(spec.transferLimit).toBe(TRANSFER_LIMIT);
  });

  // ─── Invariant: deploy fails if amount split is wrong ───────────

  it('deploy fails if seller + fee != amount', async () => {
    const badEscrow = await Escrow.fromInit(
      ORDER_ID,
      buyer.address,
      seller.address,
      treasury.address,
      TOTAL_AMOUNT,
      SELLER_AMOUNT,
      FEE_AMOUNT + 1n,
      TRIAL_WINDOW,
      fakeCollection.address,
      TRANSFER_LIMIT,
      LICENSE_CONTENT,
    );
    const opened = blockchain.openContract(badEscrow);

    const deployResult = await opened.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'Deploy', queryId: 0n },
    );
    expect(deployResult.transactions).toHaveTransaction({
      from: buyer.address,
      to: opened.address,
      success: false,
    });
  });

  // ─── PayEscrow → FUNDED ─────────────────────────────────────────

  it('accepts payment from buyer and transitions to FUNDED', async () => {
    const result = await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: true,
    });
    expect(await escrow.getState()).toBe(1n);
  });

  it('rejects payment below amount', async () => {
    const result = await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT / 2n },
      { $$type: 'PayEscrow' },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: false,
    });
  });

  it('rejects payment from non-buyer', async () => {
    const result = await escrow.send(
      outsider.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: escrow.address,
      success: false,
    });
  });

  it('rejects double payment', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    const result = await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: false,
    });
  });

  // ─── ConfirmDelivery → seller + treasury get paid ────────────────

  it('releases funds on buyer confirm — seller gets sellerAmount, treasury gets fee', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    const sellerBalanceBefore = await seller.getBalance();
    const treasuryBalanceBefore = await treasury.getBalance();

    await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'ConfirmDelivery' },
    );

    const sellerDiff = (await seller.getBalance()) - sellerBalanceBefore;
    const treasuryDiff = (await treasury.getBalance()) - treasuryBalanceBefore;

    expect(sellerDiff).toBeGreaterThan(SELLER_AMOUNT - toNano('0.02'));
    expect(sellerDiff).toBeLessThanOrEqual(SELLER_AMOUNT);
    expect(treasuryDiff).toBeGreaterThan(FEE_AMOUNT - toNano('0.02'));
  });

  it('rejects confirm from non-buyer', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
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

  // ─── TimeoutRelease ─────────────────────────────────────────────

  it('allows timeout release after trial window', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    blockchain.now = blockchain.now! + Number(TRIAL_WINDOW) + 1;

    const sellerBalanceBefore = await seller.getBalance();
    await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'TimeoutRelease' },
    );
    const sellerDiff = (await seller.getBalance()) - sellerBalanceBefore;
    expect(sellerDiff).toBeGreaterThan(SELLER_AMOUNT - toNano('0.02'));
  });

  it('rejects timeout release during window', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
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

  // ─── RefundIfNotMinted ─────────────────────────────────────────

  it('buyer can refund if license not registered within grace period', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    blockchain.now = blockchain.now! + 601;

    const buyerBalanceBefore = await buyer.getBalance();
    const result = await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RefundIfNotMinted' },
    );
    expect(result.transactions).toHaveTransaction({
      from: escrow.address,
      to: buyer.address,
      success: true,
    });
    expect(await buyer.getBalance()).toBeGreaterThan(buyerBalanceBefore);
  });

  it('rejects RefundIfNotMinted before grace period', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    const result = await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RefundIfNotMinted' },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: false,
    });
  });

  it('rejects RefundIfNotMinted from non-buyer', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    blockchain.now = blockchain.now! + 601;
    const result = await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RefundIfNotMinted' },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: escrow.address,
      success: false,
    });
  });

  it('rejects RefundIfNotMinted if escrow not in FUNDED state', async () => {
    blockchain.now = blockchain.now! + 601;
    const result = await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RefundIfNotMinted' },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: false,
    });
  });

  // ─── RegisterLicense (self-registration) ─────────────────────────

  it('accepts RegisterLicense only when sender matches licenseAddress', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
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
      success: true,
    });

    const lic = await escrow.getLicenseAddress();
    expect(lic.equals(outsider.address)).toBe(true);
  });

  it('rejects RegisterLicense when sender != licenseAddress (spoofing)', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    const result = await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: buyer.address },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: escrow.address,
      success: false,
    });
  });

  it('rejects double RegisterLicense', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: outsider.address },
    );
    const second = await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: buyer.address },
    );
    expect(second.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: false,
    });
  });

  // ─── RefundOnBurn (только от зарегистрированного license) ────────

  it('rejects RefundOnBurn from non-registered sender', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
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

  it('accepts RefundOnBurn from registered license', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: outsider.address },
    );

    const buyerBalanceBefore = await buyer.getBalance();
    const result = await escrow.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RefundOnBurn' },
    );
    expect(result.transactions).toHaveTransaction({
      from: escrow.address,
      to: buyer.address,
      success: true,
    });
    expect(await buyer.getBalance()).toBeGreaterThan(buyerBalanceBefore);
  });
});
