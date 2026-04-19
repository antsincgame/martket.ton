import { logger } from './logger.js';

let initialized = false;

export async function initSentry(): Promise<void> {
  const dsn = (process.env.SENTRY_DSN || '').trim();
  if (initialized || !dsn) return;
  initialized = true;

  try {
    // @sentry/node is an optional runtime dependency. Cast through unknown so
    // typecheck passes when the SDK is not installed (production builds may
    // omit it). Real init happens only when SENTRY_DSN is set.
    const mod = (await import(/* @vite-ignore */ '@sentry/node' as string)) as unknown as {
      init: (opts: { dsn: string; environment: string; tracesSampleRate: number }) => void;
    };
    mod.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.2,
    });
    logger.info('Sentry initialized');
  } catch {
    logger.warn('Sentry SDK not installed — skipping');
  }
}
