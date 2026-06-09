import { Permission, Role } from 'node-appwrite';
import { databases } from './db.js';
import { logger } from '../logger.js';

/**
 * Одноразовое ужесточение прав коллекций на старте (аналог scripts/harden-permissions.mjs).
 *
 * Запускается ТОЛЬКО при RUN_PERMISSION_HARDEN=1. Нужно потому, что боевой
 * APPWRITE_API_KEY живёт только внутри контейнера (Coolify-injected), и внешней машины
 * для прогона скрипта нет. Та же логика, что updateCollection в скрипте.
 *
 * Идемпотентно: выставляет одни и те же права при каждом вызове. Меняет ТОЛЬКО
 * permissions + documentSecurity, атрибуты/данные не трогает. Fire-and-forget +
 * полностью гардед: любая ошибка логируется, но никогда не роняет бут. Вызывать ПОСЛЕ app.listen.
 *
 * Модель безопасности: весь backend-слой данных ходит сервисным ключом (игнорирует
 * права коллекций), а SPA эти коллекции напрямую не читает — server-only ничего не ломает.
 */
export async function runPermissionHardenIfRequested(): Promise<void> {
  if (process.env.RUN_PERMISSION_HARDEN !== '1') return;

  const SERVER_ONLY: string[] = [];
  const READ_ADMIN = [Permission.read(Role.team('admin'))];

  // [databaseId, collectionId, name, permissions, documentSecurity]
  const targets: Array<[string, string, string, string[], boolean]> = [
    ['marketplace', 'seller_profiles', 'Seller profiles', SERVER_ONLY, false],
    ['core', 'profiles', 'User profiles', SERVER_ONLY, false],
    ['core', 'developers', 'Legacy developers', SERVER_ONLY, false],
    ['core', 'legacy_products', 'Legacy API products', SERVER_ONLY, false],
    ['core', 'support_tickets', 'Support tickets', SERVER_ONLY, false],
    ['core', 'compliance_ledger', 'Compliance financial ledger', READ_ADMIN, false],
    ['core', 'api_audit_logs', 'API audit logs', READ_ADMIN, false],
  ];

  const db = databases();
  logger.info('[harden] RUN_PERMISSION_HARDEN=1 — применяю права к 7 коллекциям');
  let failed = 0;
  for (const [dbId, colId, name, perms, docSec] of targets) {
    try {
      await db.updateCollection(dbId, colId, name, perms, docSec, true);
      logger.info(
        `[harden] OK ${dbId}.${colId} → [${perms.length ? perms.join(', ') : 'server-only'}] documentSecurity=${docSec}`,
      );
    } catch (e) {
      failed += 1;
      logger.error(`[harden] FAILED ${dbId}.${colId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  logger.info(
    `[harden] завершено (failed=${failed}/${targets.length}) — снимите RUN_PERMISSION_HARDEN и передеплойте`,
  );
}
