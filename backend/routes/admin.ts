import express, { type Request, type Response } from 'express';
import { resolveProfile, apiRequireAuth, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createAuditLogSchema } from './validation.js';
import * as repo from '../core/repository.js';
import { profileToSnakeCase } from '../core/repository.js';
import { generateId } from '../core/generateId.js';

const router = express.Router();

function str(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

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

router.post(
  '/audit-logs',
  apiRequireAuth(),
  requireAdmin,
  validateBody(createAuditLogSchema),
  asyncHandler(async (req, res) => {
    const { action, resource, resource_id, result, metadata } = req.body as Record<string, unknown>;
    await repo.insertAuditLog({
      id: generateId(),
      user_id: req.profile?.id || 'unknown',
      action: String(action || 'unknown'),
      resource: String(resource || 'unknown'),
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

export default router;
