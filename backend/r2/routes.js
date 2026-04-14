'use strict';

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { requireAuth } = require('@clerk/express');
const multer = require('multer');
const { logger } = require('../logger');
const { getR2Client, getBucketName, isR2Configured } = require('./client');
const { resolveProfile } = require('../middleware/auth');
const repo = require('../core/repository');
const { generateId } = require('../core/generateId');

const router = express.Router();

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many uploads. Try again later.' },
});

const MAX_BUILD_SIZE = 500 * 1024 * 1024; // 500 MB
const PRESIGNED_URL_EXPIRY = 15 * 60; // 15 minutes

const ALLOWED_EXTENSIONS = new Set([
  '.zip', '.tar.gz', '.tgz', '.dmg', '.exe', '.msi',
  '.deb', '.rpm', '.apk', '.aab', '.ipa', '.appimage',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BUILD_SIZE },
});

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

function buildR2Key(productId, version, filename) {
  const ext = getExtension(filename) || '.zip';
  const ts = Date.now();
  return `builds/${productId}/${version}-${ts}${ext}`;
}

// ── Upload build to R2 ─────────────────────────────────────────────
router.post(
  '/upload/:productId',
  uploadLimiter,
  requireAuth(),
  requireR2,
  upload.single('build'),
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

      if (product.creator_id !== profile.id) {
        const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
        if (!isAdmin) {
          return res.status(403).json({ success: false, message: 'Only the creator can upload builds' });
        }
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
      const r2Key = buildR2Key(product.id, version, req.file.originalname);
      const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

      await getR2Client().send(new PutObjectCommand({
        Bucket: getBucketName(),
        Key: r2Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype || 'application/octet-stream',
        ContentLength: req.file.size,
        Metadata: {
          'product-id': product.id,
          'creator-id': profile.id,
          'sha256': sha256,
          'original-filename': req.file.originalname,
          'version': version,
        },
      }));

      await repo.updateProduct(product.id, {
        build_r2_key: r2Key,
        build_sha256: sha256,
        build_size_bytes: req.file.size,
        build_filename: req.file.originalname,
        version,
      });

      await repo.insertAuditLog({
        id: generateId(),
        user_id: profile.id,
        action: 'upload_build',
        resource: 'product',
        resource_id: product.id,
        result: 'success',
        metadata: JSON.stringify({
          r2_key: r2Key,
          sha256,
          size_bytes: req.file.size,
          filename: req.file.originalname,
          version,
        }),
        ip_address: req.ip,
        user_agent: req.get('user-agent') || '',
      });

      logger.info(`Build uploaded: ${r2Key} (${req.file.size} bytes, SHA-256: ${sha256})`);

      res.json({
        success: true,
        data: {
          r2_key: r2Key,
          sha256,
          size_bytes: req.file.size,
          filename: req.file.originalname,
          version,
        },
      });
    } catch (err) {
      logger.error('R2 upload error:', err);
      res.status(500).json({ success: false, message: 'Build upload failed' });
    }
  }
);

// ── Download build (presigned URL) ─────────────────────────────────
router.get(
  '/download/:productId',
  requireAuth(),
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

      if (!product.build_r2_key) {
        return res.status(404).json({ success: false, message: 'No build file available for this product' });
      }

      const isCreator = product.creator_id === profile.id;
      const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
      const isFreeProduct = product.price_ton === 0;

      if (!isCreator && !isAdmin && !isFreeProduct) {
        const purchase = await repo.findPurchase(profile.id, product.id);
        if (!purchase) {
          return res.status(403).json({
            success: false,
            message: 'You must purchase this product to download',
          });
        }
      }

      const command = new GetObjectCommand({
        Bucket: getBucketName(),
        Key: product.build_r2_key,
        ResponseContentDisposition: `attachment; filename="${product.build_filename || 'build.zip'}"`,
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
          r2_key: product.build_r2_key,
          sha256: product.build_sha256,
        }),
        ip_address: req.ip,
        user_agent: req.get('user-agent') || '',
      });

      res.json({
        success: true,
        data: {
          download_url: url,
          expires_in: PRESIGNED_URL_EXPIRY,
          sha256: product.build_sha256,
          filename: product.build_filename,
          size_bytes: product.build_size_bytes,
        },
      });
    } catch (err) {
      logger.error('R2 download error:', err);
      res.status(500).json({ success: false, message: 'Download link generation failed' });
    }
  }
);

// ── Build info ─────────────────────────────────────────────────────
router.get(
  '/info/:productId',
  async (req, res) => {
    try {
      const product = await repo.findProductById(req.params.productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      res.json({
        success: true,
        data: {
          has_build: !!product.build_r2_key,
          version: product.version,
          size_bytes: product.build_size_bytes,
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
  requireAuth(),
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

      if (product.creator_id !== profile.id) {
        const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
        if (!isAdmin) {
          return res.status(403).json({ success: false, message: 'Only the creator or admin can delete builds' });
        }
      }

      if (!product.build_r2_key) {
        return res.status(404).json({ success: false, message: 'No build to delete' });
      }

      await getR2Client().send(new DeleteObjectCommand({
        Bucket: getBucketName(),
        Key: product.build_r2_key,
      }));

      await repo.updateProduct(product.id, {
        build_r2_key: null,
        build_sha256: null,
        build_size_bytes: null,
        build_filename: null,
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
