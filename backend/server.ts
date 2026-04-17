import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './logger.js';
import { isCoreConfigured } from './core/appwriteServer.js';
import { mahakalaHeaders, logShieldStatus } from './middleware/mahakala.js';
import { createTonForgeService, setTonForgeService } from './tonforge/service.js';
import { createDemoState } from './tonforge/demoData.js';
import { loadTonForgeStateJson, saveTonForgeStateJson } from './tonforge/persistAppwrite.js';

import { initSentry } from './sentry.js';
import profileRoutes from './routes/profile.js';
import productRoutes, { sessionProductsRouter } from './routes/products.js';
import purchaseRoutes from './routes/purchases.js';
import adminRoutes from './routes/admin.js';
import statsRoutes from './routes/stats.js';
import payoutRoutes from './routes/payouts.js';
import supportRoutes from './routes/support.js';
import tonForgeRouter from './tonforge/router.js';

const app = express();
const PORT = process.env.PORT || 8081;

app.set('trust proxy', 1);

if (!isCoreConfigured()) {
  logger.warn('Appwrite core not configured — auth & database endpoints will fail');
}

// ─── Security middleware ────────────────────────────────────────────

/**
 * Content Security Policy.
 *
 * NOTE: 'unsafe-inline' is currently required for `scriptSrc` and `styleSrc`
 *   - Vite legacy plugin and TonConnect inject small inline init scripts.
 *   - Tailwind / CSS-in-JS components inline some styles at runtime.
 * Removing it requires nonce-based CSP plumbing through index.html — tracked
 * as a follow-up. The current policy still blocks foreign script origins
 * and remote stylesheets, which is the highest-impact protection.
 */
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://tonapi.io', 'https://testnet.tonapi.io', 'https://*.appwrite.io', 'https://cloud.appwrite.io', process.env.CORS_ORIGIN || ''].filter(Boolean),
      fontSrc: ["'self'", 'data:'],
      frameSrc: ["'self'"],
      // Block <object>, <embed>, <applet> — major XSS vectors.
      objectSrc: ["'none'"],
      // Disallow `<base href>` injection redirecting relative URLs.
      baseUri: ["'self'"],
      // Forbid forms posting to other origins.
      formAction: ["'self'"],
      // Prevent clickjacking by external iframes embedding our pages.
      frameAncestors: ["'self'"],
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
/**
 * Stricter limiter for state-mutating endpoints. Stops automated abuse like
 * mass-creating products, mass-uploading builds (the build endpoint also has
 * its own dedicated multer limiter), or hammering admin actions.
 *
 * Skips GET/HEAD so reads stay on the global limiter.
 */
const mutateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD',
  message: { success: false, message: 'Too many write requests. Try again later.' },
});

app.use('/api/', globalLimiter);
app.use('/api/session/', authLimiter);
app.use('/api/purchases', authLimiter);
app.use('/api/products', mutateLimiter);
app.use('/api/admin', mutateLimiter);
app.use('/api/support', mutateLimiter);

// ─── Pre-auth routes ────────────────────────────────────────────────

/**
 * Health endpoint.
 *
 * In production we deliberately return only liveness info — service-detail
 * fields are reconnaissance hints for attackers (they reveal which optional
 * subsystems are configured: R2, VirusTotal, etc.).
 *
 * Operators who need the full status can either:
 *   - run with NODE_ENV != production (development),
 *   - or pass `?detailed=1` together with a header
 *     `X-Health-Token: $HEALTH_DETAIL_TOKEN`.
 */
app.get('/api/health', async (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  const wantDetail = req.query.detailed === '1';
  const detailToken = (process.env.HEALTH_DETAIL_TOKEN || '').trim();
  const tokenOk = !!detailToken && req.get('x-health-token') === detailToken;
  const showDetail = !isProd || (wantDetail && tokenOk);

  if (!showDetail) {
    res.json({ status: 'OK' });
    return;
  }

  let isR2 = false;
  try {
    const r2Mod = await import('./r2/client.js');
    const r2 = ((r2Mod as unknown as { default?: typeof r2Mod }).default ?? r2Mod);
    isR2 = r2.isR2Configured();
  } catch { /* R2 not loaded */ }
  const scan = process.env.VIRUSTOTAL_API_KEY ? 'virustotal' : 'not_configured';
  res.json({
    status: 'OK',
    message: 'TON Web Store API is running',
    db: 'appwrite',
    auth: isCoreConfigured() ? 'appwrite' : 'appwrite_not_configured',
    shield: 'mahakala',
    model: 'demiurge',
    storage: isR2 ? 'r2' : 'not_configured',
    scan,
  });
});

