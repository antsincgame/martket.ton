import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './logger.js';
import { isCoreConfigured } from './core/appwriteServer.js';
import { ensureSearchIndex } from './core/ensureSearchIndex.js';
import { runPermissionHardenIfRequested } from './core/bootHarden.js';
import { mahakalaHeaders, logShieldStatus } from './middleware/mahakala.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createTonForgeService, setTonForgeService } from './tonforge/service.js';
import { createDemoState } from './tonforge/demoData.js';
import { loadTonForgeStateJson, saveTonForgeStateJson } from './tonforge/persistAppwrite.js';

import { initSentry } from './sentry.js';
import profileRoutes from './routes/profile.js';
import productRoutes, { sessionProductsRouter } from './routes/products.js';
import purchaseRoutes from './routes/purchases.js';
import wishlistRoutes from './routes/wishlist.js';
import adminRoutes from './routes/admin.js';
import statsRoutes from './routes/stats.js';
import payoutRoutes from './routes/payouts.js';
import supportRoutes from './routes/support.js';
import tonForgeRouter from './tonforge/router.js';

const app = express();
const PORT = process.env.PORT || 8081;

/**
 * Constant-time secret comparison over fixed-length SHA-256 digests. Plain `===`
 * on a secret leaks length/prefix via response timing; digesting both sides to a
 * fixed 32 bytes lets `crypto.timingSafeEqual` run without throwing on length
 * mismatch. Used for the health/router-status admin tokens.
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const da = crypto.createHash('sha256').update(a).digest();
  const db = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(da, db);
}

// Process-level safety net: a single missed `.catch()` in a background worker
// (ledger writes, audit, mint/payout ticks) would otherwise terminate the
// process on Node 22. Log to stderr (and Sentry, already wired) and keep
// serving for rejections; uncaught exceptions are logged before the default
// crash so they are diagnosable.
process.on('unhandledRejection', (reason) => {
  logger.error('[unhandledRejection]', reason instanceof Error ? reason : String(reason));
});
process.on('uncaughtException', (err) => {
  logger.error('[uncaughtException]', err);
});

app.set('trust proxy', 1);
app.use(requestIdMiddleware);
app.use(requestLogger);

if (!isCoreConfigured()) {
  logger.warn('Appwrite core not configured — auth & database endpoints will fail');
}

// ─── Security middleware ──────────────────────────────────

/**
 * Content Security Policy — hardened.
 *
 * script-src: NO 'unsafe-inline'. Vite production builds use module scripts
 * loaded via `src` attributes, not inline code. This blocks XSS injection.
 *
 * style-src: 'unsafe-inline' retained — TonConnect UI injects `<style>`
 * elements for its modal, and framer-motion sets element.style via JS.
 * Style injection cannot steal cookies or execute code, so the risk is low.
 */
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://tonapi.io', 'https://testnet.tonapi.io', 'https://*.appwrite.io', 'https://cloud.appwrite.io', process.env.CORS_ORIGIN || ''].filter(Boolean),
      fontSrc: ["'self'", 'data:'],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
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
// The most privilege-critical admin mutations live OUTSIDE the /api/admin
// prefix (role flips, (de)activation, profile verification, audit-log reads)
// and would otherwise only hit the loose globalLimiter. They are role-guarded,
// but cap them with the strict mutate budget as defense-in-depth.
app.use('/api/users', mutateLimiter);
app.use('/api/profiles', mutateLimiter);
app.use('/api/audit-logs', mutateLimiter);

// ─── Pre-auth routes ───────────────────────────────────

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
  const providedToken = (req.get('x-health-token') || '').trim();
  const tokenOk = !!detailToken && !!providedToken && timingSafeEqualStr(providedToken, detailToken);
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
  } catch (e) { logger.debug('[health] R2 module not loaded:', e instanceof Error ? e.message : e); }
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

/**
 * Readiness endpoint — returns 503 if critical subsystems are down.
 * Use this for load balancer health checks (vs /api/health for liveness).
 */
app.get('/api/ready', (_req, res) => {
  const ready = isCoreConfigured();
  // Minimal response — no infrastructure detail. Load balancers check status code only.
  res.status(ready ? 200 : 503).json({ ready });
});

// ─── Body parsing ──────────────────────────────────────

/**
 * JSON parsing for normal API traffic.
 *
 * We skip endpoints that must receive the raw bytes for signature verification:
 *   - `/api/admin/resend/webhook/inbound` validates a svix signature against the
 *     exact body Resend sent.
 *   - `/api/v1/commerce/sellers/kyc/webhook` validates a Ballerine HMAC over the
 *     raw body (H-2). Without this exemption the global parser consumed the
 *     stream and the route's express.raw saw a parsed object, so the HMAC was
 *     computed over "[object Object]" — always failing / forgeable.
 * Both routes mount their own `express.raw` locally.
 */
