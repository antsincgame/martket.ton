/**
 * Background virus-scan worker.
 *
 * Loop:
 *   - Every POLL_INTERVAL_MS, claim up to BATCH_SIZE jobs in (`pending`, `running`).
 *   - For each job: hash-lookup → upload-if-needed → poll-analysis → write verdict.
 *   - On `clean` verdict: move from quarantine to public `builds/`, set product
 *     status (`published` for verified demiurges, otherwise `pending_review`).
 *   - On `malicious` verdict: delete quarantined file, mark product `rejected`.
 *
 * Crash-safety: every job is idempotent — repeated runs with the same vt_analysis_id
 * just re-poll the analysis; the move/delete is guarded by `quarantine_key` presence.
 */

import { logger } from '../logger.js';
import * as productRepo from '../core/productRepository.js';
import * as profileRepo from '../core/profileRepository.js';
import * as scanJobRepo from '../core/scanJobRepository.js';
import * as audit from '../core/auditRepository.js';
import { generateId } from '../core/generateId.js';
import {
  isVtConfigured,
  lookupByHash,
  submitFile,
  getAnalysis,
  thresholdsFromEnv,
  verdictFromStats,
  type ScanVerdict,
  type VtFileReport,
} from './virustotal.js';
import type { ScanJob } from '../domain/types.js';

const POLL_INTERVAL_MS = 15_000;
const BATCH_SIZE = 3;
/** Polling caps for the analysis-pending state (~10 min). */
const MAX_POLL_ATTEMPTS = 40;
/** Hard ceiling across all attempts (network failures, lookup, etc.). */
const MAX_TOTAL_ATTEMPTS = 60;
/** A `running` job whose lock is older than this is considered abandoned. */
const STALE_LOCK_MS = 5 * 60_000;

let timer: NodeJS.Timeout | null = null;
let inFlight = false;
let shuttingDown = false;

export function start(): void {
  if (timer) return;
  if (!isVtConfigured()) {
    logger.warn('[scan-worker] VIRUSTOTAL_API_KEY missing — worker not started');
    return;
  }
  shuttingDown = false;
  logger.info(`[scan-worker] started (poll=${POLL_INTERVAL_MS}ms, batch=${BATCH_SIZE})`);
  timer = setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
  setTimeout(() => { void tick(); }, 1_500);
}

/** Stops the worker. If a tick is in-flight, awaits its completion. */
export async function stop(): Promise<void> {
  shuttingDown = true;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  // Wait until current tick finishes (max 30s) so the process exits cleanly.
  const deadline = Date.now() + 30_000;
  while (inFlight && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
  }
  logger.info('[scan-worker] stopped');
}

/**
 * Best-effort atomic claim using an Appwrite "lock" pattern:
 *   - pending → mark running with fresh startedAt
 *   - running with stale startedAt → reclaim
 *   - running with fresh startedAt → skip (another worker owns it)
 *
 * Re-fetches the job after the update to confirm the lock; a concurrent worker
 * that wrote later wins, but the loser will skip processing.
 */
async function tryClaim(job: ScanJob): Promise<ScanJob | null> {
  const now = Date.now();
  if (job.status === 'running' && job.startedAt) {
    const age = now - new Date(job.startedAt).getTime();
    if (Number.isFinite(age) && age < STALE_LOCK_MS) {
      return null; // someone else is actively working on it
    }
  }
  if (job.attempts >= MAX_TOTAL_ATTEMPTS) {
    await failJob(job, `exceeded MAX_TOTAL_ATTEMPTS=${MAX_TOTAL_ATTEMPTS}`);
    return null;
  }
  const lockedAt = new Date().toISOString();
  await scanJobRepo.updateScanJob(job.id, {
    status: 'running',
    startedAt: lockedAt,
    attempts: job.attempts + 1,
  });
  const reread = await scanJobRepo.findScanJobById(job.id);
  if (!reread || reread.startedAt !== lockedAt) {
    return null; // another worker overwrote our lock
  }
  return reread;
}

