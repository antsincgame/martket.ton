import React, { useState, useEffect, useCallback } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { Wallet, Zap, Shield, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const TONConnectButton = () => {
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();
  const { user, isAuthenticated, reportSecurityEvent } = useAuth();
  
  const [balance, setBalance] = useState('0.00');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      // Mock balance fetch - in real app would query TON API
      const mockBalance = (Math.random() * 100).toFixed(2);
      setBalance(mockBalance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      setBalance('0.00');
      reportSecurityEvent({
        type: 'balance_fetch_error',
        severity: 'warning',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }, [reportSecurityEvent]);

  // Define reportConnectionEvent before using it
  const reportConnectionEvent = useCallback(() => {
    reportSecurityEvent({
      type: 'login_attempt',
      severity: 'info',
      details: { 
        method: 'ton_wallet_connect',
        address: tonAddress,
        timestamp: Date.now()
      }
    });
  }, [reportSecurityEvent, tonAddress]);

  // Simulate balance fetching when address changes
  useEffect(() => {
    if (tonAddress) {
      fetchBalance();
      reportConnectionEvent();
    } else {
      setBalance('0.00');
    }
  }, [tonAddress, reportConnectionEvent, fetchBalance]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setConnectionError('');
    try {
      await tonConnectUI.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await tonConnectUI.openModal();
      setRetryCount(0);
    } catch (error) {
      setConnectionError('Failed to reconnect. Please try again later.');
      reportSecurityEvent({
        type: 'ton_connect_retry_failed',
        severity: 'error',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount
        }
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
          details: { 
            method: 'ton_wallet_disconnect',
            address: tonAddress
          }
        });
      } catch (error) {
        setConnectionError('Failed to disconnect wallet');
        reportSecurityEvent({
          type: 'ton_connect_disconnect_error',
          severity: 'error',
          details: { 
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
      return;
    }

    if (retryCount >= 3) {
      setConnectionError('Too many connection attempts. Please try again later.');
      reportSecurityEvent({
        type: 'ton_connect_max_retries',
        severity: 'warning',
        details: { retryCount }
      });
      return;
    }

    setIsConnecting(true);
    setConnectionError('');

    try {
      await tonConnectUI.openModal();
    } catch (error) {
      setConnectionError('Failed to connect wallet');
      setRetryCount(prev => prev + 1);
      reportSecurityEvent({
        type: 'login_attempt',
        severity: 'error',
        details: { 
          method: 'ton_wallet_connect_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount
        }
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const getConnectionStatus = () => {
    if (isAuthenticated && user) {
      return { 
        status: 'authenticated', 
        color: 'bg-green-500/20 text-green-400 border-green-500/30',
        icon: CheckCircle 
      };
    }
    if (tonAddress) {
      return { 
        status: 'connected', 
        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        icon: Shield 
      };
    }
    return { 
      status: 'disconnected', 
      color: 'bg-ton-gradient text-white hover:scale-105 shadow-lg hover:shadow-ton-500/25',
      icon: Wallet 
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
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
        ) : (
          <StatusIcon className="w-5 h-5" />
        )}
        
        {tonAddress ? (
          <div className="flex items-center space-x-2">
            <span className="hidden sm:inline font-mono text-sm">
              {formatAddress(tonAddress)}
            </span>
            {balance !== '0.00' && (
              <>
                <span className="hidden md:inline">•</span>
                <span className="hidden md:inline text-sm">{balance} TON</span>
              </>
            )}
            {isAuthenticated && <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />}
          </div>
        ) : (
          <span className="hidden sm:inline">
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </span>
        )}
      </button>

      {/* Connection Status Indicator */}
      {tonAddress && (
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${
              isAuthenticated ? 'bg-green-400 animate-pulse' : 'bg-blue-400'
            }`}></div>
            <span className="text-gray-400">
              {isAuthenticated ? 'Authenticated' : 'Connected'}
            </span>
          </div>
        </div>
      )}

      {/* Error Display with Retry */}
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
              <span>Retry Connection</span>
            </button>
          )}
        </div>
      )}

      {/* Admin Access Hint */}
      {tonAddress && !isAuthenticated && (
        <div className="text-center">
          <p className="text-gray-400 text-xs">
            For admin access, use the sacred gem ✨
          </p>
        </div>
      )}
    </div>
  );
};

export default TONConnectButton;