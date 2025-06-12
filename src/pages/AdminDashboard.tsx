import React, { useState } from 'react';
import { Shield, Users, Database, Settings, AlertTriangle, BarChart, FileText, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SecurityMonitor from '../components/SecurityMonitor';
import UserManagement from '../components/UserManagement';
import AuditLogs from '../components/AuditLogs';

const AdminDashboard = () => {
  const { user, hasPermission, getSecurityLevel, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('security');

  // Проверяем права доступа
  if (!hasRole('admin') && !hasRole('super_admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-sm border border-red-500/20 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-4">
            🚫 Sacred Access Denied
          </h1>
          <p className="text-gray-300 mb-6">
            You need admin or super_admin role to access this divine realm.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-ton-gradient hover:scale-105 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg"
          >
            Return to Sacred Home 🏠
          </button>
        </div>
      </div>
    );
  }

  const securityLevel = getSecurityLevel();

  const tabs = [
    {
      id: 'security',
      label: 'Security Center',
      icon: Shield,
      component: SecurityMonitor,
      requiredPermission: { resource: '*', action: 'read' }
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      component: UserManagement,
      requiredPermission: { resource: 'users', action: 'read' }
    },
    {
      id: 'audit',
      label: 'Audit Logs',
      icon: FileText,
      component: AuditLogs,
      requiredPermission: { resource: 'audit_logs', action: 'read' }
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart,
      component: () => <div className="p-8 text-white">Analytics Dashboard Coming Soon ⚡</div>,
      requiredPermission: { resource: 'analytics', action: 'read' }
    },
    {
      id: 'products',
      label: 'Product Management',
      icon: Database,
      component: () => <div className="p-8 text-white">Product Management Coming Soon 🛍️</div>,
      requiredPermission: { resource: 'products', action: 'read' }
    },
    {
      id: 'system',
      label: 'System Config',
      icon: Settings,
      component: () => <div className="p-8 text-white">System Configuration Coming Soon ⚙️</div>,
      requiredPermission: { resource: '*', action: 'update' }
    }
  ];

  const availableTabs = tabs.filter(tab => 
    hasPermission(tab.requiredPermission.resource, tab.requiredPermission.action)
  );

  const activeTabData = availableTabs.find(tab => tab.id === activeTab) || availableTabs[0];
  const ActiveComponent = activeTabData?.component;

  return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-display font-bold text-white mb-2 flex items-center">
                  <Shield className="w-10 h-10 mr-4 text-purple-400" />
                  Sacred Admin Dashboard 🧿
                </h1>
                <p className="text-gray-400">
                  Divine administrative portal for cosmic marketplace management
                </p>
              </div>

              {/* Security Level Badge */}
              <div className={`px-4 py-2 rounded-full border text-sm font-medium ${
                securityLevel === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                securityLevel === 'high' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                securityLevel === 'medium' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                'bg-green-500/20 text-green-400 border-green-500/30'
              }`}>
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span>{securityLevel.toUpperCase()} Security</span>
                </div>
              </div>
            </div>

            {/* User Info */}
            {user && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-mystical-gradient rounded-full flex items-center justify-center text-white text-xl">
                    {user.profile.avatar}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{user.profile.displayName}</h3>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-gray-400">
                        Roles: {user.roles.map(role => role.name.replace('_', ' ')).join(', ')} 🪄
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-blue-400 font-mono">
                        {user.tonAddress.slice(0, 8)}...{user.tonAddress.slice(-8)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-2 mb-8">
            <div className="flex flex-wrap gap-2">
              {availableTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-ton-gradient text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl min-h-[600px]">
            {ActiveComponent ? (
              <div className="p-6">
                <ActiveComponent />
              </div>
            ) : (
              <div className="p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Access Denied</h3>
                <p className="text-gray-400">
                  You don't have permission to access any admin features.
                </p>
              </div>
            )}
          </div>

          {/* Sacred Footer */}
          <div className="mt-8 text-center">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-6">
              <p className="text-purple-200 text-sm mb-2">
                🪷 Sacred Administrative Realm • Protected by Digital Dharma 🪷
              </p>
              <p className="text-gray-300 text-xs">
                All actions are logged for karmic accountability • May your administration bring prosperity to all beings ☸️
              </p>
            </div>
          </div>
        </div>
      </div>
  );
};

export default AdminDashboard;