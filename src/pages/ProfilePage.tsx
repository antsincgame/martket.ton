import React, { useState, useEffect } from 'react';
import { Download, Heart, Settings, Wallet, Gift, Trophy, Zap, Gem, Users, TrendingUp, Upload, Shield, Star, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
// import { CSSTransition, TransitionGroup } from 'react-transition-group';

interface Stats {
  totalSpent: number;
  totalDonated: number;
  karmaPoints: number;
  appsOwned: number;
  productsPublished: number;
  totalDownloads: number;
  donationsReceived: number;
  avgRating: number;
  totalReviews: number;
}

interface Product {
  id: number;
  name: string;
  downloads: number;
  rating: number;
  price: number;
  image: string;
}

interface LibraryItem {
  id: number;
  name: string;
  developer: string;
  purchaseDate: string;
  price: number;
  image: string;
}

interface Achievement {
  icon: string;
  name: string;
  description: string;
}

const ProfilePage = () => {
  const { user, hasRole, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Просто устанавливаем загрузку в false после монтирования
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Кэширование и мемоизация данных
  const getCachedData = (key: string, fallback: any) => {
    try {
      const cached = localStorage.getItem(key);
      if (cached) return JSON.parse(cached);
    } catch {}
    return fallback;
  };
  const setCachedData = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  const stats: Stats = getCachedData('profile_stats', {
    totalSpent: 156.8,
    totalDonated: 45.2,
    karmaPoints: 1250,
    appsOwned: 12,
    productsPublished: 5,
    totalDownloads: 1250,
    donationsReceived: 89.5,
    avgRating: 4.8,
    totalReviews: 156
  });

  const library: LibraryItem[] = React.useMemo(() => getCachedData('profile_library', [
    {
      id: 1,
      name: 'Cosmic Code Editor Pro',
      developer: 'Sacred Devs',
      purchaseDate: '2025-01-10',
      price: 15.5,
      image: 'https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=300'
    },
    {
      id: 2,
      name: 'Meditation Game: Inner Peace',
      developer: 'Zen Studios',
      purchaseDate: '2025-01-08',
      price: 8.2,
      image: 'https://images.pexels.com/photos/3408744/pexels-photo-3408744.jpeg?auto=compress&cs=tinysrgb&w=300'
    }
  ]), []);

  const products: Product[] = React.useMemo(() => getCachedData('profile_products', [
    {
      id: 1,
      name: 'Sacred Task Manager',
      downloads: 450,
      rating: 4.9,
      price: 12.5,
      image: 'https://images.pexels.com/photos/5077047/pexels-photo-5077047.jpeg?auto=compress&cs=tinysrgb&w=300'
    },
    {
      id: 2,
      name: 'Mindful Notes',
      downloads: 320,
      rating: 4.7,
      price: 8.0,
      image: 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=300'
    }
  ]), []);

  const achievements: Achievement[] = React.useMemo(() => getCachedData('profile_achievements', [
    { icon: '🎯', name: 'First Purchase', description: 'Made your first sacred transaction' },
    { icon: '❤️', name: 'Generous Heart', description: 'Donated to support developers' },
    { icon: '⭐', name: 'Wisdom Seeker', description: 'Left 10 helpful reviews' },
    { icon: '🏆', name: 'Enlightened Patron', description: 'Supported 5 different developers' }
  ]), []);

  // Сохраняем данные в кэш при изменении
  React.useEffect(() => {
    setCachedData('profile_stats', stats);
    setCachedData('profile_library', library);
    setCachedData('profile_products', products);
    setCachedData('profile_achievements', achievements);
  }, [stats, library, products, achievements]);

  const getAvailableTabs = () => {
    const baseTabs = [
      { id: 'overview', label: 'Overview', icon: TrendingUp },
      { id: 'library', label: 'Sacred Library', icon: Download },
      { id: 'achievements', label: 'Achievements', icon: Trophy },
      { id: 'donations', label: 'Donations', icon: Gift }
    ];

    if (hasRole('developer')) {
      baseTabs.splice(1, 0, { id: 'products', label: 'My Products', icon: Gem });
      baseTabs.splice(2, 0, { id: 'upload', label: 'Upload New', icon: Upload });
    }

    if (hasRole('admin')) {
      baseTabs.push({ id: 'security', label: 'Security Center', icon: Shield });
    }

    return baseTabs;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = 'https://via.placeholder.com/300x200?text=Sacred+Image';
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-sm border border-red-500/20 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-4">
            🚫 Sacred Error
          </h1>
          <p className="text-gray-300 mb-6">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-ton-gradient hover:scale-105 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg"
          >
            Try Again 🔄
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-ton-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-xl font-display font-bold text-white mb-2">
            Loading Sacred Profile...
          </h2>
          <p className="text-gray-400">
            Please wait while we gather your divine data ✨
          </p>
        </div>
      </div>
    );
  }

  // Показываем сообщение для неаутентифицированных пользователей
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-ton-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Settings className="w-10 h-10 text-ton-400" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-4">
            🪷 Sacred Profile Awaits
          </h1>
          <p className="text-gray-300 mb-6">
            Connect your TON wallet to access your enlightened profile and begin your digital journey.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-ton-gradient hover:scale-105 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg"
          >
            Connect Wallet & Begin 🔮
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-ton-500 flex items-center justify-center text-4xl">
                {user?.profile.avatar || '👤'}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-mystical-gradient rounded-full p-2">
                <Trophy className="w-6 h-6 text-white" />
              </div>
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-display font-bold text-white mb-2">
                {user?.profile.displayName || 'Enlightened User'} ✨
              </h1>
              <p className="text-purple-400 font-medium mb-1">
                {user?.roles.map(role => role.name.replace('_', ' ')).join(', ')} Level
              </p>
              <p className="text-gray-400 mb-4">{user?.email || 'user@tonwebstore.com'}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-ton-400 mb-1">{stats.totalSpent}</div>
                  <div className="text-gray-400 text-sm">TON Spent 💎</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400 mb-1">{stats.totalDonated}</div>
                  <div className="text-gray-400 text-sm">TON Donated ❤️</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400 mb-1">{stats.karmaPoints}</div>
                  <div className="text-gray-400 text-sm">Karma Points ☸️</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 mb-1">{stats.appsOwned}</div>
                  <div className="text-gray-400 text-sm">Apps Owned 🚀</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button className="bg-ton-gradient hover:scale-105 text-white font-semibold px-6 py-3 rounded-full transition-all duration-300 shadow-lg hover:shadow-ton-500/50 flex items-center justify-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>Edit Profile</span>
                </button>
                <button className="bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-full transition-all duration-300 border border-white/20 flex items-center justify-center space-x-2">
                  <Wallet className="w-5 h-5" />
                  <span>Manage Wallet</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-2 mb-8">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            {getAvailableTabs().map((tab) => (
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
                Sacred Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hasRole('developer') && (
                  <>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                          <Gem className="w-6 h-6 text-blue-400" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">{stats.productsPublished}</div>
                      <div className="text-gray-400 text-sm">Products Published 🚀</div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                          <Download className="w-6 h-6 text-green-400" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-green-400" />
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">{stats.totalDownloads}</div>
                      <div className="text-gray-400 text-sm">Total Downloads 📥</div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center">
                          <Heart className="w-6 h-6 text-pink-400" />
                        </div>
                        <TrendingUp className="w-5 h-5 text-pink-400" />
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">{stats.donationsReceived} TON</div>
                      <div className="text-gray-400 text-sm">Donations Received ❤️</div>
                    </div>
                  </>
                )}

                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                      <Star className="w-6 h-6 text-yellow-400" />
                    </div>
                    <span className="text-yellow-400 text-sm font-medium">Excellent</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{stats.avgRating}</div>
                  <div className="text-gray-400 text-sm">Average Rating ⭐</div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
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
            </div>
          )}

          {activeTab === 'library' && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <Download className="w-6 h-6 mr-3 text-ton-400" />
                Sacred Library
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {library.map((item) => (
                  <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-32 object-cover rounded-lg mb-4"
                      onError={handleImageError}
                    />
                    <h3 className="font-semibold text-white mb-1">{item.name}</h3>
                    <p className="text-purple-400 text-sm mb-2">by {item.developer}</p>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Purchased: {item.purchaseDate}</span>
                      <span className="text-ton-400 font-semibold">{item.price} TON</span>
                    </div>
                    <button className="w-full mt-3 bg-white/10 hover:bg-white/20 text-white font-medium py-2 rounded-lg transition-colors">
                      Download 📥
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'products' && hasRole('developer') && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <Gem className="w-6 h-6 mr-3 text-blue-400" />
                My Sacred Products
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <div key={product.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-32 object-cover rounded-lg mb-4"
                      onError={handleImageError}
                    />
                    <h3 className="font-semibold text-white mb-1">{product.name}</h3>
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-gray-400">{product.downloads} downloads</span>
                      <span className="text-yellow-400">⭐ {product.rating}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ton-400 font-semibold">{product.price} TON</span>
                      <button className="bg-ton-gradient hover:scale-105 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-1">
                        <Settings className="w-4 h-4" />
                        <span>Manage</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <Trophy className="w-6 h-6 mr-3 text-yellow-400" />
                Sacred Achievements
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {achievements.map((achievement, index) => (
                  <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
                    <div className="flex items-center space-x-4">
                      <div className="text-4xl">{achievement.icon}</div>
                      <div>
                        <h3 className="font-semibold text-white mb-1">{achievement.name}</h3>
                        <p className="text-gray-400 text-sm">{achievement.description}</p>
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
                <Gift className="w-6 h-6 mr-3 text-green-400" />
                Sacred Donations
              </h2>
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Spread the Love ✨</h3>
                <p className="text-gray-400 max-w-md mx-auto mb-6">
                  Your donations help developers create more amazing products and support the growth of our sacred community.
                </p>
                <button className="bg-sacred-gradient hover:scale-105 text-white font-semibold px-8 py-4 rounded-full transition-all duration-300 shadow-lg">
                  Make a Donation 🪷
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upload' && hasRole('developer') && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <Upload className="w-6 h-6 mr-3 text-purple-400" />
                Upload New Product
              </h2>
              <div className="max-w-2xl mx-auto">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-white font-medium mb-2">Product Name</label>
                      <input
                        type="text"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ton-500"
                        placeholder="Enter your product name..."
                      />
                    </div>
                    <div>
                      <label className="block text-white font-medium mb-2">Description</label>
                      <textarea
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ton-500 h-32"
                        placeholder="Describe your product..."
                      />
                    </div>
                    <div>
                      <label className="block text-white font-medium mb-2">Price (TON)</label>
                      <input
                        type="number"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ton-500"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-white font-medium mb-2">Product Image</label>
                      <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-400">Drag and drop your image here, or click to browse</p>
                      </div>
                    </div>
                    <button className="w-full bg-ton-gradient hover:scale-105 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 shadow-lg">
                      Upload Product 🚀
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && hasRole('admin') && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <Shield className="w-6 h-6 mr-3 text-red-400" />
                Security Command Center
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-white mb-4">Security Alerts</h3>
                  <div className="space-y-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                      <div className="flex items-center space-x-2 text-red-400 mb-2">
                        <Shield className="w-5 h-5" />
                        <span className="font-semibold">High Risk Activity Detected</span>
                      </div>
                      <p className="text-gray-300 text-sm">Multiple failed login attempts from IP: 192.168.1.100</p>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                      <div className="flex items-center space-x-2 text-yellow-400 mb-2">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-semibold">Suspicious Transaction</span>
                      </div>
                      <p className="text-gray-300 text-sm">Large TON transfer detected from user: 0x1234...</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-white mb-4">System Status</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Server Load</span>
                      <span className="text-green-400">Normal</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Database Status</span>
                      <span className="text-green-400">Healthy</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Security Level</span>
                      <span className="text-blue-400">High</span>
                    </div>
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

export default ProfilePage;