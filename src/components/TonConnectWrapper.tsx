import { Component, type ReactNode, type ErrorInfo } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

function getManifestUrl(): string {
  return new URL('/tonconnect-manifest.json', window.location.origin).toString();
}

interface FallbackState {
  hasFailed: boolean;
}

/**
 * Перехватывает ошибки инициализации TonConnect SDK (частая проблема
 * в мобильных WebView, ограниченных по Storage/API).
 * При ошибке — рендерит children БЕЗ TonConnect-контекста;
 * CommerceCheckout покажет «Connect Wallet» с graceful fallback.
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
