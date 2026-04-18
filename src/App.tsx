import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import Header from './components/Header';
import Footer from './components/Footer';
import SecretTrigger from './components/SecretTrigger';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './contexts/AuthContext';
import TonConnectWrapper from './components/TonConnectWrapper';
import { ToastProvider } from './components/ui/Toast';
import { SearchProvider } from './contexts/SearchContext';
import { NetworkProvider } from './contexts/NetworkContext';
import { queryClient } from './lib/queryClient';
import CookieConsent from './components/CookieConsent';
import ScrollToTop from './components/ScrollToTop';

/**
 * Lazy with chunk-reload recovery.
 * On first failure: retry the same URL (covers transient network blips).
 * On second failure: hard-reload the page so the browser fetches a fresh
 * index.html with updated chunk hashes (covers post-deploy cache mismatch).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return lazy((): Promise<{ default: React.ComponentType<any> }> =>
    factory()
      .then((mod) => {
        sessionStorage.removeItem('chunk_reload');
        return mod;
      })
      .catch(() =>
        new Promise<{ default: React.ComponentType<any> }>((resolve) =>
          setTimeout(() => resolve(factory()), 1500),
        ),
      )
      .catch(() => {
        const reloaded = sessionStorage.getItem('chunk_reload');
        if (reloaded !== window.location.pathname) {
          sessionStorage.setItem('chunk_reload', window.location.pathname);
          window.location.reload();
        }
        return { default: (() => null) as React.ComponentType<any> };
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
const DocumentationPage = lazyRetry(() => import('./pages/docs/DocumentationPage'));
const LicenseNftPage = lazyRetry(() => import('./pages/docs/LicenseNftPage'));
const SignInPage = lazyRetry(() => import('./pages/auth/SignInPage'));
const AuthCallbackPage = lazyRetry(() => import('./pages/auth/AuthCallbackPage'));

const SacredGem: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, hasRole } = useAuth();

  const isAdmin = hasRole('admin');
  const isMod = hasRole('moderator');
  if (!isAuthenticated || (!isAdmin && !isMod)) return null;

  const target = isAdmin ? '/admin' : '/moderator';
  return <SecretTrigger onActivate={() => navigate(target)} />;
};

/** Resets ErrorBoundary on route change — the user can navigate away from a broken page. */
const RouteErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
};

/** Per-route Suspense + ErrorBoundary — isolates a segment failure from the rest. */
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
        <AuthProvider>
        <NetworkProvider>
        <ToastProvider>
        <SearchProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ScrollToTop />
            <div className="min-h-screen bg-gradient-to-br from-ton-900 to-cosmic-900 text-white">
              <Header />
              <main className="container mx-auto px-4 py-8">
                <Routes>
                  <Route path="/" element={<RouteSuspense message="Loading storefront..."><HomePage /></RouteSuspense>} />
                  <Route path="/product/:slug" element={
                    <RouteSuspense message="Loading product...">
                      <TonConnectWrapper><ProductPage /></TonConnectWrapper>
                    </RouteSuspense>
                  } />
                  <Route path="/category/:id" element={<RouteSuspense><CategoryPage /></RouteSuspense>} />
                  <Route path="/developer/:slug" element={<RouteSuspense><DeveloperPage /></RouteSuspense>} />
                  <Route path="/sign-in" element={<RouteSuspense message="Loading sign-in..."><SignInPage /></RouteSuspense>} />
                  <Route path="/sign-in/*" element={<Navigate to="/sign-in" replace />} />
                  <Route path="/sign-up" element={<Navigate to="/sign-in" replace />} />
                  <Route path="/sign-up/*" element={<Navigate to="/sign-in" replace />} />
                  <Route path="/auth/callback" element={<RouteSuspense message="Completing sign-in..."><AuthCallbackPage /></RouteSuspense>} />
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
                  <Route
                    path="/docs"
                    element={
                      <RouteSuspense message="Loading manifest...">
                        <DocumentationPage />
                      </RouteSuspense>
                    }
                  />
                  <Route
                    path="/docs/license-nft"
                    element={
                      <RouteSuspense message="Forging license codex...">
                        <LicenseNftPage />
                      </RouteSuspense>
                    }
                  />
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
        </SearchProvider>
        </ToastProvider>
        </NetworkProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
