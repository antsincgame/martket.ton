/**
 * AppCollection v4 contract tests — init-hash trustless mint protection.
 *
 * Ключевая новая семантика: Mint больше НЕ гейтится через ownerAddress.
 * Legitimacy sender проверяется через пересборку initOf Escrow с параметрами
 * из сообщения.
 *
 * В этом файле тестируются isolated-кейсы Collection (без реального Escrow).
 * Полный E2E flow — в licenseLifecycle.spec.ts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Blockchain, type SandboxContract, type TreasuryContract } from '@ton/sandbox';
import { beginCell, toNano } from '@ton/core';
import '@ton/test-utils';
import { AppCollection } from '../build/AppCollection_AppCollection';

const APP_ID = 0xaa11n;
const COLLECTION_URI = 'https://cdn.example.org/collection/app_aa11.json';
const COMMON_URI_PREFIX = 'https://cdn.example.org/license-metadata/app_aa11/';

function offchainContent(uri: string) {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}

function individualContent(index: number) {
  return beginCell().storeStringTail(`${index}.json`).endCell();
}

describe('AppCollection v4 contract (trustless mint)', () => {
  let blockchain: Blockchain;
  let owner: SandboxContract<TreasuryContract>;
  let buyer: SandboxContract<TreasuryContract>;
  let seller: SandboxContract<TreasuryContract>;
  let treasury: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let collection: SandboxContract<AppCollection>;

  const SELLER_AMOUNT = toNano('12.5');
  const FEE_AMOUNT    = toNano('1.875');
  const TOTAL_AMOUNT  = SELLER_AMOUNT + FEE_AMOUNT;
  const TRIAL_WINDOW  = 3600n;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = Math.floor(Date.now() / 1000);
    owner = await blockchain.treasury('owner');
    buyer = await blockchain.treasury('buyer');
    seller = await blockchain.treasury('seller');
    treasury = await blockchain.treasury('treasury');
    outsider = await blockchain.treasury('outsider');

    const contract = await AppCollection.fromInit(
      APP_ID,
      owner.address,
      offchainContent(COLLECTION_URI),
      offchainContent(COMMON_URI_PREFIX),
    );
    collection = blockchain.openContract(contract);

    const deployResult = await collection.send(
      owner.getSender(),
      { value: toNano('0.1') },
      { $$type: 'Deploy', queryId: 0n },
    );
    expect(deployResult.transactions).toHaveTransaction({
      from: owner.address,
      to: collection.address,
      deploy: true,
      success: true,
    });
  });

  function burnDeadline(): bigint {
    return BigInt(blockchain.now! + Number(TRIAL_WINDOW));
  }

  // ─── Initial state ───────────────────────────────────────────────

  it('stores app id and zero items at deploy', async () => {
    const data = await collection.getGetCollectionData();
    expect(data.nextItemIndex).toBe(0n);
    expect(data.owner.equals(owner.address)).toBe(true);

    const appId = await collection.getAppId();
    expect(appId).toBe(APP_ID);
  });

  // ─── Mint protection: non-Escrow cannot mint ─────────────────────
  //
  // Это главная security гарантия v4: даже collection owner не может
  // mint'ить напрямую, только настоящий Escrow с правильным init-hash.

  it('rejects mint from owner (no privileged mint anymore)', async () => {
    const result = await collection.send(
      owner.getSender(),
      { value: toNano('0.5') },
      {
        $$type: 'MintLicense',
        queryId: 1n,
        orderId: 1n,
        buyerAddress: buyer.address,
        sellerAddress: seller.address,
        treasuryAddress: treasury.address,
        amountNano: TOTAL_AMOUNT,
        sellerAmountNano: SELLER_AMOUNT,
        feeNano: FEE_AMOUNT,
        trialWindowSec: TRIAL_WINDOW,
        transferLimit: 0n,
        individualContent: individualContent(0),
        burnDeadline: burnDeadline(),
      },
    );
    // Owner != expectedEscrow → reject
    expect(result.transactions).toHaveTransaction({
      from: owner.address,
      to: collection.address,
      success: false,
    });

    const data = await collection.getGetCollectionData();
    expect(data.nextItemIndex).toBe(0n);
  });

  it('rejects mint from outsider with arbitrary params', async () => {
    const result = await collection.send(
      outsider.getSender(),
      { value: toNano('0.5') },
      {
        $$type: 'MintLicense',
        queryId: 2n,
        orderId: 42n,
        buyerAddress: buyer.address,
        sellerAddress: seller.address,
        treasuryAddress: treasury.address,
        amountNano: TOTAL_AMOUNT,
        sellerAmountNano: SELLER_AMOUNT,
        feeNano: FEE_AMOUNT,
        trialWindowSec: TRIAL_WINDOW,
        transferLimit: 0n,
        individualContent: individualContent(0),
        burnDeadline: burnDeadline(),
      },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: collection.address,
      success: false,
    });
  });

  // Note: тест legitimate mint (через реальный Escrow → успешный mint)
  // находится в licenseLifecycle.spec.ts — он требует deploy обоих
  // контрактов и их координации.

  // ─── Owner rotation ──────────────────────────────────────────────

  it('current owner can rotate ownership', async () => {
    const newOwner = await blockchain.treasury('new-owner');
    const result = await collection.send(
      owner.getSender(),
      { value: toNano('0.05') },
      { $$type: 'ChangeOwner', queryId: 4n, newOwner: newOwner.address },
    );
    expect(result.transactions).toHaveTransaction({
      from: owner.address,
      to: collection.address,
      success: true,
    });
    const data = await collection.getGetCollectionData();
    expect(data.owner.equals(newOwner.address)).toBe(true);
  });

  it('non-owner cannot rotate ownership', async () => {
    const newOwner = await blockchain.treasury('new-owner');
    const result = await collection.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'ChangeOwner', queryId: 5n, newOwner: newOwner.address },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: collection.address,
      success: false,
    });
  });

  // ─── BurnLicense (admin edge-case для DMCA) ───────────────────────

  it('owner can trigger BurnLicense (forwarded to item address)', async () => {
    // Фиктивный itemAddress — в сandbox никто не развёрнут там,
    // сообщение просто потеряется. Важно только что collection
    // принимает команду от owner.
    const fakeItem = await blockchain.treasury('fakeItem');
    const result = await collection.send(
      owner.getSender(),
      { value: toNano('0.1') },
      { $$type: 'BurnLicense', queryId: 6n, itemAddress: fakeItem.address },
    );
    expect(result.transactions).toHaveTransaction({
      from: owner.address,
      to: collection.address,
      success: true,
    });
  });

  it('non-owner cannot trigger BurnLicense', async () => {
    const fakeItem = await blockchain.treasury('fakeItem');
    const result = await collection.send(
      outsider.getSender(),
      { value: toNano('0.1') },
      { $$type: 'BurnLicense', queryId: 7n, itemAddress: fakeItem.address },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address,
      to: collection.address,
      success: false,
    });
  });
});
