import React from 'react';
import { Sparkles } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = "Loading Sacred Realm..." 
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ton-900 to-cosmic-900 flex items-center justify-center">
      <div className="text-center">
        {/* Sacred Loading Animation */}
        <div className="relative mb-8">
          <div className="w-20 h-20 border-4 border-purple-500/30 rounded-full animate-spin">
            <div className="absolute top-2 left-2 w-16 h-16 border-4 border-t-purple-400 border-r-pink-400 border-b-orange-400 border-l-blue-400 rounded-full animate-spin-reverse"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
          </div>
        </div>

        {/* Loading Text */}
        <h2 className="text-2xl font-display font-bold text-white mb-4 animate-pulse">
          {message}
        </h2>

        {/* Sacred Dots */}
        <div className="flex justify-center space-x-2">
          <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 h-3 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>

        {/* Sacred Blessing */}
        <p className="text-purple-200 text-sm mt-6 animate-pulse">
          🪷 Om Tare Tu Tarre Svaha 🪷
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen; 