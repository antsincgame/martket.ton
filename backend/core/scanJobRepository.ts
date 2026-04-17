import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_SCAN_JOBS } from './constants.js';
import { generateId } from './generateId.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';
import type { ScanJob, ScanJobStatus, ProductId } from '../domain/types.js';

function mapJob(doc: AppwriteDoc): ScanJob {
  return {
    id: doc.$id,
    productId: doc['product_id'] as ProductId,
    quarantineKey: (doc['quarantine_key'] as string) ?? '',
    sha256: (doc['sha256'] as string) ?? '',
    sizeBytes: (doc['size_bytes'] as number) ?? 0,
    status: ((doc['status'] as string) ?? 'pending') as ScanJobStatus,
    attempts: (doc['attempts'] as number) ?? 0,
    vtAnalysisId: (doc['vt_analysis_id'] as string) ?? null,
    errorMessage: (doc['error_message'] as string) ?? null,
    createdAt: doc.$createdAt,
    startedAt: (doc['started_at'] as string) ?? null,
    finishedAt: (doc['finished_at'] as string) ?? null,
  };
}

export interface CreateScanJobInput {
  productId: string;
  quarantineKey: string;
  sha256: string;
  sizeBytes: number;
}

export async function createScanJob(input: CreateScanJobInput): Promise<ScanJob | null> {
  const id = generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_SCAN_JOBS, id, {
    product_id: input.productId,
    quarantine_key: input.quarantineKey,
    sha256: input.sha256,
    size_bytes: input.sizeBytes,
    status: 'pending',
    attempts: 0,
    vt_analysis_id: null,
    error_message: null,
    started_at: null,
    finished_at: null,
  });
  return findScanJobById(id);
}

export async function findScanJobById(id: string): Promise<ScanJob | null> {
  try {
    const doc = await databases().getDocument(CORE_DATABASE_ID, COL_SCAN_JOBS, id);
    return mapJob(asDoc(doc));
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404) return null;
    throw e;
  }
}

/**
 * Returns the most recent job for the product that is still pending or running.
 * Completed/failed jobs are intentionally excluded — those would be misleading
 * if a caller treats the result as an "active" lock.
 */
export async function findActiveScanJobForProduct(productId: string): Promise<ScanJob | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_SCAN_JOBS, [
    Query.equal('product_id', productId),
    Query.equal('status', ['pending', 'running']),
    Query.orderDesc('$createdAt'),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapJob(asDoc(doc)) : null;
}

/** Returns up to `limit` jobs with status `pending` or `running`, oldest first. */
export async function listClaimableJobs(limit = 5): Promise<ScanJob[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_SCAN_JOBS, [
    Query.equal('status', ['pending', 'running']),
    Query.orderAsc('$createdAt'),
    Query.limit(Math.max(1, Math.min(limit, 50))),
  ]);
  return res.documents.map((d) => mapJob(asDoc(d)));
}

export async function updateScanJob(
  id: string,
  data: {
    status?: ScanJobStatus;
    attempts?: number;
    vtAnalysisId?: string | null;
    errorMessage?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  },
): Promise<ScanJob | null> {
  const update: Record<string, unknown> = {};
  if (data.status !== undefined) update['status'] = data.status;
  if (data.attempts !== undefined) update['attempts'] = data.attempts;
  if (data.vtAnalysisId !== undefined) update['vt_analysis_id'] = data.vtAnalysisId;
  if (data.errorMessage !== undefined) update['error_message'] = data.errorMessage;
  if (data.startedAt !== undefined) update['started_at'] = data.startedAt;
  if (data.finishedAt !== undefined) update['finished_at'] = data.finishedAt;
  if (Object.keys(update).length === 0) return findScanJobById(id);
  await databases().updateDocument(CORE_DATABASE_ID, COL_SCAN_JOBS, id, update);
  return findScanJobById(id);
}
