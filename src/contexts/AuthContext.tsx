import React, { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react';
import type {
  AuthContextValue,
  AuthenticatedUser,
  AuthSession,
  AuthResult,
  SecurityEvent,
  SecurityFlag,
  Permission,
} from '../types/auth';
import { profileRowToAuthenticatedUser, type ProfileRow } from '../lib/authProfileMap';
import { storeApiUrl } from '../lib/storeApi';
import { ROLES } from '../domain/auth/roleCatalog';
import { logger } from '../lib/logger';
import { CLERK_CONFIGURED, useClerkUser, useClerkAuth, useClerkUserStub, useClerkAuthStub } from '../lib/clerkSafe';

const PERMISSION_ACTIONS = ['create', 'read', 'update', 'delete', 'approve', 'ban'] as const;

function isPermissionAction(value: string): value is Permission['actions'][number] {
  return (PERMISSION_ACTIONS as readonly string[]).includes(value);
}

function createSession(user: AuthenticatedUser): AuthSession {
  const now = new Date();
  const role = user.roles[0] ?? ROLES.viewer;
  const duration = role.sessionDuration || 480;
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
    securityFlags: [],
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuthCore(
  isClerkLoaded: boolean,
  isSignedIn: boolean,
  getToken: () => Promise<string | null>,
): AuthContextValue {
  const [profile, setProfile] = useState<AuthenticatedUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityFlag[]>([]);
  const [securityEvents] = useState<SecurityEvent[]>([]);

  const fetchProfile = useCallback(async () => {
    if (!isSignedIn) {
      setProfile(null);
      setSession(null);
      setIsLoadingProfile(false);
      return;
    }
    setIsLoadingProfile(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      const res = await fetch(storeApiUrl('/api/session/profile'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setProfile(null); setSession(null); return; }
      const body = (await res.json()) as { success?: boolean; data?: ProfileRow };
      if (!body.data) { setProfile(null); setSession(null); return; }
      const user = profileRowToAuthenticatedUser(body.data);
      setProfile(user);
      setSession(createSession(user));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
      setProfile(null);
      setSession(null);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (isClerkLoaded) void fetchProfile();
  }, [isClerkLoaded, isSignedIn, fetchProfile]);

  const reportSecurityEvent = useCallback((event: Omit<SecurityEvent, 'id' | 'timestamp'>) => {
    logger.warn('[SecurityEvent]', { ...event, id: String(Date.now()), timestamp: new Date() });
  }, []);
  const logAuditEvent = useCallback((a: string, r: string, result: string, m?: Record<string, unknown>) => {
    logger.warn('[Audit]', { action: a, resource: r, result, metadata: m, at: new Date().toISOString() });
  }, []);
  const logout = useCallback(async () => { setProfile(null); setSession(null); setError(null); }, []);
  const hasPermission = useCallback((resource: string, action: string): boolean => {
    if (!profile || !isPermissionAction(action)) return false;
    return (profile.permissions || []).some(p => (p.resource === '*' || p.resource === resource) && p.actions.includes(action));
  }, [profile]);
  const hasRole = useCallback((roleName: string): boolean => {
    if (!profile) return false;
    const names = profile.roles.map(r => typeof r === 'string' ? r : r.name);
    if (names.includes('super_admin')) return true;
    return (names as string[]).includes(roleName);
  }, [profile]);
  const getSecurityLevel = useCallback(() => profile?.securityLevel || 'low', [profile]);
  const getSecurityAlerts = useCallback(() => securityAlerts, [securityAlerts]);
  const noop = useCallback(async (): Promise<AuthResult> => ({ success: false, requiresMFA: false, error: 'Not available' }), []);
  const updateUser = useCallback(async (d: Partial<AuthenticatedUser>) => {
    if (!profile) return;
    const u = { ...profile, ...d };
    setProfile(u);
    setSession(createSession(u));
  }, [profile]);

  const isLoading = !isClerkLoaded || isLoadingProfile;

  const value: AuthContextValue = useMemo(() => ({
    user: profile,
    session,
    isLoading,
    isAuthenticated: !!isSignedIn && !!profile,
    securityAlerts,
    sacredAccess: null,
    error,
    loginAttempts: { timestamp: 0, count: 0 },
    securityEvents,
    authenticateWithTON: noop,
    authenticateWithMFA: noop,
    logout,
    hasPermission,
    hasRole,
    getSecurityLevel,
    reportSecurityEvent,
    clearSecurityAlerts: () => setSecurityAlerts([]),
    getSecurityAlerts,
    logAuditEvent,
    login: noop,
    fetchProfile,
    updateUser,
    getToken,
  }), [
    profile, session, isLoading, isSignedIn, securityAlerts, error, securityEvents,
    noop, logout, hasPermission, hasRole, getSecurityLevel, reportSecurityEvent,
    getSecurityAlerts, logAuditEvent, fetchProfile, updateUser, getToken,
  ]);

  return value;
}

const ClerkAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded } = useClerkUser();
  const { isSignedIn, getToken } = useClerkAuth();
  const value = useAuthCore(isLoaded, !!isSignedIn, getToken);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const StubAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded } = useClerkUserStub();
  const { isSignedIn, getToken } = useClerkAuthStub();
  const value = useAuthCore(isLoaded, isSignedIn, getToken);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (CLERK_CONFIGURED) return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
  return <StubAuthProvider>{children}</StubAuthProvider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
