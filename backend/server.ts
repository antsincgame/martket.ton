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

import { initSentry } from './sentry.js';
import profileRoutes from './routes/profile.js';
import productRoutes from './routes/products.js';
import purchaseRoutes from './routes/purchases.js';
import adminRoutes from './routes/admin.js';
import statsRoutes from './routes/stats.js';
import payoutRoutes from './routes/payouts.js';
import supportRoutes from './routes/support.js';
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

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://tonapi.io', 'https://testnet.tonapi.io', 'https://*.clerk.dev', 'https://*.clerk.accounts.dev', 'https://*.appwrite.io', process.env.CORS_ORIGIN || ''].filter(Boolean),
      fontSrc: ["'self'", 'data:'],
      frameSrc: ["'self'", 'https://*.clerk.dev'],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
}));
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

app.get('/api/health', async (_req, res) => {
  let isR2 = false;
  try { const r2 = await import('./r2/client.js'); isR2 = r2.isR2Configured(); } catch { /* R2 not loaded */ }
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
app.use('/api', supportRoutes);
app.use('/api/tonforge', tonForgeRouter);

// ─── Optional sub-routers (JS — loaded dynamically) ─────────────────

async function mountOptionalRouters(): Promise<void> {
  const optional: Array<[string, string]> = [
    ['/api/webhooks/clerk', './webhooks/clerk.js'],
    ['/api/og', './og/handler.js'],
    ['/api/v1/commerce', './commerce/routes.js'],
    ['/api/admin/resend', './resend/routes.js'],
    ['/api/r2', './r2/routes.js'],
  ];
  for (const [mount, mod] of optional) {
    try {
      const m = await import(mod);
      const router = m.default ?? m;
      if (mount === '/api/webhooks/clerk') {
        app.post(mount, webhookLimiter, express.raw({ type: 'application/json' }), router);
      } else {
        app.use(mount, router);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      logger.warn(`Optional router ${mount} not loaded: ${msg}`);
    }
  }
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

function startOrderTtlCron(): void {
  const INTERVAL = 10 * 60 * 1000; // 10 min
  const run = async () => {
    try {
      const { expireStalePendingOrders } = await import('./commerce/ttlOrders.js');
      await expireStalePendingOrders();
    } catch { /* commerce DB may be unavailable */ }
  };
  setInterval(() => void run(), INTERVAL);
  setTimeout(() => void run(), 30_000);
}

async function start(): Promise<void> {
  await initSentry();
  await mountOptionalRouters();
  await bootstrapTonForge();
  startOrderTtlCron();
  app.listen(PORT, () => {
    logger.info(`TON Web Store API running on port ${PORT}`);
    logger.info(`Health: http://localhost:${PORT}/api/health`);
    logger.info('Auth: Clerk | Database: Appwrite | Model: Demiurge');
    logShieldStatus();
  });
}

void start();
