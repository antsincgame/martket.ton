import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, 'accepted'); } catch { /* noop */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4">
      <div className="max-w-4xl mx-auto bg-gray-900/95 backdrop-blur-lg border border-white/10 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-2xl">
        <div className="flex-1 text-sm text-gray-300">
          We use essential cookies for authentication and localStorage for preferences.
          No third-party tracking. See our{' '}
          <Link to="/privacy" className="text-blue-400 hover:text-blue-300 underline">
            Privacy Policy
          </Link>.
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={accept}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Accept
          </button>
          <button
            onClick={accept}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