const RAW_BODY_PATHS = new Set([
  '/api/admin/resend/webhook/inbound',
  '/api/v1/commerce/sellers/kyc/webhook',
]);
app.use((req, res, next) => {
  // Normalize a trailing slash before the exact-match check. With non-strict
  // routing `…/webhook/` still hits the webhook route, but `req.path` would carry
  // the slash and miss the Set — the global JSON parser would then consume the
  // stream and the route's raw-body HMAC would verify against "[object Object]".
  const path = req.path.length > 1 && req.path.endsWith('/') ? req.path.slice(0, -1) : req.path;
  if (RAW_BODY_PATHS.has(path)) return next();
  return express.json({ limit: '256kb' })(req, res, next);
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

// ─── Client error reporting (pre-auth, rate-limited) ────────────

const clientErrorLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

app.post('/api/client-errors', clientErrorLimiter, async (req, res) => {
  const { message, stack, componentStack, pathname, userAgent, viewport, resetKey, timestamp } = req.body as Record<string, unknown>;
  const errorId = `ce_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  logger.error(`[client-error] ${errorId}: ${message}`, {
    stack, componentStack, pathname, userAgent, viewport, resetKey, timestamp,
    ip: req.ip,
  });
  if (isCoreConfigured()) {
    try {
      const repoMod = await import('./core/repository.js');
      const { generateId: genId } = await import('./core/generateId.js');
      await repoMod.insertAuditLog({
        id: genId(),
        user_id: 'system',
        action: 'client_error',
        resource: 'frontend',
        resource_id: errorId,
        result: 'error',
        metadata: JSON.stringify({ message, pathname, stack, viewport, userAgent, resetKey }),
        ip_address: req.ip ?? null,
        user_agent: typeof userAgent === 'string' ? userAgent : (req.get('user-agent') || ''),
      });
    } catch (e) { logger.debug('[client-errors] audit write failed:', e instanceof Error ? e.message : e); }
  }
  res.json({ success: true, errorId });
});

// ─── TON/USD price (cached, CoinCap → CoinMarketRate — 15 min TTL) ──

import { getTonUsdPrice, getCachedTonPrice } from './commerce/tonPriceOracle.js';

app.get('/api/ton-price', async (_req, res) => {
  try {
    const usd = await getTonUsdPrice();
    const cached = getCachedTonPrice();
    res.json({ success: true, data: { usd, updatedAt: cached?.updatedAt ?? new Date().toISOString() } });
  } catch (err) {
    logger.warn('[ton-price] price fetch failed:', err instanceof Error ? err.message : err);
    const stale = getCachedTonPrice();
    if (stale) {
      res.json({ success: true, data: { usd: stale.usd, updatedAt: stale.updatedAt }, stale: true });
    } else {
      res.status(503).json({ success: false, message: 'Price data unavailable' });
    }
  }
});

// ─── Route modules ──────────────────────────────────────

app.use('/api', adminRoutes);
app.use('/api', profileRoutes);
app.use('/api/products', productRoutes);
app.use('/api/session/products', sessionProductsRouter);
app.use('/api', purchaseRoutes);
app.use('/api', wishlistRoutes);
app.use('/api', statsRoutes);
app.use('/api', payoutRoutes);
app.use('/api', supportRoutes);
app.use('/api/tonforge', tonForgeRouter);

// ─── Optional sub-routers (JS — loaded dynamically) ─────────────

const failedRouters: Array<{ mount: string; module: string; error: string; timestamp: string }> = [];

async function mountOptionalRouters(): Promise<void> {
  const optional: Array<[string, string, boolean]> = [
    ['/api/og', './og/handler.js', false],
    ['/api/v1/commerce', './commerce/routes.js', true],
    ['/api/v1/agent', './agent/routes.js', true],
    ['/api/admin/resend', './resend/routes.js', false],
    ['/api/r2', './r2/routes.js', true],
  ];
  for (const [mount, mod, critical] of optional) {
    try {
      const m = await import(mod);
      const router = m.default ?? m;
      app.use(mount, router);
      logger.info(`Router ${mount} loaded successfully`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      const entry = { mount, module: mod, error: msg, timestamp: new Date().toISOString() };
      failedRouters.push(entry);
      if (critical) {
        logger.error(`CRITICAL: Router ${mount} failed to load: ${msg}`);
      } else {
        logger.warn(`Optional router ${mount} not loaded: ${msg}`);
      }
    }
  }
  if (failedRouters.length > 0) {
    logger.error(`[mount-alert] ${failedRouters.length} router(s) failed to load: ${failedRouters.map(r => r.mount).join(', ')}`);
  }
}

app.get('/api/admin/router-status', (req, res) => {
  const token = (process.env.HEALTH_DETAIL_TOKEN || '').trim();
  const provided = (req.get('x-health-token') || '').trim();
  if (!token || !provided || !timingSafeEqualStr(provided, token)) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }
  res.json({
    success: true,
    data: {
      failed: failedRouters,
      failedCount: failedRouters.length,
      healthy: failedRouters.length === 0,
    },
  });
});

// ─── Error handler ──────────────────────────────────────

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Unhandled error on ${req.method} ${req.path} [${req.requestId || '-'}]:`, err.message, err.stack);
  res.status(500).json({ success: false, message: 'Internal server error', requestId: req.requestId });
});

// ─── Bootstrap ────────────────────────────────────────

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

function startOrderTtlCron(): ReturnType<typeof setInterval> {
  const INTERVAL = 10 * 60 * 1000; // 10 min
  const run = async () => {
    try {
      const { expireStalePendingOrders } = await import('./commerce/ttlOrders.js');
      await expireStalePendingOrders();
    } catch (e) { logger.debug('[ttl-orders] sweep failed:', e instanceof Error ? e.message : e); }
  };
  const handle = setInterval(() => void run(), INTERVAL);
  setTimeout(() => void run(), 30_000);
  return handle;
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

/**
 * Order reconciler (was the Option-C mint worker). It NO LONGER MINTS — minting
 * is owned solely by the TonForge license worker below. This only reconciles
 * order state from on-chain escrow/license truth (→ PAID / FULFILLED / REFUNDED).
 */
async function startCommerceMintWorkerIfConfigured(): Promise<void> {
  try {
    const { startMintWorker } = await import('./commerce/mintWorker.js');
    startMintWorker();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn('Commerce mint worker bootstrap failed:', msg);
  }
}

/**
 * TonForge license mint worker: retries licenses in minting/failed, refunds, payouts.
 * Requires ORACLE_MNEMONIC + LICENSE_NFT_ITEM_CODE_BOC (loadOnchainConfig.enabled).
 */
async function startTonforgeMintWorkerIfConfigured(): Promise<void> {
  try {
    const { startMintWorker } = await import('./tonforge/mintWorker.js');
    startMintWorker();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn('TonForge mint worker bootstrap failed:', msg);
  }
}

async function startSanctionsRefreshSafe(): Promise<void> {
  try {
    const { startSanctionsRefresh } = await import('./sanctions/screen.js');
    startSanctionsRefresh();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (process.env.NODE_ENV === 'production') {
      logger.error('FATAL: Sanctions module failed to load in production:', msg);
      process.exit(1);
    }
    logger.warn('Sanctions refresh bootstrap failed:', msg);
  }
}

async function start(): Promise<void> {
  await initSentry();
  await mountOptionalRouters();
  await bootstrapTonForge();
  const ttlCronHandle = startOrderTtlCron();
  await startScanWorker();
  await startCommerceMintWorkerIfConfigured();
  await startTonforgeMintWorkerIfConfigured();
  await startSanctionsRefreshSafe();
  const server = app.listen(PORT, () => {
    logger.info(`TON Web Store API running on port ${PORT}`);
    logger.info(`Health: http://localhost:${PORT}/api/health`);
    logger.info('Auth: Appwrite | Database: Appwrite | Model: Demiurge');
    logShieldStatus();
    // Self-heal schema that needs prod creds (only present in-container): the
    // public-search fulltext index. Post-listen + guarded — never affects boot.
    void ensureSearchIndex();
    // One-shot ACL hardening when RUN_PERMISSION_HARDEN=1 (post-listen, guarded,
    // идемпотентно). Снять флаг после применения. Никогда не роняет бут.
    void runPermissionHardenIfRequested();
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`[server] ${signal} received — graceful shutdown`);
    clearInterval(ttlCronHandle);
    try {
      const workerMod = await import('./scan/worker.js');
      await workerMod.stop();
    } catch (err: unknown) {
      logger.warn('[server] scan worker stop failed:', err instanceof Error ? err.message : err);
    }
    try {
      const mintMod = await import('./commerce/mintWorker.js');
      mintMod.stopMintWorker();
    } catch (err: unknown) {
      logger.warn('[server] mint worker stop failed:', err instanceof Error ? err.message : err);
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
