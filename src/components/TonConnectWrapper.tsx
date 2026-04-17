import { Component, type ReactNode, type ErrorInfo } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

function getManifestUrl(): string {
  return new URL('/tonconnect-manifest.json', window.location.origin).toString();
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
