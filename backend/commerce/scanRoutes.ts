/**
 * Moderator-triggered VirusTotal scan.
 *
 *   POST /api/v1/commerce/listings/:id/scan      (moderator only)
 *     - Looks up cached verdict by SHA256 first (free).
 *     - If unknown, streams the file from source → submits to VT → stores analysis_id.
 *   GET  /api/v1/commerce/listings/:id/scan      (moderator only)
 *     - Polls /analyses/:id, updates verdict.
 *
 * Memory-bounded: streaming file → buffer (limited to MAX_SCAN_BYTES, free VT
 * tier accepts up to 32 MB direct). Larger files mark as oversize_skip.
 */

import express, { type Request, type Response } from 'express';
import { databases, Query } from './appwrite.js';
import { DATABASE_ID, COL_LISTINGS, COL_SELLER_PROFILES } from './constants.js';
import { apiRequireAuth, resolveProfile } from '../middleware/auth.js';
import { logger } from '../logger.js';
import {
  isVtConfigured,
  lookupByHash,
  submitFile,
  getAnalysis,
  thresholdsFromEnv,
  verdictFromStats,
  type ScanVerdict,
  type VtFileReport,
} from '../scan/virustotal.js';
import { getAdapter } from '../distribution/index.js';
import { storedToManifest, type StoredManifest } from '../distribution/manifest.js';
import { str } from '../utils/params.js';

const router = express.Router();

const MAX_SCAN_BYTES = 32 * 1024 * 1024; // 32 MB — free VT tier direct upload limit

interface ListingDoc {
  $id: string;
  sellerWallet?: string;
  distribution_kind?: string;
  distribution_locator?: string;
  distribution_sha256?: string;
  distribution_size?: number;
  distribution_filename?: string;
  distribution_state?: string;
  scan_id?: string;
  scan_status?: string;
  scan_sha256?: string;
  scan_at?: string;
  scan_report_url?: string;
}

async function findListing(id: string): Promise<ListingDoc | null> {
  try {
    const doc = await databases().getDocument(DATABASE_ID, COL_LISTINGS, id);
    return doc as unknown as ListingDoc;
  } catch {
    return null;
  }
}

function parseStoredManifest(doc: ListingDoc): StoredManifest | null {
  if (!doc.distribution_kind || !doc.distribution_locator || !doc.distribution_sha256) return null;
  try {
    const locator = JSON.parse(doc.distribution_locator) as Record<string, unknown>;
    return {
      kind: doc.distribution_kind as 'r2' | 'github',
      bucket: locator.bucket as string | undefined,
      key: locator.key as string | undefined,
      repo: locator.repo as string | undefined,
      tag: locator.tag as string | undefined,
      asset: locator.asset as string | undefined,
      sha256: doc.distribution_sha256,
      size: doc.distribution_size,
      filename: doc.distribution_filename,
    };
  } catch {
    return null;
  }
}

async function requireModerator(req: Request, res: Response) {
  const profile = await resolveProfile(req);
  if (!profile) {
    res.status(403).json({ error: 'Profile not found', code: 'NO_PROFILE' });
    return null;
  }
  const role = profile.role;
  if (role !== 'moderator' && role !== 'admin' && role !== 'super_admin') {
    res.status(403).json({ error: 'Moderator role required', code: 'NOT_MODERATOR' });
    return null;
  }
  return profile;
}

async function streamToBuffer(stream: NodeJS.ReadableStream, maxBytes: number): Promise<{ buffer: Buffer; truncated: boolean }> {
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;
  for await (const chunk of stream as AsyncIterable<unknown>) {
    let buf: Buffer;
    if (Buffer.isBuffer(chunk)) {
      buf = chunk;
    } else if (typeof chunk === 'object' && chunk !== null && ArrayBuffer.isView(chunk as ArrayBufferView)) {
      const view = chunk as ArrayBufferView;
      buf = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
    } else {
      buf = Buffer.from(String(chunk));
    }
    total += buf.length;
    if (total > maxBytes) {
      truncated = true;
      break;
    }
    chunks.push(buf);
  }
  return { buffer: Buffer.concat(chunks), truncated };
}

async function persistVerdict(listingId: string, verdict: ScanVerdict | 'oversize_skip' | 'error', extra: Record<string, unknown> = {}) {
  await databases().updateDocument(DATABASE_ID, COL_LISTINGS, listingId, {
    scan_status: verdict,
    scan_at: new Date().toISOString(),
    ...extra,
  });
}

