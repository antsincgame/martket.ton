/**
 * LicenseItem v4 contract tests.
 *
 * v4: добавлен пустой receive() для авто-регистрации в Escrow сразу после
 * deploy (обрабатывает "License minted" комментарий от Collection).
 * Остальная семантика (TEP-64, soulbound, BuyerBurn, collection-mediated burn)
 * без изменений.
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

describe('LicenseItem v4 contract', () => {
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
    // Мы шлём Deploy от collection чтобы item сразу получил "License minted"-like
    // семантику. Автогенерируемый Deploy message это opcode 0x946a98b6, НЕ пустой
    // receive. Тем не менее, тут инициализируется state, deploy проходит.
    const deployRes = await sc.send(
      collection.getSender(),
      { value: toNano('0.1') },
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
      { value: toNano('0.1') },
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

  // ─── Deploy-сообщение (пустое тело от Collection) ────────────────
  //
  // Регистрацию лицензии теперь выполняет Collection (RegisterLicense в
  // Escrow, привязанный к collectionAddress) — НЕ сам айтем. Айтем лишь
  // поглощает пустое deploy-сообщение no-op-приёмником receive(). См. K-1 fix.

  it('accepts an empty deploy message without emitting any outgoing tx', async () => {
    const item = await deploySoulbound();

    const result = await item.send(
      collection.getSender(),
      { value: toNano('0.1') },
      null,  // empty body → no-op receive()
    );

    // Айтем НЕ должен слать ничего в escrow (регистрация — задача Collection).
    const itemToEscrow = result.transactions.filter(
      (tx) => tx.inMessage?.info.type === 'internal' &&
              tx.inMessage.info.src?.toString() === item.address.toString() &&
              tx.inMessage.info.dest?.toString() === escrow.address.toString()
    );
    expect(itemToEscrow.length).toBe(0);
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

  // ─── BuyerBurn (двухфазный: H-1 fix) ─────────────────────────────

  it('owner can BuyerBurn within deadline → sends RefundOnBurn to escrow', async () => {
    const item = await deploySoulbound();
    const result = await item.send(
      owner.getSender(),
      { value: toNano('0.2') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );
    expect(result.transactions).toHaveTransaction({
      from: owner.address, to: item.address, success: true,
    });
    expect(result.transactions).toHaveTransaction({
      from: item.address, to: escrow.address, success: true,
    });
  });

  it('BuyerBurn does NOT self-destruct before escrow confirms (H-1)', async () => {
    const item = await deploySoulbound();
    await item.send(
      owner.getSender(),
      { value: toNano('0.2') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );
    // Эскроу (здесь — treasury-заглушка) не отвечает BurnConfirmed, поэтому
    // айтем обязан остаться ЖИВЫМ: покупатель не теряет NFT, пока возврат не
    // подтверждён. Это и есть суть фикса H-1.
    const contractState = await blockchain.getContract(item.address);
    expect(contractState.accountState?.type).toBe('active');
    expect(await item.getBurnRequested()).toBe(true);
  });

  it('self-destructs only after BurnConfirmed from the bound escrow', async () => {
    const item = await deploySoulbound();
    await item.send(
      owner.getSender(),
      { value: toNano('0.2') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );

    // Эскроу подтверждает возврат → айтем уничтожается.
    const result = await item.send(
      blockchain.sender(escrow.address),
      { value: toNano('0.05') },
      { $$type: 'BurnConfirmed' },
    );
    expect(result.transactions).toHaveTransaction({
      from: item.address, to: owner.address, success: true,
    });
    const contractState = await blockchain.getContract(item.address);
    expect(contractState.accountState?.type).not.toBe('active');
  });

  it('rejects BurnConfirmed from a non-escrow sender', async () => {
    const item = await deploySoulbound();
    await item.send(
      owner.getSender(),
      { value: toNano('0.2') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );
    const result = await item.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'BurnConfirmed' },
    );
    expect(result.transactions).toHaveTransaction({
      from: outsider.address, to: item.address, success: false,
    });
    // Айтем по-прежнему жив.
    const contractState = await blockchain.getContract(item.address);
    expect(contractState.accountState?.type).toBe('active');
  });

  // ─── FinalizeBurn (A-1 recovery for a lost BurnConfirmed) ─────────

  it('owner can FinalizeBurn a stuck burn after the deadline', async () => {
    const item = await deploySoulbound(100);
    // BuyerBurn sets burnRequested; the treasury-stub escrow never replies
    // BurnConfirmed → the item would otherwise be stuck forever.
    await item.send(owner.getSender(), { value: toNano('0.2') }, { $$type: 'BuyerBurn', queryId: 1n });
    expect(await item.getBurnRequested()).toBe(true);

    blockchain.now = blockchain.now! + 200; // past burnDeadline

    const result = await item.send(
      owner.getSender(),
      { value: toNano('0.05') },
      { $$type: 'FinalizeBurn', queryId: 2n },
    );
    expect(result.transactions).toHaveTransaction({ from: item.address, to: owner.address, success: true });
    const state = await blockchain.getContract(item.address);
    expect(state.accountState?.type).not.toBe('active');
  });

  it('rejects FinalizeBurn before the deadline', async () => {
    const item = await deploySoulbound(3600);
    await item.send(owner.getSender(), { value: toNano('0.2') }, { $$type: 'BuyerBurn', queryId: 1n });
    const result = await item.send(
      owner.getSender(),
      { value: toNano('0.05') },
      { $$type: 'FinalizeBurn', queryId: 2n },
    );
    expect(result.transactions).toHaveTransaction({ from: owner.address, to: item.address, success: false });
    const state = await blockchain.getContract(item.address);
    expect(state.accountState?.type).toBe('active');
  });

  it('rejects FinalizeBurn from a non-owner', async () => {
    const item = await deploySoulbound(100);
    await item.send(owner.getSender(), { value: toNano('0.2') }, { $$type: 'BuyerBurn', queryId: 1n });
    blockchain.now = blockchain.now! + 200;
    const result = await item.send(
      outsider.getSender(),
      { value: toNano('0.05') },
      { $$type: 'FinalizeBurn', queryId: 2n },
    );
    expect(result.transactions).toHaveTransaction({ from: outsider.address, to: item.address, success: false });
  });

  it('rejects FinalizeBurn when no burn is in progress', async () => {
    const item = await deploySoulbound(100);
    blockchain.now = blockchain.now! + 200;
    const result = await item.send(
      owner.getSender(),
      { value: toNano('0.05') },
      { $$type: 'FinalizeBurn', queryId: 2n },
    );
    expect(result.transactions).toHaveTransaction({ from: owner.address, to: item.address, success: false });
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
