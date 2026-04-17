const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

let initialized = false;

export async function initSentry(): Promise<void> {
  if (initialized || !SENTRY_DSN) return;
  initialized = true;

  try {
    // Dynamic path prevents Rollup from failing when @sentry/react is absent
    const pkg = '@sentry/' + 'react';
    const Sentry = await import(/* @vite-ignore */ pkg);
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.2,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    });
  } catch {
    // @sentry/react not installed — skip silently
  }
}
