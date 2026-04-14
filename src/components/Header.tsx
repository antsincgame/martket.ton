import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, User, Menu, X, Sparkles, Gem, LogIn, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, useAuthModal, CLERK_CONFIGURED } from '../lib/clerkSafe';
import * as ClerkReact from '@clerk/clerk-react';

interface HeaderProps {
  onLogoClick?: () => void;
}

function SignOutButton() {
  const { signOut } = ClerkReact.useClerk();
  return (
    <button
      onClick={() => signOut({ redirectUrl: '/' })}
      className="p-2 text-[#999] hover:text-[#FF4444] transition-colors"
      title="Sign Out"
    >
      <LogOut className="w-5 h-5" />
    </button>
  );
}

const Header: React.FC<HeaderProps> = ({ onLogoClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { openAuthModal } = useAuthModal();
  const navigate = useNavigate();

  const handleSignIn = () => {
    if (window.innerWidth < 768) {
      navigate('/sign-in');
    } else {
      openAuthModal('sign-in');
    }
  };

  return (
    <header className="py-4 px-6 bg-black/30 backdrop-blur-md sticky top-0 z-50 border-b border-white/10">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center space-x-2" onClick={onLogoClick}>
          <div className="relative">
            <div className="w-10 h-10 bg-ton-gradient rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Gem className="w-6 h-6 text-white animate-sparkle" />
            </div>
            <div className="absolute -top-1 -right-1 text-yellow-400 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h1 className="font-display font-bold text-xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              TON Web Store
            </h1>
            <p className="text-xs text-gray-400 font-medium">Digital Marketplace</p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link to="/category/apps" className="text-gray-300 hover:text-white transition-colors">
            Apps
          </Link>
          <Link to="/category/games" className="text-gray-300 hover:text-white transition-colors">
            Games
          </Link>
          <Link to="/category/ai" className="text-gray-300 hover:text-white transition-colors">
            AI Services
          </Link>
        </nav>

        {/* Search Bar */}
        <div className="hidden lg:flex items-center flex-1 max-w-lg mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ton-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center space-x-4">
          {/* Mobile Search */}
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="lg:hidden p-2 text-gray-300 hover:text-white transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Auth */}
          <SignedOut>
            <button
              onClick={handleSignIn}
              className="flex items-center space-x-2 bg-[#FFD700] hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] px-4 py-2 rounded-full transition-all duration-300 text-[#0A0A0A] font-semibold text-sm"
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

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-gray-300 hover:text-white transition-colors"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {isSearchOpen && (
        <div className="lg:hidden py-4 border-t border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ton-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden py-4 border-t border-white/10">
          <nav className="flex flex-col space-y-3">
            <Link to="/category/apps" className="text-gray-300 hover:text-white transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
              Apps
            </Link>
            <Link to="/category/games" className="text-gray-300 hover:text-white transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
              Games
            </Link>
            <Link to="/category/ai" className="text-gray-300 hover:text-white transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
              AI Services
            </Link>
            <SignedIn>
              <Link to="/profile" className="text-[#FFD700] hover:text-[#FFE066] transition-colors py-2 font-medium" onClick={() => setIsMenuOpen(false)}>
                Profile
              </Link>
            </SignedIn>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
