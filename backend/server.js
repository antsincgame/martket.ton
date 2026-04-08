// API на Appwrite (core DB + Storage); JWT кошелька и сессия Appwrite для защищённых маршрутов.
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { logger } = require('./logger');
const { isCoreConfigured } = require('./core/appwriteServer');
const repo = require('./core/repository');
const { generateId } = require('./core/generateId');
const { getAppwriteAccount } = require('./core/session');
const { createTonForgeService, setTonForgeService } = require('./tonforge/service');
const { createDemoState } = require('./tonforge/demoData');
const { loadTonForgeStateJson, saveTonForgeStateJson } = require('./tonforge/persistAppwrite');

require('dotenv').config();

let commerceRoutes;
try {
  commerceRoutes = require('./commerce/routes');
} catch (err) {
  logger.warn('Commerce routes not loaded (Appwrite not configured):', err.message);
}

const app = express();
const PORT = process.env.PORT || 8081;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in environment variables');
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
app.use(express.json());

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

async function authenticateHybrid(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.sendStatus(401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch {
    /* не JWT бэкенда */
  }

  try {
    const account = await getAppwriteAccount(token);
    const profile = await repo.findUserByAppwriteId(account.$id);
    if (!profile) {
      return res.status(403).json({ success: false, message: 'Профиль не найден для пользователя Appwrite' });
    }
    req.user = {
      userId: profile.id,
      wallet: profile.ton_address,
      role: profile.role,
      appwriteUserId: account.$id,
    };
    return next();
  } catch (err) {
    logger.warn('Auth hybrid Appwrite failed:', err.message);
    return res.sendStatus(403);
  }
}

const asyncHandler =
  (fn) =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'TON Web Store API is running', db: 'appwrite' });
});

app.post(
  '/api/auth/appwrite/sync',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization required' });
    }
    const account = await getAppwriteAccount(token);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const profile = await repo.upsertProfileForAppwriteUser(account.$id, {
      email: account.email,
      name: name || account.name || 'User',
      role: 'user',
    });
    res.json({ success: true, data: profile });
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
  '/api/session/profile',
  authenticateHybrid,
  asyncHandler(async (req, res) => {
    let profile;
    if (req.user.appwriteUserId) {
      profile = await repo.findUserByAppwriteId(req.user.appwriteUserId);
    } else {
      profile = await repo.findUserById(req.user.userId);
    }
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    res.json({ success: true, data: profile });
  })
);

app.post(
  '/api/auth/login',
  asyncHandler(async (req, res) => {
    const { wallet, signature } = req.body;

    if (!wallet || !signature) {
      return res.status(400).json({ success: false, message: 'wallet and signature are required' });
    }

    let user = await repo.findUserByTonAddress(wallet);

    if (!user) {
      const newId = generateId();
      user = await repo.insertUser({
        id: newId,
        email: null,
        ton_address: wallet,
        name: `User_${wallet.slice(-6)}`,
        role: 'user',
        avatar: null,
        bio: null,
        security_level: 'low',
        is_active: true,
      });
    }

    const token = signToken({
      userId: user.id,
      wallet: user.ton_address,
      role: user.role,
    });

    await repo.insertAuditLog({
      id: generateId(),
      user_id: user.id,
      action: 'login',
      resource: 'auth',
      resource_id: null,
      result: 'success',
      metadata: JSON.stringify({ method: 'ton_wallet' }),
      ip_address: req.ip,
      user_agent: req.get('user-agent') || '',
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        wallet: user.ton_address,
        role: user.role,
        name: user.name,
      },
    });
  })
);

app.get(
  '/api/users',
  authenticateHybrid,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const users = await repo.listUsers();
    res.json({ success: true, data: users });
  })
);

app.get(
  '/api/users/:id',
  authenticateHybrid,
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
  authenticateHybrid,
  asyncHandler(async (req, res) => {
    const { name, email, description, ton_address } = req.body;

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
      user_id: req.user.userId,
      name,
      email,
      description: description || null,
      ton_address: ton_address || null,
      status: 'pending',
    });

    await repo.insertAuditLog({
      id: generateId(),
      user_id: req.user.userId,
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
  authenticateHybrid,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const developer = await repo.findDeveloperById(req.params.id);
    if (!developer) {
      return res.status(404).json({ success: false, message: 'Developer not found' });
    }

    await repo.deleteDeveloperById(req.params.id);

    await repo.insertAuditLog({
      id: generateId(),
      user_id: req.user.userId,
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
  authenticateHybrid,
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
  authenticateHybrid,
  asyncHandler(async (req, res) => {
    const { action, resource, resource_id, result, metadata } = req.body;

    await repo.insertAuditLog({
      id: generateId(),
      user_id: req.user.userId,
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
  authenticateHybrid,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const limit = Math.min(parseInt(String(req.query.limit), 10) || 100, 500);
    const logs = await repo.listAuditLogs(limit);

    const parsed = logs.map((log) => {
      let metaParsed = null;
      if (log.metadata) {
        try {
          metaParsed = JSON.parse(log.metadata);
        } catch {
          metaParsed = log.metadata;
        }
      }
      return { ...log, metadata: metaParsed };
    });

    res.json({ success: true, data: parsed });
  })
);

app.get(
  '/api/stats',
  authenticateHybrid,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

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

app.use((err, _req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

async function bootstrapTonForge() {
  try {
    const raw = await loadTonForgeStateJson();
    const state = raw && typeof raw === 'object' ? raw : createDemoState();
    const svc = createTonForgeService(state, {
      debounceMs: 600,
      save: saveTonForgeStateJson,
    });
    setTonForgeService(svc);
  } catch (err) {
    logger.warn('TonForge: старт с демо-состоянием (Storage недоступен):', err.message);
    setTonForgeService(
      createTonForgeService(createDemoState(), {
        debounceMs: 600,
        save: saveTonForgeStateJson,
      })
    );
  }
}

async function start() {
  await bootstrapTonForge();
  app.listen(PORT, () => {
    logger.info(`TON Web Store API running on port ${PORT}`);
    logger.info(`Health: http://localhost:${PORT}/api/health`);
    logger.info('Database: Appwrite (core)');
  });
}

void start();
