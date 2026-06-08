import type { Models } from 'node-appwrite';

/**
 * Appwrite Document with dynamic field access.
 * node-appwrite's Models.Document in strict TS doesn't allow bracket access to custom fields.
 * This helper casts while keeping $id, $createdAt, $updatedAt typed.
 */
export type AppwriteDoc = Models.Document & Record<string, unknown>;

export function asDoc(doc: Models.Document): AppwriteDoc {
  return doc as AppwriteDoc;
}

/**
 * True when an Appwrite write failed because a unique index already holds the
 * value — HTTP 409, or a "already exists" / "duplicate" message. Lets concurrent
 * idempotent writers treat the loser of a race as a no-op instead of throwing.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    if ((err as { code: number }).code === 409) return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('already exists') || msg.includes('duplicate');
}

