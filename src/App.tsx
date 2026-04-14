import { useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import Header from './components/Header';
import Footer from './components/Footer';
import SecretAdminAccess from './components/SecretAdminAccess';
import SecretTrigger from './components/SecretTrigger';
import ErrorBoundary from './components/ErrorBoundary';
import TonConnectWrapper from './components/TonConnectWrapper';
import { CLERK_CONFIGURED, ClerkSignIn, ClerkSignUp, AuthModalProvider } from './lib/clerkSafe';

const HomePage = lazy(() => import('./pages/HomePage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DeveloperDashboard = lazy(() => import('./pages/DeveloperDashboard'));
const DeveloperRegister = lazy(() => import('./pages/DeveloperRegister'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SellerCommercePage = lazy(() => import('./pages/SellerCommercePage'));

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

const MaybeClerk: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!CLERK_CONFIGURED) return <>{children}</>;
  return (
    <ClerkProvider
      publishableKey={CLERK_KEY}
      appearance={{
        variables: {
          colorPrimary: '#FFD700',
          colorBackground: '#0D0D1A',
          colorText: '#FFFFFF',
          colorTextSecondary: '#999999',
          colorInputBackground: 'rgba(255,255,255,0.06)',
          colorInputText: '#FFFFFF',
          colorDanger: '#FF4444',
          borderRadius: '0.75rem',
          fontFamily: "'Inter', sans-serif",
        },
        elements: {
          card: 'bg-[#0D0D1A] border border-[#FFD700]/20 shadow-[0_0_40px_rgba(255,215,0,0.08)]',
          headerTitle: 'text-white font-bold tracking-wide',
          headerSubtitle: 'text-[#999]',
          socialButtonsBlockButton:
            'border border-[#FFD700]/30 bg-transparent text-white hover:bg-[#00F5FF]/10 hover:border-[#00F5FF]/50 transition-all duration-300 [&_svg]:brightness-0 [&_svg]:invert',
          socialButtonsBlockButtonText: 'text-white font-medium hover:text-[#00F5FF]',
          socialButtonsBlockButtonArrow: 'text-white',
          formFieldLabel: 'text-[#999]',
          formFieldInput:
            'bg-white/5 border border-white/10 text-white focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30',
          formButtonPrimary:
            'bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all duration-300',
          footerActionLink: 'text-[#FFD700] hover:text-[#FFE066]',
          dividerLine: 'bg-white/10',
          dividerText: 'text-[#666]',
          identityPreviewEditButton: 'text-[#FFD700]',
          formFieldAction: 'text-[#FFD700]',
          otpCodeFieldInput: 'bg-white/5 border border-white/10 text-white',
          footer: 'hidden',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
};

function App() {
  const [isSecretVisible, setIsSecretVisible] = useState(false);

  return (
    <ErrorBoundary>
      <MaybeClerk>
        <AuthProvider>
        <AuthModalProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="min-h-screen bg-gradient-to-br from-ton-900 to-cosmic-900 text-white">
              <Header />
              <main className="container mx-auto px-4 py-8">
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/product/:id" element={<TonConnectWrapper><ProductPage /></TonConnectWrapper>} />
                    <Route path="/category/:id" element={<CategoryPage />} />
                    <Route path="/sign-in/*" element={<ClerkSignIn routing="path" path="/sign-in" afterSignInUrl="/profile" />} />
                    <Route path="/sign-up/*" element={<ClerkSignUp routing="path" path="/sign-up" afterSignUpUrl="/profile" />} />
                    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                    <Route path="/developer" element={<DeveloperDashboard />} />
                    <Route path="/developer/register" element={<ProtectedRoute><DeveloperRegister /></ProtectedRoute>} />
                    <Route path="/seller/commerce" element={<TonConnectWrapper><SellerCommercePage /></TonConnectWrapper>} />
                    <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin-dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
              <SecretTrigger onActivate={() => setIsSecretVisible(true)} />
              <SecretAdminAccess isVisible={isSecretVisible} onClose={() => setIsSecretVisible(false)} />
            </div>
          </Router>
        </AuthModalProvider>
        </AuthProvider>
      </MaybeClerk>
    </ErrorBoundary>
  );
}

export default App;
