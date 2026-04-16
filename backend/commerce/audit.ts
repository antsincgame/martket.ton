import { DATABASE_ID, COL_AUDIT } from './constants.js';
import { databases, ID } from './appwrite.js';
import { logger } from '../logger.js';

export async function writeAudit(
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    const db = databases();
    await db.createDocument(DATABASE_ID, COL_AUDIT, ID.unique(), {
      actor: String(actor).slice(0, 128),
      action: String(action).slice(0, 64),
      entityType: String(entityType).slice(0, 32),
      entityId: String(entityId).slice(0, 64),
      payloadJson: payload ? JSON.stringify(payload).slice(0, 12000) : '',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    logger.error('[commerce-audit]', msg);
  }
}
