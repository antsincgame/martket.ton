'use strict';

const express = require('express');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require('multer');
const { logger } = require('../logger');
const { getR2Client, getBucketName, isR2Configured } = require('./client');
const {
  isQuarantineKey,
  quarantineKeyFor,
} = require('./quarantine');
const { computeFileSha256, streamFileToR2, safeUnlink } = require('./streamUpload');
const { resolveProfile, apiRequireAuth } = require('../middleware/auth');
const repo = require('../core/repository');
const scanJobs = require('../core/scanJobRepository');
const { generateId } = require('../core/generateId');

const router = express.Router();

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many uploads. Try again later.' },
});

/**
 * Cap on build uploads (megabytes).
 *
 * Build uploads now use multer.diskStorage() and are streamed to R2 via
 * streamFileToR2 — no full-file buffer in RAM. With uploadLimiter
 * (10 uploads / 15 min per IP) the worst-case is `R2_MAX_BUILD_MB` * 10
 * temp files on disk; tmp files are deleted in `finally`.
 *
 * Default 100 MB; raise via R2_MAX_BUILD_MB env when needed.
 */
const MAX_BUILD_SIZE = (parseInt(process.env.R2_MAX_BUILD_MB || '100', 10) || 100) * 1024 * 1024;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5 MB
const PRESIGNED_URL_EXPIRY = 15 * 60; // 15 minutes
const BUILD_TMP_DIR = process.env.R2_BUILD_TMP_DIR || path.join(os.tmpdir(), 'ton-store-builds');

// Ensure tmp dir exists (best-effort; multer would also create it on demand).
try { fs.mkdirSync(BUILD_TMP_DIR, { recursive: true }); } catch { /* noop */ }

const { safeFilename } = require('./safeFilename');

const ALLOWED_EXTENSIONS = new Set([
  '.zip', '.tar.gz', '.tgz', '.dmg', '.exe', '.msi',
  '.deb', '.rpm', '.apk', '.aab', '.ipa', '.appimage',
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const ALLOWED_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const ALLOWED_IMAGE_KINDS = new Set(['avatar', 'banner', 'cover']);

/**
 * Build uploads use diskStorage to avoid loading 100 MB into RAM. The tmp
 * file lives in BUILD_TMP_DIR and is deleted in the route's `finally` block
 * (regardless of upload success/failure).
 */
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BUILD_TMP_DIR),
    filename: (_req, _file, cb) => {
      const rand = crypto.randomBytes(16).toString('hex');
      cb(null, `build-${Date.now()}-${rand}`);
    },
  }),
  limits: { fileSize: MAX_BUILD_SIZE },
});

// Images are small (≤ 5 MB) — memoryStorage is fine and lets us hash + ship
// in a single pass without touching disk.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.has((file.mimetype || '').toLowerCase())) cb(null, true);
    else cb(new Error('Only PNG, JPEG, WebP and GIF images are allowed'));
  },
});

function publicAssetUrl(key) {
  const base = process.env.R2_PUBLIC_URL;
  if (base) return `${base.replace(/\/+$/, '')}/${key}`;
  // Fallback: stream through our own /api/r2/asset/* endpoint.
  return `/api/r2/asset/${key}`;
}

function requireR2(_req, res, next) {
  if (!isR2Configured() || !getR2Client()) {
    return res.status(503).json({ success: false, message: 'File storage (R2) is not configured' });
  }
  next();
}

function getExtension(filename) {
  if (!filename) return '';
  const lower = filename.toLowerCase();
  if (lower.endsWith('.tar.gz')) return '.tar.gz';
  const dotIdx = lower.lastIndexOf('.');
  return dotIdx >= 0 ? lower.slice(dotIdx) : '';
}

