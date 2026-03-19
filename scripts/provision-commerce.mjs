/**
 * Commerce коллекции в БД marketplace + bucket commerce_assets.
 * env: как у provision-appwrite.mjs + APPWRITE_API_KEY с правами databases.* и storage.*
 */
import 'dotenv/config';
import { Client, Databases, IndexType, Permission, Role, Storage } from 'node-appwrite';

const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT ?? '';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? '';
const API_KEY = process.env.APPWRITE_API_KEY ?? '';

const DATABASE_ID = 'marketplace';
const COL_SELLER_PROFILES = 'seller_profiles';
const COL_LISTINGS = 'listings';
const COL_LISTING_SECRETS = 'listing_secrets';
const COL_ORDERS = 'orders';
const COL_ENTITLEMENTS = 'entitlements';
const COL_DISPUTES = 'disputes';
const COL_AUDIT = 'commerce_audit_logs';
const BUCKET_ASSETS = 'commerce_assets';

const READ_ANY = [Permission.read(Role.any())];
const SERVER_ONLY = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ignoreConflict(fn) {
  try {
    await fn();
  } catch (error) {
    if (error.code !== 409) throw error;
  }
}

async function waitForAttribute(databases, collectionId, key) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const attr = await databases.getAttribute(DATABASE_ID, collectionId, key);
    if (attr.status === 'available') return;
    if (attr.status === 'failed') throw new Error(`${collectionId}.${key}: ${attr.error}`);
    await sleep(1000);
  }
  throw new Error(`Timeout attribute ${collectionId}.${key}`);
}

async function ensureCollection(databases, collectionId, name, permissions) {
  try {
    await databases.createCollection(DATABASE_ID, collectionId, name, permissions, false, true);
    console.log(`[commerce] Коллекция ${collectionId}`);
  } catch (error) {
    if (error.code === 409) console.log(`[commerce] Коллекция ${collectionId} уже есть`);
    else throw error;
  }
}

async function idx(databases, collectionId, key, type, attributes) {
  try {
    await databases.createIndex(DATABASE_ID, collectionId, key, type, attributes);
    console.log(`[commerce] Индекс ${collectionId}.${key}`);
  } catch (error) {
    if (error.code !== 409) throw error;
  }
}

async function setupSellerProfiles(databases) {
  await ensureCollection(databases, COL_SELLER_PROFILES, 'Seller profiles', READ_ANY);
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_SELLER_PROFILES, 'wallet', 128, true)
  );
  await waitForAttribute(databases, COL_SELLER_PROFILES, 'wallet');
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_SELLER_PROFILES, 'displayName', 255, true)
  );
  await waitForAttribute(databases, COL_SELLER_PROFILES, 'displayName');
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_SELLER_PROFILES, 'bio', 4000, false)
  );
  await waitForAttribute(databases, COL_SELLER_PROFILES, 'bio');
  await idx(databases, COL_SELLER_PROFILES, 'uniq_wallet', IndexType.Unique, ['wallet']);
}

async function setupListings(databases) {
  await ensureCollection(databases, COL_LISTINGS, 'Commerce listings', READ_ANY);
  const strings = [
    ['sellerWallet', 128, true],
    ['catalogProductId', 64, true],
    ['title', 255, true],
    ['description', 12000, true],
    ['currency', 16, true],
    ['jettonMaster', 128, false],
    ['priceAmountRaw', 80, true],
    ['status', 32, true],
    ['deliveryType', 32, true],
    ['assetFileId', 128, false],
  ];
  for (const [k, size, req] of strings) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_LISTINGS, k, size, req)
    );
    await waitForAttribute(databases, COL_LISTINGS, k);
  }
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, COL_LISTINGS, 'decimals', true)
  );
  await waitForAttribute(databases, COL_LISTINGS, 'decimals');
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, COL_LISTINGS, 'platformFeeBps', true)
  );
  await waitForAttribute(databases, COL_LISTINGS, 'platformFeeBps');
  await idx(databases, COL_LISTINGS, 'idx_catalog_status', IndexType.Key, [
    'catalogProductId',
    'status',
  ]);
}

