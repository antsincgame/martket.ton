/**
 * Ужесточение прав доступа Appwrite-коллекций на ЖИВОМ инстансе.
 *
 * Зачем отдельный скрипт: provision-*.mjs ставит права только при СОЗДАНИИ
 * коллекции (createCollection). На повторном прогоне коллекция уже есть (409),
 * и ensureCollection НЕ обновляет permissions — поэтому широкие права
 * (Role.any()/Role.users()), выставленные исторически, остаются. Этот скрипт
 * вызывает updateCollection и приводит права к минимально необходимым.
 *
 * Модель: бэкенд читает/пишет все эти коллекции сервисным APPWRITE_API_KEY
 * (он игнорирует права коллекций), а фронт напрямую обращается только к
 * каталогу (products/categories/reviews). Поэтому server-only ничего не ломает.
 *
 * Запуск: APPWRITE_ENDPOINT + APPWRITE_PROJECT_ID + APPWRITE_API_KEY, затем
 *   node scripts/harden-permissions.mjs
 */
import 'dotenv/config';
import { Client, Databases, Storage, Permission, Role } from 'node-appwrite';

const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT ?? '';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? '';
const API_KEY = process.env.APPWRITE_API_KEY ?? '';

const SERVER_ONLY = [];
const READ_ADMIN = [Permission.read(Role.team('admin'))];
const READ_ANY = [Permission.read(Role.any())];

// [databaseId, collectionId, name, permissions, documentSecurity]
const COLLECTION_TARGETS = [
  ['marketplace', 'seller_profiles', 'Seller profiles', SERVER_ONLY, false],
  ['core', 'profiles', 'User profiles', SERVER_ONLY, false],
  ['core', 'developers', 'Legacy developers', SERVER_ONLY, false],
  ['core', 'legacy_products', 'Legacy API products', SERVER_ONLY, false],
  ['core', 'support_tickets', 'Support tickets', SERVER_ONLY, false],
  ['core', 'compliance_ledger', 'Compliance financial ledger', READ_ADMIN, false],
  ['core', 'api_audit_logs', 'API audit logs', READ_ADMIN, false],
  // M-1: provision-demiurge creates `purchases` with Permission.read(Role.users()),
  // exposing every buyer's user_id / tx_hash / price to ANY logged-in user. The
  // backend reads it via the service key and the frontend never touches it
  // directly, so server-only is safe and closes a purchase-history leak.
  ['core', 'purchases', 'Purchases', SERVER_ONLY, false],
  // Buyer wishlist — private per-user saved products; backend-only access.
  ['core', 'wishlists', 'Wishlists', SERVER_ONLY, false],
];

// [bucketId, name, permissions]
const BUCKET_TARGETS = [
  ['tonforge_state', 'TonForge demo state', READ_ANY],
];

async function main() {
  if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
    console.error('Нужны APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY');
    process.exit(1);
  }
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);
  const storage = new Storage(client);

  let failed = 0;

  for (const [db, col, name, perms, docSec] of COLLECTION_TARGETS) {
    try {
      await databases.updateCollection(db, col, name, perms, docSec, true);
      const label = perms.length ? perms.join(', ') : 'server-only ([])';
      console.log(`[harden] ${db}.${col} → [${label}] documentSecurity=${docSec}`);
    } catch (error) {
      failed += 1;
      console.warn(`[harden] ${db}.${col} FAILED: ${error?.message || error}`);
    }
  }

  for (const [bucket, name, perms] of BUCKET_TARGETS) {
    try {
      await storage.updateBucket(bucket, name, perms);
      console.log(`[harden] bucket ${bucket} → [${perms.join(', ')}]`);
    } catch (error) {
      failed += 1;
      console.warn(`[harden] bucket ${bucket} FAILED: ${error?.message || error}`);
    }
  }

  // M-2: previously this script always exited 0, so an operator (or CI) saw
  // "success" even if EVERY updateCollection failed (wrong db id, key missing
  // collections.write, renamed collection) — believing prod was hardened when it
  // was not. Exit non-zero on any failure so the outcome is unambiguous.
  if (failed > 0) {
    console.error(`[harden] ПРОВАЛ: ${failed} операц. не применены — права НЕ ужесточены полностью.`);
    process.exit(1);
  }
  console.log('[harden] Готово. Все права применены. Проверь в консоли Appwrite отсутствие лишних read/create.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
