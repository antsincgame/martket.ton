import React, { useState, useEffect, useRef } from 'react';
import { Shield, Smartphone, Key, Mail, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { MFAMethod } from '../types/auth';
import QRCode from 'qrcode.react';

interface MFAVerificationProps {
  methods: MFAMethod[];
  onSuccess: () => void;
  onCancel: () => void;
  isVisible: boolean;
}

const MFAVerification: React.FC<MFAVerificationProps> = ({
  methods,
  onSuccess,
  onCancel,
  isVisible
}) => {
  const { verifyMFA, reportSecurityEvent } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<MFAMethod | null>(null);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [showQR] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  // Timer countdown
  useEffect(() => {
    if (!isVisible) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          reportSecurityEvent({
            type: 'login_attempt',
            severity: 'warning',
            ipAddress: 'client_ip',
            userAgent: navigator.userAgent,
            details: { reason: 'mfa_timeout' }
          });
          onCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, onCancel, reportSecurityEvent]);

  // Auto-select first available method
  useEffect(() => {
    if (methods.length > 0 && !selectedMethod) {
      setSelectedMethod(methods[0]);
    }
  }, [methods, selectedMethod]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCodeChange = (value: string, index: number) => {
    if (lockoutUntil && Date.now() < lockoutUntil) {
      setError(`Too many failed attempts. Please wait ${Math.ceil((lockoutUntil - Date.now()) / 1000 / 60)} minutes.`);
      return;
    }

    const newCode = code.split('');
    newCode[index] = value;
    const updatedCode = newCode.join('');
    
    setCode(updatedCode);
    
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    if (updatedCode.length === 6) {
      handleVerify(updatedCode);
    }
  };

  const handleVerify = async (verificationCode?: string) => {
    if (!selectedMethod) return;

    if (lockoutUntil && Date.now() < lockoutUntil) {
      setError(`Too many failed attempts. Please wait ${Math.ceil((lockoutUntil - Date.now()) / 1000 / 60)} minutes.`);
      return;
    }

    const codeToVerify = verificationCode || code;
    if (codeToVerify.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const success = await verifyMFA(selectedMethod.id, codeToVerify);
      
      if (success) {
        setAttempts(0);
        reportSecurityEvent({
          type: 'login_attempt',
          severity: 'info',
          ipAddress: 'client_ip',
          userAgent: navigator.userAgent,
          details: { 
            method: 'mfa_success',
            mfa_type: selectedMethod.type 
          }
        });
        onSuccess();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= MAX_ATTEMPTS) {
          const lockoutTime = Date.now() + LOCKOUT_DURATION;
          setLockoutUntil(lockoutTime);
          setError(`Too many failed attempts. Please wait ${LOCKOUT_DURATION / 1000 / 60} minutes.`);
        
        reportSecurityEvent({
          type: 'login_attempt',
          severity: 'warning',
          ipAddress: 'client_ip',
          userAgent: navigator.userAgent,
          details: { 
              method: 'mfa_brute_force_detected',
              mfa_type: selectedMethod.type,
              attempts: newAttempts
          }
        });
        } else {
          setError('Invalid code. Please try again.');
        }
        
        setCode('');
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Verification failed. Please try again.');
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const getMethodIcon = (type: MFAMethod['type']) => {
    switch (type) {
      case 'totp': return <Smartphone className="w-5 h-5" />;
      case 'webauthn': return <Key className="w-5 h-5" />;
      case 'sms': return <Smartphone className="w-5 h-5" />;
      case 'email': return <Mail className="w-5 h-5" />;
      case 'biometric': return <Shield className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  const getMethodDescription = (method: MFAMethod) => {
    switch (method.type) {
      case 'totp': return 'Enter the 6-digit code from your authenticator app';
      case 'webauthn': return 'Use your security key or biometric authentication';
      case 'sms': return 'Enter the code sent to your phone';
      case 'email': return 'Enter the code sent to your email';
      case 'biometric': return 'Use your fingerprint or face recognition';
      default: return 'Complete the verification process';
    }
  };

  const generateBackupCodes = () => {
    // Mock backup codes generation
    const codes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substring(2, 8).toUpperCase()
    );
    setBackupCodes(codes);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-white/20 rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-ton-gradient rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">
            Multi-Factor Authentication 🔐
          </h2>
          <p className="text-gray-400 text-sm">
            An additional layer of protection for your sacred admin access
          </p>
        </div>

        {/* Timer */}
        <div className="flex items-center justify-center space-x-2 mb-6 p-3 bg-white/5 rounded-xl">
          <Clock className="w-5 h-5 text-yellow-400" />
          <span className="text-white font-mono text-lg">{formatTime(timeLeft)}</span>
          <span className="text-gray-400 text-sm">remaining</span>
        </div>

        {/* Method Selection */}
        {methods.length > 1 && (
          <div className="mb-6">
            <label className="block text-white font-semibold mb-3">Choose verification method:</label>
            <div className="space-y-2">
              {methods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${
                    selectedMethod?.id === method.id
                      ? 'bg-ton-gradient text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {getMethodIcon(method.type)}
                  <span className="font-medium">{method.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedMethod && (
          <>
            {/* Method Description */}
            <div className="mb-6 p-4 bg-white/5 rounded-xl">
              <div className="flex items-center space-x-2 mb-2">
                {getMethodIcon(selectedMethod.type)}
                <span className="text-white font-medium">{selectedMethod.name}</span>
              </div>
              <p className="text-gray-400 text-sm">
                {getMethodDescription(selectedMethod)}
              </p>
            </div>

            {/* TOTP/Code Input */}
            {(selectedMethod.type === 'totp' || selectedMethod.type === 'sms' || selectedMethod.type === 'email') && (
              <div className="mb-6">
                <label className="block text-white font-semibold mb-3">
                  Enter verification code:
                </label>
                <div className="flex space-x-2 justify-center">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      maxLength={1}
                      value={code[index] || ''}
                      onChange={(e) => handleCodeChange(e.target.value, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className="w-12 h-12 text-center text-xl font-bold bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-ton-500 focus:border-ton-500"
                      disabled={isVerifying}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* QR Code for TOTP setup (if needed) */}
            {selectedMethod.type === 'totp' && showQR && (
              <div className="mb-6 text-center">
                <div className="bg-white p-4 rounded-xl inline-block mb-4">
                  <QRCode 
                    value={`otpauth://totp/TON%20Web%20Store:admin?secret=JBSWY3DPEHPK3PXP&issuer=TON%20Web%20Store`}
                    size={150}
                  />
                </div>
                <p className="text-gray-400 text-sm">
                  Scan this QR code with your authenticator app
                </p>
              </div>
            )}

            {/* WebAuthn */}
            {selectedMethod.type === 'webauthn' && (
              <div className="mb-6 text-center">
                <button
                  onClick={() => handleVerify('webauthn')}
                  disabled={isVerifying}
                  className="bg-mystical-gradient hover:scale-105 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 shadow-lg"
                >
                  {isVerifying ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    'Use Security Key 🔑'
                  )}
                </button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex items-center space-x-2 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}

            {/* Verify Button (for non-auto verification) */}
            {selectedMethod.type !== 'webauthn' && code.length < 6 && (
              <button
                onClick={() => handleVerify()}
                disabled={isVerifying || code.length < 6}
                className={`w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  isVerifying || code.length < 6
                    ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                    : 'bg-ton-gradient text-white hover:scale-105 shadow-lg'
                }`}
              >
                {isVerifying ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Verify Code</span>
                  </>
                )}
              </button>
            )}
          </>
        )}

        {/* Backup Options */}
        <div className="mt-6 space-y-3">
          <button
            onClick={generateBackupCodes}
            className="w-full text-center text-gray-400 hover:text-white text-sm transition-colors"
          >
            Generate backup codes
          </button>
          
          <button
            onClick={onCancel}
            className="w-full text-center text-gray-400 hover:text-white text-sm transition-colors"
          >
            Cancel and use different method
          </button>
        </div>

        {/* Backup Codes Display */}
        {backupCodes.length > 0 && (
          <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <h4 className="text-yellow-400 font-semibold mb-2">🔑 Backup Codes</h4>
            <p className="text-gray-300 text-sm mb-3">
              Save these codes securely. Each can only be used once.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {backupCodes.map((code, index) => (
                <div key={index} className="bg-white/5 p-2 rounded text-center text-white">
                  {code}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sacred Footer */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-xs">
            🪷 Protected by digital dharma • All attempts logged for karma ☸️
          </p>
        </div>
      </div>
    </div>
  );
};

export default MFAVerification; 