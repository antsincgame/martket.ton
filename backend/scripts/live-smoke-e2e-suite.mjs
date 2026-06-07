/**
 * Live E2E suite: single-seller (minted + order PAID) and multi-seller (per-seller collections).
 * Usage: node --import tsx scripts/live-smoke-e2e-suite.mjs [single|multi|all]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Cell, Address } from '@ton/core';
import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { Client, Users, ID, Query } from 'node-appwrite';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(backendDir, '..');
dotenv.config({ path: join(backendDir, '.env.staging'), override: true });
dotenv.config({ path: join(backendDir, '.env'), override: true });

const API = process.env.VERIFY_API_URL || 'http://127.0.0.1:8081';
const ADMIN = process.env.COMMERCE_ADMIN_SECRET || '';
const BUYER_USER_ID = process.env.VERIFY_BUYER_USER_ID || 'live_verify_buyer';
const mode = process.argv[2] || 'all';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseStateInit(cell) {
  const s = cell.beginParse();
  s.loadBit();
  s.loadBit();
  const hasCode = s.loadBit();
  const code = hasCode ? s.loadRef() : undefined;
  const hasData = s.loadBit();
  const data = hasData ? s.loadRef() : undefined;
  s.loadBit();
  if (!code || !data) throw new Error('Invalid escrow StateInit cell');
  return { code, data };
}

function addrEq(a, b) {
  return Address.parse(a).equals(Address.parse(b));
}

async function openWallet(mnemonic, testnet = true) {
  const keyPair = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const endpoint = process.env.TON_API_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC';
  const client = new TonClient({ endpoint, apiKey: process.env.TON_API_KEY || undefined });
  const opened = client.open(wallet);
  return {
    client,
    opened,
    keyPair,
    address: wallet.address.toString({ testOnly: testnet, bounceable: false }),
  };
}

async function fundBuyerForOrders(ownerMnemonic, buyerAddress, orderCount = 1) {
  const neededPerOrder = 350_000_000n;
  const required = neededPerOrder * BigInt(orderCount);
  const buyer = await openWallet(ownerMnemonic);
  let buyerBal = await buyer.client.getBalance(Address.parse(buyerAddress));
  if (buyerBal >= required) return;

  const owner = await openWallet(ownerMnemonic);
  const ownerBal = await owner.client.getBalance(owner.opened.address);
  const topUp = required - buyerBal + 30_000_000n;
  if (ownerBal <= topUp + 50_000_000n) {
    throw new Error(
      `Owner balance ${Number(ownerBal) / 1e9} TON too low to fund buyer (need ${Number(topUp) / 1e9} TON)`,
    );
  }
  const seqno = await owner.opened.getSeqno();
  await owner.opened.sendTransfer({
    seqno,
    secretKey: owner.keyPair.secretKey,
    messages: [internal({ to: Address.parse(buyerAddress), value: topUp, bounce: false })],
  });
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    buyerBal = await buyer.client.getBalance(Address.parse(buyerAddress));
    if (buyerBal >= required) return;
    await sleep(3_000);
  }
  throw new Error(`Timeout funding buyer ${buyerAddress}`);
}

async function ensureBuyerProfile(buyerWallet) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
  const users = new Users(client);
  const { databases } = await import('../commerce/appwrite.js');
  const { CORE_DATABASE_ID, COL_PROFILES } = await import('../core/constants.js');
  const email = `buyer-${BUYER_USER_ID}@live-verify.local`;
  try {
    await users.get(BUYER_USER_ID);
  } catch {
    await users.create(BUYER_USER_ID, email, undefined, 'Live Verify Buyer', 'E2E123456!');
  }
  const db = databases();
  const now = new Date().toISOString();
  const { documents } = await db.listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('appwrite_user_id', BUYER_USER_ID),
    Query.limit(1),
  ]);
  const profileData = {
    appwrite_user_id: BUYER_USER_ID,
    ton_address: buyerWallet,
    name: 'Live Verify Buyer',
    display_name: 'Live Verify Buyer',
    role: 'buyer',
    is_active: true,
    security_level: 'low',
    kyc_lite_completed_at: now,
  };
  if (documents.length === 0) {
    await db.createDocument(CORE_DATABASE_ID, COL_PROFILES, ID.unique(), profileData);
  } else {
    await db.updateDocument(CORE_DATABASE_ID, COL_PROFILES, documents[0].$id, profileData);
  }
  const jwt = await users.createJWT(BUYER_USER_ID);
  return jwt.jwt;
}

async function payEscrow(buyerMnemonic, escrow) {
  const buyer = await openWallet(buyerMnemonic);
  const stateInitCell = Cell.fromBoc(Buffer.from(escrow.stateInit, 'base64'))[0];
  const body = Cell.fromBoc(Buffer.from(escrow.payload, 'base64'))[0];
  const init = parseStateInit(stateInitCell);
  const seqno = await buyer.opened.getSeqno();
  await buyer.opened.sendTransfer({
    seqno,
    secretKey: buyer.keyPair.secretKey,
    messages: [
      internal({
        to: Address.parse(escrow.address),
        value: BigInt(escrow.totalAmountRaw),
        init,
        body,
      }),
    ],
  });
  await sleep(45_000);
}

async function pollLicenseMinted(orderId, buyerJwt, timeoutMs = 600_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${API}/api/v1/commerce/buyers/me/licenses`, {
      headers: { Authorization: `Bearer ${buyerJwt}` },
    });
    const data = await res.json();
    const lic = (data.data?.licenses || []).find((l) => l.orderId === orderId);
    if (lic?.state === 'minted' && lic.nftAddress) return lic;
    try {
      const { triggerMintLoop } = await import('../tonforge/mintWorker.js');
      await triggerMintLoop();
    } catch {
      /* ignore */
    }
    try {
      const licRes = await fetch(`${API}/api/v1/commerce/buyers/me/licenses`, {
        headers: { Authorization: `Bearer ${buyerJwt}` },
      });
      const licData = await licRes.json();
      const pending = (licData.data?.licenses || []).find((l) => l.orderId === orderId);
      if (pending?.state === 'minted' && pending.nftAddress) {
        const { reconcileOrderAfterMint } = await import('../commerce/handlers/reconcileOrderAfterMint.js');
        await reconcileOrderAfterMint({
          orderId,
          listingId: pending.listingId,
          buyerWallet: pending.buyerWallet,
          nftAddress: pending.nftAddress,
          escrowAddress: pending.escrowAddress || '',
        });
      }
    } catch {
      /* ignore */
    }
    await sleep(8_000);
  }
  throw new Error(`License for order ${orderId} did not reach minted`);
}

