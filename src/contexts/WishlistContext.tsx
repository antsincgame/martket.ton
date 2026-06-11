/**
 * Buyer wishlist / favorites (store-class engagement). Holds the signed-in
 * user's saved catalog-product ids and exposes an optimistic toggle. For guests
 * it stays empty and `isAuthenticated` lets callers prompt sign-in.
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { fetchWishlist, addWishlistItem, removeWishlistItem } from '../lib/api';
import { logger } from '../lib/logger';

interface WishlistContextValue {
  savedIds: Set<string>;
  isSaved: (id: string) => boolean;
  toggle: (id: string) => Promise<void>;
  ready: boolean;
  isAuthenticated: boolean;
}

const WishlistCtx = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, getToken } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) { setSavedIds(new Set()); setReady(true); return; }
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const ids = await fetchWishlist(token);
        if (!cancelled) setSavedIds(new Set(ids));
      } catch (err) {
        logger.warn('[wishlist] load failed:', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, getToken]);

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  const toggle = useCallback(async (id: string) => {
    if (!isAuthenticated || inFlight.current.has(id)) return;
    const wasSaved = savedIds.has(id);
    inFlight.current.add(id);
    // Optimistic update.
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id); else next.add(id);
      return next;
    });
    try {
      const token = await getToken();
      if (!token) throw new Error('no token');
      if (wasSaved) await removeWishlistItem(id, token);
      else await addWishlistItem(id, token);
    } catch (err) {
      logger.warn('[wishlist] toggle failed, reverting:', err);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(id); else next.delete(id);
        return next;
      });
    } finally {
      inFlight.current.delete(id);
    }
  }, [isAuthenticated, getToken, savedIds]);

  return (
    <WishlistCtx.Provider value={{ savedIds, isSaved, toggle, ready, isAuthenticated }}>
      {children}
    </WishlistCtx.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistCtx);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
