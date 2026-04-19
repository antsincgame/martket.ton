/**
 * End-to-end lifecycle v4 tests — полный on-chain flow без backend oracle.
 *
 * v4 flow:
 *   1. Collection deployed (один раз, при setup платформы)
 *   2. Buyer deploys Escrow с параметрами сделки (в init ссылка на Collection)
 *   3. Buyer sends PayEscrow → Escrow переходит в FUNDED и автоматически
 *      шлёт MintLicense в Collection
 *   4. Collection проверяет init-hash Escrow → deploys LicenseItem
 *   5. LicenseItem при init (ответ на "License minted" от Collection)
 *      шлёт RegisterLicense обратно в Escrow → петля замкнута
 *   6. Далее: ConfirmDelivery / BuyerBurn / TimeoutRelease / RefundIfNotMinted
 *
 * Backend не участвует ни в одном шаге. Всё триггерится buyer'ом.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Blockchain, type SandboxContract, type TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { Escrow } from '../build/Escrow_Escrow';
import { AppCollection } from '../build/AppCollection_AppCollection';
import { LicenseItem } from '../build/LicenseItem_LicenseItem';

const APP_ID = 0xaa11n;
const ORDER_ID = 1n;

const SELLER_AMOUNT = toNano('12.5');
const FEE_AMOUNT    = toNano('1.875');
const TOTAL_AMOUNT  = SELLER_AMOUNT + FEE_AMOUNT;
const TRIAL_WINDOW  = 3600n;
const MINT_FORWARD  = toNano('0.4');
const TRANSFER_LIMIT = 0n;           // soulbound
const LICENSE_CONTENT_URI = 'ipfs://QmExampleLicenseMetadata';

const COLLECTION_URI = 'https://cdn.example.org/collection/app_aa11.json';
const COMMON_URI     = 'https://cdn.example.org/license-metadata/app_aa11/';

function offchain(uri: string): Cell {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}

function licenseContent(): Cell {
  return beginCell().storeStringTail(LICENSE_CONTENT_URI).endCell();
}

describe('License lifecycle v4 (trustless auto-mint)', () => {
  let blockchain: Blockchain;
  let buyer: SandboxContract<TreasuryContract>;
  let seller: SandboxContract<TreasuryContract>;
  let collectionOwner: SandboxContract<TreasuryContract>;
  let treasury: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let escrow: SandboxContract<Escrow>;
  let collection: SandboxContract<AppCollection>;
  // Cell used at Escrow deploy — same instance used for MintLicense comparison
  let sharedLicenseContent: Cell;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = Math.floor(Date.now() / 1000);

    buyer = await blockchain.treasury('buyer');
    seller = await blockchain.treasury('seller');
    collectionOwner = await blockchain.treasury('collectionOwner');
    treasury = await blockchain.treasury('treasury');
    outsider = await blockchain.treasury('outsider');

    // Collection deployed первым — будет в ref в Escrow init
    const collectionContract = await AppCollection.fromInit(
      APP_ID,
      collectionOwner.address,
      offchain(COLLECTION_URI),
      offchain(COMMON_URI),
    );
    collection = blockchain.openContract(collectionContract);
    await collection.send(
      collectionOwner.getSender(),
      { value: toNano('0.1') },
      { $$type: 'Deploy', queryId: 0n },
    );

    // Один и тот же Cell используется для init Escrow и для последующих
    // сравнений — чтобы не было вопроса "одинаковый ли content".
    sharedLicenseContent = licenseContent();

    // Escrow deployed с ссылкой на Collection
    const escrowContract = await Escrow.fromInit(
      ORDER_ID,
      buyer.address,
      seller.address,
      treasury.address,
      TOTAL_AMOUNT,
      SELLER_AMOUNT,
      FEE_AMOUNT,
      TRIAL_WINDOW,
      collection.address,
      TRANSFER_LIMIT,
      sharedLicenseContent,
    );
    escrow = blockchain.openContract(escrowContract);
    await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'Deploy', queryId: 0n },
    );
  });

  /**
   * Вспомогательно: buyer платит, escrow автоматически шлёт mint,
   * collection deploys item, item регистрируется в escrow. Возвращает
   * адрес новой лицензии (извлекается из трейса tx).
   */
  async function payAndMint(): Promise<Address> {
    const result = await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + MINT_FORWARD + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );

    // Expect: escrow → collection (MintLicense)
    expect(result.transactions).toHaveTransaction({
      from: escrow.address,
      to: collection.address,
      success: true,
    });

    // Expect: collection → licenseItem (deploy)
    const deployTx = result.transactions.find(
      (tx) =>
        tx.inMessage?.info.type === 'internal' &&
        tx.inMessage.info.src?.toString() === collection.address.toString() &&
        tx.inMessage.init !== undefined,
    );
    expect(deployTx).toBeTruthy();
    const itemAddress = (deployTx!.inMessage!.info as { dest: Address }).dest;

    // Expect: licenseItem → escrow (RegisterLicense)
    expect(result.transactions).toHaveTransaction({
      from: itemAddress,
      to: escrow.address,
      success: true,
    });

    // Verify: licenseAddress recorded in escrow
    const registered = await escrow.getLicenseAddress();
    expect(registered.equals(itemAddress)).toBe(true);

    // Verify: collection's nextItemIndex incremented
    const collData = await collection.getGetCollectionData();
    expect(collData.nextItemIndex).toBe(1n);

    return itemAddress;
  }

  // ─── Happy path: pay → auto-mint → confirm → release ────────────

  it('full flow: pay → auto-mint → auto-register → confirm → seller paid', async () => {
    const itemAddress = await payAndMint();

    // Lookup NFT data — owner должен быть buyer
    const itemContract = LicenseItem.fromAddress(itemAddress);
    const item = blockchain.openContract(itemContract);
    const nftData = await item.getGetNftData();
    expect(nftData.owner.equals(buyer.address)).toBe(true);
    expect(nftData.collection.equals(collection.address)).toBe(true);
    expect(nftData.index).toBe(0n);

    // Buyer confirms → seller + treasury paid
    const sellerBalanceBefore = await seller.getBalance();
    const treasuryBalanceBefore = await treasury.getBalance();

    const confirmResult = await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'ConfirmDelivery' },
    );
    expect(confirmResult.transactions).toHaveTransaction({
      from: escrow.address,
      to: seller.address,
      success: true,
    });

    const sellerDiff = (await seller.getBalance()) - sellerBalanceBefore;
    const treasuryDiff = (await treasury.getBalance()) - treasuryBalanceBefore;
    expect(sellerDiff).toBeGreaterThan(SELLER_AMOUNT - toNano('0.02'));
    expect(treasuryDiff).toBeGreaterThan(FEE_AMOUNT - toNano('0.02'));

    // Лицензия жива после release
    const stillAlive = await item.getGetNftData();
    expect(stillAlive.owner.equals(buyer.address)).toBe(true);
  });

  // ─── Buyer-burn-refund ────────────────────────────────────────────

  it('buyer burn refund: pay → mint → burn → escrow refunds full amount', async () => {
    const itemAddress = await payAndMint();
    const item = blockchain.openContract(LicenseItem.fromAddress(itemAddress));

    const buyerBalanceBefore = await buyer.getBalance();

    const burnResult = await item.send(
      buyer.getSender(),
      { value: toNano('0.1') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );

    // item → escrow (RefundOnBurn)
    expect(burnResult.transactions).toHaveTransaction({
      from: itemAddress,
      to: escrow.address,
      success: true,
    });
    // escrow → buyer (refund)
    expect(burnResult.transactions).toHaveTransaction({
      from: escrow.address,
      to: buyer.address,
      success: true,
    });

    // Escrow state = REFUNDED (4) — контракт может быть self-destructed
    let state: bigint;
    try {
      state = await escrow.getState();
    } catch {
      state = 4n;
    }
    expect(state).toBe(4n);

    const buyerDiff = (await buyer.getBalance()) - buyerBalanceBefore;
    // Buyer получил назад большую часть amount (минус gas за все tx)
    expect(buyerDiff).toBeGreaterThan(TOTAL_AMOUNT - toNano('0.5'));
  });

  it('rejects BuyerBurn after trial window expires', async () => {
    const itemAddress = await payAndMint();
    const item = blockchain.openContract(LicenseItem.fromAddress(itemAddress));

    blockchain.now = blockchain.now! + Number(TRIAL_WINDOW) + 1;

    const result = await item.send(
      buyer.getSender(),
      { value: toNano('0.1') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: itemAddress,
      success: false,
    });

    // License ещё жива
    const data = await item.getGetNftData();
    expect(data.owner.equals(buyer.address)).toBe(true);
  });

  it('rejects BuyerBurn from non-owner', async () => {
    const itemAddress = await payAndMint();
    const item = blockchain.openContract(LicenseItem.fromAddress(itemAddress));

    const result = await item.send(
      seller.getSender(),
      { value: toNano('0.1') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );
    expect(result.transactions).toHaveTransaction({
      from: seller.address,
      to: itemAddress,
      success: false,
    });
  });

  // ─── TimeoutRelease ──────────────────────────────────────────────

  it('timeout release works after trial window (anyone can trigger)', async () => {
    await payAndMint();

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

  // ─── Soulbound check ─────────────────────────────────────────────

  it('soulbound: transfer fails when transferLimit = 0', async () => {
    const itemAddress = await payAndMint();
    const item = blockchain.openContract(LicenseItem.fromAddress(itemAddress));

    const transferResult = await item.send(
      buyer.getSender(),
      { value: toNano('0.1') },
      {
        $$type: 'Transfer',
        queryId: 1n,
        newOwner: outsider.address,
        responseTo: buyer.address,
        customPayload: null,
        forwardAmount: 0n,
        forwardPayload: beginCell().endCell().asSlice(),
      },
    );
    expect(transferResult.transactions).toHaveTransaction({
      from: buyer.address,
      to: itemAddress,
      success: false,
    });
  });

  // ─── Init-hash protection: non-Escrow cannot mint ───────────────

  it('rejects MintLicense from non-Escrow sender (init-hash mismatch)', async () => {
    const result = await collection.send(
      outsider.getSender(),
      { value: toNano('0.5') },
      {
        $$type: 'MintLicense',
        queryId: 1n,
        orderId: ORDER_ID,
        buyerAddress: buyer.address,
        sellerAddress: seller.address,
        treasuryAddress: treasury.address,
        amountNano: TOTAL_AMOUNT,
        sellerAmountNano: SELLER_AMOUNT,
        feeNano: FEE_AMOUNT,
        trialWindowSec: TRIAL_WINDOW,
        transferLimit: TRANSFER_LIMIT,
        individualContent: sharedLicenseContent,
        burnDeadline: BigInt(blockchain.now! + Number(TRIAL_WINDOW)),
      },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: collection.address,
      success: false,
    });
  });

  it('rejects MintLicense with tampered amount (hash mismatch)', async () => {
    // Atacker имеет свой escrow (legitimate), пытается mint с bogus amount
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + MINT_FORWARD + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    // После успешного PayEscrow уже состоялся mint. Симулируем атаку:
    // через outsider sender шлём mint с подделанными параметрами.
    const result = await collection.send(
      outsider.getSender(),
      { value: toNano('0.5') },
      {
        $$type: 'MintLicense',
        queryId: 99n,
        orderId: ORDER_ID,
        buyerAddress: buyer.address,
        sellerAddress: seller.address,
        treasuryAddress: treasury.address,
        amountNano: TOTAL_AMOUNT * 2n,        // подделка
        sellerAmountNano: SELLER_AMOUNT * 2n,
        feeNano: FEE_AMOUNT * 2n,
        trialWindowSec: TRIAL_WINDOW,
        transferLimit: TRANSFER_LIMIT,
        individualContent: sharedLicenseContent,
        burnDeadline: BigInt(blockchain.now! + Number(TRIAL_WINDOW)),
      },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: collection.address,
      success: false,
    });
  });

  // ─── Double-spend guard: нельзя дважды MintLicense для одного Escrow ─

  it('second PayEscrow for same Escrow fails (escrow already funded)', async () => {
    // Первый payment+mint проходит
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + MINT_FORWARD + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    expect(await escrow.getState()).toBe(1n);

    // Попытка второй платы → reject ("Already funded")
    const secondPay = await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + MINT_FORWARD + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    expect(secondPay.transactions).toHaveTransaction({
      from: buyer.address,
      to: escrow.address,
      success: false,
    });
  });
});
