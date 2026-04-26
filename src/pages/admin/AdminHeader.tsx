import type { FC } from 'react';
import { Shield, Users } from 'lucide-react';
import type { AuthenticatedUser } from '../../types/auth';

type SecurityLevel = 'low' | 'medium' | 'high' | 'critical';

const SECURITY_BADGE_CLASSES: Record<SecurityLevel, string> = {
  critical: 'bg-[#FF4444]/20 text-[#FF4444] border-[#FF4444]/30',
  high: 'bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/30',
  medium: 'bg-[#00F5FF]/20 text-[#00F5FF] border-[#00F5FF]/30',
  low: 'bg-[#00FF88]/20 text-[#00FF88] border-[#00FF88]/30',
};

const isSecurityLevel = (value: string): value is SecurityLevel =>
  value === 'low' || value === 'medium' || value === 'high' || value === 'critical';

const normalizeSecurityLevel = (value: string): SecurityLevel =>
  isSecurityLevel(value) ? value : 'low';

const formatTonAddress = (address: string): string =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

const formatRoles = (roles: AuthenticatedUser['roles']): string =>
  roles.map((role) => role.name.replace('_', ' ')).join(', ');

interface SecurityBadgeProps {
  level: SecurityLevel;
}

const SecurityBadge: FC<SecurityBadgeProps> = ({ level }) => (
  <div
    className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider ${SECURITY_BADGE_CLASSES[level]}`}
  >
    <div className="flex items-center space-x-2">
      <Shield className="w-3.5 h-3.5" />
      <span>{level.toUpperCase()}</span>
    </div>
  </div>
);

interface AdminUserCardProps {
  user: AuthenticatedUser;
}

const AdminUserCard: FC<AdminUserCardProps> = ({ user }) => (
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
            {formatRoles(user.roles)}
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
              <span className="text-[#00F5FF] font-mono">{formatTonAddress(user.tonAddress)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  </div>
);

export interface AdminHeaderProps {
  user: AuthenticatedUser | null;
  securityLevel: string;
}

export const AdminHeader: FC<AdminHeaderProps> = ({ user, securityLevel }) => (
  <div className="mb-8">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-3xl font-display font-bold text-white mb-1 uppercase tracking-widest flex items-center">
          <Shield className="w-8 h-8 mr-3 text-[#FFD700]" />
          Admin Dashboard
        </h1>
        <p className="text-[#666666] text-sm">Administrative control center</p>
      </div>
      <SecurityBadge level={normalizeSecurityLevel(securityLevel)} />
    </div>
    {user && <AdminUserCard user={user} />}
  </div>
);
