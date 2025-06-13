import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import Header from './components/Header';
import Footer from './components/Footer';
import SecretAdminAccess from './components/SecretAdminAccess';
import SecretTrigger from './components/SecretTrigger';
import ErrorBoundary from './components/ErrorBoundary';

const HomePage = lazy(() => import('./pages/HomePage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DeveloperDashboard = lazy(() => import('./pages/DeveloperDashboard'));
const DeveloperRegister = lazy(() => import('./pages/DeveloperRegister'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

const manifestUrl =
  import.meta.env.VITE_TONCONNECT_MANIFEST_URL ||
  `https://${window.location.host}/tonconnect-manifest.json`;

function App() {
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [tonConnectError, setTonConnectError] = useState<string | null>(null);

  const handleSecretActivate = () => {
    setIsSecretVisible(true);
  };

  const handleSecretClose = () => {
    setIsSecretVisible(false);
  };

  return (
    <ErrorBoundary>
      <TonConnectUIProvider 
        manifestUrl={manifestUrl}
        onError={(error) => {
          console.error('TON Connect Error:', error);
          setTonConnectError(error.message);
        }}
      >
        <AuthProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="min-h-screen bg-gradient-to-br from-ton-900 to-cosmic-900 text-white">
              {tonConnectError && (
                <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-4 text-center z-50">
                  TON Connect Error: {tonConnectError}
                </div>
              )}
              <Header />
              <main className="container mx-auto px-4 py-8">
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/product/:id" element={<ProductPage />} />
                    <Route path="/category/:id" element={<CategoryPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/developer" element={<ProtectedRoute requiresAuthentication={true}><DeveloperDashboard /></ProtectedRoute>} />
                    <Route path="/developer/register" element={<DeveloperRegister />} />
                    <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin-dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
              <SecretTrigger onActivate={handleSecretActivate} />
              <SecretAdminAccess isVisible={isSecretVisible} onClose={handleSecretClose} />
            </div>
          </Router>
        </AuthProvider>
      </TonConnectUIProvider>
    </ErrorBoundary>
  );
}

export default App;