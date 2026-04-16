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
