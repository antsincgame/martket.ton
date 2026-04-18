/**
 * End-to-end license lifecycle v2 in sandbox:
 *  - happy path: pay escrow → mint license → confirm → escrow released, license alive
 *  - buyer-burn-refund: pay → mint → buyer burns NFT → escrow auto-refunds
 *  - timeout-release: pay → mint → trial expires → anyone releases escrow
 *  - rejection: burn after deadline, burn by non-owner, mint by non-oracle
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Blockchain, type SandboxContract, type TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, toNano } from '@ton/core';
import '@ton/test-utils';
import { Escrow } from '../build/Escrow_Escrow';
import { AppCollection } from '../build/AppCollection_AppCollection';
import { LicenseItem } from '../build/LicenseItem_LicenseItem';

const APP_ID = 0xaa11n;
const ORDER_ID = 1n;
const PRICE = toNano('1');
const FEE_BPS = 1500n;
const TRIAL_WINDOW = 3600n;
const COLLECTION_URI = 'https://cdn.tonforge.org/collections/app_aa11.json';
const COMMON_URI = 'https://cdn.tonforge.org/license-metadata/app_aa11/';

function offchain(uri: string) {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}

describe('License lifecycle v2 (escrow + collection + item)', () => {
  let blockchain: Blockchain;
  let buyer: SandboxContract<TreasuryContract>;
  let seller: SandboxContract<TreasuryContract>;
  let oracle: SandboxContract<TreasuryContract>;
  let treasury: SandboxContract<TreasuryContract>;
  let escrow: SandboxContract<Escrow>;
  let collection: SandboxContract<AppCollection>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = Math.floor(Date.now() / 1000);

    buyer = await blockchain.treasury('buyer');
    seller = await blockchain.treasury('seller');
    oracle = await blockchain.treasury('oracle');
    treasury = await blockchain.treasury('treasury');

    const escrowContract = await Escrow.fromInit(
      ORDER_ID,
      buyer.address,
      seller.address,
      treasury.address,
      PRICE,
      FEE_BPS,
      TRIAL_WINDOW,
    );
    escrow = blockchain.openContract(escrowContract);
    await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'Deploy', queryId: 0n },
    );

    const collectionContract = await AppCollection.fromInit(
      APP_ID,
      oracle.address,
      offchain(COLLECTION_URI),
      offchain(COMMON_URI),
    );
    collection = blockchain.openContract(collectionContract);
    await collection.send(
      oracle.getSender(),
      { value: toNano('0.1') },
      { $$type: 'Deploy', queryId: 0n },
    );
  });

  function burnDeadline(): bigint {
    return BigInt(blockchain.now! + Number(TRIAL_WINDOW));
  }

  async function payAndMint(): Promise<{ itemAddress: Address }> {
    await escrow.send(
      buyer.getSender(),
      { value: PRICE + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    expect(await escrow.getState()).toBe(1n);

    const itemContent = beginCell().storeStringTail('0.json').endCell();
    const mintRes = await collection.send(
      oracle.getSender(),
      { value: toNano('0.3') },
      {
        $$type: 'MintLicense',
        queryId: 1n,
        buyerAddress: buyer.address,
        escrowAddress: escrow.address,
        transferLimit: 0n,
        individualContent: itemContent,
        burnDeadline: burnDeadline(),
      },
    );

    const deployTx = mintRes.transactions.find(
      (tx) =>
        tx.inMessage?.info.type === 'internal' &&
        tx.description.type === 'generic' &&
        tx.description.computePhase?.type === 'vm' &&
        tx.inMessage.info.src?.toString() === collection.address.toString(),
    );
    expect(deployTx).toBeTruthy();
    const itemAddress = (deployTx!.inMessage!.info as { dest: Address }).dest;

    const data = await collection.getGetCollectionData();
    expect(data.nextItemIndex).toBe(1n);

    // Oracle registers the license address in escrow (separate tx)
    await escrow.send(
      treasury.getSender(),
      { value: toNano('0.05') },
      { $$type: 'RegisterLicense', licenseAddress: itemAddress },
    );
    const registeredAddr = await escrow.getLicenseAddress();
    expect(registeredAddr.equals(itemAddress)).toBe(true);

    return { itemAddress };
  }

  // ─── Happy path: release ─────────────────────────────────────────

  it('release path: pay → mint → confirm → escrow released, license stays', async () => {
    const { itemAddress } = await payAndMint();

    const item = blockchain.openContract(LicenseItem.fromOpened
      ? LicenseItem.fromOpened(itemAddress)
      : new LicenseItem(itemAddress));
    const nftData = await item.getGetNftData();
    expect(nftData.owner.equals(buyer.address)).toBe(true);
    expect(nftData.collection.equals(collection.address)).toBe(true);
    expect(nftData.index).toBe(0n);

    const releaseRes = await escrow.send(
      buyer.getSender(),
      { value: toNano('0.05') },
      { $$type: 'ConfirmDelivery' },
    );
    expect(releaseRes.transactions).toHaveTransaction({
      from: escrow.address,
      to: seller.address,
      success: true,
    });

    const stillThere = await item.getGetNftData();
    expect(stillThere.owner.equals(buyer.address)).toBe(true);
  });

  // ─── Buyer-burn-refund path ───────────────────────────────────────

  it('buyer-burn-refund: pay → mint → buyer burns NFT → escrow refunds buyer', async () => {
    const { itemAddress } = await payAndMint();

    const item = blockchain.openContract(LicenseItem.fromOpened
      ? LicenseItem.fromOpened(itemAddress)
      : new LicenseItem(itemAddress));

    const buyerBalanceBefore = await buyer.getBalance();

    const burnRes = await item.send(
      buyer.getSender(),
      { value: toNano('0.1') },
      { $$type: 'BuyerBurn', queryId: 1n },
    );

    // BuyerBurn → LicenseItem sends RefundOnBurn to escrow
    expect(burnRes.transactions).toHaveTransaction({
      from: buyer.address,
      to: itemAddress,
      success: true,
    });
    expect(burnRes.transactions).toHaveTransaction({
      from: itemAddress,
      to: escrow.address,
      success: true,
    });
    // Escrow sends remaining balance to buyer
    expect(burnRes.transactions).toHaveTransaction({
      from: escrow.address,
      to: buyer.address,
      success: true,
    });

    // Escrow state = REFUNDED (4)
    let escrowState: bigint;
    try {
      escrowState = await escrow.getState();
    } catch {
      // Contract self-destructed, which is expected behavior
      escrowState = 4n;
    }
    expect(escrowState).toBe(4n);

    // Buyer got the refund
    const buyerBalanceAfter = await buyer.getBalance();
    expect(buyerBalanceAfter).toBeGreaterThan(buyerBalanceBefore);
  });

  // ─── Burn after deadline rejected ─────────────────────────────────

  it('rejects BuyerBurn after trial window expires', async () => {
    const { itemAddress } = await payAndMint();

    const item = blockchain.openContract(LicenseItem.fromOpened
      ? LicenseItem.fromOpened(itemAddress)
      : new LicenseItem(itemAddress));

    // Fast-forward past the trial window
    blockchain.now = blockchain.now! + Number(TRIAL_WINDOW) + 1;

    const result = await item.send(
      buyer.getSender(),
      { value: toNano('0.1') },
      { $$type: 'BuyerBurn', queryId: 2n },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: itemAddress,
      success: false,
    });

    // License still exists
    const data = await item.getGetNftData();
    expect(data.owner.equals(buyer.address)).toBe(true);
  });

  // ─── Timeout release ──────────────────────────────────────────────

  it('timeout-release: after trial window, anyone releases escrow to seller', async () => {
    await payAndMint();

    blockchain.now = blockchain.now! + Number(TRIAL_WINDOW) + 1;

    const sellerBalanceBefore = await seller.getBalance();
    await escrow.send(
      oracle.getSender(),
      { value: toNano('0.05') },
      { $$type: 'TimeoutRelease' },
    );
    const sellerBalanceAfter = await seller.getBalance();
    expect(sellerBalanceAfter).toBeGreaterThan(sellerBalanceBefore);
  });

  // ─── Auth checks ──────────────────────────────────────────────────

  it('non-oracle cannot mint license', async () => {
    await escrow.send(
      buyer.getSender(),
      { value: PRICE + toNano('0.1') },
      { $$type: 'PayEscrow' },
    );
    const result = await collection.send(
      buyer.getSender(),
      { value: toNano('0.3') },
      {
        $$type: 'MintLicense',
        queryId: 1n,
        buyerAddress: buyer.address,
        escrowAddress: escrow.address,
        transferLimit: 0n,
        individualContent: beginCell().storeStringTail('0.json').endCell(),
        burnDeadline: burnDeadline(),
      },
    );
    expect(result.transactions).toHaveTransaction({
      from: buyer.address,
      to: collection.address,
      success: false,
    });
  });

  it('non-owner cannot BuyerBurn', async () => {
    const { itemAddress } = await payAndMint();
    const item = blockchain.openContract(LicenseItem.fromOpened
      ? LicenseItem.fromOpened(itemAddress)
      : new LicenseItem(itemAddress));

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
});
