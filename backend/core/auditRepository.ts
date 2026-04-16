import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_AUDIT_LOGS } from './constants.js';
import { generateId } from './generateId.js';
import type { AuditLog } from '../domain/types.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';

function mapAudit(doc: AppwriteDoc): AuditLog {
  return {
    id: doc.$id,
    userId: (doc['user_id'] as string) ?? '',
    action: doc['action'] as string,
    resource: doc['resource'] as string,
    resourceId: (doc['resource_id'] as string) ?? null,
    result: (doc['result'] as string) ?? 'success',
    metadata: (doc['metadata'] as string) ?? null,
    ipAddress: (doc['ip_address'] as string) ?? null,
    userAgent: (doc['user_agent'] as string) ?? null,
    createdAt: doc.$createdAt,
  };
}

export async function insertAuditLog(row: {
  id?: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id?: string | null;
  result?: string;
  metadata?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}): Promise<void> {
  const id = row.id || generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_AUDIT_LOGS, id, {
    user_id: row.user_id,
    action: row.action,
    resource: row.resource,
    resource_id: row.resource_id,
    result: row.result,
    metadata: row.metadata,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
  });
}

export async function listAuditLogs(limit: number): Promise<AuditLog[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_AUDIT_LOGS, [
    Query.orderDesc('$createdAt'),
    Query.limit(limit),
  ]);
  return res.documents.map((d) => mapAudit(asDoc(d)));
}