async function setupListingSecrets(databases) {
  await ensureCollection(databases, COL_LISTING_SECRETS, 'Listing secrets', SERVER_ONLY);
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_LISTING_SECRETS, 'listingId', 64, true)
  );
  await waitForAttribute(databases, COL_LISTING_SECRETS, 'listingId');
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_LISTING_SECRETS, 'deliveryPayload', 50000, true)
  );
  await waitForAttribute(databases, COL_LISTING_SECRETS, 'deliveryPayload');
  await idx(databases, COL_LISTING_SECRETS, 'uniq_listing', IndexType.Unique, ['listingId']);
}

async function setupOrders(databases) {
  await ensureCollection(databases, COL_ORDERS, 'Commerce orders', SERVER_ONLY);
  const cols = [
    ['listingId', 64, true],
    ['buyerWallet', 128, true],
    ['amountRaw', 80, true],
    ['currency', 16, true],
    ['jettonMaster', 128, false],
    ['memo', 96, true],
    ['tonTxHash', 128, false],
    ['state', 32, true],
    ['sellerNetAmountRaw', 80, true],
    ['listingSnapshotTitle', 255, false],
  ];
  for (const [k, size, req] of cols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_ORDERS, k, size, req)
    );
    await waitForAttribute(databases, COL_ORDERS, k);
  }
  await idx(databases, COL_ORDERS, 'idx_order_memo', IndexType.Unique, ['memo']);
  await idx(databases, COL_ORDERS, 'idx_buyer_state', IndexType.Key, ['buyerWallet', 'state']);
  await idx(databases, COL_ORDERS, 'idx_listing', IndexType.Key, ['listingId']);
}

async function setupEntitlements(databases) {
  await ensureCollection(databases, COL_ENTITLEMENTS, 'Entitlements', SERVER_ONLY);
  const cols = [
    ['orderId', 64, true],
    ['buyerWallet', 128, true],
    ['listingId', 64, true],
    ['deliveryPayload', 50000, true],
  ];
  for (const [k, size, req] of cols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_ENTITLEMENTS, k, size, req)
    );
    await waitForAttribute(databases, COL_ENTITLEMENTS, k);
  }
  await idx(databases, COL_ENTITLEMENTS, 'uniq_order', IndexType.Unique, ['orderId']);
  await idx(databases, COL_ENTITLEMENTS, 'idx_buyer', IndexType.Key, ['buyerWallet']);
}

async function setupDisputes(databases) {
  await ensureCollection(databases, COL_DISPUTES, 'Disputes', SERVER_ONLY);
  const cols = [
    ['orderId', 64, true],
    ['openedByWallet', 128, true],
    ['reason', 8000, true],
    ['status', 32, true],
    ['resolutionNote', 8000, false],
  ];
  for (const [k, size, req] of cols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_DISPUTES, k, size, req)
    );
    await waitForAttribute(databases, COL_DISPUTES, k);
  }
  await idx(databases, COL_DISPUTES, 'idx_dispute_order', IndexType.Key, ['orderId']);
}

async function setupAudit(databases) {
  await ensureCollection(databases, COL_AUDIT, 'Commerce audit', SERVER_ONLY);
  const cols = [
    ['actor', 128, true],
    ['action', 64, true],
    ['entityType', 32, true],
    ['entityId', 64, true],
    ['payloadJson', 12000, false],
  ];
  for (const [k, size, req] of cols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_AUDIT, k, size, req)
    );
    await waitForAttribute(databases, COL_AUDIT, k);
  }
  await idx(databases, COL_AUDIT, 'idx_audit_entity', IndexType.Key, ['entityType', 'entityId']);
}

async function ensureBucket(storage) {
  try {
    await storage.createBucket(
      BUCKET_ASSETS,
      'Commerce assets',
      READ_ANY,
      true,
      true,
      52_428_800,
      ['zip', 'apk', 'bin', 'txt', 'gz']
    );
    console.log('[commerce] Bucket commerce_assets');
  } catch (error) {
    if (error.code !== 409) throw error;
    console.log('[commerce] Bucket уже есть');
  }
}

async function main() {
  if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
    console.error('Нужны APPWRITE_* / VITE_APPWRITE_* и APPWRITE_API_KEY');
    process.exit(1);
  }
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);
  const storage = new Storage(client);

  await setupSellerProfiles(databases);
  await setupListings(databases);
  await setupListingSecrets(databases);
  await setupOrders(databases);
  await setupEntitlements(databases);
  await setupDisputes(databases);
  await setupAudit(databases);
  await ensureBucket(storage);

  console.log('[commerce] Готово. Запуск: backend с TREASURY_WALLET_ADDRESS, APPWRITE_*');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
