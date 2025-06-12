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
import { supabase } from '../utils/supabaseClient';

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

  // Supabase login by email (magic link) or TON address
  const login = useCallback(async (credentials: { email?: string; tonAddress?: string }): Promise<AuthResult> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      let user = null;
      let session = null;
      let error = null;

      if (credentials.email) {
        // Email magic link
        const { error: signInError } = await supabase.auth.signInWithOtp({ email: credentials.email });
        if (signInError) throw signInError;
        // Пользователь должен подтвердить email, сессия появится после этого
        return { success: true, requiresMFA: false };
      } else if (credentials.tonAddress) {
        // Поиск пользователя по TON адресу
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('ton_address', credentials.tonAddress)
          .single();
        if (fetchError) throw fetchError;
        user = data;
        // Можно создать сессию вручную, если нужно
        session = createSession(user);
        dispatch({ type: 'SET_USER', payload: user });
        dispatch({ type: 'SET_SESSION', payload: session });
        dispatch({ type: 'SET_ERROR', payload: null });
        return { success: true, user, session, requiresMFA: false };
      } else {
        throw new Error('No credentials provided');
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Authentication failed' });
      return { success: false, error: error.message || 'Authentication failed' };
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
    dispatch({ type: 'LOGOUT' });
  }, []);

  // Получение профиля пользователя из Supabase
  const fetchProfile = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        dispatch({ type: 'SET_USER', payload: null });
        dispatch({ type: 'SET_SESSION', payload: null });
        return;
      }
      // Получаем расширенный профиль из таблицы users
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      if (fetchError) throw fetchError;
      dispatch({ type: 'SET_USER', payload: data });
      // Можно создать сессию вручную, если нужно
      dispatch({ type: 'SET_SESSION', payload: createSession(data) });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to fetch profile' });
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
    
    // super_admin имеет доступ ко всем ролям
    const userRoles = state.user.roles.map(role => role.name);
    if (userRoles.includes('super_admin')) return true;
    
    return userRoles.includes(roleName);
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

  // Метод для обновления данных пользователя, например, после регистрации разработчика
  const updateUser = useCallback(async (updatedData: Partial<AuthenticatedUser>) => {
    if (!state.user) return;
    const updatedUser = { ...state.user, ...updatedData };
    dispatch({ type: 'SET_USER', payload: updatedUser });
    dispatch({ type: 'SET_SESSION', payload: createSession(updatedUser) });
    // Также обновляем данные в Supabase Auth, если нужно
    if (updatedData.roles || updatedData.displayName) {
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
      try {
        // Проверяем текущую сессию в Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const { user } = session;
          // Проверяем user_metadata на наличие ролей
          const roles = user.user_metadata?.roles || [];
          // Загружаем дополнительные данные из таблицы developers, если есть
          let profileData = {
            bio: '',
            avatarUrl: '',
            website: '',
            location: ''
          };
          let tonAddress = '';
          if (roles.includes('developer')) {
            const { data: developerData, error } = await supabase
              .from('developers')
              .select('description, ton_address')
              .eq('email', user.email)
              .single();
            if (!error && developerData) {
              profileData.bio = developerData.description;
              tonAddress = developerData.ton_address;
            }
          }
          // Формируем объект пользователя для AuthContext
          const authUser: AuthenticatedUser = {
            id: user.id,
            email: user.email || '',
            displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
            tonAddress: tonAddress,
            roles: roles,
            createdAt: user.created_at || new Date().toISOString(),
            lastLogin: user.last_sign_in_at || new Date().toISOString(),
            profile: profileData,
            stats: {
              products: 0,
              sales: 0,
              rating: 0,
              reviews: 0
            },
            products: [],
            library: [],
            achievements: []
          };
          dispatch({ type: 'SET_USER', payload: authUser });
          dispatch({ type: 'SET_SESSION', payload: createSession(authUser) });
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize authentication' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    initializeAuth();

    // Подписываемся на изменения состояния аутентификации
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) {
        const roles = session.user.user_metadata?.roles || [];
        const authUser: AuthenticatedUser = {
          id: session.user.id,
          email: session.user.email || '',
          displayName: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'User',
          tonAddress: '', // TODO: Загрузить tonAddress из Supabase, если нужно
          roles: roles,
          createdAt: session.user.created_at || new Date().toISOString(),
          lastLogin: session.user.last_sign_in_at || new Date().toISOString(),
          profile: {
            bio: '',
            avatarUrl: '',
            website: '',
            location: ''
          },
          stats: {
            products: 0,
            sales: 0,
            rating: 0,
            reviews: 0
          },
          products: [],
          library: [],
          achievements: []
        };
        dispatch({ type: 'SET_USER', payload: authUser });
        dispatch({ type: 'SET_SESSION', payload: createSession(authUser) });
      } else {
        dispatch({ type: 'LOGOUT' });
      }
    });

    // Подписываемся на изменения данных пользователя в таблице developers
    let subscription;
    if (state.user && state.user.roles.includes('developer')) {
      subscription = supabase
        .from('developers')
        .on('UPDATE', async (payload) => {
          if (payload.new.email === state.user?.email) {
            const updatedProfile = {
              bio: payload.new.description || state.user?.profile.bio || '',
              avatarUrl: state.user?.profile.avatarUrl || '',
              website: state.user?.profile.website || '',
              location: state.user?.profile.location || ''
            };
            const updatedUser = {
              ...state.user,
              tonAddress: payload.new.ton_address || state.user?.tonAddress,
              profile: updatedProfile
            };
            dispatch({ type: 'SET_USER', payload: updatedUser });
          }
        })
        .subscribe();
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      authListener.subscription.unsubscribe();
    };
  }, [state.user]);

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