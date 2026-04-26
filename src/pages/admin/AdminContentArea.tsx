import { Suspense, type FC } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AdminTab } from './tabs.config';

const AdminModuleFallback: FC = () => (
  <div className="p-6 flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin mx-auto mb-4" />
      <p className="text-[#999999] text-sm">Loading module...</p>
    </div>
  </div>
);

const NoAdminAccess: FC = () => (
  <div className="p-8 text-center">
    <AlertTriangle className="w-16 h-16 text-[#FF4444] mx-auto mb-4" />
    <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">No Access</h3>
    <p className="text-[#999999]">
      You don&apos;t have permission to access any admin features.
    </p>
  </div>
);

export interface AdminContentAreaProps {
  activeTab: AdminTab | undefined;
}

export const AdminContentArea: FC<AdminContentAreaProps> = ({ activeTab }) => {
  if (!activeTab) {
    return (
      <div className="rounded-xl border border-[#FFD700]/10 bg-[#1A1A1A] min-h-[600px]">
        <NoAdminAccess />
      </div>
    );
  }

  const ActiveComponent = activeTab.component;

  return (
    <div className="rounded-xl border border-[#FFD700]/10 bg-[#1A1A1A] min-h-[600px]">
      <Suspense fallback={<AdminModuleFallback />}>
        <div className="p-6">
          <ActiveComponent />
        </div>
      </Suspense>
    </div>
  );
};
