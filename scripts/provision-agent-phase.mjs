/**
 * Провижн только Phase 0/1 коллекций (agent_instructions, seller_collections).
 * Обходит attribute_limit_exceeded на legacy listings.
 */
import 'dotenv/config';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client, Databases, IndexType, Permission, Role } from 'node-appwrite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, 'backend', '.env.staging') });
dotenv.config({ path: join(root, 'backend', '.env') });

const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT ?? '';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? '';
const API_KEY = process.env.APPWRITE_API_KEY ?? '';
const DATABASE_ID = 'marketplace';
const SERVER_ONLY = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ignoreConflict(fn) {
  try {
    await fn();
  } catch (error) {
    if (error.code !== 409 && error.type !== 'attribute_limit_exceeded') throw error;
  }
}

async function waitForAttribute(databases, collectionId, key, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    const list = await databases.listAttributes(DATABASE_ID, collectionId);
    const found = list.attributes.find((a) => a.key === key);
    if (found && found.status === 'available') return;
    await sleep(500);
  }
  console.warn(`[provision-phase] attribute ${collectionId}.${key} not available yet`);
}

async function ensureCollection(databases, id, name) {
  try {
    await databases.createCollection(DATABASE_ID, id, name, SERVER_ONLY);
    console.log(`[provision-phase] created ${id}`);
  } catch (e) {
    if (e.code === 409) console.log(`[provision-phase] ${id} already exists`);
    else throw e;
  }
}

async function idx(databases, col, name, type, keys) {
  await ignoreConflict(() => databases.createIndex(DATABASE_ID, col, name, type, keys));
}

async function setupAgentTokens(databases) {
  const col = 'agent_tokens';
  await ensureCollection(databases, col, 'Agent API Personal Access Tokens');
  for (const [k, size, req] of [
    ['wallet', 128, true],
    ['tokenHash', 64, true],
    ['tokenPrefix', 16, true],
    ['name', 80, true],
    ['scopes', 255, true],
  ]) {
    await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, col, k, size, req));
    await waitForAttribute(databases, col, k);
  }
  for (const k of ['lastUsedAt', 'expiresAt', 'revokedAt']) {
    await ignoreConflict(() => databases.createDatetimeAttribute(DATABASE_ID, col, k, false));
    await waitForAttribute(databases, col, k);
  }
  await idx(databases, col, 'uniq_token_hash', IndexType.Unique, ['tokenHash']);
  await idx(databases, col, 'idx_wallet', IndexType.Key, ['wallet']);
}

async function setupAgentInstructions(databases) {
  const col = 'agent_instructions';
  await ensureCollection(databases, col, 'Agent instructions');
  for (const [k, size, req] of [
    ['section', 64, true],
    ['title', 255, true],
    ['body', 20000, true],
  ]) {
    await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, col, k, size, req));
    await waitForAttribute(databases, col, k);
  }
  for (const [k, req] of [
    ['order', false],
    ['version', false],
  ]) {
    await ignoreConflict(() => databases.createIntegerAttribute(DATABASE_ID, col, k, req));
    await waitForAttribute(databases, col, k);
  }
  await ignoreConflict(() => databases.createBooleanAttribute(DATABASE_ID, col, 'active', false, true));
  await waitForAttribute(databases, col, 'active');
  await idx(databases, col, 'uniq_section', IndexType.Unique, ['section']);
}

async function setupSellerCollections(databases) {
  const col = 'seller_collections';
  await ensureCollection(databases, col, 'Per-seller collections');
  for (const [k, size, req] of [
    ['sellerWallet', 128, true],
    ['network', 16, true],
    ['appId', 80, true],
    ['collectionAddress', 96, false],
    ['ownerWallet', 128, false],
    ['metadataUri', 512, false],
    ['itemBaseUri', 512, false],
    ['deployTxHash', 128, false],
    ['status', 16, true],
    ['lastError', 1000, false],
  ]) {
    await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, col, k, size, req));
    await waitForAttribute(databases, col, k);
  }
  await ignoreConflict(() => databases.createDatetimeAttribute(DATABASE_ID, col, 'deployedAt', false));
  await waitForAttribute(databases, col, 'deployedAt');
  await idx(databases, col, 'uniq_wallet_network', IndexType.Unique, ['sellerWallet', 'network']);
  await idx(databases, col, 'idx_status', IndexType.Key, ['status']);
}

async function main() {
  if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
    console.error('Need APPWRITE_* env');
    process.exit(1);
  }
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);
  await setupAgentTokens(databases);
  await setupAgentInstructions(databases);
  await setupSellerCollections(databases);
  console.log('[provision-phase] Done: agent_instructions + seller_collections');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
