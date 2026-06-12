/**
 * Telegram Mini App (TMA) integration — door C of the strategy: the
 * storefront living natively inside Telegram, where TON is the home chain.
 *
 * The official bridge script (telegram-web-app.js, loaded in index.html)
 * defines window.Telegram.WebApp in EVERY browser; only inside a real
 * Telegram client does `platform` report something other than "unknown".
 * Outside Telegram everything here is a deliberate no-op, so the regular
 * web storefront is untouched.
 */

interface TelegramWebApp {
  /** "android" | "ios" | "tdesktop" | "macos" | "weba" | "webk" | "unknown" … */
  platform: string;
  /** Raw init data string; non-empty only when launched as a Mini App. */
  initData: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** True only when actually running inside a Telegram client. */
export function isTelegramMiniApp(): boolean {
  const wa = window.Telegram?.WebApp;
  return Boolean(wa && wa.platform !== 'unknown' && wa.initData.length > 0);
}

/**
 * Hand-shake with the Telegram client. Call once before rendering.
 * Returns true when running as a Mini App.
 */
export function initTelegramMiniApp(): boolean {
  if (!isTelegramMiniApp()) return false;
  const wa = window.Telegram!.WebApp!;
  try {
    wa.ready();
    wa.expand();
    // Match the store's dark chrome so the Telegram header doesn't flash white.
    wa.setHeaderColor('#0A0A0A');
    wa.setBackgroundColor('#0A0A0A');
  } catch {
    // Older Telegram clients may lack some setters — cosmetic only.
  }
  // CSS hook for TMA-specific tweaks (safe areas, hidden footers, …).
  document.documentElement.classList.add('tma');
  return true;
}