async function failJob(job: ScanJob, reason: string): Promise<void> {
  await scanJobRepo.updateScanJob(job.id, {
    status: 'failed',
    errorMessage: reason.slice(0, 500),
    finishedAt: new Date().toISOString(),
  });
  await productRepo.updateScanResult(job.productId, {
    scanStatus: 'error',
    scanProvider: 'virustotal',
    scanCompletedAt: new Date().toISOString(),
  });
  logger.error(`[scan-worker] job ${job.id} dead-lettered: ${reason}`);
}

async function tick(): Promise<void> {
  if (inFlight || shuttingDown) return;
  inFlight = true;
  try {
    const jobs = await scanJobRepo.listClaimableJobs(BATCH_SIZE);
    for (const job of jobs) {
      if (shuttingDown) break;
      const claimed = await tryClaim(job);
      if (!claimed) continue;
      try {
        await processJob(claimed);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown';
        logger.error(`[scan-worker] job ${claimed.id} failed: ${msg}`);
        const nextAttempts = claimed.attempts + 1;
        if (nextAttempts >= MAX_TOTAL_ATTEMPTS) {
          await failJob(claimed, `error after ${nextAttempts} attempts: ${msg}`);
        } else {
          await scanJobRepo.updateScanJob(claimed.id, {
            attempts: nextAttempts,
            errorMessage: msg.slice(0, 500),
          });
        }
      }
    }
  } catch (err: unknown) {
    logger.error('[scan-worker] tick error:', err instanceof Error ? err.message : err);
  } finally {
    inFlight = false;
  }
}

async function processJob(job: ScanJob): Promise<void> {
  const product = await productRepo.findProductById(job.productId);
  if (!product) {
    await scanJobRepo.updateScanJob(job.id, {
      status: 'failed',
      errorMessage: 'product disappeared',
      finishedAt: new Date().toISOString(),
    });
    return;
  }

  // Reflect "scanning" state on the product on first run.
  if (product.scanStatus === 'pending') {
    await productRepo.updateScanResult(job.productId, {
      scanStatus: 'scanning',
      scanProvider: 'virustotal',
    });
  }

  // Step 1: existing hash lookup (free, no upload).
  let report: VtFileReport | null = null;
  if (!job.vtAnalysisId) {
    report = await lookupByHash(job.sha256);
  }

  // Step 2: if hash is unknown, upload the file from quarantine and start an analysis.
  if (!report && !job.vtAnalysisId) {
    const buf = await fetchQuarantineBuffer(job.quarantineKey);
    const analysisId = await submitFile(buf, basename(job.quarantineKey));
    await scanJobRepo.updateScanJob(job.id, { vtAnalysisId: analysisId });
    return; // wait for next tick to poll — non-blocking
  }

  // Step 3: poll existing analysis.
  if (!report && job.vtAnalysisId) {
    report = await getAnalysis(job.vtAnalysisId);
    if (report.status !== 'completed') {
      // Bound polling. attempts was already incremented at claim time.
      if (job.attempts >= MAX_POLL_ATTEMPTS) {
        await failJob(job, `analysis stuck at "${report.status}" after ${job.attempts} polls`);
      }
      return; // next tick will poll again
    }
  }

  if (!report) return; // safety net

  const verdict = verdictFromStats(report.stats, thresholdsFromEnv());
  await applyVerdict(job, verdict, report);
}

async function applyVerdict(job: ScanJob, verdict: ScanVerdict, report: VtFileReport): Promise<void> {
  const completedAt = new Date().toISOString();
  await productRepo.updateScanResult(job.productId, {
    scanStatus: verdict,
    scanProvider: 'virustotal',
    scanReportId: report.analysisId ?? job.vtAnalysisId ?? job.sha256,
    scanMaliciousCount: report.stats.malicious,
    scanTotalEngines: report.totalEngines,
    scanCompletedAt: completedAt,
  });

  if (verdict === 'malicious') {
    await rejectMalicious(job);
  } else {
    await promoteCleanOrSuspicious(job, verdict);
  }

  await scanJobRepo.updateScanJob(job.id, {
    status: 'done',
    finishedAt: completedAt,
  });

  await audit.insertAuditLog({
    id: generateId(),
    user_id: 'scan-worker',
    action: 'scan_complete',
    resource: 'product',
    resource_id: job.productId,
    result: verdict,
    metadata: JSON.stringify({
      analysis_id: report.analysisId ?? job.vtAnalysisId,
      stats: report.stats,
      total_engines: report.totalEngines,
      sha256: job.sha256,
    }),
    ip_address: '',
    user_agent: 'scan-worker',
  });
}

