import type { FC, ReactNode } from 'react';
import { Lock } from 'lucide-react';

const goHome = (): void => {
  window.location.href = '/';
};

const AdminLoadingScreen: FC = () => (
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

const AdminAccessDeniedScreen: FC = () => (
  <div className="min-h-screen flex items-center justify-center p-4">
    <div className="bg-[#1A1A1A] border border-[#FF4444]/20 rounded-2xl p-8 max-w-md w-full text-center">
      <div className="w-20 h-20 bg-[#FF4444]/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <Lock className="w-10 h-10 text-[#FF4444]" />
      </div>
      <h1 className="text-2xl font-display font-bold text-white mb-4 uppercase tracking-widest">
        Access Denied
      </h1>
      <p className="text-[#999999] mb-6">Required role: admin or super_admin</p>
      <button
        type="button"
        onClick={goHome}
        className="w-full border border-[#FFD700]/50 bg-transparent text-[#FFD700] font-semibold uppercase tracking-widest text-sm py-3 px-6 rounded-xl hover:bg-[#FFD700]/10 transition-all duration-300"
      >
        Return Home
      </button>
    </div>
  </div>
);

export interface AdminAccessGateProps {
  isLoading: boolean;
  isAllowed: boolean;
  children: ReactNode;
}

export const AdminAccessGate: FC<AdminAccessGateProps> = ({ isLoading, isAllowed, children }) => {
  if (isLoading) return <AdminLoadingScreen />;
  if (!isAllowed) return <AdminAccessDeniedScreen />;
  return <>{children}</>;
};
