import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { clerkMiddleware } from '@clerk/express';
import { logger } from './logger.js';
import { isCoreConfigured } from './core/appwriteServer.js';
import { mahakalaHeaders, logShieldStatus } from './middleware/mahakala.js';
import { createTonForgeService, setTonForgeService } from './tonforge/service.js';
import { createDemoState } from './tonforge/demoData.js';
import { loadTonForgeStateJson, saveTonForgeStateJson } from './tonforge/persistAppwrite.js';

import profileRoutes from './routes/profile.js';
import productRoutes from './routes/products.js';
import purchaseRoutes from './routes/purchases.js';
import adminRoutes from './routes/admin.js';
import statsRoutes from './routes/stats.js';
import payoutRoutes from './routes/payouts.js';
import tonForgeRouter from './tonforge/router.js';

const app = express();
const PORT = process.env.PORT || 8081;

app.set('trust proxy', 1);

if (!process.env.CLERK_SECRET_KEY) {
  logger.warn('CLERK_SECRET_KEY is not set — auth endpoints will reject requests');
}
if (!isCoreConfigured()) {
  logger.warn('Appwrite core не настроен — database endpoints will fail');
}

// ─── Security middleware ────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(mahakalaHeaders);
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true,
}));

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });
const webhookLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

app.use('/api/', globalLimiter);
app.use('/api/session/', authLimiter);
app.use('/api/purchases', authLimiter);

// ─── Pre-auth routes ────────────────────────────────────────────────

app.post('/api/webhooks/clerk', webhookLimiter, express.raw({ type: 'application/json' }), require('./webhooks/clerk'));
app.use('/api/og', require('./og/handler'));

app.get('/api/health', (_req, res) => {
  let isR2 = false;
  try { isR2 = require('./r2/client').isR2Configured(); } catch { /* R2 not loaded */ }
  res.json({
    status: 'OK',
    message: 'TON Web Store API is running',
    db: 'appwrite',
    auth: process.env.CLERK_SECRET_KEY ? 'clerk' : 'clerk_not_configured',
    shield: 'mahakala',
    model: 'demiurge',
    storage: isR2 ? 'r2' : 'not_configured',
  });
});

// ─── Body parsing + auth ────────────────────────────────────────────

app.use(express.json());

try {
  app.use(clerkMiddleware());
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'unknown';
  logger.error('clerkMiddleware init failed:', msg);
  app.use((_req, _res, next) => next());
}

function sanitizeBody(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    const limits: Record<string, number> = { name: 200, email: 254, description: 5000, short_description: 500, display_name: 200, bio: 2000 };
    for (const [key, val] of Object.entries(req.body as Record<string, unknown>)) {
      if (typeof val === 'string') {
        let clean = val.trim();
        if (limits[key] && clean.length > limits[key]!) clean = clean.slice(0, limits[key]);
        (req.body as Record<string, unknown>)[key] = clean;
      }
    }
  }
  next();
}

app.use(sanitizeBody);

// ─── Route modules ──────────────────────────────────────────────────

app.use('/api', profileRoutes);
app.use('/api/products', productRoutes);
app.get('/api/session/products', productRoutes);
app.use('/api', purchaseRoutes);
app.use('/api', adminRoutes);
app.use('/api', statsRoutes);
app.use('/api', payoutRoutes);
app.use('/api/tonforge', tonForgeRouter);

// ─── Optional sub-routers (JS — migrated later) ────────────────────

try {
  const commerceRoutes = require('./commerce/routes').default || require('./commerce/routes');
  app.use('/api/v1/commerce', commerceRoutes);
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'unknown';
  logger.warn('Commerce routes not loaded:', msg);
}

try {
  const resendRoutes = require('./resend/routes');
  app.use('/api/admin/resend', resendRoutes);
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'unknown';
  logger.warn('Resend routes not loaded:', msg);
}

try {
  const r2Routes = require('./r2/routes');
  app.use('/api/r2', r2Routes);
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'unknown';
  logger.warn('R2 routes not loaded:', msg);
}

// ─── Error handler ──────────────────────────────────────────────────

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Unhandled error on ${req.method} ${req.path}:`, err.message, err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ─── Bootstrap ──────────────────────────────────────────────────────

async function bootstrapTonForge(): Promise<void> {
  try {
    const raw = await loadTonForgeStateJson();
    const state = raw && typeof raw === 'object' ? raw : createDemoState();
    const svc = createTonForgeService(state, { debounceMs: 600, save: saveTonForgeStateJson });
    setTonForgeService(svc);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn('TonForge: starting with demo state:', msg);
    setTonForgeService(
      createTonForgeService(createDemoState(), { debounceMs: 600, save: saveTonForgeStateJson }),
    );
  }
}

async function start(): Promise<void> {
  await bootstrapTonForge();
  app.listen(PORT, () => {
    logger.info(`TON Web Store API running on port ${PORT}`);
    logger.info(`Health: http://localhost:${PORT}/api/health`);
    logger.info('Auth: Clerk | Database: Appwrite | Model: Demiurge');
    logShieldStatus();
  });
}

void start();
