/**
 * Distribution manifest API + buyer download redirect.
 *
 *   PUT  /api/v1/commerce/listings/:id/distribution      save manifest (draft)
 *   POST /api/v1/commerce/listings/:id/distribution/verify  stream + sha256 + save
 *   GET  /api/v1/commerce/listings/:id/distribution      public-safe view (no creds)
 *   GET  /api/v1/commerce/listings/:id/download          buyer: license check → 302 redirect
 *
 * The buyer download endpoint is the hot path: license check + rate limit +
 * 302 to the source URL. We never proxy the file body — zero egress on our side.
 */

import express, { type Request, type Response } from 'express';
import * as crypto from 'node:crypto';
import { databases, Query } from './appwrite.js';
import {
  DATABASE_ID,
  COL_LISTINGS,
  COL_SELLER_PROFILES,
  COL_DOWNLOAD_AUDIT,
  COL_ENTITLEMENTS,
} from './constants.js';
import { apiRequireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { resolveProfile } from '../middleware/auth.js';
import { writeAudit } from './audit.js';
import { logger } from '../logger.js';
import { setDistributionSchema } from './validation.js';
import { requireWalletOwner } from './helpers.js';
import { findLicenseByBuyerAndListing } from './licenseRepository.js';
import { decideDownloadGate, decideScanGate } from './handlers/downloadGate.js';
import { isVtConfigured } from '../scan/virustotal.js';
import { requireSellerKyc } from './handlers/requireSellerKyc.js';
import { getAdapter, verifyManifest } from '../distribution/index.js';
import {
  ManifestSchema,
  manifestToStored,
  storedToManifest,
  type DistributionManifest,
  type StoredManifest,
} from '../distribution/manifest.js';
import { ID } from 'node-appwrite';
import { str } from '../utils/params.js';
// Shared with the buyer-agent download surface so the daily budget can't diverge.
import { DOWNLOAD_RATE_LIMIT_PER_DAY } from './buyerDownload.js';

const router = express.Router();

interface ListingDoc {
  $id: string;
  sellerWallet?: string;
  status?: string;
  distribution_kind?: string;
  distribution_locator?: string;
  distribution_sha256?: string;
  distribution_size?: number;
  distribution_filename?: string;
  distribution_state?: string;
  distribution_ttl_sec?: number;
  distribution_verified_at?: string;
  distribution_health_status?: string;
  distribution_health_at?: string;
  scan_id?: string;
  scan_status?: string;
  scan_at?: string;
  scan_report_url?: string;
  scan_sha256?: string;
}

async function findListing(id: string): Promise<ListingDoc | null> {
  try {
    const doc = await databases().getDocument(DATABASE_ID, COL_LISTINGS, id);
    return doc as unknown as ListingDoc;
  } catch {
    return null;
  }
}

async function findSellerByWallet(wallet: string) {
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
    Query.equal('wallet', [wallet]),
    Query.limit(1),
  ]);
  return documents[0] || null;
}

function parseStoredManifest(doc: ListingDoc): { stored: StoredManifest; manifest: DistributionManifest } | null {
  if (!doc.distribution_kind || doc.distribution_kind === 'none' || !doc.distribution_locator) return null;
  try {
    const locator = JSON.parse(doc.distribution_locator) as Record<string, unknown>;
    const stored: StoredManifest = {
      kind: doc.distribution_kind as 'r2' | 'github',
      bucket: locator.bucket as string | undefined,
      key: locator.key as string | undefined,
      repo: locator.repo as string | undefined,
      tag: locator.tag as string | undefined,
      asset: locator.asset as string | undefined,
      sha256: doc.distribution_sha256 || '',
      size: doc.distribution_size,
      filename: doc.distribution_filename,
    };
    return { stored, manifest: storedToManifest(stored) };
  } catch (err) {
    logger.warn(`[distribution] failed to parse locator for listing ${doc.$id}: ${(err as Error).message}`);
    return null;
  }
}

