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
  SacredAccess
} from '../types/auth';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

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

// Mock users map for mantra authentication
const mockUsers: Record<string, AuthenticatedUser> = {};

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

  const login = useCallback(async (credentials: { email?: string; tonAddress?: string }): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase не настроен. Создайте .env с VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.' };
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      if (credentials.email) {
        const { error: signInError } = await supabase.auth.signInWithOtp({ email: credentials.email });
        if (signInError) throw signInError;
        return { success: true, requiresMFA: false };
      } else if (credentials.tonAddress) {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('ton_address', credentials.tonAddress)
          .single();
        if (fetchError) throw fetchError;
        const user = data;
        const session = createSession(user);
        dispatch({ type: 'SET_USER', payload: user });
        dispatch({ type: 'SET_SESSION', payload: session });
        dispatch({ type: 'SET_ERROR', payload: null });
        return { success: true, user, session, requiresMFA: false };
      } else {
        throw new Error('No credentials provided');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      return { success: false, error: message };
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    dispatch({ type: 'LOGOUT' });
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!isSupabaseConfigured) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        dispatch({ type: 'SET_USER', payload: null });
        dispatch({ type: 'SET_SESSION', payload: null });
        return;
      }
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      if (fetchError) throw fetchError;
      dispatch({ type: 'SET_USER', payload: data });
      dispatch({ type: 'SET_SESSION', payload: createSession(data) });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch profile';
      dispatch({ type: 'SET_ERROR', payload: message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // useEffect для автоматической загрузки профиля при монтировании
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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

    const rolesArray = state.user.roles;
    // Поддерживаем как массив строк, так и массив объектов UserRole
    const roleNames = rolesArray.map(r => typeof r === 'string' ? r : r.name);

    // super_admin имеет доступ ко всем ролям
    if (roleNames.includes('super_admin')) return true;

    return roleNames.includes(roleName);
  }, [state.user]);

  const getSecurityLevel = useCallback((): string => {
    return state.user?.securityLevel || 'low';
  }, [state.user]);

  // Session management
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

  // TON wallet authentication stub (TonConnect)
  const authenticateWithTON = useCallback(async (walletData: TONWalletAuth): Promise<AuthResult> => {
    // Mock TON authentication
    const mockUser = await getUserByTONAddress(walletData.address, mockUsers);
    if (mockUser) {
      dispatch({ type: 'SET_USER', payload: mockUser });
      dispatch({ type: 'SET_SESSION', payload: createSession(mockUser) });
      return { success: true, requiresMFA: false, user: mockUser };
    }
    dispatch({ type: 'SET_ERROR', payload: 'TON authentication not supported' });
    return { success: false, requiresMFA: false, error: 'TON authentication not supported' };
  }, []);

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

  const authenticateWithMantra = useCallback(async (credentials: { email: string }): Promise<AuthResult> => {
    // Mantra-based authentication for admin/developer access
    const mockUser: AuthenticatedUser = {
      id: 'mantra-user-id',
      email: credentials.email,
      displayName: 'Mantra Admin',
      tonAddress: 'EQ...', // Mock TON address
      roles: [ROLES.admin, ROLES.developer],
      permissions: [...ROLES.admin.permissions, ...ROLES.developer.permissions],
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      // ... (rest of the properties)
    };
    dispatch({ type: 'SET_USER', payload: mockUser });
    dispatch({ type: 'SET_SESSION', payload: createSession(mockUser) });
    return { success: true, requiresMFA: false, user: mockUser };
  }, []);

  const updateUser = useCallback(async (updatedData: Partial<AuthenticatedUser>) => {
    if (!state.user) return;
    const updatedUser = { ...state.user, ...updatedData };
    dispatch({ type: 'SET_USER', payload: updatedUser });
    dispatch({ type: 'SET_SESSION', payload: createSession(updatedUser) });

    if (isSupabaseConfigured && (updatedData.roles || updatedData.displayName)) {
      await supabase.auth.updateUser({
        data: {
          roles: updatedData.roles || state.user.roles,
          display_name: updatedData.displayName || state.user.displayName
        }
      });
    }
  }, [state.user]);

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
    logAuditEvent,
    login,
    fetchProfile,
    updateUser
  };

  useEffect(() => {
    const initializeAuth = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });

      if (!isSupabaseConfigured) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: userProfile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (error) throw error;

          dispatch({ type: 'SET_USER', payload: userProfile });
          dispatch({ type: 'SET_SESSION', payload: createSession(userProfile) });
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize authentication' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    initializeAuth();

    if (!isSupabaseConfigured) return;

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const fetchUserProfile = async () => {
            const { data: userProfile, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();
            if (userProfile) {
              dispatch({ type: 'SET_USER', payload: userProfile });
              dispatch({ type: 'SET_SESSION', payload: createSession(userProfile) });
            }
          };
          fetchUserProfile();
        } else if (event === 'SIGNED_OUT') {
          dispatch({ type: 'LOGOUT' });
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

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
async function verifyTONSignature(): Promise<boolean> {
  // Mock signature verification - in real app would verify against TON network
  return true;
}

async function getUserByTONAddress(address: string, mockUsers: Record<string, AuthenticatedUser>): Promise<AuthenticatedUser | null> {
  return mockUsers[address] || null;
}

/*
// Mock MFA verification
async function verifyMFACode(method: string, code: string): Promise<boolean> {
  // Mock MFA verification
  return code === '123456'; // Simple mock
}
*/

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