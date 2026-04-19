/**
 * LicenseItem v2 contract tests (TEP-64 + soulbound + BuyerBurn + collection-mediated burn).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Blockchain, type SandboxContract, type TreasuryContract } from '@ton/sandbox';
import { beginCell, toNano } from '@ton/core';
import '@ton/test-utils';
import { LicenseItem } from '../build/LicenseItem_LicenseItem';

const INDEX = 7n;
const SOULBOUND = 0n;
const TRANSFERABLE_LIMIT = 2n;

function content(uri: string) {
  return beginCell().storeStringTail(uri).endCell();
}

describe('LicenseItem v2 contract', () => {
  let blockchain: Blockchain;
  let collection: SandboxContract<TreasuryContract>;
  let owner: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;
  let escrow: SandboxContract<TreasuryContract>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = Math.floor(Date.now() / 1000);
    collection = await blockchain.treasury('collection');
    owner = await blockchain.treasury('owner');
    outsider = await blockchain.treasury('outsider');
    escrow = await blockchain.treasury('escrow');
  });

  function burnDeadline(offsetSec: number = 3600): bigint {
    return BigInt(blockchain.now! + offsetSec);
  }

  async function deploySoulbound(deadlineOffset = 3600) {
    const item = await LicenseItem.fromInit(
      INDEX,
      collection.address,
      owner.address,
      escrow.address,
      SOULBOUND,
      content('soulbound.json'),
      burnDeadline(deadlineOffset),
    );
    const sc = blockchain.openContract(item);
    const deployRes = await sc.send(
      collection.getSender(),
      { value: toNano('0.05') },
      { $$type: 'Deploy', queryId: 0n },
    );
    expect(deployRes.transactions).toHaveTransaction({
      from: collection.address,
      to: sc.address,
      deploy: true,
      success: true,
    });
    return sc;
  }

  async function deployTransferable() {
    const item = await LicenseItem.fromInit(
      INDEX,
      collection.address,
      owner.address,
      escrow.address,
      TRANSFERABLE_LIMIT,
      content('transferable.json'),
      burnDeadline(),
    );
    const sc = blockchain.openContract(item);
    await sc.send(
      collection.getSender(),
      { value: toNano('0.05') },
      { $$type: 'Deploy', queryId: 0n },
    );
    return sc;
  }

  // ─── TEP-64 getter ───────────────────────────────────────────────

  it('exposes TEP-64 nft data after deploy', async () => {
    const item = await deploySoulbound();
    const data = await item.getGetNftData();
    expect(data.init).toBe(true);
    expect(data.index).toBe(INDEX);
    expect(data.collection.equals(collection.address)).toBe(true);
    expect(data.owner.equals(owner.address)).toBe(true);
  });

  it('exposes escrow address', async () => {
    const item = await deploySoulbound();
    const addr = await item.getEscrowAddress();
    expect(addr.equals(escrow.address)).toBe(true);
  });

  it('reports soulbound counters', async () => {
    const item = await deploySoulbound();
    const info = await item.getSoulboundInfo();
    expect(info.transferLimit).toBe(SOULBOUND);
    expect(info.transfers).toBe(0n);
  });

  it('exposes burn deadline', async () => {
    const item = await deploySoulbound();
    const dl = await item.getBurnDeadline();
    expect(dl).toBe(burnDeadline());
  });

  // ─── Soulbound transfer rejection ────────────────────────────────

  it('rejects Transfer when transferLimit = 0 (soulbound)', async () => {
    const item = await deploySoulbound();
    const newOwner = await blockchain.treasury('new-owner');
    const result = await item.send(
      owner.getSender(),
      { value: toNano('0.1') },
      {
        $$type: 'Transfer',
        queryId: 1n,
        newOwner: newOwner.address,
        responseTo: owner.address,
        customPayload: null,
        forwardAmount: 0n,
        forwardPayload: beginCell().endCell().asSlice(),
      },
    );
    expect(result.transactions).toHaveTransaction({
      from: owner.address,
      to: item.address,
      success: false,
    });
  });

  it('allows Transfer up to transferLimit then rejects', async () => {
    const item = await deployTransferable();
    const ownerB = await blockchain.treasury('owner-b');
    const ownerC = await blockchain.treasury('owner-c');
    const ownerD = await blockchain.treasury('owner-d');

    let result = await item.send(
      owner.getSender(),
      { value: toNano('0.1') },
      {
        $$type: 'Transfer',
        queryId: 1n,
        newOwner: ownerB.address,
        responseTo: owner.address,
        customPayload: null,
        forwardAmount: 0n,
        forwardPayload: beginCell().endCell().asSlice(),
      },
    );
    expect(result.transactions).toHaveTransaction({
      from: owner.address, to: item.address, success: true,
    });

    result = await item.send(
      ownerB.getSender(),
      { value: toNano('0.1') },
      {
        $$type: 'Transfer',
        queryId: 2n,
        newOwner: ownerC.address,
        responseTo: ownerB.address,
        customPayload: null,
        forwardAmount: 0n,
        forwardPayload: beginCell().endCell().asSlice(),
      },
    );
    expect(result.transactions).toHaveTransaction({
      from: ownerB.address, to: item.address, success: true,
    });

    result = await item.send(
      ownerC.getSender(),
      { value: toNano('0.1') },
      {
        $$type: 'Transfer',
        queryId: 3n,
        newOwner: ownerD.address,
        responseTo: ownerC.address,
        customPayload: null,
        forwardAmount: 0n,
        forwardPayload: beginCell().endCell().asSlice(),
      },
    );
    expect(result.transactions).toHaveTransaction({
      from: ownerC.address, to: item.address, success: false,
    });
  });

  it('rejects Transfer from non-owner', async () => {
    const item = await deployTransferable();
    const newOwner = await blockchain.treasury('new-owner');
    const result = await item.send(
      outsider.getSender(),
      { value: toNano('0.1') },
      {
        $$type: 'Transfer',
        queryId: 1n,
        newOwner: newOwner.address,
        responseTo: outsider.address,
        customPayload: null,
        forwardAmount: 0n,
        forwardPayload: beginCell().endCell().asSlice(),
      },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address, to: item.address, success: false,
    });
  });

  // ─── Collection-mediated Burn ─────────────────────────────────────

  it('burns when called by collection, returns balance to owner', async () => {
    const item = await deploySoulbound();
    const ownerBalanceBefore = await owner.getBalance();
    const result = await item.send(
      collection.getSender(),
      { value: toNano('0.1') },
      { $$type: 'Burn', queryId: 1n },
    );
    expect(result.transactions).toHaveTransaction({
      from: collection.address, to: item.address, success: true,
    });
    expect(result.transactions).toHaveTransaction({
      from: item.address, to: owner.address, success: true,
    });
    const ownerBalanceAfter = await owner.getBalance();
    expect(ownerBalanceAfter).toBeGreaterThan(ownerBalanceBefore);
  });

  it('rejects Burn from owner (only collection can burn)', async () => {
    const item = await deploySoulbound();
    const result = await item.send(
      owner.getSender(),
      { value: toNano('0.05') },
      { $$type: 'Burn', queryId: 1n },
    );
    expect(result.transactions).toHaveTransaction({
      from: owner.address, to: item.address, success: false,
    });
  });

  it('rejects Burn from outsider', async () => {
    const item = await deploySoulbound();
    const result = await item.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'Burn', queryId: 1n },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address, to: item.address, success: false,
    });
  });

  // ─── BuyerBurn ────────────────────────────────────────────────────

  it('owner can BuyerBurn within deadline → sends RefundOnBurn to escrow', async () => {
    const item = await deploySoulbound();
    const result = await item.send(
      owner.getSender(),
      { value: toNano('0.1') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );
    expect(result.transactions).toHaveTransaction({
      from: owner.address, to: item.address, success: true,
    });
    expect(result.transactions).toHaveTransaction({
      from: item.address, to: escrow.address, success: true,
    });
  });

  it('BuyerBurn self-destructs the license contract', async () => {
    const item = await deploySoulbound();
    const result = await item.send(
      owner.getSender(),
      { value: toNano('0.1') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );
    expect(result.transactions).toHaveTransaction({
      from: item.address, to: owner.address, success: true,
    });
    const contractState = await blockchain.getContract(item.address);
    expect(contractState.accountState?.type).not.toBe('active');
  });

  it('rejects BuyerBurn after deadline', async () => {
    const item = await deploySoulbound(100);

    blockchain.now = blockchain.now! + 200;

    const result = await item.send(
      owner.getSender(),
      { value: toNano('0.1') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );
    expect(result.transactions).toHaveTransaction({
      from: owner.address, to: item.address, success: false,
    });
  });

  it('rejects BuyerBurn from non-owner', async () => {
    const item = await deploySoulbound();
    const result = await item.send(
      outsider.getSender(),
      { value: toNano('0.1') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address, to: item.address, success: false,
    });
  });

  // ─── GetStaticData ───────────────────────────────────────────────

  it('replies to GetStaticData with index and collection', async () => {
    const item = await deploySoulbound();
    const result = await item.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'GetStaticData', queryId: 99n },
    );
    expect(result.transactions).toHaveTransaction({
      from: item.address, to: outsider.address, success: true,
    });
  });
});
