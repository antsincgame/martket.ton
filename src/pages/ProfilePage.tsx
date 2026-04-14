import { useState, useCallback } from 'react';
import { Download, Heart, Settings, Wallet, Gift, Trophy, Gem, Users, TrendingUp, Upload, Shield, Star } from 'lucide-react';
import { TonConnectButton, useTonAddress } from '@tonconnect/ui-react';
import { useAuth } from '../contexts/AuthContext';
import { storeApiUrl } from '../lib/storeApi';
import TonConnectWrapper from '../components/TonConnectWrapper';

const WalletSection = () => {
  const tonAddress = useTonAddress();
  const { user, fetchProfile, getToken } = useAuth();
  const [linkStatus, setLinkStatus] = useState<'idle' | 'linking' | 'success' | 'error'>('idle');
  const [linkError, setLinkError] = useState<string | null>(null);

  const linkedAddress = user?.tonAddress;

  const handleLinkWallet = useCallback(async () => {
    if (!tonAddress) return;
    setLinkStatus('linking');
    setLinkError(null);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/session/profile'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ton_address: tonAddress }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Link failed' }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      setLinkStatus('success');
      await fetchProfile();
    } catch (err: unknown) {
      setLinkStatus('error');
      setLinkError(err instanceof Error ? err.message : 'Failed to link wallet');
    }
  }, [tonAddress, getToken, fetchProfile]);

  const handleUnlinkWallet = useCallback(async () => {
    setLinkStatus('linking');
    setLinkError(null);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/session/profile'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ton_address: null }),
      });
      if (!res.ok) throw new Error('Unlink failed');
      setLinkStatus('idle');
      await fetchProfile();
    } catch (err: unknown) {
      setLinkStatus('error');
      setLinkError(err instanceof Error ? err.message : 'Failed to unlink wallet');
    }
  }, [getToken, fetchProfile]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
        <Wallet className="w-6 h-6 mr-3 text-ton-400" />
        TON Wallet
      </h3>

      {linkedAddress ? (
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <p className="text-green-400 text-sm font-medium mb-1">Linked Wallet</p>
            <p className="text-white font-mono text-sm break-all">{linkedAddress}</p>
          </div>
          <div className="flex gap-3">
            <TonConnectButton />
            <button
              onClick={handleUnlinkWallet}
              disabled={linkStatus === 'linking'}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              Unlink
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Connect your TON wallet to enable crypto payments and receive earnings.
          </p>
          <TonConnectButton />
          {tonAddress && tonAddress !== linkedAddress && (
            <button
              onClick={handleLinkWallet}
              disabled={linkStatus === 'linking'}
              className="w-full bg-ton-gradient hover:scale-105 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg disabled:opacity-50"
            >
              {linkStatus === 'linking' ? 'Linking...' : `Link ${tonAddress.slice(0, 6)}...${tonAddress.slice(-4)}`}
            </button>
          )}
        </div>
      )}

      {linkStatus === 'success' && (
        <p className="mt-3 text-green-400 text-sm">Wallet linked successfully!</p>
      )}
      {linkError && (
        <p className="mt-3 text-red-400 text-sm">{linkError}</p>
      )}
    </div>
  );
};

