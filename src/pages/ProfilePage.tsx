import React, { useState } from 'react';
import { User, Download, Heart, Star, Settings, Wallet, Gift, Trophy, Zap } from 'lucide-react';

const ProfilePage = () => {
  const [activeTab, setActiveTab] = useState('library');

  const user = {
    name: 'Enlightened Developer',
    email: 'sage@enlightened.dev',
    avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=200',
    joinDate: '2024-03-15',
    totalSpent: 156.8,
    totalDonated: 45.2,
    karmaPoints: 1250,
    level: 'Bodhisattva'
  };

  const library = [
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
    },
    {
      id: 3,
      name: 'AI Wisdom Oracle',
      developer: 'Dharma AI',
      purchaseDate: '2025-01-05',
      price: 22.0,
      image: 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=300'
    }
  ];

  const wishlist = [
    {
      id: 4,
      name: 'Quantum Task Manager',
      developer: 'Mindful Apps',
      price: 5.9,
      image: 'https://images.pexels.com/photos/5077047/pexels-photo-5077047.jpeg?auto=compress&cs=tinysrgb&w=300'
    }
  ];

  const achievements = [
    { icon: '🎯', name: 'First Purchase', description: 'Made your first sacred transaction' },
    { icon: '❤️', name: 'Generous Heart', description: 'Donated to support developers' },
    { icon: '⭐', name: 'Wisdom Seeker', description: 'Left 10 helpful reviews' },
    { icon: '🏆', name: 'Enlightened Patron', description: 'Supported 5 different developers' }
  ];

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
            <div className="relative">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-32 h-32 rounded-full border-4 border-ton-500"
              />
              <div className="absolute -bottom-2 -right-2 bg-mystical-gradient rounded-full p-2">
                <Trophy className="w-6 h-6 text-white" />
              </div>
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-display font-bold text-white mb-2">
                {user.name} ✨
              </h1>
              <p className="text-purple-400 font-medium mb-1">{user.level} Level</p>
              <p className="text-gray-400 mb-4">{user.email}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-ton-400 mb-1">{user.totalSpent}</div>
                  <div className="text-gray-400 text-sm">TON Spent 💎</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400 mb-1">{user.totalDonated}</div>
                  <div className="text-gray-400 text-sm">TON Donated ❤️</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400 mb-1">{user.karmaPoints}</div>
                  <div className="text-gray-400 text-sm">Karma Points ☸️</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 mb-1">{library.length}</div>
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
            {[
              { id: 'library', label: 'Sacred Library', icon: Download },
              { id: 'wishlist', label: 'Wishlist', icon: Heart },
              { id: 'achievements', label: 'Achievements', icon: Trophy },
              { id: 'donations', label: 'Donations', icon: Gift }
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

          {activeTab === 'wishlist' && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center">
                <Heart className="w-6 h-6 mr-3 text-pink-400" />
                Sacred Wishlist
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {wishlist.map((item) => (
                  <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-32 object-cover rounded-lg mb-4"
                    />
                    <h3 className="font-semibold text-white mb-1">{item.name}</h3>
                    <p className="text-purple-400 text-sm mb-2">by {item.developer}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-ton-400 font-semibold">{item.price} TON</span>
                      <button className="bg-ton-gradient hover:scale-105 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-1">
                        <Zap className="w-4 h-4" />
                        <span>Buy</span>
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
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;