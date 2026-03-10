import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Eye, EyeOff, Sparkles } from 'lucide-react';

interface SecretAdminAccessProps {
  isVisible: boolean;
  onClose: () => void;
}

const sacredMantra = 'OMBENZASATOHUNG';

const SecretAdminAccess: React.FC<SecretAdminAccessProps> = ({ isVisible, onClose }) => {
  const [email, setEmail] = useState('graf.arlou@ya.ru');
  const [password, setPassword] = useState('Qw162162');
  const [mantra, setMantra] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const navigate = useNavigate();
  const { authenticateWithMantra } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const isMantraLogin = mantra.trim() === sacredMantra;
      
      if (isMantraLogin) {
        await authenticateWithMantra({ email: 'mantra@bodhisattva.path' });
        setMessage('🪷 Welcome, Bodhisattva! Sacred access granted. ✨');
        
        setTimeout(() => {
          onClose();
          navigate('/admin-dashboard');
        }, 1500);
      } else {
        // Fallback for email/password login if needed
        setMessage('❌ Invalid mantra. Only true Bodhisattvas may enter by mantra.');
      }
    } catch {
      setMessage('🔮 Connection to the mystical realm failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-purple-900/90 via-pink-900/90 to-orange-900/90 border-2 border-white/20 rounded-3xl p-8 max-w-md w-full relative overflow-hidden">
        {/* Sacred Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-4 text-6xl animate-pulse">🪷</div>
          <div className="absolute top-4 right-4 text-4xl animate-spin-slow">☸️</div>
          <div className="absolute bottom-4 left-4 text-4xl animate-bounce">🕉️</div>
          <div className="absolute bottom-4 right-4 text-6xl animate-pulse">✨</div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center mb-8 relative z-10">
          <div className="w-20 h-20 bg-mystical-gradient rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
            {/* SVG Камня Белой Тары */}
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-gem w-10 h-10 text-white animate-sparkle">
              <path d="M6 3h12l4 6-10 13L2 9Z"></path>
              <path d="M11 3 8 9l4 13 4-13-3-6"></path>
              <path d="M2 9h20"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">
            🪷 White Tara Admin Access
          </h2>
          <p className="text-purple-200 text-sm">
            Sacred realm for enlightened administration ☸️
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
          <div>
            <label className="block text-white font-semibold mb-2 flex items-center">
              <Mail className="w-4 h-4 mr-2 text-purple-300" />
              Sacred Email 📧
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your enlightened email..."
              className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-white font-semibold mb-2 flex items-center">
              <Shield className="w-4 h-4 mr-2 text-purple-300" />
              Sacred Password 🔐
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your mystical password..."
                className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-white font-semibold mb-2 flex items-center">
              <Sparkles className="w-4 h-4 mr-2 text-purple-300" />
              Sacred Mantra (optional)
            </label>
            <input
              type="text"
              value={mantra}
              onChange={(e) => setMantra(e.target.value)}
              placeholder="Введите сакральную мантру на тибетском..."
              className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {message && (
            <div className={`p-4 rounded-xl text-center font-medium ${
              message.includes('Welcome') 
                ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-mystical-gradient hover:scale-105 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-purple-500/50 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Connecting to Sacred Realm...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Enter Sacred Admin Realm 🪷</span>
              </>
            )}
          </button>
        </form>

        {/* Sacred Blessing */}
        <div className="text-center mt-6 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-white/10 relative z-10">
          <p className="text-purple-200 text-sm">
            🕉️ Om Tare Tu Tarre Svaha 🕉️
          </p>
          <p className="text-gray-300 text-xs mt-1">
            May this access bring wisdom and compassion to all beings ✨
          </p>
        </div>
      </div>
    </div>
  );
};

export default SecretAdminAccess;