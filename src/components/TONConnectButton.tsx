import { useState, useEffect, useCallback, type FC } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { Wallet, Zap, Shield, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TONConnectButtonProps {
  onConnect?: (address: string) => void;
}

const TONConnectButton: FC<TONConnectButtonProps> = ({ onConnect }) => {
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();
  const { user, isAuthenticated, reportSecurityEvent } = useAuth();

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const networkContext = useCallback(() => ({
    ipAddress: 'client',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  }), []);

  useEffect(() => {
    if (tonAddress) {
      onConnect?.(tonAddress);
      reportSecurityEvent({
        type: 'login_attempt',
        severity: 'info',
        ...networkContext(),
        details: { method: 'ton_wallet_connect', address: tonAddress },
      });
    }
  }, [tonAddress, onConnect, reportSecurityEvent, networkContext]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setConnectionError('');
    try {
      await tonConnectUI.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await tonConnectUI.openModal();
      setRetryCount(0);
    } catch (error) {
      setConnectionError('Не удалось переподключиться. Попробуйте позже.');
      reportSecurityEvent({
        type: 'ton_connect_retry_failed',
        severity: 'error',
        ...networkContext(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount,
        },
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleConnect = async () => {
    if (tonAddress) {
      try {
        await tonConnectUI.disconnect();
        reportSecurityEvent({
          type: 'login_attempt',
          severity: 'info',
          ...networkContext(),
          details: { method: 'ton_wallet_disconnect', address: tonAddress },
        });
      } catch (error) {
        setConnectionError('Не удалось отключить кошелёк');
        reportSecurityEvent({
          type: 'ton_connect_disconnect_error',
          severity: 'error',
          ...networkContext(),
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }
      return;
    }

    if (retryCount >= 3) {
      setConnectionError('Слишком много попыток. Попробуйте позже.');
      reportSecurityEvent({
        type: 'ton_connect_max_retries',
        severity: 'warning',
        ...networkContext(),
        details: { retryCount },
      });
      return;
    }

    setIsConnecting(true);
    setConnectionError('');

    try {
      await tonConnectUI.openModal();
    } catch (error) {
      setConnectionError('Не удалось подключить кошелёк');
      setRetryCount(prev => prev + 1);
      reportSecurityEvent({
        type: 'login_attempt',
        severity: 'error',
        ...networkContext(),
        details: {
          method: 'ton_wallet_connect_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount,
        },
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const formatAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-6)}`;

  const getConnectionStatus = () => {
    if (isAuthenticated && user) {
      return {
        status: 'authenticated' as const,
        color: 'bg-green-500/20 text-green-400 border-green-500/30',
        icon: CheckCircle,
      };
    }
    if (tonAddress) {
      return {
        status: 'connected' as const,
        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        icon: Shield,
      };
    }
    return {
      status: 'disconnected' as const,
      color: 'bg-ton-gradient text-white hover:scale-105 shadow-lg hover:shadow-ton-500/25',
      icon: Wallet,
    };
  };

  const connectionStatus = getConnectionStatus();
  const StatusIcon = connectionStatus.icon;

  return (
    <div className="flex flex-col space-y-2">
      <button
        onClick={handleConnect}
        disabled={isConnecting || isRetrying}
        className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all duration-300 ${connectionStatus.color} ${
          (isConnecting || isRetrying) ? 'opacity-75 cursor-not-allowed' : ''
        }`}
      >
        {isConnecting || isRetrying ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
        ) : (
          <StatusIcon className="w-5 h-5" />
        )}

        {tonAddress ? (
          <div className="flex items-center space-x-2">
            <span className="hidden sm:inline font-mono text-sm">
              {formatAddress(tonAddress)}
            </span>
            {isAuthenticated && <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />}
          </div>
        ) : (
          <span className="hidden sm:inline">
            {isConnecting ? 'Подключение...' : 'Connect Wallet'}
          </span>
        )}
      </button>

      {tonAddress && (
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${
              isAuthenticated ? 'bg-green-400 animate-pulse' : 'bg-blue-400'
            }`} />
            <span className="text-gray-400">
              {isAuthenticated ? 'Authenticated' : 'Connected'}
            </span>
          </div>
        </div>
      )}

      {connectionError && (
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center space-x-1 text-red-400 text-xs">
            <AlertTriangle className="w-3 h-3" />
            <span>{connectionError}</span>
          </div>
          {retryCount > 0 && retryCount < 3 && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TONConnectButton;
