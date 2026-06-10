/**
 * End-to-end lifecycle v4 tests (Option C — backend-driven mint).
 *
 * Flow:
 *   1. Collection deployed (один раз, owner = backend signer)
 *   2. Buyer deploys Escrow с параметрами сделки
 *   3. Buyer sends PayEscrow → Escrow переходит в FUNDED
 *   4. Backend шлёт MintLicense в Collection с escrowAddress=escrow.address
 *      (в тестах симулируем: owner.send(MintLicense) прямо в Collection)
 *   5. Collection deploys LicenseItem с правильным escrowAddress
 *   6. LicenseItem при deploy ловит "License minted" от Collection, шлёт
 *      RegisterLicense обратно в Escrow
 *   7. Далее: ConfirmDelivery / BuyerBurn → RefundOnBurn / TimeoutRelease
 *
 * v4.1: MintLicense payload теперь содержит escrowAddress явным полем,
 * Collection передаёт его в initOf LicenseItem. Refund-петля
 * (BuyerBurn → RefundOnBurn → Escrow) теперь замыкается end-to-end.
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

describe('License lifecycle v4 (Option C — backend-driven)', () => {
  let blockchain: Blockchain;
  let buyer: SandboxContract<TreasuryContract>;
  let seller: SandboxContract<TreasuryContract>;
  let collectionOwner: SandboxContract<TreasuryContract>;
  let treasury: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let escrow: SandboxContract<Escrow>;
  let collection: SandboxContract<AppCollection>;
  let sharedLicenseContent: Cell;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = Math.floor(Date.now() / 1000);

    buyer = await blockchain.treasury('buyer');
    seller = await blockchain.treasury('seller');
    collectionOwner = await blockchain.treasury('collectionOwner');
    treasury = await blockchain.treasury('treasury');
    outsider = await blockchain.treasury('outsider');

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

    sharedLicenseContent = licenseContent();

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
   * Pay + mint. Возвращает (itemAddress, burnDeadline) — второе нужно чтобы
   * пересобрать LicenseItem через fromInit в тестах, которые дальше с ним
   * работают (self-register, BuyerBurn).
   */
  async function payAndMint(): Promise<{ itemAddress: Address; burnDeadline: bigint }> {
    // 1. Buyer pays
    await escrow.send(
      buyer.getSender(),
      { value: TOTAL_AMOUNT + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    expect(await escrow.getState()).toBe(1n);

    // 2. Backend (simulated by collectionOwner) шлёт MintLicense с реальным
    //    адресом Escrow в escrowAddress — это критично, без этого LicenseItem
    //    бы привязался к oracle'у и refund loop не работал бы.
    const burnDeadline = BigInt(blockchain.now! + Number(TRIAL_WINDOW));
    const mintResult = await collection.send(
      collectionOwner.getSender(),
      { value: toNano('0.5') },
      {
        $$type: 'MintLicense',
        queryId: 1n,
        buyerAddress:      buyer.address,
        escrowAddress:     escrow.address,
        transferLimit:     TRANSFER_LIMIT,
        individualContent: sharedLicenseContent,
        burnDeadline,
      },
    );

    // 3. Collection должна была задеплоить LicenseItem. Ищем deploy-транзакцию
    //    по наличию init-данных в inMessage.
    const deployTx = mintResult.transactions.find(
      (tx) =>
        tx.inMessage?.info.type === 'internal' &&
        tx.inMessage.info.src?.toString() === collection.address.toString() &&
        tx.inMessage.init !== undefined,
    );
    expect(deployTx).toBeTruthy();
    const itemAddress = (deployTx!.inMessage!.info as { dest: Address }).dest;

    // K-1/CON-01 fix: регистрация выполняется самой Collection в ходе mint-tx
    // (RegisterLicense → Escrow, привязанный к collectionAddress). Никаких
    // ручных шагов «self-register» больше не нужно — escrow знает свой license
    // сразу после минта.
    const registered = await escrow.getLicenseAddress();
    expect(registered.equals(itemAddress)).toBe(true);

    return { itemAddress, burnDeadline };
  }

  // ─── Happy path: pay → mint → confirm ────────────────────────────

  it('full flow: pay → mint → confirm → seller paid', async () => {
    await payAndMint();

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
  });

  // ─── Refund cycle: pay → mint → self-register → BuyerBurn → refund ──
  //
  // Этот сценарий раньше был заблокирован sender()-багом: LicenseItem.initOf
  // получал sender() == oracle-кошелёк вместо реального Escrow, и RefundOnBurn
  // в escrow отклонялся (sender != licenseAddress). После фикса контракта
  // (MintLicense.escrowAddress явным полем) — проходит.
  //
  // Шаги:
  //   1. pay + mint (см. payAndMint).
  //   2. Self-register: шлём empty body от collection.address к item
  //      через blockchain.sender(collection.address).
  //   3. BuyerBurn от buyer.address → LicenseItem → RefundOnBurn → Escrow.
  //   4. Escrow переходит в REFUNDED и шлёт средства buyer'у.

  it('full refund cycle: pay → mint → BuyerBurn → escrow refunds buyer + confirms burn', async () => {
    const { itemAddress, burnDeadline } = await payAndMint();

    // Пересобираем SandboxContract<LicenseItem> с тем же init-ключом что
    // использовала Collection в MintLicense — адрес должен совпасть.
    const itemInit = await LicenseItem.fromInit(
      0n,                        // index = 0 (первый mint, nextItemIndex был 0)
      collection.address,
      buyer.address,             // ownerAddress
      escrow.address,            // escrowAddress (правильный, не sender())
      TRANSFER_LIMIT,
      sharedLicenseContent,
      burnDeadline,
    );
    expect(itemInit.address.equals(itemAddress)).toBe(true);
    const item = blockchain.openContract(itemInit);

    // Регистрация уже выполнена Collection в ходе payAndMint (см. выше) —
    // ручной self-register больше не нужен.

    const buyerBalanceBefore = await buyer.getBalance();

    // BuyerBurn от buyer'а (типизированное сообщение). Теперь двухфазный:
    // item → RefundOnBurn → escrow → (refund buyer + BurnConfirmed) → item burns.
    const burnRes = await item.send(
      buyer.getSender(),
      { value: toNano('0.2') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );

    // LicenseItem должен был послать RefundOnBurn в Escrow
    expect(burnRes.transactions).toHaveTransaction({
      from: itemAddress,
      to: escrow.address,
      success: true,
    });

    // Escrow должен был послать средства buyer'у
    expect(burnRes.transactions).toHaveTransaction({
      from: escrow.address,
      to: buyer.address,
      success: true,
    });

    // Escrow должен был подтвердить сжигание (BurnConfirmed → item)
    expect(burnRes.transactions).toHaveTransaction({
      from: escrow.address,
      to: itemAddress,
      success: true,
    });

    // А item, получив BurnConfirmed, должен самоуничтожиться (вернув остаток
    // владельцу). Проверяем, что аккаунт айтема больше не active.
    const itemState = await blockchain.getContract(itemAddress);
    expect(itemState.accountState?.type).not.toBe('active');

    // Покупатель получил возврат.
    expect(await buyer.getBalance()).toBeGreaterThan(buyerBalanceBefore);
  });

  // ─── TimeoutRelease ──────────────────────────────────────────────

  it('timeout release works after trial window', async () => {
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

  // ─── RefundIfNotMinted ───────────────────────────────────────────

  it('buyer can refund if license never minted after grace period', async () => {
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

  // ─── Collection mint authority ──────────────────────────────────

  it('rejects MintLicense from non-owner', async () => {
    const burnDeadline = BigInt(blockchain.now! + Number(TRIAL_WINDOW));
    const result = await collection.send(
      outsider.getSender(),
      { value: toNano('0.5') },
      {
        $$type: 'MintLicense',
        queryId: 1n,
        buyerAddress:      buyer.address,
        escrowAddress:     escrow.address,
        transferLimit:     TRANSFER_LIMIT,
        individualContent: sharedLicenseContent,
        burnDeadline,
      },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: collection.address,
      success: false,
    });
  });
});
