import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/clerk-react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import Header from './components/Header';
import Footer from './components/Footer';
import SecretTrigger from './components/SecretTrigger';
import ErrorBoundary from './components/ErrorBoundary';
import TonConnectWrapper from './components/TonConnectWrapper';
import { CLERK_CONFIGURED, ClerkSignIn, ClerkSignUp, AuthModalProvider } from './lib/clerkSafe';
import { ToastProvider } from './components/ui/Toast';
import { SearchProvider } from './contexts/SearchContext';
import { queryClient } from './lib/queryClient';

const HomePage = lazy(() => import('./pages/HomePage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const DemiurgePage = lazy(() => import('./pages/demiurge/DemiurgePage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SellerCommercePage = lazy(() => import('./pages/SellerCommercePage'));
const DeveloperPage = lazy(() => import('./pages/DeveloperPage'));

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

const SacredGem: React.FC = () => {
  const navigate = useNavigate();
  return <SecretTrigger onActivate={() => navigate('/admin')} />;
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <MaybeClerk>
        <AuthProvider>
        <ToastProvider>
        <SearchProvider>
        <AuthModalProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="min-h-screen bg-gradient-to-br from-ton-900 to-cosmic-900 text-white">
              <Header />
              <main className="container mx-auto px-4 py-8">
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/product/:slug" element={<TonConnectWrapper><ProductPage /></TonConnectWrapper>} />
                    <Route path="/category/:id" element={<CategoryPage />} />
                    <Route path="/developer/:slug" element={<DeveloperPage />} />
                    <Route path="/sign-in/*" element={<ClerkSignIn routing="path" path="/sign-in" afterSignInUrl="/profile" />} />
                    <Route path="/sign-up/*" element={<ClerkSignUp routing="path" path="/sign-up" afterSignUpUrl="/profile" />} />
                    <Route path="/profile/*" element={<ProtectedRoute><DemiurgePage /></ProtectedRoute>} />
                    <Route path="/seller/commerce" element={<TonConnectWrapper><SellerCommercePage /></TonConnectWrapper>} />
                    <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin-dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
              <SacredGem />
            </div>
          </Router>
        </AuthModalProvider>
        </SearchProvider>
        </ToastProvider>
        </AuthProvider>
      </MaybeClerk>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
