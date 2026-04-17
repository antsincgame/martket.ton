import { logger } from './logger.js';

let initialized = false;

export async function initSentry(): Promise<void> {
  const dsn = (process.env.SENTRY_DSN || '').trim();
  if (initialized || !dsn) return;
  initialized = true;

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.2,
    });
    logger.info('Sentry initialized');
  } catch {
    logger.warn('Sentry SDK not installed — skipping');
  }
}
