/**
 * AppCollection v2 contract tests (TEP-62 mint + RegisterLicense to escrow).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Blockchain, type SandboxContract, type TreasuryContract } from '@ton/sandbox';
import { beginCell, toNano } from '@ton/core';
import '@ton/test-utils';
import { AppCollection } from '../build/AppCollection_AppCollection';

const APP_ID = 0xaa11n;
const COLLECTION_URI = 'https://cdn.tonforge.org/collections/app_aa11.json';
const COMMON_URI_PREFIX = 'https://cdn.tonforge.org/license-metadata/app_aa11/';

function offchainContent(uri: string) {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}

function individualContent(index: number) {
  return beginCell().storeStringTail(`${index}.json`).endCell();
}

describe('AppCollection v2 contract', () => {
  let blockchain: Blockchain;
  let owner: SandboxContract<TreasuryContract>;
  let buyer: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let escrowFake: SandboxContract<TreasuryContract>;
  let collection: SandboxContract<AppCollection>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = Math.floor(Date.now() / 1000);
    owner = await blockchain.treasury('owner');
    buyer = await blockchain.treasury('buyer');
    outsider = await blockchain.treasury('outsider');
    escrowFake = await blockchain.treasury('escrow');

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
    return BigInt(blockchain.now! + 3600);
  }

  // ─── Initial state ───────────────────────────────────────────────

  it('stores app id and zero items at deploy', async () => {
    const data = await collection.getGetCollectionData();
    expect(data.nextItemIndex).toBe(0n);
    expect(data.owner.equals(owner.address)).toBe(true);

    const appId = await collection.getAppId();
    expect(appId).toBe(APP_ID);
  });

  // ─── Mint by owner ───────────────────────────────────────────────

  it('owner can mint license, item index increments', async () => {
    const result = await collection.send(
      owner.getSender(),
      { value: toNano('0.3') },
      {
        $$type: 'MintLicense',
        queryId: 1n,
        buyerAddress: buyer.address,
        escrowAddress: escrowFake.address,
        transferLimit: 0n,
        individualContent: individualContent(0),
        burnDeadline: burnDeadline(),
      },
    );

    expect(result.transactions).toHaveTransaction({
      from: owner.address,
      to: collection.address,
      success: true,
    });

    const data = await collection.getGetCollectionData();
    expect(data.nextItemIndex).toBe(1n);
  });

  it('rejects mint from non-owner', async () => {
    const result = await collection.send(
      outsider.getSender(),
      { value: toNano('0.3') },
      {
        $$type: 'MintLicense',
        queryId: 2n,
        buyerAddress: buyer.address,
        escrowAddress: escrowFake.address,
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
    const data = await collection.getGetCollectionData();
    expect(data.nextItemIndex).toBe(0n);
  });

  it('rejects mint with insufficient gas', async () => {
    const result = await collection.send(
      owner.getSender(),
      { value: toNano('0.01') },
      {
        $$type: 'MintLicense',
        queryId: 3n,
        buyerAddress: buyer.address,
        escrowAddress: escrowFake.address,
        transferLimit: 0n,
        individualContent: individualContent(0),
        burnDeadline: burnDeadline(),
      },
    );
    expect(result.transactions).toHaveTransaction({
      from: owner.address,
      to: collection.address,
      success: false,
    });
  });

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
});
