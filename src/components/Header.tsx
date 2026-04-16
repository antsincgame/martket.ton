import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Sparkles, Gem, LogIn, LogOut, Search } from 'lucide-react';
import { SignedIn, SignedOut, useAuthModal } from '../lib/clerkSafe';
import * as ClerkReact from '@clerk/clerk-react';
import { useSearch } from '../contexts/SearchContext';

interface HeaderProps {
  onLogoClick?: () => void;
}

function SignOutButton() {
  const { signOut } = ClerkReact.useClerk();
  return (
    <button
      onClick={() => { signOut().catch((err: unknown) => { console.error('Sign out failed:', err); }); }}
      className="p-2 text-[#999] hover:text-[#FF4444] transition-colors"
      title="Sign Out"
    >
      <LogOut className="w-5 h-5" />
    </button>
  );
}

const Header: React.FC<HeaderProps> = ({ onLogoClick }) => {
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const { query, setQuery } = useSearch();

  const handleSignIn = () => {
    if (window.innerWidth < 768) {
      navigate('/sign-in');
    } else {
      openAuthModal('sign-in');
    }
  };

  return (
    <header
      className="py-2 sm:py-3 px-3 sm:px-6 bg-black/55 backdrop-blur-xl sticky top-0 left-0 right-0 z-50 border-b border-white/10 w-full"
      style={{ willChange: 'transform' }}
    >
      <div className="container mx-auto flex items-center gap-2 sm:gap-4">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center space-x-2 flex-shrink-0 group"
          onClick={onLogoClick}
          aria-label="TON Web Store home"
        >
          <div className="relative">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-ton-gradient rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Gem className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-sparkle" />
            </div>
            <div className="absolute -top-1 -right-1 text-yellow-400 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="hidden sm:block">
            <h1 className="font-display font-bold text-xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              TON Web Store
            </h1>
            <p className="text-xs text-gray-400 font-medium">Digital Enlightenment</p>
          </div>
        </Link>

        {/* Search — always visible (sticky header guarantee) */}
        <div className="flex-1 min-w-0 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Search products"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              /**
               * iOS Safari зумит страницу при фокусе input если font-size < 16px.
               * Решение: на мобильных (<sm) принудительно 16px, на sm+ возвращаем text-sm (14px).
               * Визуально на мобилке поле чуть крупнее — но это плюс для тача и UX.
               */
              className="w-full pl-10 pr-4 py-2 bg-white/[0.06] border border-white/10 rounded-full text-[16px] sm:text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#FFD700]/30 focus:bg-white/[0.08] focus:shadow-[0_0_20px_rgba(255,215,0,0.15)] transition-all duration-300"
            />
          </div>
        </div>

        {/* Auth */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <SignedOut>
            <button
              onClick={handleSignIn}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] px-3 sm:px-4 py-2 rounded-full transition-all duration-300 text-white font-semibold text-sm"
              aria-label="Sign in"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          </SignedOut>

          <SignedIn>
            <Link
              to="/profile"
              className="flex items-center space-x-2 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 border border-[#FFD700]/30 px-3 sm:px-4 py-2 rounded-full transition-all duration-300"
              aria-label="Profile"
            >
              <User className="w-5 h-5 text-[#FFD700]" />
              <span className="hidden sm:inline text-[#FFD700] font-medium text-sm">Profile</span>
            </Link>
            <SignOutButton />
          </SignedIn>
        </div>
      </div>
    </header>
  );
};

export default Header;
