import { Component, type ReactNode, type ErrorInfo } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

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
      return <>{this.props.children}</>;
    }
    return (
      <TonConnectUIProvider manifestUrl={getManifestUrl()}>
        {this.props.children}
      </TonConnectUIProvider>
    );
  }
}

const TonConnectWrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
  <TonConnectSafeProvider>{children}</TonConnectSafeProvider>
);

export default TonConnectWrapper;
