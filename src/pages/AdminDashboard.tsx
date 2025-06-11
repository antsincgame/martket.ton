import React, { useState } from 'react';
import { Crown, Users, Package, DollarSign, TrendingUp, Shield, Mail, Settings, Heart, Star } from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const stats = {
    totalUsers: 12547,
    totalProducts: 3150,
    totalRevenue: 89234.5,
    totalDonations: 15678.2,
    pendingReviews: 23,
    activeReports: 7
  };

  const recentActivity = [
    { type: 'user', action: 'New user registration', user: 'enlightened_dev@zen.com', time: '2 minutes ago' },
    { type: 'product', action: 'Product uploaded', product: 'Sacred Code Editor v2.1', time: '15 minutes ago' },
    { type: 'donation', action: 'Donation received', amount: '25.5 TON', time: '1 hour ago' },
    { type: 'report', action: 'Product reported', product: 'Suspicious App', time: '2 hours ago' }
  ];

  return (
    <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2 flex items-center">
              <Crown className="w-8 h-8 mr-3 text-yellow-400 animate-sparkle" />
              🪷 White Tara Admin Dashboard
            </h1>
            <p className="text-purple-200">Sacred administration realm for TON Web Store ☸️</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Last login</div>
            <div className="text-white font-medium">{new Date().toLocaleString()}</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.totalUsers.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">Total Users 👥</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.totalProducts.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">Total Products 📦</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.totalRevenue.toLocaleString()} TON</div>
            <div className="text-gray-400 text-sm">Total Revenue 💰</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6 text-pink-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.totalDonations.toLocaleString()} TON</div>
            <div className="text-gray-400 text-sm">Total Donations ❤️</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <Star className="w-6 h-6 text-yellow-400" />
              </div>
              <span className="text-yellow-400 text-sm font-medium">Pending</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.pendingReviews}</div>
            <div className="text-gray-400 text-sm">Pending Reviews ⭐</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-red-400" />
              </div>
              <span className="text-red-400 text-sm font-medium">Active</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.activeReports}</div>
            <div className="text-gray-400 text-sm">Active Reports 🚨</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-2 mb-8">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'products', label: 'Products', icon: Package },
              { id: 'reports', label: 'Reports', icon: Shield },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-mystical-gradient text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
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
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">Recent Activity 📊</h3>
                  <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                      <div key={index} className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-white font-medium">{activity.action}</div>
                            <div className="text-gray-400 text-sm">
                              {activity.user || activity.product || activity.amount}
                            </div>
                          </div>
                          <div className="text-gray-500 text-xs">{activity.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-white mb-4">System Health 🔮</h3>
                  <div className="space-y-4">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-white">Server Status</span>
                        <span className="text-green-400 font-medium">🟢 Healthy</span>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-white">TON Network</span>
                        <span className="text-green-400 font-medium">🟢 Connected</span>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-white">Database</span>
                        <span className="text-green-400 font-medium">🟢 Optimal</span>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-white">Email Service</span>
                        <span className="text-green-400 font-medium">🟢 Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <Settings className="w-6 h-6 mr-3 text-purple-400" />
                Sacred Settings
              </h2>
              
              <div className="space-y-6">
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <Mail className="w-5 h-5 mr-2 text-blue-400" />
                    SMTP Configuration 📧
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-300 text-sm mb-2">SMTP Server</label>
                      <input 
                        type="text" 
                        value="mail.gandi.net" 
                        readOnly
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-2">Port</label>
                      <input 
                        type="text" 
                        value="587 (STARTTLS)" 
                        readOnly
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-2">Email</label>
                      <input 
                        type="email" 
                        value="dzmitry.arlou@grodno.ai" 
                        readOnly
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-2">Security</label>
                      <input 
                        type="text" 
                        value="TLS/SSL Enabled ✅" 
                        readOnly
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-6 border border-white/10">
                  <h3 className="text-xl font-semibold text-white mb-4">🪷 Sacred Blessing</h3>
                  <p className="text-purple-200 mb-4">
                    Om Tare Tu Tarre Svaha - May this admin panel bring wisdom and compassion 
                    to the management of our digital marketplace. May all beings benefit from 
                    the technology we oversee. ✨
                  </p>
                  <div className="text-center">
                    <div className="text-4xl mb-2">🕉️</div>
                    <p className="text-gray-300 text-sm">
                      Blessed by White Tara for the prosperity of all sentient beings
                    </p>
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

export default AdminDashboard;