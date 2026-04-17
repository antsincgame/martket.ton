/**
 * Frontend logger with production-aware behaviour.
 *
 * Behaviour:
 *   - `info` is silent in production to avoid console noise.
 *   - `warn` and `error` always reach the console so they show up in
 *     DevTools, browser sandboxing reports, and as breadcrumbs / events in
 *     observability tools (Sentry instruments console automatically when
 *     loaded via `src/lib/sentry.ts`).
 *
 * Previously `warn` and `error` were no-ops in production, which left
 * production failures invisible.
 */
const isDev = import.meta.env.DEV;

function reportToSentry(level: 'warn' | 'error', message: string, args: unknown[]): void {
  // Best-effort: if Sentry has been initialised by `initSentry()`, surface
  // structured events. We touch globalThis instead of importing `@sentry/react`
  // to keep the dep optional (matches `lib/sentry.ts`).
  const sentry = (globalThis as { Sentry?: {
    captureException?: (e: unknown, ctx?: unknown) => void;
    captureMessage?: (m: string, ctx?: unknown) => void;
  }; }).Sentry;
  if (!sentry) return;
  try {
    const ctx = { level, extra: { args } };
    const errorArg = args.find((a): a is Error => a instanceof Error);
    if (errorArg && sentry.captureException) {
      sentry.captureException(errorArg, ctx);
    } else if (sentry.captureMessage) {
      sentry.captureMessage(message, ctx);
    }
  } catch {
    // Never let logging crash the app.
  }
}

export const logger = {
  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
    if (!isDev) reportToSentry('warn', message, args);
  },

  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
    if (!isDev) reportToSentry('error', message, args);
  },

  info(message: string, ...args: unknown[]): void {
    if (!isDev) return;
    console.info(message, ...args);
  },
};
