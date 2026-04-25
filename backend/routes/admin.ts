import express from 'express';
import { resolveProfile, apiRequireAuth, requireAdmin, requireSuperAdmin, requireModerator } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { str } from '../utils/params.js';
import { createAuditLogSchema } from './validation.js';
import * as repo from '../core/repository.js';
import { profileToSnakeCase, updateProfile } from '../core/repository.js';
import { generateId } from '../core/generateId.js';
import { listAllProducts, listProductsByCategory, renameCategory } from '../core/productRepository.js';
import {
  listLedgerEntries,
  getLedgerEntry,
  updateComplianceStatus,
  getAggregateStats,
} from '../core/ledgerRepository.js';
import type { ComplianceStatus } from '../domain/types.js';

const router = express.Router();

router.get(
  '/users',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }
    const users = await repo.listUsers();
    res.json({ success: true, data: users.map(profileToSnakeCase) });
  }),
);

router.get(
  '/users/:id',
  apiRequireAuth(),
  asyncHandler(async (req, res) => {
    const caller = await resolveProfile(req);
    if (!caller) {
      res.status(403).json({ success: false, message: 'Profile not found' });
      return;
    }
    const isAdmin = caller.role === 'admin' || caller.role === 'super_admin';
    if (caller.id !== str(req.params.id) && !isAdmin) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    const user = await repo.findUserById(str(req.params.id));
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, data: profileToSnakeCase(user) });
  }),
);

router.get(
  '/demiurge/:id',
  asyncHandler(async (req, res) => {
    const user = await repo.findUserById(str(req.params.id));
    if (!user || !user.isActive) {
      res.status(404).json({ success: false, message: 'Demiurge not found' });
      return;
    }
    const products = await repo.listProductsByCreator(str(req.params.id));
    const published = products.filter((p) => p.status === 'published');
    res.json({
      success: true,
      data: {
        id: user.id,
        display_name: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        created_at: user.createdAt,
        products_count: published.length,
        products: published,
      },
    });
  }),
);

/**
 * Manual audit-log entry surface.
 *
 * Restricted to super-admins and to a small whitelist of action types
 * (see AUDIT_LOG_CLIENT_ACTIONS). All other action types must be inserted
 * by trusted server-side code via repo.insertAuditLog directly.
 *
 * The user_id is always taken from the authenticated profile, never the
 * request body — the writer cannot impersonate another user.
 */
router.post(
  '/audit-logs',
  apiRequireAuth(),
  requireSuperAdmin,
  validateBody(createAuditLogSchema),
  asyncHandler(async (req, res) => {
    const { action, resource, resource_id, result, metadata } = req.body as Record<string, unknown>;
    await repo.insertAuditLog({
      id: generateId(),
      user_id: req.profile?.id || 'unknown',
      action: String(action),
      resource: String(resource),
      resource_id: (resource_id as string) || null,
      result: String(result || 'success'),
      metadata: metadata ? JSON.stringify(metadata) : null,
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });
    res.json({ success: true });
  }),
);

router.get(
  '/audit-logs',
  apiRequireAuth(),
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit), 10) || 100, 500);
    const logs = await repo.listAuditLogs(limit);
    const parsed = logs.map((log) => {
      let metaParsed: unknown = null;
      if (log.metadata) {
        try { metaParsed = JSON.parse(log.metadata); } catch { metaParsed = log.metadata; }
      }
      return { ...log, metadata: metaParsed };
    });
    res.json({ success: true, data: parsed });
  }),
);

router.get(
  '/stats',
  apiRequireAuth(),
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const userCount = await repo.countUsers();
    const products = await repo.listAllProducts();
    const recentLogs = await repo.listAuditLogs(10);
    res.json({
      success: true,
      data: {
        demiurges: userCount,
        products: products.length,
        publishedProducts: products.filter((p) => p.status === 'published').length,
        recentActivity: recentLogs.length,
      },
    });
  }),
);

