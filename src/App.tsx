import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/clerk-react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import Header from './components/Header';
import Footer from './components/Footer';
import SecretTrigger from './components/SecretTrigger';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './contexts/AuthContext';
import TonConnectWrapper from './components/TonConnectWrapper';
import { CLERK_CONFIGURED, ClerkSignIn, ClerkSignUp, AuthModalProvider } from './lib/clerkSafe';
import { ToastProvider } from './components/ui/Toast';
import { SearchProvider } from './contexts/SearchContext';
import { NetworkProvider } from './contexts/NetworkContext';
import { queryClient } from './lib/queryClient';
import CookieConsent from './components/CookieConsent';

/** lazy с автоматическим retry — при сетевой ошибке (мобильный, offline) повторяет загрузку чанка. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyRetry(factory: () => Promise<{ default: React.ComponentType<any> }>, retries = 2, delayMs = 1500) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return lazy((): Promise<{ default: React.ComponentType<any> }> =>
    factory().catch((err: unknown) => {
      if (retries <= 0) throw err;
      return new Promise((resolve) => setTimeout(() => resolve(factory()), delayMs));
    }),
  );
}

const HomePage = lazyRetry(() => import('./pages/HomePage'));
const ProductPage = lazyRetry(() => import('./pages/ProductPage'));
const DemiurgePage = lazyRetry(() => import('./pages/demiurge/DemiurgePage'));
const CategoryPage = lazyRetry(() => import('./pages/CategoryPage'));
const AdminDashboard = lazyRetry(() => import('./pages/AdminDashboard'));
const ModeratorPanel = lazyRetry(() => import('./pages/ModeratorPanel'));
const DeveloperPage = lazyRetry(() => import('./pages/DeveloperPage'));
const OrdersPage = lazyRetry(() => import('./pages/OrdersPage'));
const ReceiptPage = lazyRetry(() => import('./pages/ReceiptPage'));
const TermsOfService = lazyRetry(() => import('./pages/legal/TermsOfService'));
const PrivacyPolicy = lazyRetry(() => import('./pages/legal/PrivacyPolicy'));
const RefundPolicy = lazyRetry(() => import('./pages/legal/RefundPolicy'));

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
  const { isAuthenticated, hasRole } = useAuth();

  const isAdmin = hasRole('admin');
  const isMod = hasRole('moderator');
  if (!isAuthenticated || (!isAdmin && !isMod)) return null;

  const target = isAdmin ? '/admin' : '/moderator';
  return <SecretTrigger onActivate={() => navigate(target)} />;
};

/** Сбрасывает ErrorBoundary при смене маршрута — пользователь может уйти со сломанной страницы навигацией. */
const RouteErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
};

/** Per-route Suspense + ErrorBoundary — изолирует отказ одного сегмента от остальных. */
const RouteSuspense: React.FC<{ children: React.ReactNode; message?: string }> = ({ children, message }) => (
  <RouteErrorBoundary>
    <Suspense fallback={<LoadingScreen message={message} />}>
      {children}
    </Suspense>
  </RouteErrorBoundary>
);

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <MaybeClerk>
        <AuthProvider>
        <NetworkProvider>
        <ToastProvider>
        <SearchProvider>
        <AuthModalProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="min-h-screen bg-gradient-to-br from-ton-900 to-cosmic-900 text-white">
              <Header />
              <main className="container mx-auto px-4 py-8">
                <Routes>
                  <Route path="/" element={<RouteSuspense message="Загрузка витрины..."><HomePage /></RouteSuspense>} />
                  <Route path="/product/:slug" element={
                    <RouteSuspense message="Загрузка товара...">
                      <TonConnectWrapper><ProductPage /></TonConnectWrapper>
                    </RouteSuspense>
                  } />
                  <Route path="/category/:id" element={<RouteSuspense><CategoryPage /></RouteSuspense>} />
                  <Route path="/developer/:slug" element={<RouteSuspense><DeveloperPage /></RouteSuspense>} />
                  <Route path="/sign-in/*" element={<ClerkSignIn routing="path" path="/sign-in" afterSignInUrl="/profile" />} />
                  <Route path="/sign-up/*" element={<ClerkSignUp routing="path" path="/sign-up" afterSignUpUrl="/profile" />} />
                  <Route path="/profile/*" element={<RouteSuspense><ProtectedRoute><DemiurgePage /></ProtectedRoute></RouteSuspense>} />
                  <Route path="/seller/commerce" element={<Navigate to="/profile/commerce" replace />} />
                  <Route path="/seller/commerce/*" element={<Navigate to="/profile/commerce" replace />} />
                  <Route path="/orders" element={
                    <RouteSuspense>
                      <ProtectedRoute><TonConnectWrapper><OrdersPage /></TonConnectWrapper></ProtectedRoute>
                    </RouteSuspense>
                  } />
                  <Route path="/orders/:orderId/receipt" element={
                    <RouteSuspense>
                      <ProtectedRoute><TonConnectWrapper><ReceiptPage /></TonConnectWrapper></ProtectedRoute>
                    </RouteSuspense>
                  } />
                  <Route path="/terms" element={<RouteSuspense><TermsOfService /></RouteSuspense>} />
                  <Route path="/privacy" element={<RouteSuspense><PrivacyPolicy /></RouteSuspense>} />
                  <Route path="/refund-policy" element={<RouteSuspense><RefundPolicy /></RouteSuspense>} />
                  <Route path="/admin" element={<RouteSuspense><ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute></RouteSuspense>} />
                  <Route path="/admin-dashboard" element={<RouteSuspense><ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute></RouteSuspense>} />
                  <Route path="/moderator" element={<RouteSuspense><ProtectedRoute requiredRole="moderator"><ModeratorPanel /></ProtectedRoute></RouteSuspense>} />
                </Routes>
              </main>
              <Footer />
              <CookieConsent />
              <SacredGem />
            </div>
          </Router>
        </AuthModalProvider>
        </SearchProvider>
        </ToastProvider>
        </NetworkProvider>
        </AuthProvider>
      </MaybeClerk>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
