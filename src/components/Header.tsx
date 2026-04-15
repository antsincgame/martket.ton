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
      onClick={() => { signOut().catch(() => {}); }}
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
    <header className="py-3 px-6 bg-black/40 backdrop-blur-xl sticky top-0 z-50 border-b border-white/10">
      <div className="container mx-auto flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 flex-shrink-0" onClick={onLogoClick}>
          <div className="relative">
            <div className="w-10 h-10 bg-ton-gradient rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Gem className="w-6 h-6 text-white animate-sparkle" />
            </div>
            <div className="absolute -top-1 -right-1 text-yellow-400 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="hidden sm:block">
            <h1 className="font-display font-bold text-xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              TON Web Store
            </h1>
            <p className="text-xs text-gray-400 font-medium">Digital Enlightenment</p>
          </div>
        </Link>

        {/* Search — always visible */}
        <div className="flex-1 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, developer, or tag..."
              className="w-full pl-10 pr-4 py-2 bg-white/[0.06] border border-white/10 rounded-full text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#FFD700]/30 focus:bg-white/[0.08] focus:shadow-[0_0_20px_rgba(255,215,0,0.15)] transition-all duration-300"
            />
          </div>
        </div>

        {/* Auth */}
        <div className="flex items-center space-x-3 flex-shrink-0">
          <SignedOut>
            <button
              onClick={handleSignIn}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] px-4 py-2 rounded-full transition-all duration-300 text-white font-semibold text-sm"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          </SignedOut>

          <SignedIn>
            <Link
              to="/profile"
              className="flex items-center space-x-2 bg-[#FFD700]/10 hover:bg-[#FFD700]/20 border border-[#FFD700]/30 px-4 py-2 rounded-full transition-all duration-300"
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
