import { useQuery } from '@tanstack/react-query';
import { fetchTonBalance } from '../lib/api';

export function useTonBalance(address: string | undefined) {
  return useQuery({
    queryKey: ['ton-balance', address],
    queryFn: () => fetchTonBalance(address!),
    enabled: !!address,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
