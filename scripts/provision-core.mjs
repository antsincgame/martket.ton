/**
 * БД `core` в Appwrite: профили, legacy developers/products, аудит, bucket для TonForge state.
 * env: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 */
import 'dotenv/config';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client, Databases, Storage, Permission, Role, IndexType } from 'node-appwrite';

const BUCKET_TONFORGE_STATE = 'tonforge_state';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT ?? '';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? '';
const API_KEY = process.env.APPWRITE_API_KEY ?? '';

const DATABASE_ID = 'core';
const READ_USERS = [Permission.read(Role.users()), Permission.read(Role.team('admin'))];
const CRUD_USERS = [
  Permission.create(Role.users()),
  Permission.read(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.team('admin')),
];

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
    if (attr.status === 'failed') throw new Error(`Атрибут ${collectionId}.${key}: ${attr.error}`);
    await sleep(1000);
  }
  throw new Error(`Таймаут ожидания атрибута ${collectionId}.${key}`);
}

async function ensureDatabase(databases) {
  try {
    await databases.create(DATABASE_ID, 'TON Core (profiles + legacy API)', true);
    console.log('[core] Создана БД core');
  } catch (error) {
    if (error.code === 409) console.log('[core] БД core уже есть');
    else throw error;
  }
}

async function ensureCollection(databases, collectionId, name, perms) {
  try {
    await databases.createCollection(DATABASE_ID, collectionId, name, perms, false, true);
    console.log(`[core] Коллекция ${collectionId}`);
  } catch (error) {
    if (error.code === 409) console.log(`[core] Коллекция ${collectionId} уже есть`);
    else throw error;
  }
}

async function setupProfiles(databases) {
  await ensureCollection(databases, 'profiles', 'User profiles', READ_USERS);
  const attrs = [
    ['email', 320, false],
    ['ton_address', 128, false],
    ['name', 255, true],
    ['role', 64, true],
    ['avatar', 2048, false],
    ['bio', 8000, false],
    ['security_level', 32, true],
    ['appwrite_user_id', 36, false],
  ];
  for (const [key, size, req] of attrs) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, 'profiles', key, size, req)
    );
    await waitForAttribute(databases, 'profiles', key);
  }
  await ignoreConflict(() => databases.createBooleanAttribute(DATABASE_ID, 'profiles', 'is_active', true));
  await waitForAttribute(databases, 'profiles', 'is_active');
  try {
    await databases.createIndex(DATABASE_ID, 'profiles', 'idx_ton', IndexType.Key, ['ton_address']);
    console.log('[core] Индекс profiles.ton_address');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс ton уже есть');
    else throw e;
  }
  try {
    await databases.createIndex(DATABASE_ID, 'profiles', 'idx_appwrite_user', IndexType.Key, [
      'appwrite_user_id',
    ]);
    console.log('[core] Индекс profiles.appwrite_user_id');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс appwrite_user_id уже есть');
    else throw e;
  }
}

async function setupDevelopers(databases) {
  await ensureCollection(databases, 'developers', 'Legacy developers', CRUD_USERS);
  const attrs = [
    ['user_id', 64, false],
    ['name', 255, true],
    ['email', 320, true],
    ['description', 8000, false],
    ['ton_address', 128, false],
    ['status', 32, true],
  ];
  for (const [key, size, req] of attrs) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, 'developers', key, size, req)
    );
    await waitForAttribute(databases, 'developers', key);
  }
}

async function setupLegacyProducts(databases) {
  await ensureCollection(databases, 'legacy_products', 'Legacy API products', CRUD_USERS);
  const strings = [
    ['developer_id', 64, false],
    ['name', 255, true],
    ['description', 16000, false],
    ['short_description', 2000, false],
    ['category', 64, true],
    ['image', 2048, false],
    ['status', 32, true],
  ];
  for (const [key, size, req] of strings) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, 'legacy_products', key, size, req)
    );
    await waitForAttribute(databases, 'legacy_products', key);
  }
  await ignoreConflict(() => databases.createFloatAttribute(DATABASE_ID, 'legacy_products', 'price_ton', true));
  await waitForAttribute(databases, 'legacy_products', 'price_ton');
  await ignoreConflict(() => databases.createFloatAttribute(DATABASE_ID, 'legacy_products', 'rating', true));
  await waitForAttribute(databases, 'legacy_products', 'rating');
  await ignoreConflict(() => databases.createIntegerAttribute(DATABASE_ID, 'legacy_products', 'reviews_count', true));
  await waitForAttribute(databases, 'legacy_products', 'reviews_count');
  await ignoreConflict(() => databases.createIntegerAttribute(DATABASE_ID, 'legacy_products', 'downloads', true));
  await waitForAttribute(databases, 'legacy_products', 'downloads');
}

async function setupAudit(databases) {
  await ensureCollection(databases, 'api_audit_logs', 'API audit logs', [
    Permission.create(Role.users()),
    Permission.read(Role.team('admin')),
  ]);
  const attrs = [
    ['user_id', 64, false],
    ['action', 128, true],
    ['resource', 128, true],
    ['resource_id', 128, false],
    ['result', 32, true],
    ['metadata', 24000, false],
    ['ip_address', 64, false],
    ['user_agent', 512, false],
  ];
  for (const [key, size, req] of attrs) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, 'api_audit_logs', key, size, req)
    );
    await waitForAttribute(databases, 'api_audit_logs', key);
  }
}

async function ensureBucket(storage) {
  try {
    await storage.createBucket(
      BUCKET_TONFORGE_STATE,
      'TonForge demo state',
      [Permission.read(Role.any()), Permission.create(Role.users()), Permission.update(Role.users())],
      true,
      true,
      5_242_880,
      ['json']
    );
    console.log('[core] Bucket tonforge_state');
  } catch (e) {
    if (e.code === 409) console.log('[core] Bucket tonforge_state уже есть');
    else throw e;
  }
}

async function main() {
  if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
    console.error('Задайте APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
    process.exit(1);
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);
  const storage = new Storage(client);

  await ensureDatabase(databases);
  await setupProfiles(databases);
  await setupDevelopers(databases);
  await setupLegacyProducts(databases);
  await setupAudit(databases);
  await ensureBucket(storage);

  console.log('[core] Готово. Запустите npm run seed в backend при необходимости.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
