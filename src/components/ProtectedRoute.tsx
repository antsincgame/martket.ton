import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CLERK_CONFIGURED, useAuthModal, useClerkAuthForRoute } from '../lib/clerkSafe';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, hasRole, isLoading, user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const clerkAuth = useClerkAuthForRoute();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (CLERK_CONFIGURED && clerkAuth.isSignedIn) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#999] text-sm">Setting up your profile...</p>
          </div>
        </div>
      );
    }

    if (CLERK_CONFIGURED) {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        openAuthModal('sign-in');
        return <Navigate to="/" replace />;
      }
      return <Navigate to="/sign-in" state={{ from: location }} replace />;
    }
    return <Navigate to="/" replace />;
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
