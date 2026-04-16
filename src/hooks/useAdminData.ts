import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs, fetchAdminStats, fetchUsers } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export function useAuditLogs(limit = 100) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['audit-logs', limit],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return fetchAuditLogs(token, limit);
    },
    enabled: true,
  });
}

export function useAdminStats() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return fetchAdminStats(token);
    },
  });
}

export function useAdminUsers() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return fetchUsers(token);
    },
  });
}
