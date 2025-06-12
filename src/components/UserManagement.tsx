import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Edit, Trash2, Eye, Ban, CheckCircle, Search, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AuthenticatedUser } from '../types/auth';

interface UserListItem extends AuthenticatedUser {
  status: 'active' | 'suspended' | 'pending';
  lastActivity: Date;
  loginCount: number;
  riskScore: number;
}

const UserManagement: React.FC = () => {
  const { hasPermission, reportSecurityEvent } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // Load mock users data
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Mock user data - in real app would fetch from API
      const mockUsers: UserListItem[] = [
        {
          id: 'user-1',
          tonAddress: 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N',
          email: 'sacred.admin@tonwebstore.com',
          username: 'sacred_admin',
          roles: [{
            id: 'super_admin',
            name: 'super_admin',
            permissions: [{ resource: '*', actions: ['create', 'read', 'update', 'delete', 'approve', 'ban'] }],
            sessionDuration: 120,
            requiresMFA: true,
            description: 'Supreme cosmic administrator'
          }],
          mfaMethods: [],
          lastLogin: new Date(),
          loginHistory: [],
          securityLevel: 'critical',
          isActive: true,
          profile: { displayName: 'Sacred Administrator', avatar: '🧿' },
          status: 'active',
          lastActivity: new Date(),
          loginCount: 156,
          riskScore: 5
        },
        {
          id: 'user-2',
          tonAddress: 'EQB1aB2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X',
          email: 'dharma.moderator@tonwebstore.com',
          username: 'dharma_mod',
          roles: [{
            id: 'moderator',
            name: 'moderator',
            permissions: [
              { resource: 'products', actions: ['read', 'update', 'approve'] },
              { resource: 'users', actions: ['read', 'ban'] }
            ],
            sessionDuration: 360,
            requiresMFA: false,
            description: 'Content moderator'
          }],
          mfaMethods: [],
          lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
          loginHistory: [],
          securityLevel: 'medium',
          isActive: true,
          profile: { displayName: 'Dharma Moderator', avatar: '🪄' },
          status: 'active',
          lastActivity: new Date(Date.now() - 30 * 60 * 1000),
          loginCount: 89,
          riskScore: 15
        },
        {
          id: 'user-3',
          tonAddress: 'EQC2bC3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y',
          email: 'sacred.dev@tonwebstore.com',
          username: 'sacred_dev',
          roles: [{
            id: 'developer',
            name: 'developer',
            permissions: [
              { resource: 'products', actions: ['create', 'read', 'update'], conditions: { owner: true } }
            ],
            sessionDuration: 480,
            requiresMFA: false,
            description: 'Sacred developer'
          }],
          mfaMethods: [],
          lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000),
          loginHistory: [],
          securityLevel: 'low',
          isActive: true,
          profile: { displayName: 'Sacred Developer', avatar: '✨' },
          status: 'active',
          lastActivity: new Date(Date.now() - 4 * 60 * 60 * 1000),
          loginCount: 234,
          riskScore: 8
        },
        {
          id: 'user-4',
          tonAddress: 'EQD3cD4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z',
          email: 'support@tonwebstore.com',
          username: 'compassion_helper',
          roles: [{
            id: 'support',
            name: 'support',
            permissions: [
              { resource: 'users', actions: ['read'] },
              { resource: 'tickets', actions: ['create', 'read', 'update'] }
            ],
            sessionDuration: 1440,
            requiresMFA: false,
            description: 'Support agent'
          }],
          mfaMethods: [],
          lastLogin: new Date(Date.now() - 48 * 60 * 60 * 1000),
          loginHistory: [],
          securityLevel: 'medium',
          isActive: false,
          profile: { displayName: 'Compassion Helper', avatar: '🤝' },
          status: 'suspended',
          lastActivity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          loginCount: 45,
          riskScore: 25
        }
      ];

      setTimeout(() => {
        setUsers(mockUsers);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load users:', error);
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.profile.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.roles.some(role => role.name === filterRole);
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleUserAction = async (userId: string, action: string) => {
    if (!hasPermission('users', action as 'create' | 'read' | 'update' | 'delete' | 'ban')) {
      reportSecurityEvent({
        type: 'permission_denied',
        severity: 'warning',
        ipAddress: 'client_ip',
        userAgent: navigator.userAgent,
        details: { 
          action: `user_${action}`,
          target_user_id: userId,
          reason: 'insufficient_permissions'
        }
      });
      return;
    }

    reportSecurityEvent({
      type: 'data_access',
      severity: 'info',
      ipAddress: 'client_ip',
      userAgent: navigator.userAgent,
      details: { 
        action: `user_${action}`,
        target_user_id: userId
      }
    });

    // Mock action implementation
    switch (action) {
      case 'ban':
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, status: 'suspended' as const, isActive: false } : user
        ));
        break;
      case 'activate':
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, status: 'active' as const, isActive: true } : user
        ));
        break;
      case 'delete':
        if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
          setUsers(prev => prev.filter(user => user.id !== userId));
        }
        break;
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 20) return 'text-red-400';
    if (score >= 10) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/20';
      case 'suspended': return 'text-red-400 bg-red-500/20';
      case 'pending': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ton-400"></div>
        <span className="ml-4 text-white">Loading sacred users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center">
            <Users className="w-7 h-7 mr-3 text-blue-400" />
            Sacred User Management 👥
          </h2>
          <p className="text-gray-400 mt-1">Manage divine community members and their karmic permissions</p>
        </div>

        {hasPermission('users', 'create') && (
          <button className="bg-ton-gradient hover:scale-105 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 shadow-lg flex items-center space-x-2">
            <UserPlus className="w-5 h-5" />
            <span>Invite Sacred User</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ton-500"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-ton-500"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="developer">Developer</option>
              <option value="support">Support</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-ton-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-gray-400 text-sm">
          Showing {filteredUsers.length} of {users.length} sacred beings ✨
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-gray-300">User</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-300">Role</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-300">Status</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-300">Last Activity</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-300">Risk Score</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-t border-white/10 hover:bg-white/5 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-mystical-gradient rounded-full flex items-center justify-center text-white font-bold">
                        {user.profile.avatar}
                      </div>
                      <div>
                        <div className="text-white font-medium">{user.profile.displayName}</div>
                        <div className="text-gray-400 text-sm">{user.username}</div>
                        <div className="text-gray-500 text-xs font-mono">
                          {user.tonAddress.slice(0, 8)}...{user.tonAddress.slice(-8)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role.id}
                          className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium"
                        >
                          {role.name.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-white text-sm">
                      {user.lastActivity.toLocaleDateString()}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {user.lastActivity.toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`font-bold ${getRiskScoreColor(user.riskScore)}`}>
                      {user.riskScore}%
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowUserModal(true);
                        }}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {hasPermission('users', 'update') && (
                        <button
                          className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}

                      {hasPermission('users', 'ban') && user.status === 'active' && (
                        <button
                          onClick={() => handleUserAction(user.id, 'ban')}
                          className="p-2 text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors"
                          title="Suspend User"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}

                      {hasPermission('users', 'ban') && user.status === 'suspended' && (
                        <button
                          onClick={() => handleUserAction(user.id, 'activate')}
                          className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                          title="Activate User"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}

                      {hasPermission('users', 'delete') && (
                        <button
                          onClick={() => handleUserAction(user.id, 'delete')}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
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

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No sacred beings found matching your criteria</p>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-white/20 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-display font-bold text-white">
                User Sacred Profile 👤
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-mystical-gradient rounded-full flex items-center justify-center text-white text-2xl">
                  {selectedUser.profile.avatar}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">{selectedUser.profile.displayName}</h4>
                  <p className="text-gray-400">@{selectedUser.username}</p>
                  <p className="text-gray-500 font-mono text-sm">{selectedUser.email}</p>
                </div>
              </div>

              {/* Detailed Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">TON Address</div>
                  <div className="text-white font-mono text-sm break-all">{selectedUser.tonAddress}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">Security Level</div>
                  <div className="text-white font-medium">{selectedUser.securityLevel.toUpperCase()}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">Login Count</div>
                  <div className="text-white font-medium">{selectedUser.loginCount} times</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-gray-400 text-sm mb-1">Risk Score</div>
                  <div className={`font-bold ${getRiskScoreColor(selectedUser.riskScore)}`}>
                    {selectedUser.riskScore}%
                  </div>
                </div>
              </div>

              {/* Roles */}
              <div>
                <h5 className="text-lg font-semibold text-white mb-3">Sacred Roles & Permissions 🪄</h5>
                <div className="space-y-3">
                  {selectedUser.roles.map((role) => (
                    <div key={role.id} className="bg-white/5 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{role.name.replace('_', ' ').toUpperCase()}</span>
                        <span className="text-gray-400 text-sm">{role.description}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {role.permissions.map((permission, idx) => (
                          <span key={idx} className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                            {permission.actions.join(', ')} on {permission.resource}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement; 