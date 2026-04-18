import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, Check } from 'lucide-react';
import { storeApiUrl } from '../lib/storeApi';

interface Props {
  children: ReactNode;
  /** When this key changes, ErrorBoundary resets the error (useful for route transitions). */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  copied: boolean;
  errorId: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, copied: false, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Mahakala Guardian caught error:', error, errorInfo);
    }
    this.setState({ error, errorInfo });
    this.reportToSentry(error, errorInfo);
    this.reportToBackend(error, errorInfo);
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

  private reportToBackend(error: Error, errorInfo: ErrorInfo) {
    const payload = {
      message: error.message,
      stack: error.stack ?? null,
      componentStack: errorInfo.componentStack ?? null,
      pathname: window.location.pathname,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      resetKey: this.props.resetKey ?? 'root',
      timestamp: new Date().toISOString(),
    };
    fetch(storeApiUrl('/api/client-errors'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data: { errorId?: string }) => {
        if (data.errorId) this.setState({ errorId: data.errorId });
      })
      .catch(() => { /* network failure — already logged to Sentry if available */ });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: undefined, errorInfo: undefined, copied: false, errorId: null });
    }
  }

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRetry = () => {
    const msg = this.state.error?.message ?? '';
    if (msg.includes('dynamically imported module') || msg.includes('Failed to fetch')) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, copied: false, errorId: null });
  };

  handleCopyError = () => {
    const { error, errorInfo, errorId } = this.state;
    const text = [
      `Error: ${error?.message}`,
      errorId ? `ID: ${errorId}` : '',
      `Path: ${window.location.pathname}`,
      `Time: ${new Date().toISOString()}`,
      error?.stack ? `\nStack:\n${error.stack}` : '',
      errorInfo?.componentStack ? `\nComponent:\n${errorInfo.componentStack}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch(() => {});
  };

  render() {
    if (this.state.hasError) {
      const { error, errorId, copied } = this.state;
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
          <div className="bg-white/5 backdrop-blur-sm border border-red-500/20 rounded-3xl p-8 max-w-lg w-full text-center">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>

            <h1 className="text-2xl font-display font-bold text-white mb-4">
              Something went wrong
            </h1>

            {error && (
              <div className="bg-black/30 rounded-xl p-4 mb-4 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-400 font-semibold text-sm">Error Details</span>
                  <button
                    onClick={this.handleCopyError}
                    className="text-gray-500 hover:text-white transition-colors p-1"
                    title="Copy error info"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-gray-300 text-xs font-mono overflow-auto max-h-24 break-all">
                  {error.message}
                </p>
                {errorId && (
                  <p className="text-gray-500 text-xs font-mono mt-2">
                    Error ID: {errorId}
                  </p>
                )}
                <p className="text-gray-600 text-xs mt-1">
                  {window.location.pathname} · {new Date().toLocaleString()}
                </p>
              </div>
            )}

            <p className="text-gray-400 text-sm mb-6">
              This error has been automatically reported.
              {errorId && ' Include the Error ID if you contact support.'}
            </p>

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
                <span>Return Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
