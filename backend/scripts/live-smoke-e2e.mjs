/**
 * Live E2E: agent listing → buyer PayEscrow → LICENSE_STATE=MINTED (runs from backend/).
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Cell, Address } from '@ton/core';
import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { Client, Users, ID, Query } from 'node-appwrite';
const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(backendDir, '..');
dotenv.config({ path: join(backendDir, '.env.staging'), override: true });
dotenv.config({ path: join(backendDir, '.env'), override: true });

const API = process.env.VERIFY_API_URL || 'http://127.0.0.1:8081';
const ADMIN = process.env.COMMERCE_ADMIN_SECRET || '';
const BUYER_USER_ID = process.env.VERIFY_BUYER_USER_ID || 'live_verify_buyer';

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

async function openWallet(mnemonic, testnet = true) {
  const keyPair = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const endpoint = process.env.TON_API_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC';
  const client = new TonClient({ endpoint, apiKey: process.env.TON_API_KEY || undefined });
  const opened = client.open(wallet);
  return { client, wallet, opened, keyPair, address: wallet.address.toString({ testOnly: testnet, bounceable: false }) };
}

async function fundBuyer(ownerMnemonic, buyerAddress, nano = '2000000000') {
  const owner = await openWallet(ownerMnemonic);
  const buyerBal = await owner.client.getBalance(Address.parse(buyerAddress));
  if (buyerBal >= 500_000_000n) return;
  const seqno = await owner.opened.getSeqno();
  await owner.opened.sendTransfer({
    seqno,
    secretKey: owner.keyPair.secretKey,
    messages: [internal({ to: Address.parse(buyerAddress), value: BigInt(nano), bounce: false })],
  });
  await waitForBalance(owner.client, buyerAddress, 500_000_000n, 180_000);
}

async function waitForBalance(client, addr, minNano, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const bal = await client.getBalance(Address.parse(addr));
    if (bal >= minNano) return bal;
    await sleep(3_000);
  }
  throw new Error(`Timeout waiting for balance on ${addr}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
  await sleep(20_000);
}

async function pollLicenseMinted(orderId, buyerJwt, timeoutMs = 240_000) {
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
    await sleep(8_000);
  }
  throw new Error('License did not reach minted state in time');
}

const report = { phase1: null, listing: null, order: null, license: null, errors: [] };

try {
  const tokenRaw = readFileSync(join(root, 'scripts', '.verify-token.json'), 'utf8');
  const { token: agentToken } = JSON.parse(tokenRaw.match(/\{[\s\S]*\}/)[0]);

  const collectionAddress = process.env.COLLECTION_ADDRESS_TESTNET?.replace(/^"|"$/g, '') || '';
  if (!collectionAddress) throw new Error('COLLECTION_ADDRESS_TESTNET not set');
  report.phase1 = { skipped: true, collectionAddress };

  const buyerFile = join(root, 'scripts', '.verify-e2e-buyer.json');
  let buyerMnemonic = process.env.VERIFY_BUYER_MNEMONIC;
  if (!buyerMnemonic) {
    try {
      buyerMnemonic = JSON.parse(readFileSync(buyerFile, 'utf8')).mnemonic;
    } catch {
      const { mnemonicNew } = await import('@ton/crypto');
      buyerMnemonic = (await mnemonicNew()).join(' ');
      writeFileSync(buyerFile, `${JSON.stringify({ mnemonic: buyerMnemonic }, null, 2)}\n`);
    }
  }

  const buyer = await openWallet(buyerMnemonic);
  report.buyerAddress = buyer.address;

  const ownerMnemonic = process.env.COLLECTION_OWNER_MNEMONIC_TESTNET?.replace(/^"|"$/g, '') || '';
  await fundBuyer(ownerMnemonic, buyer.address);
  const buyerJwt = await ensureBuyerProfile(buyer.address);

  const productRes = await fetch(`${API}/api/v1/agent/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${agentToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'E2E Live Verify App', price_usd: 1, category: 'developer-tools' }),
  });
  const productData = await productRes.json();
  const catalogProductId = productData.data?.product?.id;
  if (!catalogProductId) throw new Error(`Product create failed: ${JSON.stringify(productData)}`);

  const listingRes = await fetch(`${API}/api/v1/agent/listings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${agentToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      catalogProductId,
      title: 'E2E Live Verify Listing',
      priceUsd: 1,
      deliveryType: 'license_key',
      deliveryPayload: 'E2E-SECRET-KEY-12345',
      collectionAddress,
    }),
  });
  const listingData = await listingRes.json();
  report.listing = { status: listingRes.status, data: listingData };
  const listingId = listingData.data?.listing?.id;
  if (!listingId) throw new Error(`Listing create failed: ${JSON.stringify(listingData)}`);

  const orderRes = await fetch(`${API}/api/v1/commerce/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId, buyerWallet: buyer.address }),
  });
  const orderData = await orderRes.json();
  report.order = { status: orderRes.status, data: orderData };
  if (orderRes.status !== 200) throw new Error(`Order create failed: ${JSON.stringify(orderData)}`);

  const orderId = orderData.data?.orderId;
  const escrow = orderData.data?.escrow;
  if (!escrow?.address) throw new Error('Order has no escrow');

  await payEscrow(buyerMnemonic, escrow);

  const confirmRes = await fetch(`${API}/api/v1/commerce/orders/${orderId}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ buyerWallet: buyer.address, txHash: '' }),
  });
  const confirmData = await confirmRes.json();
  report.order.confirm = { status: confirmRes.status, data: confirmData };
  if (confirmRes.status !== 200) throw new Error(`Confirm failed: ${JSON.stringify(confirmData)}`);

  report.license = await pollLicenseMinted(orderId, buyerJwt);
} catch (err) {
  report.errors.push(err instanceof Error ? err.message : String(err));
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.errors.length ? 1 : 0);