async function pollOrderPaid(orderId, buyerJwt, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${API}/api/v1/commerce/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${buyerJwt}` },
    });
    const data = await res.json();
    const state = data.data?.order?.state ?? data.data?.state;
    if (state === 'paid' || state === 'fulfilled') return { state, data: data.data };
    await sleep(5_000);
  }
  throw new Error(`Order ${orderId} did not reach PAID in time`);
}

async function getNftCollectionOnChain(nftAddress) {
  const endpoint = process.env.TON_API_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC';
  const client = new TonClient({ endpoint, apiKey: process.env.TON_API_KEY || undefined });
  const result = await client.runMethod(Address.parse(nftAddress), 'get_nft_data');
  result.stack.readBoolean();
  result.stack.readBigNumber();
  const collection = result.stack.readAddress();
  return collection.toString({ testOnly: true, bounceable: false });
}

async function provisionSellerCollection(sellerWallet) {
  const res = await fetch(`${API}/api/v1/commerce/admin/seller-collections/provision`, {
    method: 'POST',
    headers: {
      'x-commerce-admin-secret': ADMIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sellerWallet, network: 'testnet' }),
  });
  const data = await res.json();
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Provision ${sellerWallet} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  const collectionAddress =
    data.data?.collectionAddress || data.data?.result?.collectionAddress || data.collectionAddress;
  if (!collectionAddress) throw new Error(`No collectionAddress in provision response: ${JSON.stringify(data)}`);
  return collectionAddress;
}

async function ensureSellerAgentReady(wallet) {
  const { databases, ID, Query } = await import('../commerce/appwrite.js');
  const { DATABASE_ID, COL_SELLER_PROFILES } = await import('../commerce/constants.js');
  const { findUserByTonAddress } = await import('../core/profileRepository.js');
  const { CORE_DATABASE_ID, COL_PROFILES } = await import('../core/constants.js');
  const { generateId } = await import('../core/generateId.js');
  const db = databases();

  const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
    Query.equal('wallet', wallet),
    Query.limit(1),
  ]);
  if (documents.length === 0) {
    await db.createDocument(DATABASE_ID, COL_SELLER_PROFILES, ID.unique(), {
      wallet,
      kyc_status: 'approved',
      displayName: 'E2E Seller',
    });
  } else if (documents[0]['kyc_status'] !== 'approved') {
    await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, documents[0].$id, {
      kyc_status: 'approved',
    });
  }

  const catalog = await findUserByTonAddress(wallet);
  if (!catalog) {
    const id = generateId();
    await db.createDocument(CORE_DATABASE_ID, COL_PROFILES, id, {
      ton_address: wallet,
      name: 'E2E Seller',
      display_name: 'E2E Seller',
      role: 'demiurge',
      slug: `e2e-${Date.now().toString(36)}`,
      is_active: true,
      security_level: 'low',
    });
  }
}

async function issueAgentTokenForWallet(wallet) {
  const { issueToken } = await import('../agent/tokenIssuer.js');
  await ensureSellerAgentReady(wallet);
  const { plaintext } = await issueToken({
    wallet,
    name: 'e2e-suite',
    scopes: ['products:write', 'listings:read', 'listings:write'],
    ttlDays: 1,
  });
  return plaintext;
}

async function runPurchase({ agentToken, collectionAddress, buyerMnemonic, buyerJwt, tag }) {
  const productRes = await fetch(`${API}/api/v1/agent/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${agentToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `E2E ${tag}`, price_usd: 0.01, category: 'developer-tools' }),
  });
  const productData = await productRes.json();
  const catalogProductId = productData.data?.product?.id;
  if (!catalogProductId) throw new Error(`[${tag}] product create failed: ${JSON.stringify(productData)}`);

  const listingRes = await fetch(`${API}/api/v1/agent/listings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${agentToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      catalogProductId,
      title: `E2E Listing ${tag}`,
      priceUsd: 0.01,
      deliveryType: 'license_key',
      deliveryPayload: `SECRET-${tag}`,
      collectionAddress,
    }),
  });
  const listingData = await listingRes.json();
  const listingId = listingData.data?.listing?.id;
  if (!listingId) throw new Error(`[${tag}] listing failed: ${JSON.stringify(listingData)}`);

  const orderRes = await fetch(`${API}/api/v1/commerce/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId, buyerWallet: (await openWallet(buyerMnemonic)).address }),
  });
  const orderData = await orderRes.json();
  if (orderRes.status !== 200) throw new Error(`[${tag}] order failed: ${JSON.stringify(orderData)}`);

  const orderId = orderData.data?.orderId;
  const escrow = orderData.data?.escrow;
  if (!escrow?.address) throw new Error(`[${tag}] no escrow`);

  await payEscrow(buyerMnemonic, escrow);

  const confirmRes = await fetch(`${API}/api/v1/commerce/orders/${orderId}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ buyerWallet: (await openWallet(buyerMnemonic)).address, txHash: '' }),
  });
  let confirmData = await confirmRes.json();
  if (confirmRes.status !== 200 && confirmData.code === 'PAYMENT_VERIFY_FAILED') {
    await sleep(30_000);
    const retry = await fetch(`${API}/api/v1/commerce/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerJwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerWallet: (await openWallet(buyerMnemonic)).address, txHash: '' }),
    });
    confirmData = await retry.json();
    if (retry.status !== 200) {
      throw new Error(`[${tag}] confirm failed: ${JSON.stringify(confirmData)}`);
    }
  } else if (confirmRes.status !== 200) {
    throw new Error(`[${tag}] confirm failed: ${JSON.stringify(confirmData)}`);
  }

  const license = await pollLicenseMinted(orderId, buyerJwt);
  const orderPaid = await pollOrderPaid(orderId, buyerJwt);
  const nftCollection = await getNftCollectionOnChain(license.nftAddress);
  const collectionMatch = addrEq(nftCollection, collectionAddress);

  return {
    tag,
    orderId,
    listingId,
    collectionAddress,
    license: { state: license.state, nftAddress: license.nftAddress },
    order: { state: orderPaid.state },
    onChain: { nftCollection, collectionMatch },
  };
}

async function loadBuyer(orderCount = 1) {
  const buyerFile = join(root, 'scripts', '.verify-e2e-buyer.json');
  let buyerMnemonic = process.env.VERIFY_BUYER_MNEMONIC;
  if (!buyerMnemonic) {
    if (existsSync(buyerFile)) {
      buyerMnemonic = JSON.parse(readFileSync(buyerFile, 'utf8')).mnemonic;
    } else {
      buyerMnemonic = (await mnemonicNew()).join(' ');
      writeFileSync(buyerFile, `${JSON.stringify({ mnemonic: buyerMnemonic }, null, 2)}\n`);
    }
  }
  const buyer = await openWallet(buyerMnemonic);
  const ownerMnemonic = process.env.COLLECTION_OWNER_MNEMONIC_TESTNET?.replace(/^"|"$/g, '') || '';
  await fundBuyerForOrders(ownerMnemonic, buyer.address, orderCount);
  const buyerJwt = await ensureBuyerProfile(buyer.address);
  return { buyerMnemonic, buyerJwt, buyerAddress: buyer.address };
}

async function runSingle() {
  const tokenRaw = readFileSync(join(root, 'scripts', '.verify-token.json'), 'utf8');
  const { token: agentToken } = JSON.parse(tokenRaw.match(/\{[\s\S]*\}/)[0]);
  const collectionAddress =
    process.env.COLLECTION_ADDRESS_TESTNET?.replace(/^"|"$/g, '') ||
    (await provisionSellerCollection(JSON.parse(tokenRaw).wallet));

  const { buyerMnemonic, buyerJwt } = await loadBuyer(1);
  const result = await runPurchase({
    agentToken,
    collectionAddress,
    buyerMnemonic,
    buyerJwt,
    tag: 'single-seller',
  });

  if (result.order.state !== 'paid') throw new Error(`Single-seller: order state=${result.order.state}`);
  if (!result.onChain.collectionMatch) throw new Error('Single-seller: NFT not in expected collection');
  return { scenario: 'single-seller', pass: true, ...result };
}

async function runMulti() {
  const tokenRaw = readFileSync(join(root, 'scripts', '.verify-token.json'), 'utf8');
  const sellerA = JSON.parse(tokenRaw.match(/\{[\s\S]*\}/)[0]).wallet;
  const tokenA = JSON.parse(tokenRaw.match(/\{[\s\S]*\}/)[0]).token;

  const sellerBFile = join(root, 'scripts', '.verify-seller-b.json');
  let sellerB;
  if (existsSync(sellerBFile)) {
    sellerB = JSON.parse(readFileSync(sellerBFile, 'utf8'));
  } else {
    const mnemonic = (await mnemonicNew()).join(' ');
    const w = await openWallet(mnemonic);
    const token = await issueAgentTokenForWallet(w.address);
    sellerB = { wallet: w.address, mnemonic, token };
    writeFileSync(sellerBFile, `${JSON.stringify({ wallet: w.address, token }, null, 2)}\n`);
  }

  const collectionA = await provisionSellerCollection(sellerA);
  const collectionB = await provisionSellerCollection(sellerB.wallet);
  if (addrEq(collectionA, collectionB)) {
    throw new Error(`Multi-seller: collections must differ (both ${collectionA})`);
  }

  await ensureSellerAgentReady(sellerA);
  await ensureSellerAgentReady(sellerB.wallet);

  const { buyerMnemonic, buyerJwt } = await loadBuyer(2);

  const purchaseA = await runPurchase({
    agentToken: tokenA,
    collectionAddress: collectionA,
    buyerMnemonic,
    buyerJwt,
    tag: 'seller-A',
  });
  const purchaseB = await runPurchase({
    agentToken: sellerB.token,
    collectionAddress: collectionB,
    buyerMnemonic,
    buyerJwt,
    tag: 'seller-B',
  });

  if (!purchaseA.onChain.collectionMatch || !purchaseB.onChain.collectionMatch) {
    throw new Error('Multi-seller: NFT collection mismatch on-chain');
  }
  if (addrEq(purchaseA.onChain.nftCollection, purchaseB.onChain.nftCollection)) {
    throw new Error('Multi-seller: both NFTs landed in the same collection');
  }

  return {
    scenario: 'multi-seller',
    pass: true,
    sellerA: { wallet: sellerA, collectionAddress: collectionA, ...purchaseA },
    sellerB: { wallet: sellerB.wallet, collectionAddress: collectionB, ...purchaseB },
  };
}

const report = { startedAt: new Date().toISOString(), mode, results: [], errors: [] };

try {
  if (mode === 'single' || mode === 'all') report.results.push(await runSingle());
  if (mode === 'multi' || mode === 'all') report.results.push(await runMulti());
} catch (err) {
  report.errors.push(err instanceof Error ? err.message : String(err));
}

report.pass = report.errors.length === 0;
report.finishedAt = new Date().toISOString();
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
