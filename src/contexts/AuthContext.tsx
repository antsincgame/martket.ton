import React, { createContext, useContext, useCallback, useEffect, useState, useMemo, useRef } from 'react';
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
import { getCurrentUser, getJwt, logout as appwriteLogout } from '../lib/appwriteAuth';

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
    ipAddress: '',
    userAgent: navigator.userAgent,
    mfaVerified: false,
    securityFlags: [],
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Single source of truth for auth state.
 *
 * Bootstraps by asking Appwrite for the current account; if a session exists,
 * fetches the backend profile and exposes a stable `useAuth()` contract.
 *
 * `getToken()` returns a short-lived Appwrite JWT (cached in lib/appwriteAuth)
 * that backend middleware verifies via `Account.get()`.
 */
function useAuthInternal(): AuthContextValue {
  const [profile, setProfile] = useState<AuthenticatedUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isAppwriteLoaded, setIsAppwriteLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityFlag[]>([]);
  const [securityEvents] = useState<SecurityEvent[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const fetchProfile = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoadingProfile(true);
    setError(null);

    // After OTP / OAuth the session already exists but isSignedIn may still
    // be false (it was set during the initial mount check). Eagerly verify
    // the Appwrite session so downstream `isAuthenticated` is correct even
    // if the caller (SignInPage / AuthCallbackPage) invokes fetchProfile()
    // right after creating the session.
    const currentUser = await getCurrentUser();
    if (currentUser && !controller.signal.aborted) {
      setIsSignedIn(true);
    }

    const timeout = setTimeout(() => controller.abort(), 8000);

    const tryFetch = async (): Promise<ProfileRow | null> => {
      if (controller.signal.aborted) return null;
      const token = await getJwt();
      if (!token || controller.signal.aborted) return null;
      const res = await fetch(storeApiUrl('/api/session/profile'), {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        logger.warn(`[fetchProfile] ${res.status} ${res.statusText}`);
        if (res.status === 401) setError('Authentication expired — please sign in again');
        return null;
      }
      const body = (await res.json()) as { success?: boolean; data?: ProfileRow };
      return body.data ?? null;
    };

    try {
      let data = await tryFetch();
      if (!data && !controller.signal.aborted) {
        await new Promise(r => setTimeout(r, 1500));
        data = await tryFetch();
      }
      if (controller.signal.aborted) return;
      if (data) {
        const u = profileRowToAuthenticatedUser(data);
        setProfile(u);
        setSession(createSession(u));
      } else {
        setProfile(null);
        setSession(null);
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Profile request timed out');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch profile');
      }
      setProfile(null);
      setSession(null);
    } finally {
      clearTimeout(timeout);
      if (!controller.signal.aborted) setIsLoadingProfile(false);
    }
  }, []);

  // On mount: ask Appwrite for current session and decide whether to load
  // the backend profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCurrentUser();
      if (cancelled) return;
      const signed = !!user;
      setIsSignedIn(signed);
      setIsAppwriteLoaded(true);
      if (signed) {
        await fetchProfile();
      } else {
        setIsLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [fetchProfile]);

  const reportSecurityEvent = useCallback((event: Omit<SecurityEvent, 'id' | 'timestamp'>) => {
    logger.warn('[SecurityEvent]', { ...event, id: String(Date.now()), timestamp: new Date() });
  }, []);
  const logAuditEvent = useCallback((a: string, r: string, result: string, m?: Record<string, unknown>) => {
    logger.warn('[Audit]', { action: a, resource: r, result, metadata: m, at: new Date().toISOString() });
  }, []);
  const logout = useCallback(async () => {
    await appwriteLogout();
    setProfile(null);
    setSession(null);
    setIsSignedIn(false);
    setError(null);
  }, []);
  const hasPermission = useCallback((resource: string, action: string): boolean => {
    if (!profile || !isPermissionAction(action)) return false;
    return (profile.permissions || []).some(p => (p.resource === '*' || p.resource === resource) && p.actions.includes(action));
  }, [profile]);
  const hasRole = useCallback((roleName: string): boolean => {
    if (!profile) return false;
    const ROLE_HIERARCHY: Record<string, number> = {
      super_admin: 100, admin: 80, moderator: 60, demiurge: 40, viewer: 10,
    };
    const rawNames: string[] = profile.roles.map(r => typeof r === 'string' ? r : r.name);
    const names = rawNames.map(n => (n === 'seller' ? 'demiurge' : n));
    if (names.includes('super_admin')) return true;
    const requiredLevel = ROLE_HIERARCHY[roleName === 'seller' ? 'demiurge' : roleName] ?? 0;
    return names.some(n => (ROLE_HIERARCHY[n] ?? 0) >= requiredLevel);
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

  const isLoading = !isAppwriteLoaded || (isSignedIn && isLoadingProfile);

  const clearAlerts = useCallback(() => setSecurityAlerts([]), []);

  const stableGetToken = useCallback(async () => getJwt(), []);

  const value: AuthContextValue = useMemo(() => ({
    user: profile,
    session,
    isLoading,
    isAuthenticated: !!isSignedIn && !!profile,
    providerSignedIn: !!isSignedIn,
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
    clearSecurityAlerts: clearAlerts,
    getSecurityAlerts,
    logAuditEvent,
    login: noop,
    fetchProfile,
    updateUser,
    getToken: stableGetToken,
  }), [
    profile, session, isLoading, isSignedIn, securityAlerts, error, securityEvents,
    noop, logout, hasPermission, hasRole, getSecurityLevel, reportSecurityEvent,
    clearAlerts, getSecurityAlerts, logAuditEvent, fetchProfile, updateUser, stableGetToken,
  ]);

  return value;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useAuthInternal();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
