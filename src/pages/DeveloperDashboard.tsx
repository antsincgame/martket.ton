import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, DollarSign, Users, Heart, Star, Upload, Sparkles, Gem } from 'lucide-react';
import DeveloperRegisterModal from '../components/DeveloperRegisterModal';
import { useAuth } from '../contexts/AuthContext';
import { TONWalletAuth } from '../types/auth';

// Мок-структура приложения
interface AppSummary {
  id: string;
  name: string;
  revenue: number;
  downloads: number;
  rating: number;
  reviews: number;
  status: string;
}

// Мок-данные приложений
const initialApps: AppSummary[] = [
  {
    id: 'app-1',
    name: 'Cosmic Code Editor Pro',
    revenue: 186.0,
    downloads: 12500,
    rating: 4.9,
    reviews: 42,
    status: 'Active'
  },
  {
    id: 'app-2',
    name: 'Sacred Terminal',
    revenue: 42.3,
    downloads: 2100,
    rating: 4.6,
    reviews: 18,
    status: 'Active'
  }
];

const DeveloperDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [apps] = useState<AppSummary[]>(initialApps);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [developer, setDeveloper] = useState<{ wallet: string; email: string; name: string } | null>(null);
  const { authenticateWithTON, user, hasRole } = useAuth();

  const stats = {
    totalRevenue: 245.8,
    totalDownloads: 15420,
    totalProducts: 4,
    donationsReceived: 67.3,
    avgRating: 4.7,
    totalReviews: 342
  };

  // Открывать модалку автоматически, если пользователь не разработчик
  useEffect(() => {
    if (!hasRole('developer')) {
      setIsRegisterOpen(true);
    }
  }, [hasRole]);

  async function handleRegister(data: { wallet: string; email: string; name: string }) {
    setDeveloper(data);
    
    // Мок-данные TONWalletAuth для автоматической авторизации
    const walletAuth: TONWalletAuth = {
      address: data.wallet,
      publicKey: 'mock_public_key',
      signature: 'mock_signature_data_very_long_string_to_simulate_real_signature',
      timestamp: Date.now(),
      network: 'testnet'
    };
    
    try {
      await authenticateWithTON(walletAuth);
    } catch (error) {
      console.log('Auto-authentication after registration failed:', error);
    }
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2 flex items-center">
              <Sparkles className="w-8 h-8 mr-3 text-purple-400" />
              Developer Dashboard
            </h1>
            <p className="text-gray-400">Manage your digital treasures and sacred offerings 🪄</p>
          </div>
          {!developer && (
            <button
              className="mt-4 md:mt-0 bg-ton-gradient hover:scale-105 text-white font-semibold px-6 py-3 rounded-full transition-all duration-300 shadow-lg hover:shadow-ton-500/50 flex items-center space-x-2"
              onClick={() => setIsRegisterOpen(true)}
            >
            <Plus className="w-5 h-5" />
              <span>Стать разработчиком</span>
          </button>
          )}
        </div>
        <DeveloperRegisterModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          onRegister={handleRegister}
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.totalRevenue} TON</div>
            <div className="text-gray-400 text-sm">Total Revenue 💰</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.totalDownloads.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">Total Downloads 📈</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Gem className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-purple-400 text-sm font-medium">Active</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.totalProducts}</div>
            <div className="text-gray-400 text-sm">Active Products 🚀</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6 text-pink-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-pink-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.donationsReceived} TON</div>
            <div className="text-gray-400 text-sm">Donations Received ❤️</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <Star className="w-6 h-6 text-yellow-400" />
              </div>
              <span className="text-yellow-400 text-sm font-medium">Excellent</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.avgRating}</div>
            <div className="text-gray-400 text-sm">Average Rating ⭐</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              <span className="text-indigo-400 text-sm font-medium">Growing</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.totalReviews}</div>
            <div className="text-gray-400 text-sm">Total Reviews 💬</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-2 mb-8">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'products', label: 'Products', icon: Gem },
              { id: 'donations', label: 'Donations', icon: Heart },
              { id: 'upload', label: 'Upload New', icon: Upload }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-ton-gradient text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <TrendingUp className="w-6 h-6 mr-3 text-ton-400" />
                Revenue Overview
              </h2>
              <div className="bg-white/5 rounded-xl p-6 mb-6">
                <div className="text-center">
                  <div className="text-4xl font-display font-bold text-ton-400 mb-2">
                    {stats.totalRevenue} TON
                  </div>
                  <p className="text-gray-400 mb-4">Total Earnings This Month</p>
                  <div className="text-green-400 font-medium">
                    +12.5% from last month 📈
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 rounded-xl p-6">
                  <h3 className="font-semibold text-white mb-4">Top Performing Products</h3>
                  <div className="space-y-3">
                    {apps.slice(0, 3).map((app, index) => (
                      <div key={app.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            index === 0 ? 'bg-gold' : index === 1 ? 'bg-silver' : 'bg-bronze'
                          }`}>
                            {index + 1}
                          </div>
                          <span className="text-white">{app.name}</span>
                        </div>
                        <span className="text-ton-400 font-semibold">{app.revenue} TON</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-6">
                  <h3 className="font-semibold text-white mb-4">Sacred Donation Ranking</h3>
                  <div className="space-y-3">
                    {apps.sort((a, b) => b.revenue - a.revenue).slice(0, 3).map((app, index) => (
                      <div key={app.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="text-2xl">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                          </div>
                          <span className="text-white">{app.name}</span>
                        </div>
                        <span className="text-pink-400 font-semibold">{app.revenue} TON ❤️</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <Gem className="w-6 h-6 mr-3 text-purple-400" />
                Your Sacred Products
              </h2>
              <div className="space-y-4">
                {apps.map((app) => (
                  <div key={app.id} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-semibold text-white">{app.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            app.status === 'Active' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {app.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Revenue:</span>
                            <div className="text-green-400 font-semibold">{app.revenue} TON</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Downloads:</span>
                            <div className="text-blue-400 font-semibold">{app.downloads.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Rating:</span>
                            <div className="text-yellow-400 font-semibold">{app.rating} ⭐</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Reviews:</span>
                            <div className="text-pink-400 font-semibold">{app.reviews}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors">
                          Edit
                        </button>
                        <button className="bg-ton-gradient hover:scale-105 text-white px-4 py-2 rounded-lg transition-all">
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'donations' && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <Heart className="w-6 h-6 mr-3 text-pink-400" />
                Sacred Donation System
              </h2>
              
              <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 rounded-2xl p-8 mb-8 border border-white/10">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">Boost Your Product Ranking 🚀</h3>
                  <p className="text-gray-300 max-w-2xl mx-auto">
                    Make a donation to elevate your product in our mystical marketplace. 
                    Products with higher donations receive sacred blessings and better visibility.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white/10 rounded-xl p-6 text-center">
                    <div className="text-3xl mb-3">🥉</div>
                    <div className="text-yellow-400 font-bold text-xl mb-2">1-10 TON</div>
                    <div className="text-gray-300">Bronze Blessing</div>
                    <div className="text-sm text-gray-400 mt-2">+20% visibility boost</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-6 text-center border-2 border-purple-500/50">
                    <div className="text-3xl mb-3">🥈</div>
                    <div className="text-purple-400 font-bold text-xl mb-2">11-25 TON</div>
                    <div className="text-gray-300">Silver Enlightenment</div>
                    <div className="text-sm text-gray-400 mt-2">+50% visibility boost</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-6 text-center">
                    <div className="text-3xl mb-3">🥇</div>
                    <div className="text-pink-400 font-bold text-xl mb-2">25+ TON</div>
                    <div className="text-gray-300">Golden Nirvana</div>
                    <div className="text-sm text-gray-400 mt-2">+100% visibility boost</div>
                  </div>
                </div>

                <div className="text-center">
                  <button className="bg-sacred-gradient hover:scale-105 text-white font-semibold px-8 py-4 rounded-full transition-all duration-300 shadow-lg">
                    Make Sacred Donation 🪷
                  </button>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-6">
                <h3 className="font-semibold text-white mb-4">Your Donation History</h3>
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Heart className="w-8 h-8 text-pink-400" />
                  </div>
                  <p className="text-gray-400">
                    No donations yet. Start blessing your products to increase their sacred ranking! ✨
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <Upload className="w-6 h-6 mr-3 text-blue-400" />
                Upload New Sacred Product
              </h2>
              
              <div className="max-w-2xl mx-auto">
                <div className="space-y-6">
                  <div>
                    <label className="block text-white font-semibold mb-2">Product Name ✨</label>
                    <input
                      type="text"
                      placeholder="Enter your product's sacred name..."
                      className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ton-500"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">Category 🚀</label>
                    <select className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-ton-500">
                      <option value="">Select a category...</option>
                      <option value="apps">Apps</option>
                      <option value="games">Games</option>
                      <option value="ai">AI Services</option>
                      <option value="tools">Developer Tools</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">Price (TON) 💎</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ton-500"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">Description 📝</label>
                    <textarea
                      rows={4}
                      placeholder="Describe your sacred creation..."
                      className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ton-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-semibold mb-2">Upload Files 📎</label>
                    <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-white/40 transition-colors">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400 mb-2">Drag and drop your files here, or click to browse</p>
                      <p className="text-gray-500 text-sm">Supported formats: .zip, .dmg, .exe, .deb</p>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button className="w-full bg-ton-gradient hover:scale-105 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-ton-500/50">
                      Submit for Sacred Review 🪷
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeveloperDashboard;