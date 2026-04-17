/**
 * React Query hooks для эндпоинтов кабинета /api/session/*.
 *
 * Единая точка для library/products/stats — заменяет ручные useState/useEffect
 * в DemiurgePage и его секциях. Кешируется QueryClient'ом из src/lib/queryClient.ts.
 */
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { storeApiUrl } from '../lib/storeApi';
import { logger } from '../lib/logger';
import type { PurchaseWithProduct, CreatedProduct } from '../pages/demiurge/types';

export const sessionQueryKeys = {
  all: ['session'] as const,
  library: () => [...sessionQueryKeys.all, 'library'] as const,
  products: () => [...sessionQueryKeys.all, 'products'] as const,
  stats: () => [...sessionQueryKeys.all, 'stats'] as const,
  payouts: () => [...sessionQueryKeys.all, 'payouts'] as const,
  transactions: () => [...sessionQueryKeys.all, 'transactions'] as const,
} as const;

type GetToken = () => Promise<string | null>;

async function authFetch<T>(path: string, getToken: GetToken): Promise<T> {
  const token = await getToken();
  const res = await fetch(storeApiUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = `Request to ${path} failed with ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // ignore json parse error — keep status-based message
    }
    throw new Error(message);
  }
  const body = await res.json();
  return (body?.data ?? null) as T;
}

export function useLibraryQuery(): UseQueryResult<PurchaseWithProduct[], Error> {
  const { isAuthenticated, getToken } = useAuth();
  return useQuery<PurchaseWithProduct[], Error>({
    queryKey: sessionQueryKeys.library(),
    enabled: isAuthenticated,
    queryFn: async () => {
      try {
        const data = await authFetch<PurchaseWithProduct[] | null>(
          '/api/session/library',
          getToken,
        );
        return data ?? [];
      } catch (err) {
        logger.warn('[useLibraryQuery] failed:', err);
        throw err;
      }
    },
  });
}

export function useMyProductsQuery(): UseQueryResult<CreatedProduct[], Error> {
  const { isAuthenticated, getToken } = useAuth();
  return useQuery<CreatedProduct[], Error>({
    queryKey: sessionQueryKeys.products(),
    enabled: isAuthenticated,
    queryFn: async () => {
      try {
        const data = await authFetch<CreatedProduct[] | null>(
          '/api/session/products',
          getToken,
        );
        return data ?? [];
      } catch (err) {
        logger.warn('[useMyProductsQuery] failed:', err);
        throw err;
      }
    },
  });
}

// ── Stats ──────────────────────────────────────────────────────────────

export interface SessionStats {
  downloadsTotal: number;
  revenueTotal: number;
  revenue30d: number;
  sales30d: number;
  productsPublished: number;
  pendingReview: number;
  drafts: number;
  suspended: number;
  avgRating: number;
  reviewsTotal: number;
  librarySize: number;
}

const ZERO_STATS: SessionStats = {
  downloadsTotal: 0,
  revenueTotal: 0,
  revenue30d: 0,
  sales30d: 0,
  productsPublished: 0,
  pendingReview: 0,
  drafts: 0,
  suspended: 0,
  avgRating: 0,
  reviewsTotal: 0,
  librarySize: 0,
};

export function useSessionStatsQuery(): UseQueryResult<SessionStats, Error> {
  const { isAuthenticated, getToken } = useAuth();
  return useQuery<SessionStats, Error>({
    queryKey: sessionQueryKeys.stats(),
    enabled: isAuthenticated,
    queryFn: async () => {
      const data = await authFetch<SessionStats | null>('/api/session/stats', getToken);
      return data ?? ZERO_STATS;
    },
  });
}

// ── Payouts ────────────────────────────────────────────────────────────

export interface PayoutGroup {
  /** ISO date `YYYY-MM-01` для группировки по месяцам. */
  month: string;
  totalTon: number;
  salesCount: number;
}

export interface PayoutsLedger {
  totals: { lifetimeTon: number; thisMonthTon: number; salesAllTime: number };
  payouts: PayoutGroup[];
}

const ZERO_PAYOUTS: PayoutsLedger = {
  totals: { lifetimeTon: 0, thisMonthTon: 0, salesAllTime: 0 },
  payouts: [],
};

export function usePayoutsQuery(): UseQueryResult<PayoutsLedger, Error> {
  const { isAuthenticated, getToken } = useAuth();
  return useQuery<PayoutsLedger, Error>({
    queryKey: sessionQueryKeys.payouts(),
    enabled: isAuthenticated,
    queryFn: async () => {
      const data = await authFetch<PayoutsLedger | null>('/api/session/payouts', getToken);
      return data ?? ZERO_PAYOUTS;
    },
  });
}

export interface TransactionRow {
  id: string;
  type: 'sale' | 'payout' | 'refund';
  productId: string | null;
  productName: string | null;
  buyerId: string | null;
  amountTon: number;
  txHash: string | null;
  status: 'completed' | 'pending';
  createdAt: string;
}

export function useTransactionsQuery(limit = 50): UseQueryResult<TransactionRow[], Error> {
  const { isAuthenticated, getToken } = useAuth();
  return useQuery<TransactionRow[], Error>({
    queryKey: [...sessionQueryKeys.transactions(), { limit }] as const,
    enabled: isAuthenticated,
    queryFn: async () => {
      const data = await authFetch<TransactionRow[] | null>(
        `/api/session/transactions?limit=${limit}`,
        getToken,
      );
      return data ?? [];
    },
  });
}

// ── Cache invalidation helpers ────────────────────────────────────────

export function useSessionInvalidator() {
  const qc = useQueryClient();
  return {
    invalidateAll: () => qc.invalidateQueries({ queryKey: sessionQueryKeys.all }),
    invalidateProducts: () => qc.invalidateQueries({ queryKey: sessionQueryKeys.products() }),
    invalidateLibrary: () => qc.invalidateQueries({ queryKey: sessionQueryKeys.library() }),
    invalidateStats: () => qc.invalidateQueries({ queryKey: sessionQueryKeys.stats() }),
    invalidatePayouts: () => qc.invalidateQueries({ queryKey: sessionQueryKeys.payouts() }),
    invalidateTransactions: () => qc.invalidateQueries({ queryKey: sessionQueryKeys.transactions() }),
  };
}
