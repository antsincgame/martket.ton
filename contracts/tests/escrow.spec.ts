/**
 * Escrow v3 contract sandbox tests.
 *
 * v3: amountNano split into sellerAmountNano + feeNano (fee поверх цены seller),
 * RefundIfNotMinted страховка, bounced<ReleaseSeller> откат в FUNDED.
 *
 * Новая семантика fee: buyer платит amount = seller's listed price + 15% fee.
 * Seller получает sellerAmountNano, treasury получает feeNano.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Blockchain, type SandboxContract, type TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import '@ton/test-utils';
import { Escrow } from '../build/Escrow_Escrow';

describe('Escrow v3 Contract', () => {
  let blockchain: Blockchain;
  let buyer: SandboxContract<TreasuryContract>;
  let seller: SandboxContract<TreasuryContract>;
  let treasury: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let escrow: SandboxContract<Escrow>;

  const ORDER_ID = 1n;
  // Пример: seller хочет $50 → при курсе $4/TON = 12.5 TON
  // platform fee 15% = 1.875 TON
  // buyer платит 14.375 TON total
  const SELLER_AMOUNT = toNano('12.5');
  const FEE_AMOUNT    = toNano('1.875');
  const TOTAL_AMOUNT  = SELLER_AMOUNT + FEE_AMOUNT; // 14.375 TON
  const TRIAL_WINDOW  = 3600n;

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
      TOTAL_AMOUNT,
      SELLER_AMOUNT,
      FEE_AMOUNT,
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

  // ─── Invariant check: init fails if amount split is wrong ───────

  it('init fails if seller + fee != amount', async () => {
    const badInit = Escrow.fromInit(
      ORDER_ID,
      buyer.address,
      seller.address,
      treasury.address,
      TOTAL_AMOUNT,
      SELLER_AMOUNT,
      FEE_AMOUNT + 1n, // +1 nano ломает инвариант
      TRIAL_WINDOW,
    );
    await expect(badInit).rejects.toThrow();
  });

  // ─── Happy path: pay → confirm → release ────────────────────────

  it('accepts payment from buyer', async () => {
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

  it('releases funds on buyer confirm — seller gets sellerAmount, treasury gets fee', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    const sellerBalanceBefore = await seller.getBalance();
    const treasuryBalanceBefore = await treasury.getBalance();

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

    const sellerDiff = (await seller.getBalance()) - sellerBalanceBefore;
    const treasuryDiff = (await treasury.getBalance()) - treasuryBalanceBefore;

    // Seller получил ровно sellerAmount минус gas для его send
    expect(sellerDiff).toBeGreaterThan(SELLER_AMOUNT - toNano('0.02'));
    expect(sellerDiff).toBeLessThanOrEqual(SELLER_AMOUNT);

    // Treasury получил fee + сдача балaнса escrow (self-destruct)
    expect(treasuryDiff).toBeGreaterThan(FEE_AMOUNT - toNano('0.02'));
  });

  // ─── Timeout release ───────────────────────────────────────────

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

  // ─── RefundIfNotMinted (новое, v3) ─────────────────────────────

  it('buyer can refund if license not minted within grace period', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    // Ждём grace + 1 секунда (в escrow.tact MINT_GRACE_SEC = 600 = 10 мин)
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
    // grace не прошёл
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

  it('rejects RefundIfNotMinted if not funded', async () => {
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

  // ─── RefundOnBurn ─────────────────────────────────────────────────

  it('rejects RefundOnBurn from non-registered license address', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    // license не зарегистрирован — нельзя вернуть
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

  // ─── RegisterLicense (self-registration by license) ─────────────
  //
  // Новая семантика: sender должен совпадать с licenseAddress в сообщении.
  // Это означает что только сама лицензия может себя зарегистрировать —
  // атакующий не может зарегистрировать произвольный адрес как "license".

  it('accepts RegisterLicense only when sender matches licenseAddress', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    // outsider пытается зарегистрировать себя как license от имени себя → ок по новой логике,
    // но это именно outsider, не реальный mint flow. Тест того что логика sender==licenseAddress работает.
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

  it('rejects RegisterLicense when sender != licenseAddress', async () => {
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

  it('rejects RegisterLicense if already registered (no double-register)', async () => {
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
    const secondAttempt = await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: buyer.address },
    );
    expect(secondAttempt.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: false,
    });
  });

  // ─── Rejections ─────────────────────────────────────────────────

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

  it('rejects insufficient payment', async () => {
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
});
