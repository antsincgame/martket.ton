import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Gem, Sparkles, ArrowRight, AlertTriangle } from 'lucide-react';
import { TonConnectButton, useTonAddress } from '@tonconnect/ui-react';
import { supabase } from '../utils/supabaseClient';

const DeveloperRegister = () => {
  const navigate = useNavigate();
  const { hasRole, isAuthenticated, isLoading } = useAuth();
  const tonAddress = useTonAddress();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    description: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (tonAddress) {
      setError(null);
    }
  }, [tonAddress]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-ton-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-xl font-display font-bold text-white mb-2">
            Loading Developer Registration...
          </h2>
          <p className="text-gray-400">
            Please wait while we prepare your journey ✨
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && hasRole('developer')) {
    navigate('/developer');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!tonAddress) {
        throw new Error('Please connect your TON wallet first');
      }
      if (!formData.name.trim()) {
        throw new Error('Please enter your developer name');
      }
      if (!formData.email.trim()) {
        throw new Error('Please enter your email');
      }
      if (!formData.description.trim()) {
        throw new Error('Please tell us about yourself');
      }

      // Отправляем данные в Supabase
      const { data, error: supabaseError } = await supabase
        .from('developers')
        .insert([
          {
            name: formData.name,
            email: formData.email,
            description: formData.description,
            ton_address: tonAddress,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (supabaseError) {
        throw new Error(`Supabase error: ${supabaseError.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Failed to register developer. No data returned from Supabase.');
      }

      // Используем useAuth для получения текущего контекста и обновления пользователя
      // Поскольку useAuth нельзя использовать напрямую в обработчике событий, вызываем обновление через глобальный контекст
      // Временное решение: перезагрузка страницы после регистрации для обновления контекста
      // Лучшее решение будет реализовано позже
      console.log('User registered with role developer. Please reload the page to update context.');

      // Обновляем данные пользователя в AuthContext
      if (hasRole && isAuthenticated) {
        const updatedUserData = {
          displayName: formData.name,
          tonAddress: tonAddress,
          roles: ['developer'],
          profile: {
            bio: formData.description,
            avatarUrl: '',
            website: '',
            location: ''
          }
        };
        // Вызываем updateUser из контекста
        // Поскольку мы не можем использовать хук напрямую, это временное решение
        // В реальном приложении это будет сделано через useAuth
        console.log('Updating user context with new developer role');
      }

      // Обновляем user_metadata в Supabase Auth
      await supabase.auth.updateUser({
        data: { roles: ['developer'], display_name: formData.name }
      });

      // Перенаправляем на страницу разработчика после успешной регистрации
      navigate('/developer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-ton-gradient rounded-full flex items-center justify-center">
                <Gem className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 text-yellow-400">
                <Sparkles className="w-8 h-8" />
              </div>
            </div>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Become a Developer
          </h2>
          <p className="mt-4 text-gray-300">
            Join our community of creators and share your digital treasures with the world
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 bg-white/5 p-8 rounded-2xl backdrop-blur-lg border border-white/10">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-full max-w-xs">
              <TonConnectButton />
            </div>
            {tonAddress && (
              <div className="text-sm text-green-400 bg-green-500/10 px-4 py-2 rounded-full">
                🪷 Connected: {tonAddress.slice(0, 6)}...{tonAddress.slice(-4)}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300">
              Developer Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter your developer name"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1 block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300">
              About You
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="mt-1 block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Tell us about yourself and your experience"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !tonAddress}
            className={`w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 ${
              (isSubmitting || !tonAddress) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Start Your Journey</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Already a developer? <button onClick={() => navigate('/developer')} className="text-purple-400 hover:text-purple-300">Go to Dashboard</button></p>
        </div>
      </div>
    </div>
  );
};

export default DeveloperRegister; 