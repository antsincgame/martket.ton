import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type {
  AuthContextValue,
  AuthenticatedUser,
  AuthSession,
  TONWalletAuth,
  AuthResult,
  SecurityEvent,
  SecurityFlag,
  SacredAccess,
  Permission,
} from '../types/auth';
import { appwriteAccount, isAppwriteConfigured } from '../lib/appwriteClient';
import { profileRowToAuthenticatedUser, type ProfileRow } from '../lib/authProfileMap';
import { storeApiUrl } from '../lib/storeApi';
import { ROLES } from '../domain/auth/roleCatalog';
import { logger } from '../lib/logger';
import type { Account } from 'appwrite';

async function fetchProfileRowWithJwt(jwt: string): Promise<ProfileRow | null> {
  const res = await fetch(storeApiUrl('/api/session/profile'), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { success?: boolean; data?: ProfileRow };
  return body.data ?? null;
}

async function syncAppwriteProfile(account: Account, name?: string): Promise<void> {
  const { jwt } = await account.createJWT();
  const res = await fetch(storeApiUrl('/api/auth/appwrite/sync'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: name ?? '' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'sync failed');
  }
}

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

const PERMISSION_ACTIONS = ['create', 'read', 'update', 'delete', 'approve', 'ban'] as const;

function isPermissionAction(value: string): value is Permission['actions'][number] {
  return (PERMISSION_ACTIONS as readonly string[]).includes(value);
}

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
    // В production сюда подключается аналитика/бекенд
    logger.warn('[SecurityEvent]', { ...event, id: String(Date.now()), timestamp: new Date() });
  }, []);

  const logAuditEvent = useCallback((actionLabel: string, resource: string, result: string, metadata?: Record<string, unknown>) => {
    logger.warn('[Audit]', { action: actionLabel, resource, result, metadata, at: new Date().toISOString() });
  }, []);

  const login = useCallback(
    async (credentials: { email?: string; password?: string; tonAddress?: string }): Promise<AuthResult> => {
      if (credentials.email && credentials.password) {
        if (!appwriteAccount || !isAppwriteConfigured) {
          return {
            success: false,
            requiresMFA: false,
            error: 'Appwrite не настроен. Задайте VITE_APPWRITE_ENDPOINT и VITE_APPWRITE_PROJECT_ID.',
          };
        }
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
          await appwriteAccount.createEmailPasswordSession(credentials.email, credentials.password);
          await syncAppwriteProfile(appwriteAccount);
          const { jwt } = await appwriteAccount.createJWT();
          const row = await fetchProfileRowWithJwt(jwt);
          if (!row) throw new Error('Профиль не найден после входа');
          const user = profileRowToAuthenticatedUser(row);
          const session = createSession(user);
          dispatch({ type: 'SET_USER', payload: user });
          dispatch({ type: 'SET_SESSION', payload: session });
          dispatch({ type: 'SET_ERROR', payload: null });
          return { success: true, requiresMFA: false, user, session };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Authentication failed';
          dispatch({ type: 'SET_ERROR', payload: message });
          return { success: false, requiresMFA: false, error: message };
        } finally {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      }

      if (credentials.tonAddress) {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
          const res = await fetch(
            storeApiUrl(`/api/profiles/by-ton/${encodeURIComponent(credentials.tonAddress)}`)
          );
          if (!res.ok) throw new Error('Пользователь с данным TON адресом не найден');
          const body = (await res.json()) as { data: ProfileRow };
          const user = profileRowToAuthenticatedUser(body.data);
          const session = createSession(user);
          dispatch({ type: 'SET_USER', payload: user });
          dispatch({ type: 'SET_SESSION', payload: session });
          dispatch({ type: 'SET_ERROR', payload: null });
          return { success: true, requiresMFA: false, user, session };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Authentication failed';
          dispatch({ type: 'SET_ERROR', payload: message });
          return { success: false, requiresMFA: false, error: message };
        } finally {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      }

      return { success: false, requiresMFA: false, error: 'Укажите email и пароль или TON-адрес' };
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    if (appwriteAccount && isAppwriteConfigured) {
      try {
        await appwriteAccount.deleteSessions();
      } catch {
        /* сессия уже сброшена */
      }
    }
    dispatch({ type: 'LOGOUT' });
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!appwriteAccount || !isAppwriteConfigured) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await appwriteAccount.get();
      const { jwt } = await appwriteAccount.createJWT();
      const row = await fetchProfileRowWithJwt(jwt);
      if (!row) {
        dispatch({ type: 'SET_USER', payload: null });
        dispatch({ type: 'SET_SESSION', payload: null });
        return;
      }
      const user = profileRowToAuthenticatedUser(row);
      dispatch({ type: 'SET_USER', payload: user });
      dispatch({ type: 'SET_SESSION', payload: createSession(user) });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error: unknown) {
      dispatch({ type: 'SET_USER', payload: null });
      dispatch({ type: 'SET_SESSION', payload: null });
      const message = error instanceof Error ? error.message : 'Failed to fetch profile';
      dispatch({ type: 'SET_ERROR', payload: message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Permission checking
  const hasPermission = useCallback((resource: string, action: string): boolean => {
    if (!state.user || !isPermissionAction(action)) return false;

    const userPermissions = state.user.permissions || [];

    return userPermissions.some((permission) => {
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

    return (roleNames as string[]).includes(roleName);
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

  const authenticateWithTON = useCallback(async (walletData: TONWalletAuth): Promise<AuthResult> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await fetch(storeApiUrl(`/api/profiles/by-ton/${encodeURIComponent(walletData.address)}`));
      if (!res.ok) {
        return { success: false, requiresMFA: false, error: 'Пользователь с данным TON адресом не найден' };
      }
      const body = (await res.json()) as { data: ProfileRow };
      const user = profileRowToAuthenticatedUser(body.data);
      const session = createSession(user);
      dispatch({ type: 'SET_USER', payload: user });
      dispatch({ type: 'SET_SESSION', payload: session });
      dispatch({ type: 'SET_ERROR', payload: null });
      return { success: true, requiresMFA: false, user, session };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'TON authentication failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      return { success: false, requiresMFA: false, error: message };
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const authenticateWithMFA = useCallback(async (_method: string, _code: string): Promise<AuthResult> => {
    return {
      success: false,
      requiresMFA: false,
      error: 'MFA не реализован. Подключите TOTP-провайдер для полноценной верификации.',
    };
  }, []);

  const updateUser = useCallback(async (updatedData: Partial<AuthenticatedUser>) => {
    if (!state.user) return;
    const updatedUser = { ...state.user, ...updatedData };
    dispatch({ type: 'SET_USER', payload: updatedUser });
    dispatch({ type: 'SET_SESSION', payload: createSession(updatedUser) });
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
    void fetchProfile();
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- useAuth экспортируется вместе с провайдером
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function createSession(user: AuthenticatedUser): AuthSession {
  const now = new Date();
  const role = user.roles[0] ?? ROLES.viewer;
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