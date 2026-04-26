import { useState, type FC } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AdminAccessGate } from './admin/AdminAccessGate';
import { AdminHeader } from './admin/AdminHeader';
import { AdminTabsNav } from './admin/AdminTabsNav';
import { AdminContentArea } from './admin/AdminContentArea';
import { useAdminTabs } from './admin/useAdminTabs';
import { DEFAULT_ADMIN_TAB_ID } from './admin/tabs.config';

const AdminDashboard: FC = () => {
  const { user, hasPermission, getSecurityLevel, hasRole, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_ADMIN_TAB_ID);

  const isAllowed =
    isAuthenticated && !!user && (hasRole('admin') || hasRole('super_admin'));

  const { availableTabs, activeTabData } = useAdminTabs(hasPermission, activeTab);

  return (
    <AdminAccessGate isLoading={isLoading} isAllowed={isAllowed}>
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <AdminHeader user={user} securityLevel={getSecurityLevel()} />
          <AdminTabsNav
            tabs={availableTabs}
            activeTabId={activeTabData?.id ?? activeTab}
            onTabChange={setActiveTab}
          />
          <AdminContentArea activeTab={activeTabData} />
          <div className="mt-8 text-center">
            <div className="rounded-xl border border-[#FFD700]/10 bg-[#0D0D1A] p-4">
              <p className="text-[#666666] text-xs">
                All actions are logged &bull; Protected by Mahakala
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminAccessGate>
  );
};

export default AdminDashboard;
