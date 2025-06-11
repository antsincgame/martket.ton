import React, { useState } from 'react';
import { Wallet, Zap } from 'lucide-react';

const TONConnectButton = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState('0.00');

  const handleConnect = () => {
    // In a real implementation, this would use @tonconnect/ui-react
    setIsConnected(!isConnected);
    if (!isConnected) {
      setBalance('12.45');
    } else {
      setBalance('0.00');
    }
  };

  return (
    <button
      onClick={handleConnect}
      className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all duration-300 ${
        isConnected
          ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
          : 'bg-ton-gradient text-white hover:scale-105 shadow-lg hover:shadow-ton-500/25'
      }`}
    >
      <Wallet className="w-5 h-5" />
      {isConnected ? (
        <div className="flex items-center space-x-2">
          <span className="hidden sm:inline">{balance} TON</span>
          <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
        </div>
      ) : (
        <span className="hidden sm:inline">Connect Wallet</span>
      )}
    </button>
  );
};

export default TONConnectButton;