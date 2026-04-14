const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { clerkMiddleware, requireAuth, getAuth } = require('@clerk/express');
const { logger } = require('./logger');

let TonAddress = null;
try {
  TonAddress = require('@ton/core').Address;
} catch {
  logger.warn('@ton/core not available — TON address validation will use regex fallback');
}

function isValidTonAddress(addr) {
  if (TonAddress) {
    try { TonAddress.parse(addr); return true; } catch { return false; }
  }
  return /^(EQ|UQ|0:|kQ)[A-Za-z0-9_-]{46,48}$/.test(addr);
}
const { isCoreConfigured } = require('./core/appwriteServer');
const repo = require('./core/repository');
const { generateId } = require('./core/generateId');
const { createTonForgeService, setTonForgeService } = require('./tonforge/service');
const { createDemoState } = require('./tonforge/demoData');
const { loadTonForgeStateJson, saveTonForgeStateJson } = require('./tonforge/persistAppwrite');

require('dotenv').config();

let commerceRoutes;
try {
  commerceRoutes = require('./commerce/routes');
} catch (err) {
  logger.warn('Commerce routes not loaded:', err.message);
}

let resendRoutes;
try {
  resendRoutes = require('./resend/routes');
} catch (err) {
  logger.warn('Resend routes not loaded:', err.message);
}

let r2Routes;
try {
  r2Routes = require('./r2/routes');
} catch (err) {
  logger.warn('R2 routes not loaded:', err.message);
}

const app = express();
const PORT = process.env.PORT || 8081;

app.set('trust proxy', 1);

if (!process.env.CLERK_SECRET_KEY) {
  logger.warn('CLERK_SECRET_KEY is not set — auth endpoints will reject requests');
}

if (!isCoreConfigured()) {
  logger.warn('Appwrite core не настроен — database endpoints will fail');
}

const { mahakalaHeaders, logShieldStatus } = require('./middleware/mahakala');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(mahakalaHeaders);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    credentials: true,
  })
);

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const webhookLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

app.use('/api/', globalLimiter);

app.post('/api/webhooks/clerk', webhookLimiter, express.raw({ type: 'application/json' }), require('./webhooks/clerk'));

// ── Health (before auth middleware — always reachable) ───────────
app.get('/api/health', (_req, res) => {
  const { isR2Configured } = require('./r2/client');
  res.json({
    status: 'OK',
    message: 'TON Web Store API is running',
    db: 'appwrite',
    auth: process.env.CLERK_SECRET_KEY ? 'clerk' : 'clerk_not_configured',
    shield: 'mahakala',
    model: 'demiurge',
    storage: isR2Configured() ? 'r2' : 'not_configured',
  });
});

app.use(express.json());

try {
  app.use(clerkMiddleware());
} catch (err) {
  logger.error('clerkMiddleware init failed:', err.message);
  app.use((_req, _res, next) => next());
}

function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    const limits = { name: 200, email: 254, description: 5000, short_description: 500, display_name: 200, bio: 2000 };
    for (const [key, val] of Object.entries(req.body)) {
      if (typeof val === 'string') {
        let clean = val.trim();
        if (limits[key] && clean.length > limits[key]) {
          clean = clean.slice(0, limits[key]);
        }
        req.body[key] = clean;
      }
    }
  }
  next();
}

app.use(sanitizeBody);

const asyncHandler =
  (fn) =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const { resolveProfile, requireAdmin } = require('./middleware/auth');

// ── Profile (Demiurge) ─────────────────────────────────────────────

app.get(
  '/api/session/profile',
  requireAuth(),
  asyncHandler(async (req, res) => {
    let profile = await resolveProfile(req);
    if (!profile) {
      const auth = getAuth(req);
      if (auth && auth.userId) {
        logger.info(`Auto-creating profile for Clerk user ${auth.userId} (webhook may be delayed)`);
        profile = await repo.upsertProfileForClerkUser(auth.userId, {
          role: 'demiurge',
        });
      }
    }
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    res.json({ success: true, data: profile });
  })
);