function publicDistributionView(doc: ListingDoc) {
  const parsed = parseStoredManifest(doc);
  return {
    kind: doc.distribution_kind || 'none',
    state: doc.distribution_state || 'draft',
    sha256: doc.distribution_sha256 || null,
    size: doc.distribution_size || null,
    filename: doc.distribution_filename || null,
    ttlSec: doc.distribution_ttl_sec || null,
    verifiedAt: doc.distribution_verified_at || null,
    healthStatus: doc.distribution_health_status || null,
    healthAt: doc.distribution_health_at || null,
    scanStatus: doc.scan_status || 'idle',
    scanAt: doc.scan_at || null,
    scanReportUrl: doc.scan_report_url || null,
    locator: parsed?.stored
      ? // strip private bits — bucket name is fine to expose, repo/tag/asset is public anyway
        {
          ...(parsed.stored.kind === 'r2'
            ? { bucket: parsed.stored.bucket, key: parsed.stored.key }
            : { repo: parsed.stored.repo, tag: parsed.stored.tag, asset: parsed.stored.asset }),
        }
      : null,
  };
}

router.put(
  '/listings/:id/distribution',
  apiRequireAuth(),
  validateBody(setDistributionSchema),
  async (req: Request, res: Response) => {
    const body = req.body as {
      wallet: string;
      manifest: { kind: 'r2' | 'github' } & Record<string, unknown>;
      ttlSec?: number;
    };
    const owner = await requireWalletOwner(req, res, body.wallet);
    if (!owner) return;

    const kyc = await requireSellerKyc(body.wallet);
    if (!kyc.ok) {
      res.status(kyc.status).json({ error: kyc.message, code: kyc.code });
      return;
    }

    const doc = await findListing(str(req.params.id));
    if (!doc) {
      res.status(404).json({ error: 'Listing not found', code: 'NO_LISTING' });
      return;
    }
    if (doc.sellerWallet !== body.wallet) {
      res.status(403).json({ error: 'Not your listing', code: 'NOT_OWNER' });
      return;
    }

    const parsed = ManifestSchema.safeParse(body.manifest);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid manifest', code: 'INVALID_MANIFEST', details: parsed.error.issues });
      return;
    }
    const stored = manifestToStored(parsed.data);

    await databases().updateDocument(DATABASE_ID, COL_LISTINGS, doc.$id, {
      distribution_kind: stored.kind,
      distribution_locator: JSON.stringify({
        bucket: stored.bucket,
        key: stored.key,
        repo: stored.repo,
        tag: stored.tag,
        asset: stored.asset,
      }),
      distribution_sha256: stored.sha256,
      distribution_filename: stored.filename || '',
      distribution_state: 'draft',
      distribution_ttl_sec: body.ttlSec || 3600,
      // reset scan state — new manifest needs new scan
      scan_status: 'idle',
      scan_sha256: '',
    });
    await writeAudit(body.wallet, 'distribution_set', 'listing', doc.$id, { kind: stored.kind });
    const updated = await findListing(doc.$id);
    res.json({ data: { distribution: publicDistributionView(updated || doc) } });
  },
);

