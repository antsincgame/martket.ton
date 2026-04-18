import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield, Lock, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

/**
 * Gate that requires an authenticated session for the wrapped route.
 *
 * - While auth is bootstrapping → spinner (no flicker to /sign-in)
 * - Logged in but profile still loading → spinner with manual Retry
 * - Logged out → redirect to /sign-in (mobile and desktop alike)
 * - Logged in but missing role → access-denied screen
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, providerSignedIn, hasRole, isLoading, user, fetchProfile, error } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Session exists at the auth provider but the backend profile hasn't
    // resolved yet — give the user a way to retry instead of a blank screen.
    if (providerSignedIn) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-sm">
            {!error && (
              <div className="w-16 h-16 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin mx-auto mb-4" />
            )}
            {error ? (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <Shield className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            ) : (
              <p className="text-[#999] text-sm mb-4">Setting up your profile...</p>
            )}
            <button
              onClick={() => fetchProfile()}
              className="inline-flex items-center gap-2 text-[#FFD700] text-sm hover:text-[#FFE066] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      );
    }
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-sm border border-red-500/20 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-4">Access Denied</h1>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center space-x-2 text-red-400 mb-2">
              <Shield className="w-5 h-5" />
              <span className="font-semibold">Required Role: {requiredRole}</span>
            </div>
            {user && (
              <p className="text-gray-400 text-sm">
                Your role: {user.roles.map(r => r.name).join(', ')}
              </p>
            )}
          </div>
          <button onClick={() => window.history.back()} className="w-full bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 font-semibold py-3 px-6 rounded-xl transition-all duration-300 mb-3">
            Go Back
          </button>
          <button onClick={() => { window.location.href = '/'; }} className="w-full bg-ton-gradient hover:scale-105 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg">
            Home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
