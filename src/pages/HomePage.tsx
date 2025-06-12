import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, TrendingUp, Gem, Star, Zap, Heart, Rocket, Bot, Gamepad2 } from 'lucide-react';
import ProductCard from '../components/ProductCard';

// TODO: В будущем заменить статические mock-данные на динамические данные из Supabase
const featuredProducts = [
  {
    id: '1',
    name: 'Cosmic Code Editor Pro',
    description: 'Advanced code editor with AI assistance and mystical themes. Perfect for enlightened developers seeking digital nirvana.',
    price: 15.5,
    rating: 4.9,
    downloads: 12500,
    image: 'https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Developer Tools',
    developer: 'Sacred Devs',
    isFeatured: true,
    donationAmount: 25.8
  },
  {
    id: '2',
    name: 'Meditation Game: Inner Peace',
    description: 'Immersive meditation experience with beautiful visuals and sacred sounds. Journey to enlightenment through gameplay.',
    price: 8.2,
    rating: 4.8,
    downloads: 8900,
    image: 'https://images.pexels.com/photos/3408744/pexels-photo-3408744.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Games',
    developer: 'Zen Studios',
    isFeatured: true,
    donationAmount: 18.5
  },
  {
    id: '3',
    name: 'AI Wisdom Oracle',
    description: 'Advanced AI assistant trained on ancient wisdom texts. Get enlightened insights for your projects and life.',
    price: 22.0,
    rating: 4.7,
    downloads: 5600,
    image: 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'AI Services',
    developer: 'Dharma AI',
    isFeatured: false,
    donationAmount: 12.3
  },
  {
    id: '4',
    name: 'Quantum Task Manager',
    description: 'Organize your work with quantum efficiency. Task management app inspired by Buddhist mindfulness principles.',
    price: 5.9,
    rating: 4.6,
    downloads: 15200,
    image: 'https://images.pexels.com/photos/5077047/pexels-photo-5077047.jpeg?auto=compress&cs=tinysrgb&w=800',
    category: 'Productivity',
    developer: 'Mindful Apps',
    isFeatured: false,
    donationAmount: 8.1
  }
];

// TODO: Получать категории из Supabase
const categories = [
  {
    name: 'Apps',
    icon: Rocket,
    count: 1250,
    gradient: 'from-blue-500 to-purple-600',
    emoji: '🚀'
  },
  {
    name: 'Games',
    icon: Gamepad2,
    count: 890,
    gradient: 'from-green-500 to-teal-600',
    emoji: '🎮'
  },
  {
    name: 'AI Services',
    icon: Bot,
    count: 340,
    gradient: 'from-purple-500 to-pink-600',
    emoji: '🤖'
  },
  {
    name: 'Developer Tools',
    icon: Zap,
    count: 670,
    gradient: 'from-yellow-500 to-orange-600',
    emoji: '⚡'
  }
];

const HomePage = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-teal-500/10"></div>
        <div className="relative max-w-7xl mx-auto text-center">
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 bg-ton-gradient rounded-full flex items-center justify-center animate-float">
                <Gem className="w-10 h-10 text-white animate-sparkle" />
              </div>
              <div className="absolute -top-2 -right-2 text-yellow-400 animate-pulse">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="absolute -bottom-2 -left-2 text-purple-400 animate-pulse">
                <Star className="w-6 h-6" />
              </div>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              TON Web Store
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto">
            ☸️ Decentralized Digital Marketplace for Enlightened Souls
          </p>
          
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Discover apps, games, and AI services that elevate consciousness. 
            Built on TON blockchain with love and compassion for developers. 🪷✨
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link
              to="/category/apps"
              className="bg-ton-gradient hover:scale-105 text-white font-semibold px-8 py-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-ton-500/50 flex items-center space-x-2"
            >
              <Sparkles className="w-5 h-5" />
              <span>Explore Treasures</span>
            </Link>
            <Link
              to="/developer/register"
              className="bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-full transition-all duration-300 border border-white/20 flex items-center space-x-2"
            >
              <Heart className="w-5 h-5 text-red-400" />
              <span>Join as Developer</span>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="text-2xl font-bold text-ton-400 mb-1">3,150+</div>
              <div className="text-gray-400 text-sm">Digital Products 💎</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="text-2xl font-bold text-purple-400 mb-1">125K+</div>
              <div className="text-gray-400 text-sm">Happy Users 🌟</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="text-2xl font-bold text-green-400 mb-1">89K TON</div>
              <div className="text-gray-400 text-sm">Total Donations ❤️</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="text-2xl font-bold text-yellow-400 mb-1">1,200+</div>
              <div className="text-gray-400 text-sm">Blessed Devs 🪄</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold text-white mb-4 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 mr-3 text-ton-400" />
              Sacred Categories
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Explore our mystical collection of digital treasures, each category blessed with unique energy ✨
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category) => (
              <Link
                key={category.name}
                to={`/category/${category.name.toLowerCase().replace(' ', '-')}`}
                className="group"
              >
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                  <div className={`w-16 h-16 bg-gradient-to-r ${category.gradient} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <category.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2 flex items-center">
                    {category.name} <span className="ml-2">{category.emoji}</span>
                  </h3>
                  <p className="text-gray-400 text-sm mb-3">
                    {category.count.toLocaleString()} products
                  </p>
                  <div className="text-ton-400 text-sm font-medium group-hover:text-ton-300">
                    Explore Collection →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-display font-bold text-white mb-4 flex items-center justify-center">
              <Gem className="w-8 h-8 mr-3 text-mystical-400 animate-sparkle" />
              Featured Treasures
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Handpicked digital gems blessed by our community through generous donations 🪷
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              to="/category/featured"
              className="bg-mystical-gradient hover:scale-105 text-white font-semibold px-8 py-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-pink-500/50 inline-flex items-center space-x-2"
            >
              <Star className="w-5 h-5" />
              <span>View All Featured</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Donation System Info */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 rounded-3xl p-8 border border-white/10">
            <div className="text-center">
              <div className="w-16 h-16 bg-mystical-gradient rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="w-8 h-8 text-white animate-pulse" />
              </div>
              
              <h3 className="text-2xl font-display font-bold text-white mb-4">
                Sacred Donation System 🪷
              </h3>
              
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto leading-relaxed">
                Our unique ranking system elevates products based on community donations. 
                When developers contribute TON coins with their app name in the comment, 
                their digital treasures rise higher in our mystical marketplace. 
                <strong className="text-ton-400"> The more generous the donation, the higher the blessing! </strong> ✨
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-2xl mb-2">🥉</div>
                  <div className="text-yellow-400 font-semibold">1-10 TON</div>
                  <div className="text-gray-400 text-sm">Bronze Blessing</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-2xl mb-2">🥈</div>
                  <div className="text-purple-400 font-semibold">11-25 TON</div>
                  <div className="text-gray-400 text-sm">Silver Enlightenment</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-2xl mb-2">🥇</div>
                  <div className="text-pink-400 font-semibold">0+ TON</div>
                  <div className="text-gray-400 text-sm">Golden Nirvana</div>
                </div>
              </div>

              <Link
                to="/developer"
                className="bg-sacred-gradient hover:scale-105 text-white font-semibold px-8 py-4 rounded-full transition-all duration-300 shadow-lg inline-flex items-center space-x-2"
              >
                <Sparkles className="w-5 h-5" />
                <span>Bless Your Product</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;