// ── Upload build to R2 (quarantine + scan job) ─────────────────────
//
// Workflow:
//   1) PUT object into `quarantine/builds/{productId}/{version}-{ts}{ext}`.
//   2) Save sha256/size/filename + quarantine_key into product, reset scan_status=pending.
//   3) Create scan_job → background worker picks it up and runs VirusTotal.
//   4) Respond 202 Accepted — UI must poll `/api/products/:id/scan-status`.
router.post(
  '/upload/:productId',
  uploadLimiter,
  apiRequireAuth(),
  requireR2,
  upload.single('build'),
  async (req, res) => {
    // Capture path early — multer assigns req.file.path with diskStorage.
    const tmpPath = req.file ? req.file.path : null;
    try {
      const profile = await resolveProfile(req);
      if (!profile) {
        return res.status(403).json({ success: false, message: 'Profile not found' });
      }

      const product = await repo.findProductById(req.params.productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
      if (product.creatorId !== profile.id && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Only the creator can upload builds' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No build file provided. Use multipart field "build"' });
      }

      const ext = getExtension(req.file.originalname);
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return res.status(400).json({
          success: false,
          message: `File type "${ext}" not allowed. Accepted: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
        });
      }

      const version = req.body.version || product.version || '1.0.0';
      const quarantineKey = quarantineKeyFor(product.id, version, ext);
      // Hash the on-disk file streamingly — O(1) memory, O(filesize) IO.
      const sha256 = await computeFileSha256(tmpPath);

      await streamFileToR2({
        client: getR2Client(),
        PutObjectCommand,
        bucket: getBucketName(),
        key: quarantineKey,
        filePath: tmpPath,
        contentLength: req.file.size,
        contentType: req.file.mimetype || 'application/octet-stream',
        metadata: {
          'product-id': product.id,
          'creator-id': profile.id,
          'sha256': sha256,
          'original-filename': req.file.originalname,
          'version': version,
          'quarantine': '1',
        },
      });

      await repo.updateProduct(product.id, {
        quarantine_key: quarantineKey,
        build_sha256: sha256,
        build_size_bytes: req.file.size,
        build_filename: req.file.originalname,
        version,
        scan_status: 'pending',
        scan_provider: 'virustotal',
        scan_report_id: null,
        scan_malicious_count: 0,
        scan_total_engines: 0,
        scan_completed_at: null,
        build_r2_key: null,
      });

      const job = await scanJobs.createScanJob({
        productId: product.id,
        quarantineKey,
        sha256,
        sizeBytes: req.file.size,
      });

      await repo.insertAuditLog({
        id: generateId(),
        user_id: profile.id,
        action: 'upload_build',
        resource: 'product',
        resource_id: product.id,
        result: 'success',
        metadata: JSON.stringify({
          quarantine_key: quarantineKey,
          sha256,
          size_bytes: req.file.size,
          filename: req.file.originalname,
          version,
          scan_job_id: job ? job.id : null,
        }),
        ip_address: req.ip,
        user_agent: req.get('user-agent') || '',
      });

      logger.info(`Build quarantined: ${quarantineKey} (${req.file.size} bytes, SHA-256: ${sha256})`);

      return res.status(202).json({
        success: true,
        data: {
          status: 'scanning',
          scan_job_id: job ? job.id : null,
          quarantine_key: quarantineKey,
          sha256,
          size_bytes: req.file.size,
          filename: req.file.originalname,
          version,
        },
      });
    } catch (err) {
      logger.error('R2 upload error:', err);
      res.status(500).json({ success: false, message: 'Build upload failed' });
    } finally {
      // Always clean up the multer-created temp file. Runs on success and
      // on every error path — including early returns (403/404/400) — so
      // the disk never fills up from rejected or partial uploads.
      await safeUnlink(tmpPath);
    }
  }
);

// ── Upload image (avatar/banner/cover) ────────────────────────────
router.post(
  '/upload/image',
  uploadLimiter,
  apiRequireAuth(),
  requireR2,
  imageUpload.single('image'),
  async (req, res) => {
    try {
      const profile = await resolveProfile(req);
      if (!profile) {
        return res.status(403).json({ success: false, message: 'Profile not found' });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image provided. Use multipart field "image"' });
      }
      const kind = String(req.body.kind || 'cover').toLowerCase();
      if (!ALLOWED_IMAGE_KINDS.has(kind)) {
        return res.status(400).json({
          success: false,
          message: `Invalid kind "${kind}". Use one of: ${[...ALLOWED_IMAGE_KINDS].join(', ')}`,
        });
      }
      const ext = getExtension(req.file.originalname);
      if (ext && !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        return res.status(400).json({
          success: false,
          message: `File extension "${ext}" is not allowed`,
        });
      }
      const safeExt = ext || '.png';
      const sha = crypto.createHash('sha256').update(req.file.buffer).digest('hex').slice(0, 24);
      const key = `assets/${kind}/${profile.id}/${Date.now()}-${sha}${safeExt}`;

      await getR2Client().send(new PutObjectCommand({
        Bucket: getBucketName(),
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ContentLength: req.file.size,
        CacheControl: 'public, max-age=31536000, immutable',
        Metadata: {
          'kind': kind,
          'owner-id': profile.id,
          'original-filename': req.file.originalname,
        },
      }));

      const url = publicAssetUrl(key);

      await repo.insertAuditLog({
        id: generateId(),
        user_id: profile.id,
        action: 'upload_image',
        resource: 'asset',
        resource_id: key,
        result: 'success',
        metadata: JSON.stringify({ kind, size_bytes: req.file.size, url }),
        ip_address: req.ip,
        user_agent: req.get('user-agent') || '',
      });

      logger.info(`Image uploaded: ${key} (${req.file.size} bytes, kind=${kind})`);

      return res.json({
        success: true,
        data: {
          key,
          url,
          size_bytes: req.file.size,
          kind,
        },
      });
    } catch (err) {
      logger.error('R2 image upload error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Image upload failed' });
    }
  }
);

// ── Public asset proxy (when R2_PUBLIC_URL is not set) ─────────────
router.get('/asset/*', requireR2, async (req, res) => {
  try {
    const key = req.params[0];
    if (!key || !key.startsWith('assets/') || isQuarantineKey(key)) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    const obj = await getR2Client().send(new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }));
    res.setHeader('Content-Type', obj.ContentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (obj.Body && typeof obj.Body.pipe === 'function') {
      obj.Body.pipe(res);
    } else {
      const buf = await obj.Body.transformToByteArray();
      res.end(Buffer.from(buf));
    }
  } catch (err) {
    if (err.$metadata && err.$metadata.httpStatusCode === 404) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    logger.error('R2 asset proxy error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load asset' });
  }
});

// ── Download build (presigned URL) ─────────────────────────────────
router.get(
  '/download/:productId',
  apiRequireAuth(),
  requireR2,
  async (req, res) => {
    try {
      const profile = await resolveProfile(req);
      if (!profile) {
        return res.status(403).json({ success: false, message: 'Profile not found' });
      }

      const product = await repo.findProductById(req.params.productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      if (!product.buildR2Key || isQuarantineKey(product.buildR2Key)) {
        return res.status(404).json({ success: false, message: 'No clean build available for this product' });
      }

      const isCreator = product.creatorId === profile.id;
      const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
      const isFreeProduct = product.priceUsd === 0;

      if (!isCreator && !isAdmin && !isFreeProduct) {
        const purchase = await repo.findPurchase(profile.id, product.id);
        if (!purchase) {
          return res.status(403).json({
            success: false,
            message: 'You must purchase this product to download',
          });
        }
      }

      const filename = safeFilename(product.buildFilename);
      const command = new GetObjectCommand({
        Bucket: getBucketName(),
        Key: product.buildR2Key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      });

      const url = await getSignedUrl(getR2Client(), command, { expiresIn: PRESIGNED_URL_EXPIRY });

      await repo.insertAuditLog({
        id: generateId(),
        user_id: profile.id,
        action: 'download_build',
        resource: 'product',
        resource_id: product.id,
        result: 'success',
        metadata: JSON.stringify({
          r2_key: product.buildR2Key,
          sha256: product.buildSha256,
        }),
        ip_address: req.ip,
        user_agent: req.get('user-agent') || '',
      });

      res.json({
        success: true,
        data: {
          download_url: url,
          expires_in: PRESIGNED_URL_EXPIRY,
          sha256: product.buildSha256,
          filename: product.buildFilename,
          size_bytes: product.buildSizeBytes,
        },
      });
    } catch (err) {
      logger.error('R2 download error:', err);
      res.status(500).json({ success: false, message: 'Download link generation failed' });
    }
  }
);

// ── Build info ─────────────────────────────────────────────────────
//
// Auth required: this surface leaks build size/version/scan_status which can
// help attackers fingerprint suspicious uploads. Public consumers should rely
// on the published product page instead.
router.get(
  '/info/:productId',
  apiRequireAuth(),
  async (req, res) => {
    try {
      const profile = await resolveProfile(req);
      if (!profile) {
        return res.status(403).json({ success: false, message: 'Profile not found' });
      }
      const product = await repo.findProductById(req.params.productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const isCreator = product.creatorId === profile.id;
      const isStaff = profile.role === 'admin' || profile.role === 'super_admin' || profile.role === 'moderator';
      if (!isCreator && !isStaff && product.status !== 'published') {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      res.json({
        success: true,
        data: {
          has_build: !!product.buildR2Key,
          version: product.version,
          size_bytes: product.buildSizeBytes,
          scan_status: product.scanStatus,
        },
      });
    } catch (err) {
      logger.error('R2 info error:', err);
      res.status(500).json({ success: false, message: 'Failed to get build info' });
    }
  }
);

// ── Delete build (creator or admin) ────────────────────────────────
router.delete(
  '/build/:productId',
  apiRequireAuth(),
  requireR2,
  async (req, res) => {
    try {
      const profile = await resolveProfile(req);
      if (!profile) {
        return res.status(403).json({ success: false, message: 'Profile not found' });
      }

      const product = await repo.findProductById(req.params.productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      if (product.creatorId !== profile.id) {
        const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
        if (!isAdmin) {
          return res.status(403).json({ success: false, message: 'Only the creator or admin can delete builds' });
        }
      }

      const keyToDelete = product.buildR2Key || product.quarantineKey;
      if (!keyToDelete) {
        return res.status(404).json({ success: false, message: 'No build to delete' });
      }

      await getR2Client().send(new DeleteObjectCommand({
        Bucket: getBucketName(),
        Key: keyToDelete,
      }));

      await repo.updateProduct(product.id, {
        build_r2_key: null,
        build_sha256: null,
        build_size_bytes: null,
        build_filename: null,
        quarantine_key: null,
        scan_status: 'pending',
        scan_report_id: null,
        scan_malicious_count: 0,
        scan_total_engines: 0,
        scan_completed_at: null,
      });

      await repo.insertAuditLog({
        id: generateId(),
        user_id: profile.id,
        action: 'delete_build',
        resource: 'product',
        resource_id: product.id,
        result: 'success',
        metadata: null,
        ip_address: req.ip,
        user_agent: req.get('user-agent') || '',
      });

      logger.info(`Build deleted for product ${product.id}`);
      res.json({ success: true });
    } catch (err) {
      logger.error('R2 delete error:', err);
      res.status(500).json({ success: false, message: 'Build deletion failed' });
    }
  }
);

module.exports = router;
