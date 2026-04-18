import { useQuery } from '@tanstack/react-query';
import { storeApiUrl } from '../lib/storeApi';

interface TonPriceData {
  usd: number;
  updatedAt: string;
}

async function fetchTonPrice(): Promise<number> {
  const res = await fetch(storeApiUrl('/api/ton-price'));
  if (!res.ok) return 0;
  const body = (await res.json()) as { success: boolean; data?: TonPriceData };
  return body.data?.usd ?? 0;
}

export function useTonPrice() {
  return useQuery({
    queryKey: ['ton-price-usd'],
    queryFn: fetchTonPrice,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}
