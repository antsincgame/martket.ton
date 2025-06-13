import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Edit, Trash2, Eye, Ban, CheckCircle, Search, Filter, Database, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabaseClient';

interface SupabaseUser {
  id: string;
  name: string;
  email: string;
  description: string;
  ton_address: string;
  created_at: string;
  role?: string;
  status?: 'active' | 'suspended' | 'pending';
  last_login?: string;
  risk_score?: number;
}

const RealUserManagement: React.FC = () => {
  const { hasPermission, reportSecurityEvent, user: currentUser } = useAuth();
  const [users, setUsers] = useState<SupabaseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<SupabaseUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    description: '',
    ton_address: '',
    role: 'user'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('developers')
        .select('*')
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;

      // Add mock user properties for demo
      const usersWithStatus = data?.map(user => ({
        ...user,
        role: user.email?.includes('admin') ? 'admin' : 
              user.email?.includes('mod') ? 'moderator' : 'developer',
        status: Math.random() > 0.8 ? 'suspended' : 'active',
        last_login: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        risk_score: Math.floor(Math.random() * 30)
      })) || [];

      setUsers(usersWithStatus);
    } catch (err) {
      console.error('Error loading users:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.ton_address) {
      alert('Please fill all required fields');
      return;
    }

    try {
      const { data, error: supabaseError } = await supabase
        .from('developers')
        .insert([{
          name: newUser.name,
          email: newUser.email,
          description: newUser.description,
          ton_address: newUser.ton_address
        }])
        .select();

      if (supabaseError) throw supabaseError;

      reportSecurityEvent({
        type: 'data_access',
        severity: 'info',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { 
          action: 'create_user',
          user_email: newUser.email,
          creator: currentUser?.email
        }
      });

      setNewUser({ name: '', email: '', description: '', ton_address: '', role: 'user' });
      setShowUserModal(false);
      loadUsers();
    } catch (err) {
      console.error('Error creating user:', err);
      alert('Failed to create user: ' + (err as Error).message);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      const { error: supabaseError } = await supabase
        .from('developers')
        .delete()
        .eq('id', userId);

      if (supabaseError) throw supabaseError;

      reportSecurityEvent({
        type: 'data_access',
        severity: 'warning',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { 
          action: 'delete_user',
          target_user_id: userId,
          operator: currentUser?.email
        }
      });

      loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Failed to delete user: ' + (err as Error).message);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.ton_address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-red-400 bg-red-500/20';
      case 'moderator': return 'text-yellow-400 bg-yellow-500/20';
      case 'developer': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/20';
      case 'suspended': return 'text-red-400 bg-red-500/20';
      case 'pending': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  if (!hasPermission('users', 'read')) {
    return (
      <div className="text-center p-8 bg-red-500/10 rounded-lg">
        <Shield className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <h3 className="text-xl font-bold text-red-400 mb-2">Access Denied</h3>
        <p className="text-gray-400">You don't have permission to view user management.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Database className="mr-3 text-blue-400" />
          Real User Management 👥
        </h2>
        <div className="flex space-x-2">
          <button 
            onClick={loadUsers}
            disabled={loading}
            className="bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {hasPermission('users', 'create') && (
            <button 
              onClick={() => setShowUserModal(true)}
              className="bg-green-500/20 text-green-300 px-4 py-2 rounded-lg hover:bg-green-500/30 transition-colors flex items-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:border-blue-500/50 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{users.length}</div>
          <div className="text-gray-400 text-sm">Total Users</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{users.filter(u => u.status === 'active').length}</div>
          <div className="text-gray-400 text-sm">Active</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-400">{users.filter(u => u.status === 'suspended').length}</div>
          <div className="text-gray-400 text-sm">Suspended</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{users.filter(u => u.role === 'admin').length}</div>
          <div className="text-gray-400 text-sm">Admins</div>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center p-8">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-4 text-blue-400" />
          <p className="text-gray-400">Loading sacred users... ✨</p>
        </div>
      ) : error ? (
        <div className="text-center p-8 bg-red-500/10 rounded-lg">
          <Shield className="w-8 h-8 mx-auto mb-4 text-red-400" />
          <p className="text-red-400 font-semibold">Error loading users</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button onClick={loadUsers} className="bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">TON Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Risk</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-white">{user.name}</div>
                        <div className="text-sm text-gray-400">{user.email}</div>
                        <div className="text-xs text-gray-500">{new Date(user.created_at).toLocaleDateString()}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getRoleColor(user.role || 'user')}`}>
                        {user.role?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(user.status || 'active')}`}>
                        {user.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-mono text-sm text-blue-400">
                        {user.ton_address.slice(0, 8)}...{user.ton_address.slice(-8)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        (user.risk_score || 0) >= 20 ? 'text-red-400' :
                        (user.risk_score || 0) >= 10 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {user.risk_score || 0}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="text-blue-400 hover:text-blue-300"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {hasPermission('users', 'delete') && (
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="text-red-400 hover:text-red-300"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Create New User</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                value={newUser.name}
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
              />
              <input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
              />
              <input
                type="text"
                placeholder="TON Address"
                value={newUser.ton_address}
                onChange={(e) => setNewUser({...newUser, ton_address: e.target.value})}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
              />
              <textarea
                placeholder="Description"
                value={newUser.description}
                onChange={(e) => setNewUser({...newUser, description: e.target.value})}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
                rows={3}
              />
            </div>
            <div className="flex space-x-4 mt-6">
              <button
                onClick={createUser}
                className="flex-1 bg-green-500/20 text-green-300 py-2 rounded-lg hover:bg-green-500/30 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowUserModal(false)}
                className="flex-1 bg-gray-500/20 text-gray-300 py-2 rounded-lg hover:bg-gray-500/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold text-white mb-4">User Details</h3>
            <div className="space-y-3">
              <div><span className="text-gray-400">Name:</span> <span className="text-white">{selectedUser.name}</span></div>
              <div><span className="text-gray-400">Email:</span> <span className="text-white">{selectedUser.email}</span></div>
              <div><span className="text-gray-400">Description:</span> <span className="text-white">{selectedUser.description}</span></div>
              <div><span className="text-gray-400">TON Address:</span> <span className="text-blue-400 font-mono">{selectedUser.ton_address}</span></div>
              <div><span className="text-gray-400">Created:</span> <span className="text-white">{new Date(selectedUser.created_at).toLocaleString()}</span></div>
              <div><span className="text-gray-400">Role:</span> <span className={getRoleColor(selectedUser.role || 'user')}>{selectedUser.role}</span></div>
              <div><span className="text-gray-400">Status:</span> <span className={getStatusColor(selectedUser.status || 'active')}>{selectedUser.status}</span></div>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="w-full mt-6 bg-blue-500/20 text-blue-300 py-2 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <p className="text-gray-400 text-sm">
          🌟 Real-time user management connected to Supabase database
        </p>
      </div>
    </div>
  );
};

export default RealUserManagement; 