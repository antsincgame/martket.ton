import { useState } from 'react';
import { Shield, Database, MessageCircle, BookOpen, AlertTriangle, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProductModerationQueue from '../components/admin/ProductModerationQueue';
import SupportTickets from '../components/admin/SupportTickets';
import ModerationGuidelines from '../components/moderator/ModerationGuidelines';

const ModeratorPanel = () => {
  const { user, hasPermission, hasRole, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('queue');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-[#8B5CF6]/30 border-t-[#8B5CF6] rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-display font-bold text-white mb-2 uppercase tracking-widest">
            Loading Panel
          </h2>
          <p className="text-[#999999]">Initializing moderator realm...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || !hasRole('moderator')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-[#1A1A1A] border border-[#FF4444]/20 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-[#FF4444]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-[#FF4444]" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-4 uppercase tracking-widest">
            Access Denied
          </h1>
          <p className="text-[#999999] mb-6">Required role: moderator</p>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="w-full border border-[#8B5CF6]/50 bg-transparent text-[#8B5CF6] font-semibold uppercase tracking-widest text-sm py-3 px-6 rounded-xl hover:bg-[#8B5CF6]/10 transition-all duration-300"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: 'queue',
      label: 'Moderation',
      icon: Database,
      component: ProductModerationQueue,
      requiredPermission: { resource: 'products', action: 'read' },
    },
    {
      id: 'tickets',
      label: 'Support',
      icon: MessageCircle,
      component: () => <SupportTickets isAdminView />,
      requiredPermission: { resource: 'support_tickets', action: 'read' },
    },
    {
      id: 'guidelines',
      label: 'Guidelines',
      icon: BookOpen,
      component: ModerationGuidelines,
      requiredPermission: { resource: 'products', action: 'read' },
    },
  ];

  const availableTabs = tabs.filter((tab) =>
    hasPermission(tab.requiredPermission.resource, tab.requiredPermission.action),
  );

  const activeTabData = availableTabs.find((tab) => tab.id === activeTab) || availableTabs[0];
  const ActiveComponent = activeTabData?.component;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-white mb-1 uppercase tracking-widest flex items-center">
                <Shield className="w-8 h-8 mr-3 text-[#8B5CF6]" />
                Moderator Panel
              </h1>
              <p className="text-[#666666] text-sm">Content moderation and support center</p>
            </div>
          </div>

          {user && (
            <div className="rounded-xl border border-[#8B5CF6]/15 bg-[#1A1A1A] p-5">
              <div className="flex items-center space-x-4">
                <div className="w-11 h-11 rounded-full border-2 border-[#8B5CF6]/40 flex items-center justify-center overflow-hidden bg-[#0D0D1A]">
                  {user.profile.avatar ? (
                    <img src={user.profile.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Shield className="w-5 h-5 text-[#8B5CF6]" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{user.profile.displayName || 'Moderator'}</h3>
                  <span className="text-[#8B5CF6] font-semibold uppercase tracking-wider text-xs">
                    {user.roles.map((role) => role.name.replace('_', ' ')).join(', ')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#8B5CF6]/10 bg-[#1A1A1A] p-1.5 mb-8">
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
                      ? 'bg-[#8B5CF6] text-white shadow-[0_0_15px_rgba(139,92,246,0.25)]'
                      : 'text-[#999999] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-[#8B5CF6]/10 bg-[#1A1A1A] min-h-[600px]">
          {ActiveComponent ? (
            <div className="p-6">
              <ActiveComponent />
            </div>
          ) : (
            <div className="p-8 text-center">
              <AlertTriangle className="w-16 h-16 text-[#FF4444] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">No Access</h3>
              <p className="text-[#999999]">No moderator features available.</p>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <div className="rounded-xl border border-[#8B5CF6]/10 bg-[#0D0D1A] p-4">
            <p className="text-[#666666] text-xs">
              All moderation actions are logged &bull; Protected by Mahakala
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModeratorPanel;