router.post('/listings/:id/scan', apiRequireAuth(), async (req: Request, res: Response) => {
  const moderator = await requireModerator(req, res);
  if (!moderator) return;
  if (!isVtConfigured()) {
    res.status(503).json({ error: 'VirusTotal not configured', code: 'VT_NOT_CONFIGURED' });
    return;
  }
  const doc = await findListing(str(req.params.id));
  if (!doc) {
    res.status(404).json({ error: 'Listing not found', code: 'NO_LISTING' });
    return;
  }
  const stored = parseStoredManifest(doc);
  if (!stored) {
    res.status(400).json({ error: 'No verified manifest', code: 'NO_MANIFEST' });
    return;
  }
  // If we already scanned this exact sha256, return cached result
  if (doc.scan_status && doc.scan_sha256 === stored.sha256 && doc.scan_status !== 'idle') {
    res.json({ data: { status: doc.scan_status, cached: true } });
    return;
  }

  // Step 1: free hash lookup
  let report: VtFileReport | null = null;
  try {
    report = await lookupByHash(stored.sha256);
  } catch (err: unknown) {
    logger.warn(`[scan] lookupByHash failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  if (report) {
    const verdict = verdictFromStats(report.stats, thresholdsFromEnv());
    await persistVerdict(doc.$id, verdict, {
      scan_sha256: stored.sha256,
      scan_id: stored.sha256,
      scan_report_url: `https://www.virustotal.com/gui/file/${stored.sha256}`,
    });
    res.json({ data: { status: verdict, cached: false, source: 'hash-lookup' } });
    return;
  }

  // Step 2: oversize check via manifest size (avoid downloading huge files only to truncate)
  if (stored.size && stored.size > MAX_SCAN_BYTES) {
    await persistVerdict(doc.$id, 'oversize_skip', { scan_sha256: stored.sha256 });
    res.json({
      data: {
        status: 'oversize_skip',
        message: `File >${MAX_SCAN_BYTES} bytes — VT free tier cannot scan. Download and inspect locally.`,
      },
    });
    return;
  }

  // Step 3: stream file → submit to VT
  const seller = await databases().listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
    Query.equal('wallet', [doc.sellerWallet || '']),
    Query.limit(1),
  ]);
  const sellerId = seller.documents[0]?.$id || doc.sellerWallet || '';
  const manifest = storedToManifest(stored);
  let analysisId: string;
  try {
    const { stream, contentType } = await getAdapter(stored.kind).openReadStream(manifest, { sellerId });
    const { buffer, truncated } = await streamToBuffer(stream, MAX_SCAN_BYTES);
    if (truncated) {
      await persistVerdict(doc.$id, 'oversize_skip', { scan_sha256: stored.sha256 });
      res.json({
        data: {
          status: 'oversize_skip',
          message: 'File exceeds 32 MB while streaming — manual review required',
        },
      });
      return;
    }
    analysisId = await submitFile(buffer, stored.filename || 'build', contentType);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 500) : 'unknown';
    logger.warn(`[scan] submit failed for listing ${doc.$id}: ${msg}`);
    await persistVerdict(doc.$id, 'error', { scan_sha256: stored.sha256 });
    res.status(502).json({ error: 'VT submit failed', code: 'VT_SUBMIT_FAILED', details: msg });
    return;
  }

  await databases().updateDocument(DATABASE_ID, COL_LISTINGS, doc.$id, {
    scan_id: analysisId,
    scan_status: 'scanning',
    scan_sha256: stored.sha256,
    scan_at: new Date().toISOString(),
  });
  res.json({ data: { status: 'scanning', analysisId } });
});

router.get('/listings/:id/scan', apiRequireAuth(), async (req: Request, res: Response) => {
  const moderator = await requireModerator(req, res);
  if (!moderator) return;
  const doc = await findListing(str(req.params.id));
  if (!doc) {
    res.status(404).json({ error: 'Listing not found', code: 'NO_LISTING' });
    return;
  }
  const status = doc.scan_status || 'idle';
  if (status !== 'scanning' || !doc.scan_id) {
    res.json({
      data: {
        status,
        scan_id: doc.scan_id || null,
        scan_at: doc.scan_at || null,
      },
    });
    return;
  }
  // Poll VT for analysis state
  try {
    const report = await getAnalysis(doc.scan_id);
    if (report.status !== 'completed') {
      res.json({ data: { status: 'scanning', poll: report.status } });
      return;
    }
    const verdict = verdictFromStats(report.stats, thresholdsFromEnv());
    await persistVerdict(doc.$id, verdict, {
      scan_report_url: `https://www.virustotal.com/gui/file/${doc.scan_sha256 || ''}`,
    });
    res.json({
      data: {
        status: verdict,
        stats: report.stats,
        totalEngines: report.totalEngines,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 500) : 'unknown';
    logger.warn(`[scan] poll failed for listing ${doc.$id}: ${msg}`);
    res.status(502).json({ error: 'VT poll failed', code: 'VT_POLL_FAILED', details: msg });
  }
});

export default router;
