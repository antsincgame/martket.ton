/**
 * Миграция БД core → модель Демиурга (Demiurge).
 * - Расширяет profiles: display_name, clerk_user_id
 * - Создаёт коллекцию purchases (история покупок)
 * - Расширяет legacy_products: creator_id, build_r2_key, build_sha256, build_size_bytes, build_filename, version
 *
 * Безопасно для повторного запуска (ignoreConflict на 409).
 * env: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 */
import 'dotenv/config';
import { Client, Databases, Permission, Role, IndexType } from 'node-appwrite';

const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT ?? '';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? '';
const API_KEY = process.env.APPWRITE_API_KEY ?? '';
const DATABASE_ID = 'core';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ignoreConflict(fn) {
  try { await fn(); } catch (e) { if (e.code !== 409) throw e; }
}

async function waitForAttribute(db, colId, key) {
  for (let i = 0; i < 120; i++) {
    const attr = await db.getAttribute(DATABASE_ID, colId, key);
    if (attr.status === 'available') return;
    if (attr.status === 'failed') throw new Error(`Attr ${colId}.${key} failed: ${attr.error}`);
    await sleep(1000);
  }
  throw new Error(`Timeout waiting for ${colId}.${key}`);
}

async function migrateProfiles(db) {
  console.log('[demiurge] Расширение profiles...');

  const newStrings = [
    ['display_name', 255, false],
    ['clerk_user_id', 128, false],
  ];

  for (const [key, size, req] of newStrings) {
    await ignoreConflict(() =>
      db.createStringAttribute(DATABASE_ID, 'profiles', key, size, req)
    );
    await waitForAttribute(db, 'profiles', key);
    console.log(`  + profiles.${key}`);
  }

  await ignoreConflict(() =>
    db.createIndex(DATABASE_ID, 'profiles', 'idx_clerk_user', IndexType.Key, ['clerk_user_id'])
  );
  console.log('  + index clerk_user_id');
}

async function createPurchases(db) {
  console.log('[demiurge] Создание коллекции purchases...');

  const PERMS = [
    Permission.create(Role.users()),
    Permission.read(Role.users()),
    Permission.update(Role.team('admin')),
    Permission.delete(Role.team('admin')),
  ];

  await ignoreConflict(() =>
    db.createCollection(DATABASE_ID, 'purchases', 'Purchases (ownership)', PERMS, false, true)
  );

  const strings = [
    ['user_id', 64, true],
    ['product_id', 64, true],
    ['tx_hash', 128, false],
  ];

  for (const [key, size, req] of strings) {
    await ignoreConflict(() =>
      db.createStringAttribute(DATABASE_ID, 'purchases', key, size, req)
    );
    await waitForAttribute(db, 'purchases', key);
    console.log(`  + purchases.${key}`);
  }

  await ignoreConflict(() =>
    db.createFloatAttribute(DATABASE_ID, 'purchases', 'price_ton', false)
  );
  await waitForAttribute(db, 'purchases', 'price_ton');
  console.log('  + purchases.price_ton');

  await ignoreConflict(() =>
    db.createIndex(DATABASE_ID, 'purchases', 'idx_user', IndexType.Key, ['user_id'])
  );
  await ignoreConflict(() =>
    db.createIndex(DATABASE_ID, 'purchases', 'idx_product', IndexType.Key, ['product_id'])
  );
  await ignoreConflict(() =>
    db.createIndex(DATABASE_ID, 'purchases', 'idx_user_product', IndexType.Key, ['user_id', 'product_id'])
  );
  console.log('  + indexes');
}

async function migrateProducts(db) {
  console.log('[demiurge] Расширение legacy_products (R2 + creator)...');

  const newStrings = [
    ['creator_id', 64, false],
    ['build_r2_key', 512, false],
    ['build_sha256', 64, false],
    ['build_filename', 255, false],
    ['version', 32, false],
  ];

  for (const [key, size, req] of newStrings) {
    await ignoreConflict(() =>
      db.createStringAttribute(DATABASE_ID, 'legacy_products', key, size, req)
    );
    await waitForAttribute(db, 'legacy_products', key);
    console.log(`  + legacy_products.${key}`);
  }

  await ignoreConflict(() =>
    db.createIntegerAttribute(DATABASE_ID, 'legacy_products', 'build_size_bytes', false)
  );
  await waitForAttribute(db, 'legacy_products', 'build_size_bytes');
  console.log('  + legacy_products.build_size_bytes');

  await ignoreConflict(() =>
    db.createIndex(DATABASE_ID, 'legacy_products', 'idx_creator', IndexType.Key, ['creator_id'])
  );
  console.log('  + index creator_id');
}

async function main() {
  if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
    console.error('Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
    process.exit(1);
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const db = new Databases(client);

  await migrateProfiles(db);
  await createPurchases(db);
  await migrateProducts(db);

  console.log('\n[demiurge] Миграция завершена. Все Демиурги готовы к творению.');
}

main().catch((e) => { console.error(e); process.exit(1); });