const VALID_ROLES = ['viewer', 'demiurge', 'moderator', 'admin', 'super_admin'] as const;

router.patch(
  '/users/:id/role',
  apiRequireAuth(),
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const targetId = str(req.params.id);
    const { role } = req.body as { role?: string };
    if (!role || !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }
    const target = await repo.findUserById(targetId);
    if (!target) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const oldRole = target.role;
    await updateProfile(targetId, { role });
    await repo.insertAuditLog({
      id: generateId(),
      user_id: req.profile?.id || 'unknown',
      action: 'role_change',
      resource: 'user',
      resource_id: targetId,
      result: 'success',
      metadata: JSON.stringify({ from: oldRole, to: role }),
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });
    const updated = await repo.findUserById(targetId);
    res.json({ success: true, data: updated ? profileToSnakeCase(updated) : null });
  }),
);

router.patch(
  '/users/:id/active',
  apiRequireAuth(),
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const targetId = str(req.params.id);
    const { is_active } = req.body as { is_active?: boolean };
    if (typeof is_active !== 'boolean') {
      res.status(400).json({ success: false, message: 'is_active must be a boolean' });
      return;
    }
    const target = await repo.findUserById(targetId);
    if (!target) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    await updateProfile(targetId, { is_active });
    await repo.insertAuditLog({
      id: generateId(),
      user_id: req.profile?.id || 'unknown',
      action: is_active ? 'user_activate' : 'user_deactivate',
      resource: 'user',
      resource_id: targetId,
      result: 'success',
      metadata: null,
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });
    const updated = await repo.findUserById(targetId);
    res.json({ success: true, data: updated ? profileToSnakeCase(updated) : null });
  }),
);

router.get(
  '/products/pending',
  apiRequireAuth(),
  requireModerator,
  asyncHandler(async (_req, res) => {
    const products = await repo.listProductsByStatus('pending_review');
    res.json({ success: true, data: products.map(repo.productToSnakeCase) });
  }),
);

router.post(
  '/products/:id/rescan',
  apiRequireAuth(),
  requireModerator,
  asyncHandler(async (req, res) => {
    const product = await repo.findProductById(str(req.params.id));
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    const sourceKey = product.quarantineKey || product.buildR2Key;
    if (!sourceKey || !product.buildSha256 || !product.buildSizeBytes) {
      res.status(409).json({
        success: false,
        message: 'Product has no build to rescan',
      });
      return;
    }

    let quarantineKey = product.quarantineKey;
    if (!quarantineKey && product.buildR2Key) {
      const ext = product.buildR2Key.slice(product.buildR2Key.lastIndexOf('.'));
      quarantineKey = `quarantine/builds/${product.id}/${product.version || '1.0.0'}-${Date.now()}${ext}`;
      const r2Mod = await import('../r2/client.js');
      const r2 = ((r2Mod as unknown as { default?: typeof r2Mod }).default ?? r2Mod);
      const { CopyObjectCommand } = await import('@aws-sdk/client-s3');
      const client = r2.getR2Client();
      if (!client) {
        res.status(503).json({ success: false, message: 'R2 not configured' });
        return;
      }
      const bucket = r2.getBucketName();
      await client.send(new CopyObjectCommand({
        Bucket: bucket,
        Key: quarantineKey,
        CopySource: `${bucket}/${encodeURIComponent(product.buildR2Key)}`,
      }));
    }

    if (!quarantineKey) {
      res.status(409).json({ success: false, message: 'Failed to prepare build for rescan' });
      return;
    }

    await repo.updateProduct(product.id, {
      quarantine_key: quarantineKey,
      scan_status: 'pending',
      scan_report_id: null,
      scan_malicious_count: 0,
      scan_total_engines: 0,
      scan_completed_at: null,
    });

    const scanJobsMod = await import('../core/scanJobRepository.js');
    const scanJobs = ((scanJobsMod as unknown as { default?: typeof scanJobsMod }).default ?? scanJobsMod);
    const job = await scanJobs.createScanJob({
      productId: product.id,
      quarantineKey,
      sha256: product.buildSha256,
      sizeBytes: product.buildSizeBytes,
    });

    await repo.insertAuditLog({
      id: generateId(),
      user_id: req.profile?.id || 'unknown',
      action: 'rescan_request',
      resource: 'product',
      resource_id: product.id,
      result: 'success',
      metadata: JSON.stringify({ scan_job_id: job?.id, quarantine_key: quarantineKey }),
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });

    res.status(202).json({
      success: true,
      data: { status: 'scanning', scan_job_id: job?.id, quarantine_key: quarantineKey },
    });
  }),
);

