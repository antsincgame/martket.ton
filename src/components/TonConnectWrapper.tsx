import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { isTelegramMiniApp } from '../lib/telegramMiniApp';

/**
 * TonConnect requires a publicly fetchable manifest. In dev (localhost or any
 * non-HTTPS host) wallets that don't run on the same machine (Tonkeeper mobile,
 * MyTonWallet extension talking via tonconnect bridge) cannot fetch a manifest
 * served from `http://localhost:5173`. We fall back to the production manifest
 * so the connect button at least works when developing — even though paid
 * actions still require a real domain. An explicit override is supported via
 * `VITE_TONCONNECT_MANIFEST_URL` for staging deployments.
 */
function getManifestUrl(): string {
  const override = import.meta.env.VITE_TONCONNECT_MANIFEST_URL;
  if (override) return String(override);
  const origin = window.location.origin;
  const isLocal =
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.') ||
    origin.startsWith('http://0.0.0.0');
  if (isLocal) {
    return 'https://tonforge.org/tonconnect-manifest.json';
  }
  return new URL('/tonconnect-manifest.json', origin).toString();
}

/**
 * Inside a Telegram Mini App, jumping out to a wallet (Tonkeeper, Wallet) to
 * sign would otherwise strand the user there. `twaReturnUrl` tells TonConnect
 * which t.me link re-opens this Mini App after signing. Set
 * `VITE_TG_BOT_URL` (e.g. https://t.me/tonforge_bot/store) once the bot is
 * registered with BotFather; without it we let TonConnect use its default
 * back-navigation.
 */
function getTwaReturnUrl(): `${string}://${string}` | undefined {
  if (!isTelegramMiniApp()) return undefined;
  const url = import.meta.env.VITE_TG_BOT_URL;
  return url && String(url).startsWith('https://t.me/')
    ? (String(url) as `${string}://${string}`)
    : undefined;
}

interface FallbackState {
  hasFailed: boolean;
}

/**
 * Catches TonConnect SDK initialization errors (a common issue
 * in mobile WebViews with limited Storage/API support).
 * On error — renders children WITHOUT the TonConnect context;
 * CommerceCheckout will show "Connect Wallet" with graceful fallback.
 */
class TonConnectSafeProvider extends Component<{ children: ReactNode }, FallbackState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasFailed: false };
  }

  static getDerivedStateFromError(): FallbackState {
    return { hasFailed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.warn('[TonConnect] SDK init failed, rendering without wallet context:', error, info);
    }
  }

  render() {
    if (this.state.hasFailed) {
      return (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center text-sm text-amber-200">
          Wallet connection unavailable. Reload the page to try again.
        </div>
      );
    }
    const twaReturnUrl = getTwaReturnUrl();
    return (
      <TonConnectUIProvider
        manifestUrl={getManifestUrl()}
        actionsConfiguration={twaReturnUrl ? { twaReturnUrl } : undefined}
      >
        {this.props.children}
      </TonConnectUIProvider>
    );
  }
}

const TonConnectWrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
  <TonConnectSafeProvider>{children}</TonConnectSafeProvider>
);

export default TonConnectWrapper;