router.post(
  '/listings/:id/distribution/verify',
  apiRequireAuth(),
  async (req: Request, res: Response) => {
    const wallet = str((req.body as { wallet?: string }).wallet);
    const owner = await requireWalletOwner(req, res, wallet);
    if (!owner) return;

    const kyc = await requireSellerKyc(wallet);
    if (!kyc.ok) {
      res.status(kyc.status).json({ error: kyc.message, code: kyc.code });
      return;
    }

    const doc = await findListing(str(req.params.id));
    if (!doc) {
      res.status(404).json({ error: 'Listing not found', code: 'NO_LISTING' });
      return;
    }
    if (doc.sellerWallet !== wallet) {
      res.status(403).json({ error: 'Not your listing', code: 'NOT_OWNER' });
      return;
    }
    const parsed = parseStoredManifest(doc);
    if (!parsed) {
      res.status(400).json({ error: 'No manifest set', code: 'NO_MANIFEST' });
      return;
    }
    const seller = await findSellerByWallet(wallet);
    const sellerId = seller?.$id || wallet;
    try {
      const result = await verifyManifest(parsed.manifest, { sellerId });
      const newState = result.matches ? 'verified' : 'manifest_drift';
      await databases().updateDocument(DATABASE_ID, COL_LISTINGS, doc.$id, {
        distribution_size: result.size,
        distribution_state: newState,
        distribution_verified_at: result.verifiedAt,
        distribution_health_status: 'ok',
        distribution_health_at: result.verifiedAt,
        // If sha256 drift, force rescan
        ...(result.matches ? {} : { scan_status: 'idle', scan_sha256: '' }),
      });
      await writeAudit(wallet, 'distribution_verify', 'listing', doc.$id, {
        matches: result.matches,
        size: result.size,
      });
      res.json({
        data: {
          matches: result.matches,
          sha256: result.sha256,
          size: result.size,
          verifiedAt: result.verifiedAt,
          state: newState,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.slice(0, 500) : 'unknown';
      await databases().updateDocument(DATABASE_ID, COL_LISTINGS, doc.$id, {
        distribution_state: 'source_unavailable',
        distribution_health_status: 'down',
        distribution_health_at: new Date().toISOString(),
      });
      logger.warn(`[distribution] verify failed for listing ${doc.$id}: ${msg}`);
      res.status(502).json({ error: 'Source verification failed', code: 'SOURCE_UNAVAILABLE', details: msg });
    }
  },
);

router.get('/listings/:id/distribution', async (req: Request, res: Response) => {
  const doc = await findListing(str(req.params.id));
  if (!doc) {
    res.status(404).json({ error: 'Listing not found', code: 'NO_LISTING' });
    return;
  }
  res.json({ data: { distribution: publicDistributionView(doc) } });
});

// ── Buyer download: license check → rate limit → 302 redirect ──────
router.get('/listings/:id/download', apiRequireAuth(), async (req: Request, res: Response) => {
  const profile = await resolveProfile(req);
  if (!profile) {
    res.status(403).json({ error: 'Profile not found', code: 'NO_PROFILE' });
    return;
  }
  const doc = await findListing(str(req.params.id));
  if (!doc) {
    res.status(404).json({ error: 'Listing not found', code: 'NO_LISTING' });
    return;
  }
  if (doc.distribution_state !== 'verified') {
    res.status(404).json({ error: 'Build not available', code: 'NO_BUILD' });
    return;
  }
  const parsed = parseStoredManifest(doc);
  if (!parsed) {
    res.status(404).json({ error: 'Manifest missing', code: 'NO_MANIFEST' });
    return;
  }

  const wallet = profile.tonAddress as string | null;
  if (!wallet) {
    res.status(403).json({ error: 'Wallet required', code: 'NO_WALLET' });
    return;
  }

  // Owner / admin / moderator can always download (their own product or for review)
  const isOwner = doc.sellerWallet === wallet;
  const role = profile.role;
  const isStaff = role === 'admin' || role === 'super_admin' || role === 'moderator';

  // Antivirus gate applies to EVERYONE (distribution #1): a reviewing moderator
  // or the seller must never be handed a known-bad / unscanned build — they are
  // the most likely to open it. The license/entitlement gate below stays
  // buyer-scoped, but the scan verdict is enforced before any short-circuit.
  const scanDenial = decideScanGate(doc.scan_status, isVtConfigured());
  if (scanDenial) {
    res.status(scanDenial.status).json({ error: scanDenial.message, code: scanDenial.code });
    return;
  }

  // For buyers: require an entitlement (purchase) for this listing
  if (!isOwner && !isStaff) {
    const { documents } = await databases().listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
      Query.equal('buyerWallet', [wallet]),
      Query.equal('listingId', [doc.$id]),
      Query.limit(1),
    ]);
    if (documents.length === 0) {
      res.status(403).json({ error: 'No entitlement for this product', code: 'NO_ENTITLEMENT' });
      return;
    }

    // License gate: download is open ONLY when:
    //   - a license record exists for (buyer, listing)
    //   - state == minted
    //   - nftAddress is set (the NFT actually deployed on-chain)
    //   - и артефакт не помечен антивирусом как malicious/suspicious (scan_status)
    //
    // Anything else is a hard deny — no "legacy fallback" anymore. Without
    // a real NFT the buyer-burn refund guarantee does not apply, so giving
    // out the file would let a buyer keep both the product and the money.
    const license = await findLicenseByBuyerAndListing(wallet, doc.$id);
    // Fail-closed when antivirus scanning is configured (M-8): require a `clean`
    // verdict, so a manifest swapped after approval (scan_status → idle) cannot
    // serve an unscanned build.
    const gate = decideDownloadGate(license, doc.scan_status, isVtConfigured());
    if (gate.kind === 'deny') {
      const body: Record<string, unknown> = { error: gate.message, code: gate.code };
      if (gate.licenseId) body.licenseId = gate.licenseId;
      if (license) body.state = license.state;
      res.status(gate.status).json(body);
      return;
    }

    // Rate limit: ≤ 20 redirects/day per (license_id|wallet)
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const licenseId = String(documents[0]!.$id);
    const recent = await databases().listDocuments(DATABASE_ID, COL_DOWNLOAD_AUDIT, [
      Query.equal('license_id', [licenseId]),
      Query.greaterThan('issued_at', since),
      Query.limit(DOWNLOAD_RATE_LIMIT_PER_DAY + 1),
    ]);
    if (recent.documents.length >= DOWNLOAD_RATE_LIMIT_PER_DAY) {
      res.status(429).json({
        error: 'Download rate limit exceeded (20/day)',
        code: 'DOWNLOAD_RATE_LIMIT',
      });
      return;
    }
  }

  const seller = await findSellerByWallet(doc.sellerWallet || '');
  const sellerId = seller?.$id || doc.sellerWallet || '';

  try {
    const ttlSec = Math.min(21600, Math.max(60, doc.distribution_ttl_sec || 3600));
    const url = await getAdapter(parsed.manifest.kind).getDownloadUrl(parsed.manifest, { sellerId }, ttlSec);

    // Audit (best-effort, don't block). Key must match the rate-limit query above.
    if (!isStaff) {
      const { documents: entDocs } = await databases().listDocuments(DATABASE_ID, COL_ENTITLEMENTS, [
        Query.equal('buyerWallet', [wallet]),
        Query.equal('listingId', [doc.$id]),
        Query.limit(1),
      ]);
      const entitlementId = entDocs[0]?.$id || doc.$id;
      const ipHash = crypto
        .createHash('sha256')
        .update((req.ip || '') + (process.env.STORAGE_ENCRYPTION_KEY || ''))
        .digest('hex')
        .slice(0, 32);
      databases()
        .createDocument(DATABASE_ID, COL_DOWNLOAD_AUDIT, ID.unique(), {
          license_id: entitlementId,
          buyer_wallet: wallet,
          ip_hash: ipHash,
          ttl_sec: ttlSec,
          source_kind: parsed.manifest.kind,
          issued_at: new Date().toISOString(),
        })
        .catch((err: unknown) => {
          logger.warn(
            `[distribution] download_audit insert failed: ${err instanceof Error ? err.message : 'unknown'}`,
          );
        });
    }

    // Content negotiation:
    //   Accept: application/json → return { url, expiresInSec } (SPA flow)
    //   else                     → 302 redirect (direct browser/curl)
    const accept = String(req.get('accept') || '').toLowerCase();
    if (accept.includes('application/json')) {
      res.json({ data: { url, expiresInSec: ttlSec } });
      return;
    }
    res.redirect(302, url);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn(`[distribution] download URL generation failed: ${msg}`);
    res.status(502).json({ error: 'Source unavailable', code: 'SOURCE_UNAVAILABLE' });
  }
});

export default router;