app.patch(
  '/api/session/profile',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const { ton_address, display_name, bio, avatar } = req.body;
    const updates = {};

    if (ton_address !== undefined) {
      if (ton_address) {
        if (!isValidTonAddress(ton_address)) {
          return res.status(400).json({ success: false, message: 'Invalid TON address format' });
        }
        const existing = await repo.findUserByTonAddress(ton_address);
        if (existing && existing.id !== profile.id) {
          return res.status(409).json({
            success: false,
            message: 'This TON wallet is already linked to another account',
          });
        }
      }
      updates.ton_address = ton_address || null;
    }

    if (display_name !== undefined) updates.display_name = display_name;
    if (bio !== undefined) updates.bio = bio;
    if (avatar !== undefined) updates.avatar = avatar;

    if (Object.keys(updates).length > 0) {
      await repo.updateProfile(profile.id, updates);
    }

    const updated = await repo.findUserById(profile.id);
    res.json({ success: true, data: updated });
  })
);

app.get(
  '/api/profiles/by-ton/:ton',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await repo.findUserByTonAddress(req.params.ton);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: profile });
  })
);

// ── Users (Admin) ──────────────────────────────────────────────────

app.get(
  '/api/users',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const users = await repo.listUsers();
    res.json({ success: true, data: users });
  })
);

app.get(
  '/api/users/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const caller = await resolveProfile(req);
    if (!caller) {
      return res.status(403).json({ success: false, message: 'Profile not found' });
    }

    const isAdmin = caller.role === 'admin' || caller.role === 'super_admin';
    if (caller.id !== req.params.id && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const user = await repo.findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  })
);

// ── Demiurge public profile ────────────────────────────────────────

app.get(
  '/api/demiurge/:id',
  asyncHandler(async (req, res) => {
    const user = await repo.findUserById(req.params.id);
    if (!user || !user.is_active) {
      return res.status(404).json({ success: false, message: 'Demiurge not found' });
    }
    const products = await repo.listProductsByCreator(req.params.id);
    const published = products.filter(p => p.status === 'published');
    res.json({
      success: true,
      data: {
        id: user.id,
        display_name: user.display_name,
        avatar: user.avatar,
        bio: user.bio,
        created_at: user.created_at,
        products_count: published.length,
        products: published,
      },
    });
  })
);

// ── Products ───────────────────────────────────────────────────────

app.get(
  '/api/products',
  asyncHandler(async (_req, res) => {
    const products = await repo.listProductsByStatus('published');
    res.json({ success: true, data: products });
  })
);

app.get(
  '/api/products/:id',
  asyncHandler(async (req, res) => {
    const product = await repo.findProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  })
);

app.get(
  '/api/session/products',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(403).json({ success: false, message: 'Profile not found' });
    }
    const products = await repo.listProductsByCreator(profile.id);
    res.json({ success: true, data: products });
  })
);

app.post(
  '/api/products',
  requireAuth(),
  strictLimiter,
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(403).json({ success: false, message: 'Profile not found' });
    }

    const { name, description, short_description, price_ton, category, image, version } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const newId = generateId();
    const product = await repo.insertProduct({
      id: newId,
      creator_id: profile.id,
      name,
      description: description || null,
      short_description: short_description || null,
      price_ton: price_ton || 0,
      category: category || 'other',
      image: image || null,
      version: version || '1.0.0',
      status: 'draft',
    });

    await repo.insertAuditLog({
      id: generateId(),
      user_id: profile.id,
      action: 'create',
      resource: 'product',
      resource_id: newId,
      result: 'success',
      metadata: JSON.stringify({ name }),
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });

    res.json({ success: true, data: product });
  })
);

app.patch(
  '/api/products/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(403).json({ success: false, message: 'Profile not found' });
    }

    const product = await repo.findProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
    const isOwner = product.creator_id === profile.id;
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only the creator or admin can edit this product' });
    }

    const allowedFields = ['name', 'description', 'short_description', 'price_ton', 'category', 'image', 'version'];
    if (isAdmin) allowedFields.push('status');

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const updated = await repo.updateProduct(req.params.id, updates);
    res.json({ success: true, data: updated });
  })
);

// ── Purchases (Library) ────────────────────────────────────────────

app.get(
  '/api/session/library',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(403).json({ success: false, message: 'Profile not found' });
    }
    const purchases = await repo.listPurchasesByUser(profile.id);
    const productIds = [...new Set(purchases.map(p => p.product_id).filter(Boolean))];
    const products = await Promise.all(productIds.map(id => repo.findProductById(id)));
    const productMap = new Map(products.filter(Boolean).map(p => [p.id, p]));
    const enriched = purchases.map(p => ({
      ...p,
      product: productMap.get(p.product_id) || null,
    }));
    res.json({ success: true, data: enriched });
  })
);

