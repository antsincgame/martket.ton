/**
 * Commerce коллекции в БД marketplace + bucket commerce_assets.
 * env: как у provision-appwrite.mjs + APPWRITE_API_KEY с правами databases.* и storage.*
 *
 * v4 escrow поля (orders): sellerWallet, escrowAddress, licenseContentUri,
 * mintAttempts (int), licenseAddress. Эти поля нужны mint worker'у для
 * автоматической обработки платежа и deploy LicenseItem.
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
const COL_AUDIT = 'commerce_audit_logs';
const COL_DOWNLOAD_AUDIT = 'download_audit';
const COL_LICENSES = 'licenses';
const COL_WORKER_LOCKS = 'worker_locks';
const COL_AGENT_TOKENS = 'agent_tokens';
const COL_AML_CHECKS = 'aml_checks';
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

  // ── BYOS storage fields (encrypted credentials for per-developer R2/S3) ──
  // All optional: a seller without storage cannot publish, but can register.
  const storageCols = [
    ['storage_provider', 32, false],            // 'cloudflare-r2' | 's3' | 'b2' | 'none'
    ['storage_account_id', 128, false],
    ['storage_bucket', 128, false],
    ['storage_endpoint', 255, false],
    ['storage_creds_iv', 64, false],            // hex
    ['storage_creds_tag', 64, false],           // hex
    ['storage_creds_ciphertext', 4000, false],  // hex
    ['storage_status', 32, false],              // 'connected' | 'error' | 'revoked' | 'unconfigured'
    ['storage_last_error', 1000, false],
    ['storage_public_base_url', 255, false],
  ];
  for (const [k, size, req] of storageCols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_SELLER_PROFILES, k, size, req)
    );
    await waitForAttribute(databases, COL_SELLER_PROFILES, k);
  }
  await ignoreConflict(() =>
    databases.createDatetimeAttribute(DATABASE_ID, COL_SELLER_PROFILES, 'storage_last_check_at', false)
  );
  await waitForAttribute(databases, COL_SELLER_PROFILES, 'storage_last_check_at');

  // ── Full KYC fields (seller verification via Didit) ──
  const kycCols = [
    ['kyc_status', 32, false],
    ['kyc_provider', 32, false],
    ['kyc_applicant_id', 128, false],
    ['kyc_rejection_reason', 500, false],
  ];
  for (const [k, size, req] of kycCols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_SELLER_PROFILES, k, size, req)
    );
    await waitForAttribute(databases, COL_SELLER_PROFILES, k);
  }
  await ignoreConflict(() =>
    databases.createDatetimeAttribute(DATABASE_ID, COL_SELLER_PROFILES, 'kyc_completed_at', false)
  );
  await waitForAttribute(databases, COL_SELLER_PROFILES, 'kyc_completed_at');
  await idx(databases, COL_SELLER_PROFILES, 'idx_kyc_status', IndexType.Key, ['kyc_status']);
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
    // v4: per-listing custom metadata URI. Если пустой — order использует fallback.
    ['licenseContentUri', 512, false],
  ];
  for (const [k, size, req] of strings) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_LISTINGS, k, size, req)
    );
    await waitForAttribute(databases, COL_LISTINGS, k);
  }
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_LISTINGS, 'priceUsd', 32, false)
  );
  await waitForAttribute(databases, COL_LISTINGS, 'priceUsd');
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

  // ── License NFT fields (per-listing collection on TON) ──────────
  // After the NFT-mint bridge `collection_address` is REQUIRED at application
  // level (createListingSchema in backend/commerce/validation.ts). We keep
  // the Appwrite attribute itself nullable so re-provisioning doesn't fail
  // on databases that still have legacy rows; the migration script
  // `scripts/migrate-suspend-no-collection.mjs` flips such legacy listings
  // to status=suspended.
  // metadata_uri_prefix capped at 128 to fit Appwrite row-size budget
  // (listings collection holds many large strings: description=12000,
  //  distribution_locator=2048, etc.). 128 is enough for IPFS / R2 URL prefix.
  const nftCols = [
    ['collection_address', 96, false],
    ['metadata_uri_prefix', 128, false],
    ['license_transfer_limit', 16, false], // stored as string, 0 = soulbound
  ];
  for (const [k, size, req] of nftCols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_LISTINGS, k, size, req)
    );
    await waitForAttribute(databases, COL_LISTINGS, k);
  }

  // ── Distribution manifest fields (BYOS: R2 / GitHub Releases) ──
  const distCols = [
    ['distribution_kind', 16, false],          // 'r2' | 'github' | 'none'
    ['distribution_locator', 2048, false],     // JSON: {bucket,key} | {repo,tag,asset}
    ['distribution_sha256', 64, false],
    ['distribution_filename', 255, false],
    ['distribution_state', 32, false],         // draft|verified|manifest_drift|source_unavailable
    ['distribution_health_status', 16, false], // ok|degraded|down
    ['scan_id', 128, false],
    ['scan_status', 32, false],                // idle|scanning|clean|suspicious|malicious|oversize_skip|error
    ['scan_report_url', 255, false],
    ['scan_sha256', 64, false],
  ];
  for (const [k, size, req] of distCols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_LISTINGS, k, size, req)
    );
    await waitForAttribute(databases, COL_LISTINGS, k);
  }
  const distInts = [
    ['distribution_size', false],
    ['distribution_ttl_sec', false],
  ];
  for (const [k, req] of distInts) {
    await ignoreConflict(() =>
      databases.createIntegerAttribute(DATABASE_ID, COL_LISTINGS, k, req)
    );
    await waitForAttribute(databases, COL_LISTINGS, k);
  }
  const distDates = [
    'distribution_verified_at',
    'distribution_health_at',
    'scan_at',
  ];
  for (const k of distDates) {
    await ignoreConflict(() =>
      databases.createDatetimeAttribute(DATABASE_ID, COL_LISTINGS, k, false)
    );
    await waitForAttribute(databases, COL_LISTINGS, k);
  }
}

async function setupDownloadAudit(databases) {
  await ensureCollection(databases, COL_DOWNLOAD_AUDIT, 'Download audit', SERVER_ONLY);
  const cols = [
    ['license_id', 64, true],
    ['buyer_wallet', 128, true],
    ['ip_hash', 64, false],
    ['source_kind', 16, true],
  ];
  for (const [k, size, req] of cols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_DOWNLOAD_AUDIT, k, size, req)
    );
    await waitForAttribute(databases, COL_DOWNLOAD_AUDIT, k);
  }
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, COL_DOWNLOAD_AUDIT, 'ttl_sec', false)
  );
  await waitForAttribute(databases, COL_DOWNLOAD_AUDIT, 'ttl_sec');
  await ignoreConflict(() =>
    databases.createDatetimeAttribute(DATABASE_ID, COL_DOWNLOAD_AUDIT, 'issued_at', true)
  );
  await waitForAttribute(databases, COL_DOWNLOAD_AUDIT, 'issued_at');
  await idx(databases, COL_DOWNLOAD_AUDIT, 'idx_license_issued', IndexType.Key, ['license_id', 'issued_at']);
  await idx(databases, COL_DOWNLOAD_AUDIT, 'idx_buyer', IndexType.Key, ['buyer_wallet']);
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
    // v3 legacy поля
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
    // v4 escrow поля — нужны mint worker'у
    ['sellerWallet', 128, false],       // seller address для MintLicense
    ['escrowAddress', 128, false],      // derived Escrow address
    ['licenseContentUri', 512, false],  // TEP-64 metadata URI
    ['licenseAddress', 128, false],     // set by worker после RegisterLicense
  ];
  for (const [k, size, req] of cols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_ORDERS, k, size, req)
    );
    await waitForAttribute(databases, COL_ORDERS, k);
  }
  // mintAttempts — integer, отдельным вызовом
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, COL_ORDERS, 'mintAttempts', false, 0, 100, 0)
  );
  await waitForAttribute(databases, COL_ORDERS, 'mintAttempts');

  await idx(databases, COL_ORDERS, 'idx_order_memo', IndexType.Unique, ['memo']);
  await idx(databases, COL_ORDERS, 'idx_buyer_state', IndexType.Key, ['buyerWallet', 'state']);
  await idx(databases, COL_ORDERS, 'idx_listing', IndexType.Key, ['listingId']);
  // Index для mint worker polling — state + escrowAddress
  await idx(databases, COL_ORDERS, 'idx_state_escrow', IndexType.Key, ['state', 'escrowAddress']);
}

async function setupEntitlements(databases) {
  await ensureCollection(databases, COL_ENTITLEMENTS, 'Entitlements', SERVER_ONLY);
  const cols = [
    ['orderId', 64, true],
    ['buyerWallet', 128, true],
    ['listingId', 64, true],
    ['deliveryPayload', 50000, true],
    // v4: для каких ордеров была заминчена лицензия и куда
    ['licenseAddress', 128, false],
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

async function setupLicenses(databases) {
  await ensureCollection(databases, COL_LICENSES, 'License NFT records', SERVER_ONLY);
  // Single source of truth for License NFT lifecycle.
  // Created when Commerce order is paid. Updated by mintWorker as the
  // on-chain state progresses (mint_pending → minted | mint_failed → burned/refunded).
  const stringCols = [
    ['orderId', 64, true],
    ['listingId', 64, true],
    ['catalogProductId', 64, false],
    ['buyerWallet', 128, true],
    ['sellerWallet', 128, true],
    ['escrowAddress', 96, false],
    ['collectionAddress', 96, false],
    ['nftAddress', 96, false],
    ['mintTxHash', 128, false],
    ['burnTxHash', 128, false],
    ['refundTxHash', 128, false],
    ['refundReason', 255, false],
    // Tact queryId echoed back by the oracle wallet for replay protection.
    ['mintQueryId', 64, false],
    ['mintError', 1000, false],
    // mint_pending | minted | mint_failed | refund_pending | burned | refunded
    ['state', 32, true],
  ];
  for (const [k, size, req] of stringCols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_LICENSES, k, size, req)
    );
    await waitForAttribute(databases, COL_LICENSES, k);
  }
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, COL_LICENSES, 'mintAttempts', false)
  );
  await waitForAttribute(databases, COL_LICENSES, 'mintAttempts');
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, COL_LICENSES, 'collectionIndex', false)
  );
  await waitForAttribute(databases, COL_LICENSES, 'collectionIndex');
  const dateCols = ['trialEndsAt', 'mintedAt', 'lastMintAttemptAt', 'burnedAt', 'refundedAt', 'releasedAt'];
  for (const k of dateCols) {
    await ignoreConflict(() =>
      databases.createDatetimeAttribute(DATABASE_ID, COL_LICENSES, k, false)
    );
    await waitForAttribute(databases, COL_LICENSES, k);
  }
  await idx(databases, COL_LICENSES, 'uniq_order', IndexType.Unique, ['orderId']);
  await idx(databases, COL_LICENSES, 'idx_buyer_state', IndexType.Key, ['buyerWallet', 'state']);
  await idx(databases, COL_LICENSES, 'idx_state', IndexType.Key, ['state']);
  await idx(databases, COL_LICENSES, 'idx_listing', IndexType.Key, ['listingId']);
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

async function setupWorkerLocks(databases) {
  // Distributed mutex for the mint/refund/payout worker. Each lock is a
  // single document (lockKey + owner + expiresAt). The unique index on
  // lockKey is what makes it actually serialize across replicas.
  await ensureCollection(databases, COL_WORKER_LOCKS, 'Worker Locks', SERVER_ONLY);
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_WORKER_LOCKS, 'lockKey', 64, true)
  );
  await waitForAttribute(databases, COL_WORKER_LOCKS, 'lockKey');
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_WORKER_LOCKS, 'owner', 64, true)
  );
  await waitForAttribute(databases, COL_WORKER_LOCKS, 'owner');
  await ignoreConflict(() =>
    databases.createDatetimeAttribute(DATABASE_ID, COL_WORKER_LOCKS, 'expiresAt', true)
  );
  await waitForAttribute(databases, COL_WORKER_LOCKS, 'expiresAt');
  await idx(databases, COL_WORKER_LOCKS, 'uniq_lockKey', IndexType.Unique, ['lockKey']);
}

async function setupAgentTokens(databases) {
  // Personal Access Tokens for AI agents acting on behalf of a verified
  // seller. Only the sha256 of the plaintext is stored; the plaintext is
  // returned exactly once at issue time. Lookup keyed on tokenHash (unique).
  await ensureCollection(databases, COL_AGENT_TOKENS, 'Agent API Personal Access Tokens', SERVER_ONLY);
  const stringCols = [
    ['wallet', 128, true],
    ['tokenHash', 64, true],
    ['tokenPrefix', 16, true],
    ['name', 80, true],
    // CSV scope list, e.g. "listings:read,listings:write,orders:read,distribution:write"
    ['scopes', 255, true],
  ];
  for (const [k, size, req] of stringCols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_AGENT_TOKENS, k, size, req)
    );
    await waitForAttribute(databases, COL_AGENT_TOKENS, k);
  }
  const dateCols = ['lastUsedAt', 'expiresAt', 'revokedAt'];
  for (const k of dateCols) {
    await ignoreConflict(() =>
      databases.createDatetimeAttribute(DATABASE_ID, COL_AGENT_TOKENS, k, false)
    );
    await waitForAttribute(databases, COL_AGENT_TOKENS, k);
  }
  await idx(databases, COL_AGENT_TOKENS, 'uniq_token_hash', IndexType.Unique, ['tokenHash']);
  await idx(databases, COL_AGENT_TOKENS, 'idx_wallet', IndexType.Key, ['wallet']);
}

async function setupAmlChecks(databases) {
  // Кэш AML-вердиктов AMLBot (backend/aml/amlbot.ts): один документ на
  // нормализованный кошелёк (0:hex). Свежесть контролирует код через
  // AML_CACHE_HOURS, протухшие записи перезаписываются upsert'ом.
  await ensureCollection(databases, COL_AML_CHECKS, 'AML wallet checks', SERVER_ONLY);
  const stringCols = [
    ['wallet', 128, true],
    ['asset', 16, true],
    ['verdict', 16, true],          // ok | high_risk
    ['providerRaw', 4000, false],   // усечённый сырой ответ провайдера для разбора инцидентов
  ];
  for (const [k, size, req] of stringCols) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_AML_CHECKS, k, size, req)
    );
    await waitForAttribute(databases, COL_AML_CHECKS, k);
  }
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, COL_AML_CHECKS, 'riskScore', true)
  );
  await waitForAttribute(databases, COL_AML_CHECKS, 'riskScore');
  await ignoreConflict(() =>
    databases.createDatetimeAttribute(DATABASE_ID, COL_AML_CHECKS, 'checkedAt', true)
  );
  await waitForAttribute(databases, COL_AML_CHECKS, 'checkedAt');
  await idx(databases, COL_AML_CHECKS, 'uniq_wallet', IndexType.Unique, ['wallet']);
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
  await setupLicenses(databases);
  await setupWorkerLocks(databases);
  await setupAgentTokens(databases);
  await setupAmlChecks(databases);
  await setupAudit(databases);
  await setupDownloadAudit(databases);
  await ensureBucket(storage);

  console.log('[commerce] Готово. Запуск: backend с TREASURY_WALLET_ADDRESS, APPWRITE_*, STORAGE_ENCRYPTION_KEY');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
