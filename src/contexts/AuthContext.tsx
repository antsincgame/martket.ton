import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import { 
  AuthContextValue, 
  AuthenticatedUser, 
  AuthSession, 
  TONWalletAuth, 
  AuthResult,
  SecurityEvent,
  SecurityFlag,
  UserRole,
  AuditLog,
  SacredAccess
} from '../types/auth';

// Security configuration
const SECURITY_CONFIG = {
  session: {
    maxDuration: 480, // 8 hours for regular users
    maxDurationAdmin: 240, // 4 hours for admins
    extendOnActivity: true,
    maxConcurrentSessions: 3
  },
  mfa: {
    required: true,
    gracePeriod: 5, // minutes
    backupCodes: 10
  },
  rateLimit: {
    loginAttempts: 5,
    windowMinutes: 15,
    blockDuration: 30
  }
};

// Role definitions with permissions
const ROLES: Record<string, UserRole> = {
  super_admin: {
    id: 'super_admin',
    name: 'super_admin',
    permissions: [
      { resource: '*', actions: ['create', 'read', 'update', 'delete', 'approve', 'ban'] }
    ],
    sessionDuration: 120, // 2 hours
    requiresMFA: true,
    description: 'Supreme cosmic administrator with all divine permissions'
  },
  admin: {
    id: 'admin', 
    name: 'admin',
    permissions: [
      { resource: 'users', actions: ['create', 'read', 'update', 'ban'] },
      { resource: 'products', actions: ['create', 'read', 'update', 'delete', 'approve'] },
      { resource: 'categories', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'donations', actions: ['read', 'approve'] }
    ],
    sessionDuration: 240, // 4 hours
    requiresMFA: true,
    description: 'Administrative guardian with elevated access'
  },
  moderator: {
    id: 'moderator',
    name: 'moderator', 
    permissions: [
      { resource: 'products', actions: ['read', 'update', 'approve'] },
      { resource: 'users', actions: ['read', 'ban'] },
      { resource: 'reviews', actions: ['read', 'update', 'delete'] }
    ],
    sessionDuration: 360, // 6 hours
    requiresMFA: false,
    description: 'Content moderator ensuring marketplace harmony'
  },
  developer: {
    id: 'developer',
    name: 'developer',
    permissions: [
      { resource: 'products', actions: ['create', 'read', 'update'], conditions: { owner: true } },
      { resource: 'analytics', actions: ['read'], conditions: { owner: true } }
    ],
    sessionDuration: 480, // 8 hours  
    requiresMFA: false,
    description: 'Sacred developer creating digital treasures'
  },
  support: {
    id: 'support',
    name: 'support',
    permissions: [
      { resource: 'users', actions: ['read'] },
      { resource: 'tickets', actions: ['create', 'read', 'update'] }
    ],
    sessionDuration: 1440, // 24 hours
    requiresMFA: false,
    description: 'Compassionate support helping users'
  },
  analyst: {
    id: 'analyst',
    name: 'analyst',
    permissions: [
      { resource: 'analytics', actions: ['read'] },
      { resource: 'reports', actions: ['create', 'read'] }
    ],
    sessionDuration: 480, // 8 hours
    requiresMFA: false,
    description: 'Data analyst seeking marketplace insights'
  },
  viewer: {
    id: 'viewer',
    name: 'viewer',
    permissions: [
      { resource: 'dashboard', actions: ['read'] }
    ],
    sessionDuration: 240, // 4 hours
    requiresMFA: false,
    description: 'Observer with read-only access'
  },
  auditor: {
    id: 'auditor',
    name: 'auditor',
    permissions: [
      { resource: 'audit_logs', actions: ['read'] },
      { resource: 'security_events', actions: ['read'] }
    ],
    sessionDuration: 120, // 2 hours
    requiresMFA: true,
    description: 'Security auditor monitoring system integrity'
  }
};

interface AuthState {
  user: AuthenticatedUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  securityAlerts: SecurityFlag[];
  sacredAccess: SacredAccess | null;
  error: string | null;
  loginAttempts: { timestamp: number; count: number };
  securityEvents: SecurityEvent[];
}

type AuthAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: AuthenticatedUser | null }
  | { type: 'SET_SESSION'; payload: AuthSession | null }
  | { type: 'ADD_SECURITY_ALERT'; payload: SecurityFlag }
  | { type: 'CLEAR_SECURITY_ALERTS' }
  | { type: 'SET_SACRED_ACCESS'; payload: SacredAccess | null }
  | { type: 'LOGOUT' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_LOGIN_ATTEMPTS'; payload: { timestamp: number; count: number } }
  | { type: 'SET_SECURITY_EVENTS'; payload: SecurityEvent[] };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_SESSION':
      return { ...state, session: action.payload };
    case 'ADD_SECURITY_ALERT':
      return { 
        ...state, 
        securityAlerts: [...state.securityAlerts, action.payload] 
      };
    case 'CLEAR_SECURITY_ALERTS':
      return { ...state, securityAlerts: [] };
    case 'SET_SACRED_ACCESS':
      return { ...state, sacredAccess: action.payload };
    case 'LOGOUT':
      return {
        user: null,
        session: null,
        isLoading: false,
        securityAlerts: [],
        sacredAccess: null,
        error: null,
        loginAttempts: { timestamp: 0, count: 0 },
        securityEvents: []
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_LOGIN_ATTEMPTS':
      return { ...state, loginAttempts: action.payload };
    case 'SET_SECURITY_EVENTS':
      return { ...state, securityEvents: action.payload };
    default:
      return state;
  }
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    session: null,
    isLoading: true,
    securityAlerts: [],
    sacredAccess: null,
    error: null,
    loginAttempts: { timestamp: 0, count: 0 },
    securityEvents: []
  });

  // Security monitoring
  const reportSecurityEvent = useCallback((event: Omit<SecurityEvent, 'id' | 'timestamp'>) => {
    // Mock security event reporting
    console.log('Security Event:', { ...event, id: Date.now().toString(), timestamp: new Date() });
  }, []);

  // Audit logging
  const logAuditEvent = useCallback((action: string, resource: string, result: string, metadata?: Record<string, unknown>) => {
    // Mock audit logging
    console.log('Audit Event:', { action, resource, result, metadata, timestamp: new Date().toISOString() });
  }, []);

  const mockUsers = useMemo(() => ({
    'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N': {
      id: 'admin-1',
      tonAddress: 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N',
      email: 'dzmitry.arlou@grodno.ai',
      role: 'admin',
      roles: [ROLES.admin],
      permissions: ROLES.admin.permissions,
      securityFlags: [],
      securityLevel: 'high',
      lastLogin: new Date().toISOString(),
      mfaEnabled: false,
      mfaMethods: [],
      sessionDuration: ROLES.admin.sessionDuration,
      requiresMFA: ROLES.admin.requiresMFA,
      description: ROLES.admin.description,
      profile: {
        displayName: 'Sacred Admin',
        avatar: '🧿'
      }
    },
    'EQDeveloper123456789TestWalletAddress': {
      id: 'dev-1',
      tonAddress: 'EQDeveloper123456789TestWalletAddress',
      email: 'developer@tonwebstore.com',
      role: 'developer',
      roles: [ROLES.developer, ROLES.viewer],
      permissions: [...ROLES.developer.permissions, ...ROLES.viewer.permissions],
      securityFlags: [],
      securityLevel: 'medium',
      lastLogin: new Date().toISOString(),
      mfaEnabled: false,
      mfaMethods: [],
      sessionDuration: ROLES.developer.sessionDuration,
      requiresMFA: ROLES.developer.requiresMFA,
      description: ROLES.developer.description,
      profile: {
        displayName: 'Sacred Developer',
        avatar: '🚀'
      }
    },
    'EQUser987654321TestWalletAddress': {
      id: 'user-1',
      tonAddress: 'EQUser987654321TestWalletAddress',
      email: 'user@tonwebstore.com',
      role: 'viewer',
      roles: [ROLES.viewer],
      permissions: ROLES.viewer.permissions,
      securityFlags: [],
      securityLevel: 'low',
      lastLogin: new Date().toISOString(),
      mfaEnabled: false,
      mfaMethods: [],
      sessionDuration: ROLES.viewer.sessionDuration,
      requiresMFA: ROLES.viewer.requiresMFA,
      description: ROLES.viewer.description,
      profile: {
        displayName: 'Sacred User',
        avatar: '👤'
      }
    },
    'mantra@bodhisattva.path': {
      id: 'mantra-admin',
      tonAddress: 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N',
      email: 'mantra@bodhisattva.path',
      role: 'super_admin',
      roles: [ROLES.super_admin],
      permissions: ROLES.super_admin.permissions,
      securityFlags: [],
      securityLevel: 'critical',
      lastLogin: new Date().toISOString(),
      mfaEnabled: false,
      mfaMethods: [],
      sessionDuration: ROLES.super_admin.sessionDuration,
      requiresMFA: ROLES.super_admin.requiresMFA,
      description: ROLES.super_admin.description,
      profile: {
        displayName: 'Bodhisattva',
        avatar: '🪷'
    }
    }
  }), []);

  // TON Wallet Authentication
  const authenticateWithTON = useCallback(async (walletData: TONWalletAuth): Promise<AuthResult> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      reportSecurityEvent({
        type: 'login_attempt',
        severity: 'info',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { method: 'ton_wallet', address: walletData.address }
      });

      // Simulate TON signature verification
      const isValidSignature = await verifyTONSignature(walletData);
      
      if (!isValidSignature) {
        reportSecurityEvent({
          type: 'login_attempt',
          severity: 'warning',
          ipAddress: 'client_ip',
          userAgent: navigator.userAgent,
          details: { method: 'ton_wallet', address: walletData.address, result: 'invalid_signature' }
        });
        
        return {
          success: false,
          requiresMFA: false,
          error: 'Invalid TON wallet signature'
        };
      }

      // Mock user lookup - in real app would query backend
      const mockUser = await getUserByTONAddress(walletData.address);
      
      if (!mockUser) {
        return {
          success: false,
          requiresMFA: false,
          error: 'TON address not registered for admin access'
        };
      }

      const requiresMFA = mockUser.roles.some(role => role.requiresMFA);
      
      if (requiresMFA) {
        return {
          success: false,
          requiresMFA: true,
          mfaMethods: mockUser.mfaMethods.filter(m => m.isActive)
        };
      }

      // Create session
      const session = createSession(mockUser);
      
      dispatch({ type: 'SET_USER', payload: mockUser });
      dispatch({ type: 'SET_SESSION', payload: session });

      logAuditEvent('login', 'auth', 'success', { method: 'ton_wallet' });

      return {
        success: true,
        requiresMFA: false,
        session
      };

    } catch (error) {
      reportSecurityEvent({
        type: 'login_attempt',
        severity: 'error',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { method: 'ton_wallet', error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return {
        success: false,
        requiresMFA: false,
        error: 'Authentication failed'
      };
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [reportSecurityEvent, logAuditEvent]);

  // Permission checking
  const hasPermission = useCallback((resource: string, action: string): boolean => {
    if (!state.user) return false;
    
    const userPermissions = state.user.permissions || [];
    
    return userPermissions.some(permission => {
      const resourceMatch = permission.resource === '*' || permission.resource === resource;
      const actionMatch = permission.actions.includes(action);
      return resourceMatch && actionMatch;
    });
  }, [state.user]);

  const hasRole = useCallback((roleName: string): boolean => {
    if (!state.user) return false;
    
    // super_admin имеет доступ ко всем ролям
    const userRoles = state.user.roles.map(role => role.name);
    if (userRoles.includes('super_admin')) return true;
    
    return userRoles.includes(roleName);
  }, [state.user]);

  const getSecurityLevel = useCallback((): string => {
    return state.user?.securityLevel || 'low';
  }, [state.user]);

  // Session management
  const logout = useCallback(async (): Promise<void> => {
    if (state.session) {
      logAuditEvent('logout', 'auth', 'success');
    }
    
    dispatch({ type: 'LOGOUT' });
  }, [state.session, logAuditEvent]);

  const getSecurityAlerts = useCallback((): SecurityFlag[] => {
    return state.securityAlerts;
  }, [state.securityAlerts]);

  // Session timeout check
  useEffect(() => {
    if (!state.session) return;

    const checkSession = () => {
      const now = new Date();
      if (now > state.session!.expiresAt) {
        reportSecurityEvent({
          type: 'login_attempt',
          severity: 'info',
          ipAddress: 'client_ip',
          userAgent: navigator.userAgent,
          details: { reason: 'session_timeout' }
        });
        dispatch({ type: 'LOGOUT' });
      }
    };

    const interval = setInterval(checkSession, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [state.session, reportSecurityEvent]);

  const authenticateWithMantra = useCallback(async (credentials: { email: string }): Promise<AuthResult> => {
    try {
      const user = mockUsers[credentials.email];
      if (!user) {
        throw new Error('Invalid credentials');
      }

      const session = createSession(user);
      dispatch({ type: 'SET_USER', payload: user });
    dispatch({ type: 'SET_SESSION', payload: session });
      dispatch({ type: 'SET_ERROR', payload: null });

      return {
        success: true,
        user,
        session,
        requiresMFA: false
      };
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Authentication failed' });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }, [mockUsers]);

  const authenticateWithMFA = useCallback(async (method: string, code: string): Promise<AuthResult> => {
    try {
      // Mock MFA verification
      if (code === '123456') {
        return {
          success: true,
          requiresMFA: false
        };
      }
      return {
        success: false,
        error: 'Invalid MFA code'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MFA verification failed'
      };
    }
  }, []);

  const contextValue: AuthContextValue = {
    user: state.user,
    session: state.session,
    isLoading: state.isLoading,
    isAuthenticated: !!state.user && !!state.session,
    securityAlerts: state.securityAlerts,
    sacredAccess: state.sacredAccess,
    error: state.error,
    loginAttempts: state.loginAttempts,
    securityEvents: state.securityEvents,
    authenticateWithTON,
    authenticateWithMFA,
    authenticateWithMantra,
    logout,
    reportSecurityEvent,
    clearSecurityAlerts: () => dispatch({ type: 'CLEAR_SECURITY_ALERTS' }),
    hasPermission,
    hasRole,
    getSecurityLevel,
    getSecurityAlerts,
    logAuditEvent
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Utility functions (mock implementations)
async function verifyTONSignature(walletData: TONWalletAuth): Promise<boolean> {
  // Mock signature verification - in real app would verify against TON network
  return walletData.signature.length > 100; // Simple check
}

async function getUserByTONAddress(address: string): Promise<AuthenticatedUser | null> {
  // Mock user database lookup
  const mockUsers: Record<string, AuthenticatedUser> = {
    'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N': {
      id: 'admin-1',
      tonAddress: address,
      email: 'admin@tonwebstore.com',
      username: 'sacred_admin',
      roles: [ROLES.super_admin],
      mfaMethods: [
        {
          id: 'mfa-1',
          type: 'totp',
          name: 'Authenticator App',
          isActive: true,
          createdAt: new Date(),
          lastUsed: new Date()
        }
      ],
      lastLogin: new Date(),
      loginHistory: [],
      securityLevel: 'critical',
      isActive: true,
      profile: {
        displayName: 'Sacred Administrator',
        bio: 'Guardian of the digital dharma',
        avatar: '🧿'
      }
    },
    'EQDeveloper123456789TestWalletAddress': {
      id: 'dev-1',
      tonAddress: address,
      email: 'developer@tonwebstore.com',
      username: 'sacred_developer',
      roles: [ROLES.developer, ROLES.viewer],
      mfaMethods: [],
      lastLogin: new Date(),
      loginHistory: [],
      securityLevel: 'medium',
      isActive: true,
      profile: {
        displayName: 'Sacred Developer',
        bio: 'Creator of digital treasures',
        avatar: '🚀'
      }
    },
    'EQUser987654321TestWalletAddress': {
      id: 'user-1',
      tonAddress: address,
      email: 'user@tonwebstore.com',
      username: 'sacred_user',
      roles: [ROLES.viewer],
      mfaMethods: [],
      lastLogin: new Date(),
      loginHistory: [],
      securityLevel: 'low',
      isActive: true,
      profile: {
        displayName: 'Sacred User',
        bio: 'Explorer of digital realms',
        avatar: '👤'
      }
    }
  };

  return mockUsers[address] || null;
}

async function verifyMFACode(method: string, code: string): Promise<boolean> {
  // Mock MFA verification
  return code === '123456'; // Simple mock
}

function createSession(user: AuthenticatedUser): AuthSession {
  const now = new Date();
  const role = user.roles[0]; // Get primary role
  const duration = role.sessionDuration || SECURITY_CONFIG.session.maxDuration;
  
  return {
    sessionId: crypto.randomUUID(),
    userId: user.id,
    tonAddress: user.tonAddress,
    roles: user.roles,
    permissions: user.permissions,
    createdAt: now,
    expiresAt: new Date(now.getTime() + duration * 60 * 1000),
    lastActivity: now,
    ipAddress: 'localhost',
    userAgent: navigator.userAgent,
    mfaVerified: false,
    securityFlags: []
  };
} 