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

  for (const [db, col, name, perms, docSec] of COLLECTION_TARGETS) {
    try {
      await databases.updateCollection(db, col, name, perms, docSec, true);
      const label = perms.length ? perms.join(', ') : 'server-only ([])';
      console.log(`[harden] ${db}.${col} → [${label}] documentSecurity=${docSec}`);
    } catch (error) {
      console.warn(`[harden] ${db}.${col} FAILED: ${error?.message || error}`);
    }
  }

  for (const [bucket, name, perms] of BUCKET_TARGETS) {
    try {
      await storage.updateBucket(bucket, name, perms);
      console.log(`[harden] bucket ${bucket} → [${perms.join(', ')}]`);
    } catch (error) {
      console.warn(`[harden] bucket ${bucket} FAILED (можно пропустить): ${error?.message || error}`);
    }
  }

  console.log('[harden] Готово. Проверь в консоли Appwrite, что у перечисленных коллекций нет лишних read/create.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
