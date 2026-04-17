import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** При смене этого ключа ErrorBoundary сбрасывает ошибку (полезно для route transitions). */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Mahakala Guardian caught error:', error, errorInfo);
    }
    this.setState({ error, errorInfo });
    this.reportToSentry(error, errorInfo);
  }

  private reportToSentry(error: Error, errorInfo: ErrorInfo) {
    const sentryPkg = '@sentry/' + 'react';
    import(/* @vite-ignore */ sentryPkg)
      .then((Sentry) => {
        Sentry.withScope?.((scope: { setTag: (k: string, v: string) => void; setExtra: (k: string, v: unknown) => void }) => {
          scope.setTag('boundary', 'mahakala');
          scope.setTag('resetKey', this.props.resetKey ?? 'root');
          scope.setExtra('componentStack', errorInfo.componentStack);
          scope.setExtra('viewport', `${window.innerWidth}x${window.innerHeight}`);
          scope.setExtra('userAgent', navigator.userAgent);
          scope.setExtra('pathname', window.location.pathname);
          scope.setExtra('isMobile', window.matchMedia?.('(pointer: coarse)')?.matches ?? false);
          Sentry.captureException?.(error);
        });
      })
      .catch(() => { /* @sentry/react not installed — skip */ });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
          <div className="bg-white/5 backdrop-blur-sm border border-red-500/20 rounded-3xl p-8 max-w-lg w-full text-center">
            {/* Mahakala Guardian Icon */}
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>

            <h1 className="text-2xl font-display font-bold text-white mb-4">
              🛡️ Mahakala's Protection Activated
            </h1>
            
            <p className="text-gray-300 mb-6">
              The fierce protector Mahakala has intercepted a disturbance in the digital realm. 
              Your sacred journey was temporarily interrupted, but fear not - enlightenment awaits!
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="bg-black/20 rounded-xl p-4 mb-6 text-left">
                <div className="text-red-400 font-semibold text-sm mb-2">Error Details (dev only):</div>
                <div className="text-gray-300 text-xs font-mono overflow-auto max-h-32">
                  {this.state.error.message}
                </div>
              </div>
            )}

            {/* Sacred Mantra */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-6">
              <p className="text-purple-200 text-sm font-medium mb-2">
                🕉️ Sacred Recovery Mantra 🕉️
              </p>
              <p className="text-gray-300 text-xs">
                "Gate gate pāragate pārasaṃgate bodhi svāhā"<br/>
                <em>Gone, gone, gone beyond, gone completely beyond, awakening, so be it!</em>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full bg-mystical-gradient hover:scale-105 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Try Again</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 border border-white/20 flex items-center justify-center space-x-2"
              >
                <Home className="w-5 h-5" />
                <span>Return to Sanctuary</span>
              </button>
            </div>

            {/* Sacred Footer */}
            <div className="mt-6 p-4 bg-white/5 rounded-xl">
              <p className="text-gray-400 text-xs">
                🪷 Protected by the compassionate wrath of Mahakala<br/>
                All disturbances are temporary - the path to digital nirvana continues ☸️
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 