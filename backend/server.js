const express = require('express');
const cors = require('cors');
const { clerkMiddleware, requireAuth, getAuth } = require('@clerk/express');
const { logger } = require('./logger');
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

const app = express();
const PORT = process.env.PORT || 8081;

if (!process.env.CLERK_SECRET_KEY) {
  throw new Error('CLERK_SECRET_KEY must be set in environment variables');
}

if (!isCoreConfigured()) {
  throw new Error(
    'Appwrite core не настроен: задайте APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY'
  );
}

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    credentials: true,
  })
);

app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), require('./webhooks/clerk'));

app.use(express.json());
app.use(clerkMiddleware());

const asyncHandler =
  (fn) =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

async function resolveProfile(req) {
  const auth = getAuth(req);
  if (!auth || !auth.userId) return null;
  return repo.findUserByClerkId(auth.userId);
}

function requireAdmin(req, res, next) {
  resolveProfile(req).then((profile) => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    req.profile = profile;
    next();
  }).catch((err) => {
    logger.error('requireAdmin error:', err);
    res.status(500).json({ success: false, message: 'Internal error' });
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'TON Web Store API is running', db: 'appwrite', auth: 'clerk' });
});

app.get(
  '/api/session/profile',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found. It will be created via webhook.' });
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

    const { ton_address } = req.body;

    if (ton_address !== undefined) {
      if (ton_address) {
        const existing = await repo.findUserByTonAddress(ton_address);
        if (existing && existing.id !== profile.id) {
          return res.status(409).json({
            success: false,
            message: 'This TON wallet is already linked to another account',
          });
        }
      }
      await repo.updateProfileField(profile.id, 'ton_address', ton_address || null);
    }

    const updated = await repo.findUserById(profile.id);
    res.json({ success: true, data: updated });
  })
);

app.get(
  '/api/profiles/by-ton/:ton',
  asyncHandler(async (req, res) => {
    const profile = await repo.findUserByTonAddress(req.params.ton);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: profile });
  })
);

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
    const user = await repo.findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  })
);

app.get(
  '/api/developers',
  asyncHandler(async (_req, res) => {
    const developers = await repo.listDevelopers();
    res.json({ success: true, data: developers });
  })
);

app.post(
  '/api/developers',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile) {
      return res.status(403).json({ success: false, message: 'Profile not found' });
    }

    const { name, email, description } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'name and email are required' });
    }

    const existing = await repo.findDeveloperByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Developer with this email already exists' });
    }

    const newId = generateId();
    const developer = await repo.insertDeveloper({
      id: newId,
      user_id: profile.id,
      name,
      email,
      description: description || null,
      ton_address: profile.ton_address || null,
      status: 'pending',
    });

    await repo.insertAuditLog({
      id: generateId(),
      user_id: profile.id,
      action: 'create',
      resource: 'developer',
      resource_id: newId,
      result: 'success',
      metadata: JSON.stringify({ name, email }),
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });

    res.json({ success: true, data: developer });
  })
);

app.delete(
  '/api/developers/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const developer = await repo.findDeveloperById(req.params.id);
    if (!developer) {
      return res.status(404).json({ success: false, message: 'Developer not found' });
    }

    await repo.deleteDeveloperById(req.params.id);

    await repo.insertAuditLog({
      id: generateId(),
      user_id: profile.id,
      action: 'delete',
      resource: 'developer',
      resource_id: req.params.id,
      result: 'success',
      metadata: JSON.stringify({ name: developer.name }),
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });

    res.json({ success: true });
  })
);

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

app.post(
  '/api/products',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { name, description, short_description, price_ton, category, image } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const newId = generateId();
    const product = await repo.insertProduct({
      id: newId,
      developer_id: req.body.developer_id || null,
      name,
      description: description || null,
      short_description: short_description || null,
      price_ton: price_ton || 0,
      category: category || 'other',
      image: image || null,
      status: 'draft',
    });

    res.json({ success: true, data: product });
  })
);

app.post(
  '/api/audit-logs',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const profile = await resolveProfile(req);
    const { action, resource, resource_id, result, metadata } = req.body;

    await repo.insertAuditLog({
      id: generateId(),
      user_id: profile?.id || 'unknown',
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

app.get(
  '/api/stats',
  requireAuth(),
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const userCount = await repo.countUsers();
    const developers = await repo.listDevelopers();
    const products = await repo.listAllProducts();
    const recentLogs = await repo.listAuditLogs(10);

    res.json({
      success: true,
      data: {
        users: userCount,
        developers: developers.length,
        products: products.length,
        publishedProducts: products.filter((p) => p.status === 'published').length,
        recentActivity: recentLogs.length,
      },
    });
  })
);

const tonForgeRouter = require('./tonforge/router');
app.use('/api/tonforge', tonForgeRouter);

if (commerceRoutes) {
  app.use('/api/v1/commerce', commerceRoutes);
}

if (resendRoutes) {
  app.use('/api/admin/resend', resendRoutes);
}

app.use((err, _req, res, _next) => {
  logger.error('Unhandled error:', err);
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
    logger.info('Auth: Clerk | Database: Appwrite');
  });
}

void start();
