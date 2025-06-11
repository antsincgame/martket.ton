import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import ProfilePage from './pages/ProfilePage';
import DeveloperDashboard from './pages/DeveloperDashboard';
import CategoryPage from './pages/CategoryPage';
import AdminDashboard from './pages/AdminDashboard';
import SecretAdminAccess from './components/SecretAdminAccess';
import SecretTrigger from './components/SecretTrigger';

function App() {
  const [showAdminAccess, setShowAdminAccess] = useState(false);

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http://www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] animate-pulse-slow"></div>
        
        <div className="relative z-10">
          <Header />
          <main className="min-h-screen">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/product/:id" element={<ProductPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/developer" element={<DeveloperDashboard />} />
              <Route path="/category/:category" element={<CategoryPage />} />
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
            </Routes>
          </main>
          <Footer />
        </div>

        {/* Secret White Tara Admin Access */}
        <SecretTrigger onActivate={() => setShowAdminAccess(true)} />
        <SecretAdminAccess 
          isVisible={showAdminAccess} 
          onClose={() => setShowAdminAccess(false)} 
        />
      </div>
    </Router>
  );
}

export default App;