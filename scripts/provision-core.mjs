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
    ['clerk_user_id', 64, false],
    ['display_name', 255, false],
    ['slug', 64, false],
    ['banner_url', 2048, false],
    ['website', 500, false],
    ['github', 100, false],
    ['telegram', 100, false],
    ['twitter', 100, false],
    ['about_long', 8000, false],
    ['featured_product_ids', 2000, false],
  ];
  for (const [key, size, req] of attrs) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, 'profiles', key, size, req)
    );
    await waitForAttribute(databases, 'profiles', key);
  }
  await ignoreConflict(() => databases.createBooleanAttribute(DATABASE_ID, 'profiles', 'is_active', true));
  await waitForAttribute(databases, 'profiles', 'is_active');

  await ignoreConflict(() =>
    databases.createBooleanAttribute(DATABASE_ID, 'profiles', 'verified', false, false)
  );
  await waitForAttribute(databases, 'profiles', 'verified');
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'profiles', 'trust_score', false, 0, 1000, 0)
  );
  await waitForAttribute(databases, 'profiles', 'trust_score');
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'profiles', 'published_count', false, 0, undefined, 0)
  );
  await waitForAttribute(databases, 'profiles', 'published_count');
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'profiles', 'rejection_count', false, 0, undefined, 0)
  );
  await waitForAttribute(databases, 'profiles', 'rejection_count');

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
  try {
    await databases.createIndex(DATABASE_ID, 'profiles', 'idx_clerk_user', IndexType.Key, [
      'clerk_user_id',
    ]);
    console.log('[core] Индекс profiles.clerk_user_id');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс clerk_user_id уже есть');
    else throw e;
  }
  try {
    await databases.createIndex(DATABASE_ID, 'profiles', 'idx_slug', IndexType.Key, ['slug']);
    console.log('[core] Индекс profiles.slug');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс slug уже есть');
    else throw e;
  }
  try {
    await databases.createIndex(DATABASE_ID, 'profiles', 'idx_email', IndexType.Unique, ['email']);
    console.log('[core] Уникальный индекс profiles.email');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс email уже есть');
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
    ['creator_id', 64, false],
    ['name', 255, true],
    ['description', 16000, false],
    ['short_description', 2000, false],
    ['category', 64, true],
    ['image', 2048, false],
    ['status', 32, true],
    ['version', 64, false],
    ['build_r2_key', 1024, false],
    ['build_sha256', 128, false],
    ['build_filename', 512, false],
    ['quarantine_key', 1024, false],
    ['scan_status', 32, false],
    ['scan_provider', 64, false],
    ['scan_report_id', 256, false],
    ['scan_completed_at', 64, false],
    ['moderator_id', 64, false],
    ['moderation_reason', 4000, false],
    ['moderated_at', 64, false],
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
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'legacy_products', 'build_size_bytes', false, 0, undefined, 0)
  );
  await waitForAttribute(databases, 'legacy_products', 'build_size_bytes');
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'legacy_products', 'scan_malicious_count', false, 0, undefined, 0)
  );
  await waitForAttribute(databases, 'legacy_products', 'scan_malicious_count');
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'legacy_products', 'scan_total_engines', false, 0, undefined, 0)
  );
  await waitForAttribute(databases, 'legacy_products', 'scan_total_engines');

  try {
    await databases.createIndex(DATABASE_ID, 'legacy_products', 'idx_creator', IndexType.Key, ['creator_id']);
    console.log('[core] Индекс legacy_products.creator_id');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс creator_id уже есть');
    else throw e;
  }
  try {
    await databases.createIndex(DATABASE_ID, 'legacy_products', 'idx_status', IndexType.Key, ['status']);
    console.log('[core] Индекс legacy_products.status');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс status уже есть');
    else throw e;
  }
  try {
    await databases.createIndex(DATABASE_ID, 'legacy_products', 'idx_scan_status', IndexType.Key, ['scan_status']);
    console.log('[core] Индекс legacy_products.scan_status');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс scan_status уже есть');
    else throw e;
  }
}

