import React, { useState, useEffect, useCallback } from 'react';
import { Users, Shield, Eye, Search, Database, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { storeApiUrl } from '../lib/storeApi';

interface DemiurgeProfile {
  id: string;
  name: string;
  display_name: string;
  email: string;
  ton_address: string | null;
  role: string;
  bio: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const RealUserManagement: React.FC = () => {
  const { hasPermission, getToken } = useAuth();
  const [users, setUsers] = useState<DemiurgeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<DemiurgeProfile | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(storeApiUrl('/api/users'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      setUsers(body.data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = users.filter(user =>
    (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.display_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
      case 'admin': return 'text-[#FF4444] bg-[#FF4444]/10';
      case 'moderator': return 'text-[#FFD700] bg-[#FFD700]/10';
      case 'demiurge': return 'text-[#00F5FF] bg-[#00F5FF]/10';
      default: return 'text-[#999999] bg-white/5';
    }
  };

  if (!hasPermission('users', 'read')) {
    return (
      <div className="text-center p-8 rounded-xl border border-[#FF4444]/20 bg-[#FF4444]/5">
        <Shield className="w-12 h-12 mx-auto mb-4 text-[#FF4444]" />
        <h3 className="text-xl font-bold text-[#FF4444] mb-2">Access Denied</h3>
        <p className="text-[#999999]">You don't have permission to view user management.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Database className="mr-3 text-[#00F5FF]" />
          Demiurge Management
        </h2>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="border border-[#00F5FF]/30 text-[#00F5FF] px-4 py-2 rounded-lg hover:bg-[#00F5FF]/10 transition-colors flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#666666]" />
          <input
            type="text"
            placeholder="Search demiurges..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-[#666666] focus:border-[#FFD700]/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-[#FFD700]/10 bg-[#0D0D1A] p-4">
          <div className="text-2xl font-bold text-white">{users.length}</div>
          <div className="text-[#666666] text-sm">Total Demiurges</div>
        </div>
        <div className="rounded-lg border border-[#00FF88]/10 bg-[#0D0D1A] p-4">
          <div className="text-2xl font-bold text-[#00FF88]">{users.filter(u => u.is_active).length}</div>
          <div className="text-[#666666] text-sm">Active</div>
        </div>
        <div className="rounded-lg border border-[#FF4444]/10 bg-[#0D0D1A] p-4">
          <div className="text-2xl font-bold text-[#FF4444]">{users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}</div>
          <div className="text-[#666666] text-sm">Admins</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-8">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-4 text-[#FFD700]" />
          <p className="text-[#999999]">Loading demiurges...</p>
        </div>
      ) : error ? (
        <div className="text-center p-8 rounded-xl border border-[#FF4444]/20 bg-[#FF4444]/5">
          <Shield className="w-8 h-8 mx-auto mb-4 text-[#FF4444]" />
          <p className="text-[#FF4444] font-semibold">Error loading demiurges</p>
          <p className="text-[#999999] text-sm mb-4">{error}</p>
          <button onClick={loadUsers} className="border border-[#00F5FF]/30 text-[#00F5FF] px-4 py-2 rounded-lg hover:bg-[#00F5FF]/10 transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#FFD700]/10 bg-[#0D0D1A] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#666666] uppercase tracking-wider">Demiurge</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#666666] uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#666666] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#666666] uppercase tracking-wider">Wallet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#666666] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-white">{user.display_name || user.name}</div>
                        <div className="text-sm text-[#666666]">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getRoleColor(user.role || 'demiurge')}`}>
                        {(user.role || 'demiurge').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        user.is_active ? 'text-[#00FF88] bg-[#00FF88]/10' : 'text-[#FF4444] bg-[#FF4444]/10'
                      }`}>
                        {user.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.ton_address ? (
                        <div className="font-mono text-sm text-[#00F5FF]">
                          {user.ton_address.slice(0, 6)}...{user.ton_address.slice(-4)}
                        </div>
                      ) : (
                        <span className="text-[#666666] text-sm">Not linked</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-[#00F5FF] hover:text-white transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="rounded-2xl border border-[#FFD700]/20 bg-[#1A1A1A] p-6 max-w-lg w-full shadow-[0_0_40px_rgba(255,215,0,0.08)]">
            <h3 className="text-xl font-bold uppercase tracking-widest text-white mb-4">Demiurge Details</h3>
            <div className="space-y-3">
              <div><span className="text-[#666666]">Name:</span> <span className="text-white ml-2">{selectedUser.display_name || selectedUser.name}</span></div>
              <div><span className="text-[#666666]">Email:</span> <span className="text-white ml-2">{selectedUser.email}</span></div>
              <div><span className="text-[#666666]">Bio:</span> <span className="text-white ml-2">{selectedUser.bio || 'N/A'}</span></div>
              <div><span className="text-[#666666]">TON Address:</span> <span className="text-[#00F5FF] font-mono ml-2">{selectedUser.ton_address || 'Not linked'}</span></div>
              <div><span className="text-[#666666]">Created:</span> <span className="text-white ml-2">{new Date(selectedUser.created_at).toLocaleString()}</span></div>
              <div><span className="text-[#666666]">Role:</span> <span className={`ml-2 ${getRoleColor(selectedUser.role || 'demiurge')}`}>{selectedUser.role}</span></div>
              <div><span className="text-[#666666]">Status:</span> <span className={`ml-2 ${selectedUser.is_active ? 'text-[#00FF88]' : 'text-[#FF4444]'}`}>{selectedUser.is_active ? 'Active' : 'Inactive'}</span></div>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="w-full mt-6 border border-[#FFD700]/50 bg-transparent py-2 rounded-lg text-[#FFD700] font-semibold uppercase tracking-widest text-sm hover:bg-[#FFD700]/10 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealUserManagement;