router.patch(
  '/profiles/:id/verify',
  apiRequireAuth(),
  requireAdmin,
  asyncHandler(async (req, res) => {
    const targetId = str(req.params.id);
    const { verified } = req.body as { verified?: boolean };
    if (typeof verified !== 'boolean') {
      res.status(400).json({ success: false, message: 'verified must be a boolean' });
      return;
    }
    const target = await repo.findUserById(targetId);
    if (!target) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }
    await updateProfile(targetId, { verified });
    await repo.insertAuditLog({
      id: generateId(),
      user_id: req.profile?.id || 'unknown',
      action: verified ? 'profile_verify' : 'profile_unverify',
      resource: 'profile',
      resource_id: targetId,
      result: 'success',
      metadata: JSON.stringify({ from: target.verified, to: verified }),
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });
    const updated = await repo.findUserById(targetId);
    res.json({ success: true, data: updated ? profileToSnakeCase(updated) : null });
  }),
);

// ─── Categories ──────────────────────────────────────────────────────────────

router.get(
  '/admin/categories',
  apiRequireAuth(),
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const products = await listAllProducts();
    const countMap = new Map<string, number>();
    for (const p of products) {
      const slug = (p.category || 'other').toLowerCase().trim();
      countMap.set(slug, (countMap.get(slug) ?? 0) + 1);
    }
    const categories = Array.from(countMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([slug, count]) => ({ slug, name: slug, products: count }));
    res.json({ success: true, data: categories });
  }),
);

router.post(
  '/admin/categories',
  apiRequireAuth(),
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name } = req.body as { name?: string };
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, message: 'name is required' });
      return;
    }
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    const existing = await listProductsByCategory(slug);
    if (existing.length > 0) {
      res.status(409).json({ success: false, message: `Category "${slug}" already exists` });
      return;
    }
    res.status(201).json({ success: true, data: { slug, name: slug, products: 0 } });
  }),
);

router.patch(
  '/admin/categories/:slug',
  apiRequireAuth(),
  requireAdmin,
  asyncHandler(async (req, res) => {
    const oldSlug = str(req.params.slug);
    const { name } = req.body as { name?: string };
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, message: 'name is required' });
      return;
    }
    const newSlug = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (oldSlug === newSlug) {
      res.status(400).json({ success: false, message: 'New name is the same as old name' });
      return;
    }
    const updated = await renameCategory(oldSlug, newSlug);
    res.json({ success: true, data: { slug: newSlug, name: newSlug, products: updated } });
  }),
);

router.delete(
  '/admin/categories/:slug',
  apiRequireAuth(),
  requireAdmin,
  asyncHandler(async (req, res) => {
    const slug = str(req.params.slug);
    const inUse = await listProductsByCategory(slug);
    if (inUse.length > 0) {
      res.status(409).json({
        success: false,
        message: `Cannot delete category "${slug}": ${inUse.length} product(s) use it. Reassign them first.`,
      });
      return;
    }
    res.json({ success: true, data: { slug, deleted: true } });
  }),
);

// ─── Compliance Ledger ──────────────────────────────────────────────