async function setupScanJobs(databases) {
  await ensureCollection(databases, 'scan_jobs', 'Antivirus scan jobs', [
    Permission.read(Role.team('admin')),
    Permission.create(Role.team('admin')),
    Permission.update(Role.team('admin')),
  ]);
  const strings = [
    ['product_id', 64, true],
    ['quarantine_key', 1024, true],
    ['sha256', 128, true],
    ['status', 32, true],
    ['vt_analysis_id', 256, false],
    ['error_message', 4000, false],
    ['started_at', 64, false],
    ['finished_at', 64, false],
  ];
  for (const [key, size, req] of strings) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, 'scan_jobs', key, size, req)
    );
    await waitForAttribute(databases, 'scan_jobs', key);
  }
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'scan_jobs', 'size_bytes', true, 0)
  );
  await waitForAttribute(databases, 'scan_jobs', 'size_bytes');
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'scan_jobs', 'attempts', false, 0, undefined, 0)
  );
  await waitForAttribute(databases, 'scan_jobs', 'attempts');

  try {
    await databases.createIndex(DATABASE_ID, 'scan_jobs', 'idx_product', IndexType.Key, ['product_id']);
    console.log('[core] Индекс scan_jobs.product_id');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс scan_jobs.product_id уже есть');
    else throw e;
  }
  try {
    await databases.createIndex(DATABASE_ID, 'scan_jobs', 'idx_status', IndexType.Key, ['status']);
    console.log('[core] Индекс scan_jobs.status');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс scan_jobs.status уже есть');
    else throw e;
  }
}

async function setupInboundEmails(databases) {
  await ensureCollection(databases, 'inbound_emails', 'Inbound emails (Resend)', [
    Permission.read(Role.team('admin')),
    Permission.create(Role.team('admin')),
    Permission.update(Role.team('admin')),
    Permission.delete(Role.team('admin')),
  ]);
  const strings = [
    ['email_id', 64, true],
    ['message_id', 256, false],
    ['from_address', 320, true],
    ['to_address', 4000, true],
    ['cc_address', 4000, false],
    ['subject', 1024, false],
    ['received_at', 64, true],
    ['attachments_meta', 16000, false],
    ['preview_text', 2000, false],
    ['status', 32, true],
    ['assigned_to', 64, false],
  ];
  for (const [key, size, req] of strings) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, 'inbound_emails', key, size, req)
    );
    await waitForAttribute(databases, 'inbound_emails', key);
  }
  await ignoreConflict(() =>
    databases.createBooleanAttribute(DATABASE_ID, 'inbound_emails', 'is_read', false, false)
  );
  await waitForAttribute(databases, 'inbound_emails', 'is_read');

  try {
    await databases.createIndex(DATABASE_ID, 'inbound_emails', 'idx_received', IndexType.Key, ['received_at']);
    console.log('[core] Индекс inbound_emails.received_at');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс inbound_emails.received_at уже есть');
    else throw e;
  }
  try {
    await databases.createIndex(DATABASE_ID, 'inbound_emails', 'idx_email_id', IndexType.Unique, ['email_id']);
    console.log('[core] Индекс inbound_emails.email_id (unique)');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс inbound_emails.email_id уже есть');
    else throw e;
  }
  try {
    await databases.createIndex(DATABASE_ID, 'inbound_emails', 'idx_status', IndexType.Key, ['status']);
    console.log('[core] Индекс inbound_emails.status');
  } catch (e) {
    if (e.code === 409) console.log('[core] Индекс inbound_emails.status уже есть');
    else throw e;
  }
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
  await setupScanJobs(databases);
  await setupInboundEmails(databases);
  await setupAudit(databases);
  await ensureBucket(storage);

  console.log('[core] Готово. Запустите npm run seed в backend при необходимости.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
