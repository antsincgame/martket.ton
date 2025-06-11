import React from 'react';
import { Link } from 'react-router-dom';
import { Gem, Heart, Star, Sparkles } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-black/40 backdrop-blur-xl border-t border-white/10 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-ton-gradient rounded-xl flex items-center justify-center">
                <Gem className="w-6 h-6 text-white animate-sparkle" />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  TON Web Store
                </h3>
                <p className="text-sm text-gray-400">☸️ Digital Enlightenment Marketplace</p>
              </div>
            </div>
            <p className="text-gray-400 mb-4 max-w-md">
              Decentralized marketplace for digital goods built on TON blockchain. 
              Supporting developers through fair monetization and charitable donations. 🪷
            </p>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1 text-yellow-400">
                <Heart className="w-4 h-4" />
                <span className="text-sm">Made with compassion</span>
              </div>
              <div className="flex items-center space-x-1 text-purple-400">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm">Blessed by Tara</span>
              </div>
            </div>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="font-semibold text-white mb-4 flex items-center">
              <Star className="w-4 h-4 mr-2 text-yellow-400" />
              Marketplace
            </h4>
            <div className="space-y-2">
              <Link to="/category/apps" className="block text-gray-400 hover:text-white transition-colors">
                Apps 🚀
              </Link>
              <Link to="/category/games" className="block text-gray-400 hover:text-white transition-colors">
                Games 🎮
              </Link>
              <Link to="/category/ai" className="block text-gray-400 hover:text-white transition-colors">
                AI Services 🤖
              </Link>
              <Link to="/developer" className="block text-gray-400 hover:text-white transition-colors">
                Developer Hub 🪄
              </Link>
            </div>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-white mb-4 flex items-center">
              🕉️ Support
            </h4>
            <div className="space-y-2">
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">
                Help Center 📿
              </a>
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">
                Community 🌟
              </a>
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">
                Documentation 📜
              </a>
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">
                TON Integration 💎
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="text-gray-400 text-sm mb-4 md:mb-0">
            © 2025 TON Web Store. Built with ❤️‍🔥 for the decentralized future. ☯️
          </div>
          <div className="flex items-center space-x-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">TON Network ⚡</a>
          </div>
        </div>

        {/* Sacred Blessing */}
        <div className="text-center mt-8 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-white/10">
          <p className="text-purple-300 text-sm font-medium mb-2">
            🪷 Sacred Dedication 🪷
          </p>
          <p className="text-gray-400 text-sm">
            Om Tare Tu Tarre Svaha - May this marketplace bring prosperity to all beings 
            and support the growth of consciousness through technology. ✨🌟🚀
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;