async function loadQuarantine(): Promise<typeof import('../r2/quarantine.js')> {
  const mod = await import('../r2/quarantine.js');
  // Tsx loader returns CJS module either as `default` or as named exports.
  return ((mod as unknown as { default?: typeof import('../r2/quarantine.js') }).default ?? mod);
}

async function loadR2Client(): Promise<typeof import('../r2/client.js')> {
  const mod = await import('../r2/client.js');
  return ((mod as unknown as { default?: typeof import('../r2/client.js') }).default ?? mod);
}

async function rejectMalicious(job: ScanJob): Promise<void> {
  const { deleteQuarantined } = await loadQuarantine();
  try {
    await deleteQuarantined(job.quarantineKey);
  } catch (err: unknown) {
    logger.warn('[scan-worker] delete quarantine failed:', err instanceof Error ? err.message : err);
  }

  const product = await productRepo.findProductById(job.productId);
  await productRepo.updateProduct(job.productId, {
    quarantine_key: null,
    build_r2_key: null,
    status: 'rejected',
    moderation_reason: 'Build flagged by VirusTotal as malicious — automatic rejection',
    moderated_at: new Date().toISOString(),
    moderator_id: 'scan-worker',
  });
  if (product?.creatorId) {
    const creator = await profileRepo.findUserById(product.creatorId);
    if (creator) {
      await profileRepo.updateProfile(product.creatorId, {
        rejection_count: (creator.rejectionCount ?? 0) + 1,
        trust_score: Math.max(-100, (creator.trustScore ?? 0) - 5),
      });
    }
  }
}

async function promoteCleanOrSuspicious(job: ScanJob, verdict: ScanVerdict): Promise<void> {
  const { moveFromQuarantine } = await loadQuarantine();
  const newKey = await moveFromQuarantine(job.quarantineKey);

  const product = await productRepo.findProductById(job.productId);
  const creator = product?.creatorId
    ? await profileRepo.findUserById(product.creatorId)
    : null;

  const autoPublishAllowed = verdict === 'clean' && creator?.verified === true;

  const updates: Record<string, unknown> = {
    quarantine_key: null,
    build_r2_key: newKey,
  };

  if (autoPublishAllowed && product?.status !== 'published') {
    updates.status = 'published';
    updates.moderator_id = 'scan-worker';
    updates.moderation_reason = 'Auto-published: verified demiurge + clean scan';
    updates.moderated_at = new Date().toISOString();
  } else if (product?.status === 'draft' || product?.status === 'pending_review') {
    updates.status = 'pending_review';
  }

  await productRepo.updateProduct(job.productId, updates);

  if (autoPublishAllowed && creator) {
    await profileRepo.updateProfile(creator.id, {
      published_count: (creator.publishedCount ?? 0) + 1,
      trust_score: (creator.trustScore ?? 0) + 1,
    });
  }
}

async function fetchQuarantineBuffer(quarantineKey: string): Promise<Buffer> {
  const { getR2Client, getBucketName } = await loadR2Client();
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = getR2Client();
  if (!client) throw new Error('R2 client not initialized');
  const obj = await client.send(new GetObjectCommand({
    Bucket: getBucketName(),
    Key: quarantineKey,
  }));
  const body = obj.Body;
  if (!body) throw new Error(`empty body for ${quarantineKey}`);
  const arr = await body.transformToByteArray();
  return Buffer.from(arr);
}

function basename(key: string): string {
  const idx = key.lastIndexOf('/');
  return idx >= 0 ? key.slice(idx + 1) : key;
}