app.get(
  '/api/session/owns/:productId',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.json({ success: true, data: { owns: false } });
    }
    const purchase = await repo.findPurchase(profile.id, req.params.productId);
    res.json({ success: true, data: { owns: !!purchase } });
  })
);

app.post(
  '/api/purchases',
  requireAuth(),
  strictLimiter,
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(403).json({ success: false, message: 'Profile not found' });
    }

    const { product_id, tx_hash } = req.body;
    if (!product_id) {
      return res.status(400).json({ success: false, message: 'product_id is required' });
    }

    const product = await repo.findProductById(product_id);
    if (!product || product.status !== 'published') {
      return res.status(404).json({ success: false, message: 'Product not found or not published' });
    }

    const existingPurchase = await repo.findPurchase(profile.id, product_id);
    if (existingPurchase) {
      return res.status(409).json({ success: false, message: 'You already own this product' });
    }

    const purchase = await repo.insertPurchase({
      id: generateId(),
      user_id: profile.id,
      product_id,
      price_ton: product.price_ton,
      tx_hash: tx_hash || null,
    });

    await repo.insertAuditLog({
      id: generateId(),
      user_id: profile.id,
      action: 'purchase',
      resource: 'product',
      resource_id: product_id,
      result: 'success',
      metadata: JSON.stringify({ price_ton: product.price_ton, tx_hash }),
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });

    res.json({ success: true, data: purchase });
  })
);

// ── Audit ──────────────────────────────────────────────────────────

app.post(
  '/api/audit-logs',
  requireAuth(),
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { action, resource, resource_id, result, metadata } = req.body;

    await repo.insertAuditLog({
      id: generateId(),
      user_id: req.profile?.id || 'unknown',
      action: action || 'unknown',
      resource: resource || 'unknown',
      resource_id: resource_id || null,
      result: result || 'success',
      metadata: metadata ? JSON.stringify(metadata) : null,
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });

    res.json({ success: true });
  })
);

app.get(
  '/api/audit-logs',
  requireAuth(),
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit), 10) || 100, 500);
    const logs = await repo.listAuditLogs(limit);

    const parsed = logs.map((log) => {
      let metaParsed = null;
      if (log.metadata) {
        try { metaParsed = JSON.parse(log.metadata); } catch { metaParsed = log.metadata; }
      }
      return { ...log, metadata: metaParsed };
    });

    res.json({ success: true, data: parsed });
  })
);

// ── Stats ──────────────────────────────────────────────────────────

app.get(
  '/api/stats',
  requireAuth(),
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
  })
);

// ── Sub-routers ────────────────────────────────────────────────────

const tonForgeRouter = require('./tonforge/router');
app.use('/api/tonforge', tonForgeRouter);

if (commerceRoutes) {
  app.use('/api/v1/commerce', commerceRoutes);
}

if (resendRoutes) {
  app.use('/api/admin/resend', resendRoutes);
}

if (r2Routes) {
  app.use('/api/r2', r2Routes);
}

app.use((err, req, res, _next) => {
  logger.error(`Unhandled error on ${req.method} ${req.path}:`, err.message, err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

async function bootstrapTonForge() {
  try {
    const raw = await loadTonForgeStateJson();
    const state = raw && typeof raw === 'object' ? raw : createDemoState();
    const svc = createTonForgeService(state, { debounceMs: 600, save: saveTonForgeStateJson });
    setTonForgeService(svc);
  } catch (err) {
    logger.warn('TonForge: starting with demo state:', err.message);
    setTonForgeService(
      createTonForgeService(createDemoState(), { debounceMs: 600, save: saveTonForgeStateJson })
    );
  }
}

async function start() {
  await bootstrapTonForge();
  app.listen(PORT, () => {
    logger.info(`TON Web Store API running on port ${PORT}`);
    logger.info(`Health: http://localhost:${PORT}/api/health`);
    logger.info('Auth: Clerk | Database: Appwrite | Model: Demiurge');
    logShieldStatus();
  });
}

void start();
