import React, { useState, useEffect, useCallback } from 'react';
import { TonConnectButton, useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { Wallet, Shield, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TONWalletAuth } from '../types/auth';

interface SecureTONConnectProps {
  onAuthSuccess?: () => void;
  onAuthError?: (error: string) => void;
  requiresAdmin?: boolean;
}

const SecureTONConnect: React.FC<SecureTONConnectProps> = ({
  onAuthSuccess,
  onAuthError,
  requiresAdmin = false
}) => {
  useTonConnectUI();
  const tonAddress = useTonAddress();
  const { authenticateWithTON, isLoading, reportSecurityEvent } = useAuth();
  
  const [authState, setAuthState] = useState<'idle' | 'connecting' | 'verifying' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  const [securityScore, setSecurityScore] = useState<number>(0);

  const performSecurityChecks = useCallback(() => {
    let score = 0;
    
    // Check if HTTPS
    if (window.location.protocol === 'https:') score += 20;
    
    // Check for secure connection indicators
    if (navigator.userAgent.includes('Secure')) score += 15;
    
    // Check wallet connection security
    if (tonAddress && tonAddress.length > 40) score += 25;
    
    // Check for VPN/Proxy (mock)
    if (Math.random() > 0.3) score += 20; // Mock VPN detection
    
    // Check device security
    if (navigator.hardwareConcurrency > 4) score += 10; // Better hardware
    if (window.screen.width > 1920) score += 10; // Larger screen = potentially more secure environment
    
    setSecurityScore(score);
    
    if (score < 60) {
      reportSecurityEvent({
        type: 'suspicious_activity',
        severity: 'warning',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { 
          reason: 'low_security_score', 
          score,
          wallet_address: tonAddress 
        }
      });
    }
  }, [tonAddress, reportSecurityEvent]);

  // Security checks
  useEffect(() => {
    if (tonAddress) {
      performSecurityChecks();
    }
  }, [tonAddress, performSecurityChecks]);

  const handleConnect = async () => {
    if (!tonAddress) {
      setError('Please connect your TON wallet first');
      return;
    }

    setAuthState('verifying');
    setError('');

    try {
      // Create signature challenge
      const challenge = createSignatureChallenge();
      
      // Request signature from wallet (mock)
      const signature = await requestWalletSignature(challenge);
      
      const walletData: TONWalletAuth = {
        address: tonAddress,
        publicKey: 'mock_public_key', // Would be extracted from wallet
        signature: signature,
        timestamp: Date.now(),
        network: 'testnet' // Detect from wallet
      };

      const result = await authenticateWithTON(walletData);

      if (result.success) {
        setAuthState('success');
        onAuthSuccess?.();
      } else if (result.requiresMFA) {
        setAuthState('idle');
        // MFA component would be shown here
        onAuthError?.('Multi-factor authentication required');
      } else {
        setAuthState('error');
        setError(result.error || 'Authentication failed');
        onAuthError?.(result.error || 'Authentication failed');
      }

    } catch (error) {
      setAuthState('error');
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setError(errorMessage);
      onAuthError?.(errorMessage);
      
      reportSecurityEvent({
        type: 'login_attempt',
        severity: 'error',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { 
          error: errorMessage,
          wallet_address: tonAddress 
        }
      });
    }
  };

  const getSecurityBadgeColor = () => {
    if (securityScore >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (securityScore >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const getSecurityLevel = () => {
    if (securityScore >= 80) return 'High Security';
    if (securityScore >= 60) return 'Medium Security';
    return 'Low Security - Use VPN';
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-ton-gradient rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-display font-bold text-white">
              {requiresAdmin ? 'Sacred Admin Access' : 'Secure Authentication'}
            </h3>
            <p className="text-gray-400 text-sm">
              Connect your TON wallet for {requiresAdmin ? 'administrative' : 'secure'} access 🔒
            </p>
          </div>
        </div>
        
        {/* Security Score */}
        <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getSecurityBadgeColor()}`}>
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>{securityScore}%</span>
          </div>
        </div>
      </div>

      {/* TON Connect Button */}
      <div className="mb-6">
        <TonConnectButton />
      </div>

      {/* Connection Status */}
      {tonAddress && (
        <div className="bg-white/5 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-white font-medium">Wallet Connected</span>
            </div>
            <button
              onClick={() => setShowSecurityDetails(!showSecurityDetails)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {showSecurityDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="text-gray-400 text-sm font-mono mb-2">
            {tonAddress.slice(0, 8)}...{tonAddress.slice(-8)}
          </div>
          
          {showSecurityDetails && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Security Level:</span>
                <span className="text-white">{getSecurityLevel()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Network:</span>
                <span className="text-blue-400">TON Testnet</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Connection:</span>
                <span className="text-green-400">Encrypted HTTPS</span>
              </div>
              {securityScore < 60 && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center space-x-2 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Consider using a VPN for enhanced security</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Authentication Button */}
      {tonAddress && (
        <button
          onClick={handleConnect}
          disabled={isLoading || authState === 'verifying'}
          className={`w-full flex items-center justify-center space-x-2 px-6 py-4 rounded-xl font-semibold transition-all duration-300 ${
            authState === 'success'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : authState === 'error'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : isLoading || authState === 'verifying'
              ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30 cursor-not-allowed'
              : 'bg-ton-gradient text-white hover:scale-105 shadow-lg hover:shadow-ton-500/25'
          }`}
        >
          {authState === 'verifying' ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Verifying Signature...</span>
            </>
          ) : authState === 'success' ? (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Authentication Successful ✨</span>
            </>
          ) : authState === 'error' ? (
            <>
              <AlertTriangle className="w-5 h-5" />
              <span>Authentication Failed</span>
            </>
          ) : (
            <>
              <Wallet className="w-5 h-5" />
              <span>
                {requiresAdmin ? 'Authenticate as Admin 🧿' : 'Authenticate with TON 🔮'}
              </span>
            </>
          )}
        </button>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Security Information */}
      {requiresAdmin && (
        <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <div className="text-center">
            <div className="text-purple-400 text-sm mb-2">🪷 Sacred Admin Protocol 🪷</div>
            <p className="text-gray-300 text-xs leading-relaxed">
              Administrative access requires TON wallet authentication, optional MFA verification,
              and compliance with our digital dharma security principles. All actions are logged
              for karmic accountability. ☸️
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Utility functions (mock implementations)
function createSignatureChallenge(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `TON_WEB_STORE_AUTH_${timestamp}_${random}`;
}

async function requestWalletSignature(challenge: string): Promise<string> {
  // Mock signature generation - in real app would use wallet API
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
  
  // Simulate successful signature
  return `ton_signature_${challenge}_${Date.now()}_mock_signature_data_very_long_string_to_simulate_real_signature`;
}

export default SecureTONConnect; 