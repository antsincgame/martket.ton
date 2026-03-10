import React, { useState } from 'react';
import { Shield, Sparkles, Moon } from 'lucide-react';

interface AdminAccessProps {
  isVisible: boolean;
  onClose: () => void;
}

const SacredAdminAccess: React.FC<AdminAccessProps> = ({ isVisible }) => {
  const [mantra, setMantra] = useState('');
  const [email] = useState('');
  const [password] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const sacredMantra = 'OMBENZASATOHUNG';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      // Проверка по мантре (без email)
      if (mantra.trim() === sacredMantra) {
        setMessage('🪷 Welcome, Bodhisattva! Sacred access granted by mantra. ✨');
        setTimeout(() => {
          window.location.href = '/admin-dashboard';
        }, 2000);
        return;
      }
      // Обычная проверка email+пароль
      if (email === 'graf.arlou@ya.ru' && password === 'Qw162162') {
        setMessage('🪷 Welcome, White Tara Admin! Sacred access granted. ✨');
        setTimeout(() => {
          window.location.href = '/admin-dashboard';
        }, 2000);
      } else {
        setMessage('❌ Invalid credentials or mantra. Only true Bodhisattvas may enter.');
      }
    } catch {
      setMessage('🔮 Connection to the mystical realm failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 p-8 rounded-2xl border border-purple-500/20 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <Shield className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Сакральный Вход</h2>
          <p className="text-purple-200">Введите священную мантру для доступа</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <div className="relative">
              <Key className="w-5 h-5 text-purple-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={mantra}
                onChange={(e) => setMantra(e.target.value)}
                placeholder="Введите мантру..."
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-purple-500/20 rounded-xl text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {message && (
              <p className="mt-2 text-purple-200 text-sm">{message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-black transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                Аутентификация...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Moon className="w-5 h-5 mr-2" />
                Войти в Сакральную Панель
              </span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-purple-200 text-sm">
            🪷 Только те, кто знает истинную мантру, могут войти 🪷
          </p>
        </div>
      </div>
    </div>
  );
};

export default SacredAdminAccess; 