const ProfilePage = () => {
  const { user, hasRole, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const getAvailableTabs = () => {
    const baseTabs = [
      { id: 'overview', label: 'Overview', icon: TrendingUp },
      { id: 'wallet', label: 'TON Wallet', icon: Wallet },
      { id: 'library', label: 'Library', icon: Download },
      { id: 'achievements', label: 'Achievements', icon: Trophy },
      { id: 'donations', label: 'Donations', icon: Gift },
    ];

    if (hasRole('developer')) {
      baseTabs.splice(2, 0, { id: 'products', label: 'My Products', icon: Gem });
      baseTabs.splice(3, 0, { id: 'upload', label: 'Upload New', icon: Upload });
    }

    if (hasRole('admin')) {
      baseTabs.push({ id: 'security', label: 'Security Center', icon: Shield });
    }

    return baseTabs;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = 'https://via.placeholder.com/300x200?text=Image';
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-ton-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-display font-bold text-white mb-2">Loading Profile...</h2>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-ton-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Settings className="w-10 h-10 text-ton-400" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-4">Profile Awaits</h1>
          <p className="text-gray-300 mb-6">
            Sign in to access your profile and manage your account.
          </p>
          <a
            href="/sign-in"
            className="block w-full bg-ton-gradient hover:scale-105 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg text-center"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  const displayName = user.profile?.displayName || user.username || 'User';
  const avatarEmoji = user.profile?.avatar || '👤';
  const userStats = user.stats;
  const roleLabels = user.roles.map(role => role.name.replace('_', ' ')).join(', ');

  return (
    <TonConnectWrapper>
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Profile Header */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-8">
            <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-ton-500 flex items-center justify-center text-4xl">
                  {avatarEmoji}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-mystical-gradient rounded-full p-2">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
              </div>

              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-display font-bold text-white mb-2">{displayName}</h1>
                <p className="text-purple-400 font-medium mb-1">{roleLabels}</p>
                <p className="text-gray-400 mb-4">{user.email || ''}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-ton-400 mb-1">{userStats?.totalSpent ?? 0}</div>
                    <div className="text-gray-400 text-sm">TON Spent</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-purple-400 mb-1">{userStats?.totalDonated ?? 0}</div>
                    <div className="text-gray-400 text-sm">TON Donated</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-400 mb-1">{userStats?.karmaPoints ?? 0}</div>
                    <div className="text-gray-400 text-sm">Karma Points</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-400 mb-1">{userStats?.appsOwned ?? 0}</div>
                    <div className="text-gray-400 text-sm">Apps Owned</div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button className="bg-ton-gradient hover:scale-105 text-white font-semibold px-6 py-3 rounded-full transition-all duration-300 shadow-lg hover:shadow-ton-500/50 flex items-center justify-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>Edit Profile</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-2 mb-8">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 overflow-x-auto">
              {getAvailableTabs().map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
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
                  Overview
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hasRole('developer') && (
                    <>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                            <Gem className="w-6 h-6 text-blue-400" />
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-white mb-1">{userStats?.productsPublished ?? 0}</div>
                        <div className="text-gray-400 text-sm">Products Published</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                            <Download className="w-6 h-6 text-green-400" />
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-white mb-1">{userStats?.totalDownloads ?? 0}</div>
                        <div className="text-gray-400 text-sm">Total Downloads</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center">
                            <Heart className="w-6 h-6 text-pink-400" />
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-white mb-1">{userStats?.donationsReceived ?? 0} TON</div>
                        <div className="text-gray-400 text-sm">Donations Received</div>
                      </div>
                    </>
                  )}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                        <Star className="w-6 h-6 text-yellow-400" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">{userStats?.avgRating ?? 0}</div>
                    <div className="text-gray-400 text-sm">Average Rating</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-indigo-400" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">{userStats?.totalReviews ?? 0}</div>
                    <div className="text-gray-400 text-sm">Total Reviews</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'wallet' && <WalletSection />}

            {activeTab === 'library' && (
              <div>
                <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                  <Download className="w-6 h-6 mr-3 text-ton-400" />
                  Library
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {user.library && user.library.length > 0 ? user.library.map((item) => (
                    <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all">
                      <img src={item.image} alt={item.name} className="w-full h-32 object-cover rounded-lg mb-4" onError={handleImageError} />
                      <h3 className="font-semibold text-white mb-1">{item.name}</h3>
                      <p className="text-purple-400 text-sm mb-2">by {item.developer}</p>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Purchased: {item.purchaseDate}</span>
                        <span className="text-ton-400 font-semibold">{item.price} TON</span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-400 col-span-full text-center">Your library is empty. Explore the store to find products.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'products' && hasRole('developer') && (
              <div>
                <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                  <Gem className="w-6 h-6 mr-3 text-blue-400" />
                  My Products
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {user.products && user.products.length > 0 ? user.products.map((product) => (
                    <div key={product.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all">
                      <img src={product.image} alt={product.name} className="w-full h-32 object-cover rounded-lg mb-4" onError={handleImageError} />
                      <h3 className="font-semibold text-white mb-1">{product.name}</h3>
                      <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-gray-400">{product.downloads} downloads</span>
                        <span className="text-yellow-400">{product.rating}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-ton-400 font-semibold">{product.price} TON</span>
                        <button className="bg-ton-gradient hover:scale-105 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-1">
                          <Settings className="w-4 h-4" />
                          <span>Manage</span>
                        </button>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-400 col-span-full text-center">You have not published any products yet.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'achievements' && (
              <div>
                <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                  <Trophy className="w-6 h-6 mr-3 text-yellow-400" />
                  Achievements
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {user.achievements && user.achievements.length > 0 ? user.achievements.map((achievement, index) => (
                    <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
                      <div className="flex items-center space-x-4">
                        <div className="text-4xl">{achievement.icon}</div>
                        <div>
                          <h3 className="font-semibold text-white mb-1">{achievement.name}</h3>
                          <p className="text-gray-400 text-sm">{achievement.description}</p>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-400 col-span-full text-center">No achievements unlocked yet.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'donations' && (
              <div>
                <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                  <Gift className="w-6 h-6 mr-3 text-green-400" />
                  Donations
                </h2>
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Heart className="w-10 h-10 text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Support Developers</h3>
                  <p className="text-gray-400 max-w-md mx-auto mb-6">
                    Your donations help developers create more amazing products.
                  </p>
                  <button className="bg-sacred-gradient hover:scale-105 text-white font-semibold px-8 py-4 rounded-full transition-all duration-300 shadow-lg">
                    Make a Donation
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
                        <input type="text" className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ton-500" placeholder="Enter your product name..." />
                      </div>
                      <div>
                        <label className="block text-white font-medium mb-2">Description</label>
                        <textarea className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ton-500 h-32" placeholder="Describe your product..." />
                      </div>
                      <div>
                        <label className="block text-white font-medium mb-2">Price (TON)</label>
                        <input type="number" className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ton-500" placeholder="0.00" step="0.01" />
                      </div>
                      <div>
                        <label className="block text-white font-medium mb-2">Product Image</label>
                        <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-400">Drag and drop your image here, or click to browse</p>
                        </div>
                      </div>
                      <button className="w-full bg-ton-gradient hover:scale-105 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 shadow-lg">
                        Upload Product
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
                  Security Center
                </h2>
                <p className="text-gray-400">Security monitoring is available in the Admin Dashboard.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </TonConnectWrapper>
  );
};

export default ProfilePage;