router.get(
  '/admin/ledger',
  apiRequireAuth(),
  requireAdmin,
  asyncHandler(async (req, res) => {
    const filters = {
      entryType: req.query.entryType as string | undefined,
      jurisdiction: req.query.jurisdiction as string | undefined,
      complianceStatus: req.query.complianceStatus as string | undefined,
      buyerCountry: req.query.buyerCountry as string | undefined,
      geoKycMatch: req.query.geoKycMatch === 'false' ? false : req.query.geoKycMatch === 'true' ? true : undefined,
      search: req.query.search as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      limit: Math.min(Number(req.query.limit) || 50, 200),
      offset: Number(req.query.offset) || 0,
    };
    const result = await listLedgerEntries(filters);
    res.json({ success: true, data: result.entries, total: result.total });
  }),
);

router.get(
  '/admin/ledger/stats',
  apiRequireAuth(),
  requireAdmin,
  asyncHandler(async (req, res) => {
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const stats = await getAggregateStats(dateFrom, dateTo);
    res.json({ success: true, data: stats });
  }),
);

router.get(
  '/admin/ledger/export',
  apiRequireAuth(),
  requireAdmin,
  asyncHandler(async (req, res) => {
    const filters = {
      entryType: req.query.entryType as string | undefined,
      jurisdiction: req.query.jurisdiction as string | undefined,
      complianceStatus: req.query.complianceStatus as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      limit: 5000,
      offset: 0,
    };
    const { entries } = await listLedgerEntries(filters);

    const format = (req.query.format as string) || 'csv';
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="ledger-export.json"');
      res.json(entries);
      return;
    }

    const csvHeaders = [
      'id', 'date', 'type', 'ref_type', 'ref_id',
      'amount_usd', 'amount_ton', 'ton_usd_rate',
      'platform_fee_usd', 'platform_fee_ton',
      'buyer_wallet', 'seller_wallet', 'tx_hash',
      'buyer_country', 'buyer_ip_country', 'seller_country',
      'geo_kyc_match', 'jurisdiction', 'compliance_status',
      'product_name', 'escrow_address', 'license_address', 'notes',
    ];
    const csvRows = entries.map((e) => [
      e.id, e.createdAt, e.entryType, e.refType, e.refId,
      e.amountUsd, e.amountTonRaw, e.tonUsdRate,
      e.platformFeeUsd, e.platformFeeTonRaw,
      e.buyerWallet ?? '', e.sellerWallet ?? '', e.txHash ?? '',
      e.buyerCountry ?? '', e.buyerIpCountry ?? '', e.sellerCountry ?? '',
      e.geoKycMatch, e.jurisdiction, e.complianceStatus,
      `"${(e.productName || '').replace(/"/g, '""')}"`,
      e.escrowAddress ?? '', e.licenseAddress ?? '', `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ledger-export.csv"');
    res.send([csvHeaders.join(','), ...csvRows.map((r) => r.join(','))].join('\n'));
  }),
);

router.get(
  '/admin/ledger/:id',
  apiRequireAuth(),
  requireAdmin,
  asyncHandler(async (req, res) => {
    const entry = await getLedgerEntry(str(req.params.id));
    if (!entry) {
      res.status(404).json({ success: false, message: 'Ledger entry not found' });
      return;
    }
    res.json({ success: true, data: entry });
  }),
);

router.patch(
  '/admin/ledger/:id/status',
  apiRequireAuth(),
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status, notes } = req.body as { status?: string; notes?: string };
    const validStatuses: ComplianceStatus[] = ['clean', 'review', 'reported', 'flagged'];
    if (!status || !validStatuses.includes(status as ComplianceStatus)) {
      res.status(400).json({ success: false, message: 'Invalid status' });
      return;
    }
    const entry = await updateComplianceStatus(str(req.params.id), status as ComplianceStatus, notes);
    res.json({ success: true, data: entry });
  }),
);

export default router;
