import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield, AlertTriangle, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: {
    resource: string;
    action: string;
  };
  requiredRole?: string;
  requiresAuthentication?: boolean;
  fallbackComponent?: React.ComponentType;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
  requiresAuthentication = true,
  fallbackComponent: FallbackComponent
}) => {
  const { 
    isAuthenticated, 
    user, 
    session, 
    hasPermission, 
    hasRole, 
    reportSecurityEvent,
    getSecurityLevel
  } = useAuth();
  const location = useLocation();

  // Check authentication
  if (requiresAuthentication && !isAuthenticated) {
    reportSecurityEvent({
      type: 'permission_denied',
      severity: 'warning',
      ipAddress: 'client_ip',
      userAgent: navigator.userAgent,
      details: { 
        reason: 'not_authenticated',
        attempted_path: location.pathname,
        timestamp: Date.now()
      }
    });

    if (FallbackComponent) {
      return <FallbackComponent />;
    }

    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Check session validity and security level
  if (isAuthenticated && session) {
    const now = new Date();
    if (now > session.expiresAt) {
      reportSecurityEvent({
        type: 'permission_denied',
        severity: 'warning',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { 
          reason: 'session_expired',
          attempted_path: location.pathname,
          session_id: session.sessionId
        }
      });

      return <Navigate to="/" replace />;
    }

    // Check security level for sensitive routes
    const securityLevel = getSecurityLevel();
    if (requiredPermission?.resource === 'admin' && securityLevel !== 'high') {
      reportSecurityEvent({
        type: 'permission_denied',
        severity: 'warning',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { 
          reason: 'insufficient_security_level',
          required_level: 'high',
          current_level: securityLevel,
          attempted_path: location.pathname
        }
      });

      return <AccessDenied reason="security_level" requiredLevel="high" />;
    }
  }

  // Check role-based access with enhanced validation
  if (requiredRole) {
    const hasRequiredRole = hasRole(requiredRole);
    const userRoles = user?.roles.map(r => r.name) || [];
    
    if (!hasRequiredRole) {
    reportSecurityEvent({
      type: 'permission_denied',
      severity: 'warning',
      ipAddress: 'client_ip',
      userAgent: navigator.userAgent,
      details: { 
        reason: 'insufficient_role',
        required_role: requiredRole,
          user_roles: userRoles,
          attempted_path: location.pathname,
          security_level: getSecurityLevel()
      }
    });

    return <AccessDenied reason="role" requiredRole={requiredRole} />;
  }
  }

  // Check permission-based access with enhanced validation
  if (requiredPermission) {
    const hasRequiredPermission = hasPermission(requiredPermission.resource, requiredPermission.action);
    const userPermissions = user?.roles.flatMap(r => r.permissions) || [];
    
    if (!hasRequiredPermission) {
    reportSecurityEvent({
      type: 'permission_denied',
      severity: 'warning',
      ipAddress: 'client_ip',
      userAgent: navigator.userAgent,
      details: { 
        reason: 'insufficient_permission',
        required_permission: requiredPermission,
          user_permissions: userPermissions,
          attempted_path: location.pathname,
          security_level: getSecurityLevel()
      }
    });

    return <AccessDenied reason="permission" requiredPermission={requiredPermission} />;
    }
  }

  // All checks passed - render protected content
  return <>{children}</>;
};

interface AccessDeniedProps {
  reason: 'role' | 'permission' | 'security_level';
  requiredRole?: string;
  requiredPermission?: {
    resource: string;
    action: string;
  };
  requiredLevel?: string;
}

const AccessDenied: React.FC<AccessDeniedProps> = ({ reason, requiredRole, requiredPermission, requiredLevel }) => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white/5 backdrop-blur-sm border border-red-500/20 rounded-3xl p-8 max-w-md w-full text-center">
        {/* Sacred Access Denied Icon */}
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-red-400" />
        </div>

        <h1 className="text-2xl font-display font-bold text-white mb-4">
          🚫 Sacred Access Denied
        </h1>
        
        <div className="text-gray-300 mb-6">
          <p className="mb-4">
            Your current spiritual level does not grant access to this divine realm.
          </p>
          
          {reason === 'role' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
              <div className="flex items-center space-x-2 text-red-400 mb-2">
                <Shield className="w-5 h-5" />
                <span className="font-semibold">Required Sacred Role:</span>
              </div>
              <div className="text-white font-mono bg-white/5 px-3 py-2 rounded">
                {requiredRole?.replace('_', ' ').toUpperCase()} 🪄
              </div>
            </div>
          )}

          {reason === 'permission' && requiredPermission && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
              <div className="flex items-center space-x-2 text-red-400 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">Required Divine Permission:</span>
              </div>
              <div className="text-white font-mono bg-white/5 px-3 py-2 rounded">
                {requiredPermission.action.toUpperCase()} on {requiredPermission.resource.toUpperCase()} ⚡
              </div>
            </div>
          )}

          {reason === 'security_level' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
              <div className="flex items-center space-x-2 text-red-400 mb-2">
                <Shield className="w-5 h-5" />
                <span className="font-semibold">Required Security Level:</span>
              </div>
              <div className="text-white font-mono bg-white/5 px-3 py-2 rounded">
                {requiredLevel?.toUpperCase()} 🔐
              </div>
            </div>
          )}

          {user && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="text-blue-400 font-semibold mb-2">Your Current Status:</div>
              <div className="text-white text-sm">
                <div className="mb-1">User: {user.profile.displayName} {user.profile.avatar}</div>
                <div className="mb-1">
                  Roles: {user.roles.map(role => role.name.replace('_', ' ')).join(', ')} 🧿
                </div>
                <div>
                  Security Level: {user.securityLevel.toUpperCase()} 🔐
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 font-semibold py-3 px-6 rounded-xl transition-all duration-300"
          >
            Return to Previous Realm 🔙
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-ton-gradient hover:scale-105 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg"
          >
            Return to Sacred Home 🏠
          </button>
        </div>

        {/* Sacred Blessing */}
        <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <p className="text-purple-200 text-sm">
            🪷 Om Tare Tu Tarre Svaha 🪷
          </p>
          <p className="text-gray-300 text-xs mt-1">
            May your digital karma guide you to the appropriate realm ☸️
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProtectedRoute; 