// ─── Body parsing ───────────────────────────────────────────────────

/**
 * JSON parsing for normal API traffic.
 *
 * We skip a few endpoints that must receive the raw bytes:
 *   - `/api/admin/resend/webhook/inbound` validates a svix signature
 *     against the exact body Resend sent, so it uses `express.raw`
 *     locally inside the router.
 */
app.use((req, res, next) => {
  if (req.path === '/api/admin/resend/webhook/inbound') return next();
  return express.json()(req, res, next);
});

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

/**
 * Soft Origin guard for mutating requests.
 *
 * Defence-in-depth on top of CORS. CORS only protects the browser-side
 * response; nothing stops a malicious script from issuing the request itself.
 * With Bearer-token auth (no cookies) the classic CSRF surface is small, but
 * we still reject obvious cross-origin write attempts to prevent forged form
 * posts and reduce reconnaissance noise.
 *
 * Skips:
 *   - safe methods (GET/HEAD/OPTIONS),
 *   - requests with no Origin header (curl, Postman, server-to-server,
 *     mobile apps that use `Authorization: Bearer ...`).
 *
 * Production-only so local dev can hit the API from any vite dev port.
 */
function originGuard(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (process.env.NODE_ENV !== 'production') return next();
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.get('origin');
  if (!origin) return next();
  const allowed = (process.env.CORS_ORIGIN || '').trim();
  if (!allowed || origin === allowed) return next();
  logger.warn(`[origin-guard] blocked ${req.method} ${req.path} from ${origin}`);
  res.status(403).json({
    success: false,
    message: 'Cross-origin write requests are not allowed',
    code: 'BAD_ORIGIN',
  });
}

app.use(originGuard);

// ─── Route modules ──────────────────────────────────────────────────

app.use('/api', profileRoutes);
app.use('/api/products', productRoutes);
app.use('/api/session/products', sessionProductsRouter);
app.use('/api', purchaseRoutes);
app.use('/api', adminRoutes);
app.use('/api', statsRoutes);
app.use('/api', payoutRoutes);
app.use('/api', supportRoutes);
app.use('/api/tonforge', tonForgeRouter);

// ─── Optional sub-routers (JS — loaded dynamically) ─────────────────

async function mountOptionalRouters(): Promise<void> {
  const optional: Array<[string, string]> = [
    ['/api/og', './og/handler.js'],
    ['/api/v1/commerce', './commerce/routes.js'],
    ['/api/admin/resend', './resend/routes.js'],
    ['/api/r2', './r2/routes.js'],
  ];
  for (const [mount, mod] of optional) {
    try {
      const m = await import(mod);
      const router = m.default ?? m;
      app.use(mount, router);
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

async function startScanWorker(): Promise<void> {
  try {
    const r2Mod = await import('./r2/client.js');
    const r2 = ((r2Mod as unknown as { default?: typeof r2Mod }).default ?? r2Mod);
    if (!r2.isR2Configured()) {
      logger.warn('Scan worker: R2 not configured — skipping');
      return;
    }
    const { isVtConfigured, logVtConfig } = await import('./scan/virustotal.js');
    logVtConfig();
    if (!isVtConfigured()) return;
    const { start } = await import('./scan/worker.js');
    start();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn('Scan worker bootstrap failed:', msg);
  }
}

async function start(): Promise<void> {
  await initSentry();
  await mountOptionalRouters();
  await bootstrapTonForge();
  startOrderTtlCron();
  await startScanWorker();
  const server = app.listen(PORT, () => {
    logger.info(`TON Web Store API running on port ${PORT}`);
    logger.info(`Health: http://localhost:${PORT}/api/health`);
    logger.info('Auth: Appwrite | Database: Appwrite | Model: Demiurge');
    logShieldStatus();
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`[server] ${signal} received — graceful shutdown`);
    try {
      const workerMod = await import('./scan/worker.js');
      await workerMod.stop();
    } catch (err: unknown) {
      logger.warn('[server] worker stop failed:', err instanceof Error ? err.message : err);
    }
    server.close((err) => {
      if (err) logger.error('[server] close error:', err.message);
      process.exit(err ? 1 : 0);
    });
    setTimeout(() => {
      logger.error('[server] graceful shutdown timeout — forcing exit');
      process.exit(1);
    }, 30_000).unref();
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  logger.error('[server] fatal startup error:', msg);
  process.exit(1);
});
