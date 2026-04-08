import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Eye, EyeOff, Sparkles } from 'lucide-react';

interface SecretAdminAccessProps {
  isVisible: boolean;
  onClose: () => void;
}

const SecretAdminAccess: React.FC<SecretAdminAccessProps> = ({ isVisible, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setMessage('Введите email и пароль');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const result = await login({ email, password });
      if (result.success) {
        setMessage('Авторизация успешна.');
        setTimeout(() => {
          onClose();
          navigate('/admin-dashboard');
        }, 1500);
      } else {
        setMessage(result.error || 'Ошибка авторизации');
      }
    } catch {
      setMessage('Ошибка подключения. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-purple-900/90 via-pink-900/90 to-orange-900/90 border-2 border-white/20 rounded-3xl p-8 max-w-md w-full relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
        >
          ✕
        </button>

        <div className="text-center mb-8 relative z-10">
          <div className="w-20 h-20 bg-mystical-gradient rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">
            Admin Access
          </h2>
          <p className="text-purple-200 text-sm">
            Вход для администраторов
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
          <div>
            <label className="block text-white font-semibold mb-2 flex items-center">
              <Mail className="w-4 h-4 mr-2 text-purple-300" />
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-white font-semibold mb-2 flex items-center">
              <Shield className="w-4 h-4 mr-2 text-purple-300" />
              Пароль
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
                required
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

          {message && (
            <div className={`p-4 rounded-xl text-center font-medium ${
              message.includes('успешна')
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
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Подключение...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Войти</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SecretAdminAccess;
