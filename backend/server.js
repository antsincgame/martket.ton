const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { queries, generateId } = require('./db');
const { logger } = require('./logger');
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

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true,
}));
app.use(express.json());

if (commerceRoutes) {
  app.use('/api/v1/commerce', commerceRoutes);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'TON Web Store API is running', db: 'sqlite' });
});

app.post('/api/auth/login', (req, res) => {
  const { wallet, signature } = req.body;

  if (!wallet || !signature) {
    return res.status(400).json({ success: false, message: 'wallet and signature are required' });
  }

  try {
    let user = queries.users.findByTonAddress.get(wallet);

    if (!user) {
      const newId = generateId();
      queries.users.insert.run({
        id: newId,
        email: null,
        ton_address: wallet,
        name: `User_${wallet.slice(-6)}`,
        role: 'user',
        avatar: null,
        bio: null,
        security_level: 'low',
      });
      user = queries.users.findById.get(newId);
    }

    const token = signToken({
      userId: user.id,
      wallet: user.ton_address,
      role: user.role,
    });

    queries.auditLogs.insert.run({
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
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/users', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const users = queries.users.getAll.all();
    res.json({ success: true, data: users });
  } catch (err) {
    logger.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', authenticateToken, (req, res) => {
  try {
    const user = queries.users.findById.get(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    logger.error('Error fetching user:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

app.get('/api/developers', (_req, res) => {
  try {
    const developers = queries.developers.getAll.all();
    res.json({ success: true, data: developers });
  } catch (err) {
    logger.error('Error fetching developers:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch developers' });
  }
});

app.post('/api/developers', authenticateToken, (req, res) => {
  try {
    const { name, email, description, ton_address } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'name and email are required' });
    }

    const existing = queries.developers.findByEmail.get(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Developer with this email already exists' });
    }

    const newId = generateId();
    queries.developers.insert.run({
      id: newId,
      user_id: req.user.userId,
      name,
      email,
      description: description || null,
      ton_address: ton_address || null,
      status: 'pending',
    });

    const developer = queries.developers.findById.get(newId);

    queries.auditLogs.insert.run({
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
  } catch (err) {
    logger.error('Error creating developer:', err);
    res.status(500).json({ success: false, message: 'Failed to create developer' });
  }
});

app.delete('/api/developers/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const developer = queries.developers.findById.get(req.params.id);
    if (!developer) {
      return res.status(404).json({ success: false, message: 'Developer not found' });
    }

    queries.developers.delete.run(req.params.id);

    queries.auditLogs.insert.run({
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
  } catch (err) {
    logger.error('Error deleting developer:', err);
    res.status(500).json({ success: false, message: 'Failed to delete developer' });
  }
});

app.get('/api/products', (_req, res) => {
  try {
    const products = queries.products.getAll.all('published');
    res.json({ success: true, data: products });
  } catch (err) {
    logger.error('Error fetching products:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const product = queries.products.findById.get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    logger.error('Error fetching product:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch product' });
  }
});

app.post('/api/products', authenticateToken, (req, res) => {
  try {
    const { name, description, short_description, price_ton, category, image } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const newId = generateId();
    queries.products.insert.run({
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

    const product = queries.products.findById.get(newId);
    res.json({ success: true, data: product });
  } catch (err) {
    logger.error('Error creating product:', err);
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
});

app.post('/api/audit-logs', authenticateToken, (req, res) => {
  try {
    const { action, resource, resource_id, result, metadata } = req.body;

    queries.auditLogs.insert.run({
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
  } catch (err) {
    logger.error('Error storing audit log:', err);
    res.status(500).json({ success: false, message: 'Failed to store audit log' });
  }
});

app.get('/api/audit-logs', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const logs = queries.auditLogs.getAll.all(limit);

    const parsed = logs.map(log => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    res.json({ success: true, data: parsed });
  } catch (err) {
    logger.error('Error fetching audit logs:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
});

app.get('/api/stats', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const userCount = queries.users.count.get().count;
    const developers = queries.developers.getAll.all();
    const products = queries.products.getAllAny.all();
    const recentLogs = queries.auditLogs.getAll.all(10);

    res.json({
      success: true,
      data: {
        users: userCount,
        developers: developers.length,
        products: products.length,
        publishedProducts: products.filter(p => p.status === 'published').length,
        recentActivity: recentLogs.length,
      },
    });
  } catch (err) {
    logger.error('Error fetching stats:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

app.listen(PORT, () => {
  logger.info(`TON Web Store API running on port ${PORT}`);
  logger.info(`Health: http://localhost:${PORT}/api/health`);
  logger.info(`Database: SQLite (local)`);
});
