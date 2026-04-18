import { useState } from 'react';
import { Shield, Users, Database, Settings, AlertTriangle, BarChart, FileText, Lock, Coins, Mail, Folder, MessageCircle, ShieldCheck, Bug } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SecurityMonitor from '../components/SecurityMonitor';
import RealUserManagement from '../components/RealUserManagement';
import AuditLogs from '../components/AuditLogs';
import CommerceAdminPanel from '../components/admin/CommerceAdminPanel';
import ProductModerationQueue from '../components/admin/ProductModerationQueue';
import ResendSettings from '../components/admin/ResendSettings';
import CategoryManagement from '../components/admin/CategoryManagement';
import AnalyticsDashboard from '../components/admin/AnalyticsDashboard';
import SystemConfig from '../components/admin/SystemConfig';
import SupportTickets from '../components/admin/SupportTickets';
import VerifiedDemiurges from '../components/admin/VerifiedDemiurges';
import ClientErrorsPanel from '../components/admin/ClientErrorsPanel';

const AdminDashboard = () => {
  const { user, hasPermission, getSecurityLevel, hasRole, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('security');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-display font-bold text-white mb-2 uppercase tracking-widest">
            Loading Dashboard
          </h2>
          <p className="text-[#999999]">Initializing administrative realm...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || (!hasRole('admin') && !hasRole('super_admin'))) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-[#1A1A1A] border border-[#FF4444]/20 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-[#FF4444]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-[#FF4444]" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-4 uppercase tracking-widest">
            Access Denied
          </h1>
          <p className="text-[#999999] mb-6">
            Required role: admin or super_admin
          </p>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-full border border-[#FFD700]/50 bg-transparent text-[#FFD700] font-semibold uppercase tracking-widest text-sm py-3 px-6 rounded-xl hover:bg-[#FFD700]/10 transition-all duration-300"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const securityLevel = getSecurityLevel();

  const tabs = [
    {
      id: 'security',
      label: 'Security',
      icon: Shield,
      component: SecurityMonitor,
      requiredPermission: { resource: '*', action: 'read' },
    },
    {
      id: 'users',
      label: 'Users',
      icon: Users,
      component: RealUserManagement,
      requiredPermission: { resource: 'users', action: 'read' },
    },
    {
      id: 'audit',
      label: 'Audit',
      icon: FileText,
      component: AuditLogs,
      requiredPermission: { resource: 'audit_logs', action: 'read' },
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart,
      component: AnalyticsDashboard,
      requiredPermission: { resource: 'analytics', action: 'read' },
    },
    {
      id: 'products',
      label: 'Moderation',
      icon: Database,
      component: ProductModerationQueue,
      requiredPermission: { resource: 'products', action: 'read' },
    },
    {
      id: 'verified',
      label: 'Verified',
      icon: ShieldCheck,
      component: VerifiedDemiurges,
      requiredPermission: { resource: 'users', action: 'update' },
    },
    {
      id: 'categories',
      label: 'Categories',
      icon: Folder,
      component: CategoryManagement,
      requiredPermission: { resource: 'categories', action: 'read' },
    },
    {
      id: 'commerce',
      label: 'Commerce',
      icon: Coins,
      component: CommerceAdminPanel,
      requiredPermission: { resource: 'products', action: 'read' },
    },
    {
      id: 'email',
      label: 'Email',
      icon: Mail,
      component: ResendSettings,
      requiredPermission: { resource: '*', action: 'update' },
    },
    {
      id: 'support',
      label: 'Support',
      icon: MessageCircle,
      component: () => <SupportTickets isAdminView />,
      requiredPermission: { resource: '*', action: 'read' },
    },
    {
      id: 'errors',
      label: 'Errors',
      icon: Bug,
      component: ClientErrorsPanel,
      requiredPermission: { resource: 'audit_logs', action: 'read' },
    },
    {
      id: 'system',
      label: 'System',
      icon: Settings,
      component: SystemConfig,
      requiredPermission: { resource: '*', action: 'update' },
    },
  ];

  const availableTabs = tabs.filter((tab) =>
    hasPermission(tab.requiredPermission.resource, tab.requiredPermission.action),
  );

  const activeTabData = availableTabs.find((tab) => tab.id === activeTab) || availableTabs[0];
  const ActiveComponent = activeTabData?.component;

  const securityBadge = (() => {
    switch (securityLevel) {
      case 'critical': return 'bg-[#FF4444]/20 text-[#FF4444] border-[#FF4444]/30';
      case 'high': return 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/30';
      case 'medium': return 'bg-[#00F5FF]/20 text-[#00F5FF] border-[#00F5FF]/30';
      default: return 'bg-[#00FF88]/20 text-[#00FF88] border-[#00FF88]/30';
    }
  })();

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-white mb-1 uppercase tracking-widest flex items-center">
                <Shield className="w-8 h-8 mr-3 text-[#FFD700]" />
                Admin Dashboard
              </h1>
              <p className="text-[#666666] text-sm">
                Administrative control center
              </p>
            </div>

            <div className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider ${securityBadge}`}>
              <div className="flex items-center space-x-2">
                <Shield className="w-3.5 h-3.5" />
                <span>{securityLevel.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* User Info */}
          {user && (
            <div className="rounded-xl border border-[#FFD700]/15 bg-[#1A1A1A] p-5">
              <div className="flex items-center space-x-4">
                <div className="w-11 h-11 rounded-full border-2 border-[#FFD700]/40 flex items-center justify-center overflow-hidden bg-[#0D0D1A]">
                  {user.profile.avatar ? (
                    <img src={user.profile.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-5 h-5 text-[#FFD700]" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{user.profile.displayName || 'Admin'}</h3>
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-[#FFD700] font-semibold uppercase tracking-wider">
                      {user.roles.map((role) => role.name.replace('_', ' ')).join(', ')}
                    </span>
                    {user.email && (
                      <>
                        <span className="text-[#666666]">&bull;</span>
                        <span className="text-[#999999] font-mono">{user.email}</span>
                      </>
                    )}
                    {user.tonAddress && (
                      <>
                        <span className="text-[#666666]">&bull;</span>
                        <span className="text-[#00F5FF] font-mono">
                          {user.tonAddress.slice(0, 6)}...{user.tonAddress.slice(-4)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="rounded-xl border border-[#FFD700]/10 bg-[#1A1A1A] p-1.5 mb-8">
          <div className="flex flex-wrap gap-1.5">
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[#FFD700] text-[#0A0A0A] shadow-[0_0_15px_rgba(255,215,0,0.25)]'
                      : 'text-[#999999] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="rounded-xl border border-[#FFD700]/10 bg-[#1A1A1A] min-h-[600px]">
          {ActiveComponent ? (
            <div className="p-6">
              <ActiveComponent />
            </div>
          ) : (
            <div className="p-8 text-center">
              <AlertTriangle className="w-16 h-16 text-[#FF4444] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">
                No Access
              </h3>
              <p className="text-[#999999]">
                You don&apos;t have permission to access any admin features.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="rounded-xl border border-[#FFD700]/10 bg-[#0D0D1A] p-4">
            <p className="text-[#666666] text-xs">
              All actions are logged &bull; Protected by Mahakala
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
