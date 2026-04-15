import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Shield as ShieldIcon, Hammer, Wallet, Settings,
  ChevronLeft, ChevronRight, Gem, Menu, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TonConnectButton, useTonAddress } from '@tonconnect/ui-react';
import { CopyableText } from '../components/ui/CopyButton';

interface NavItem {
  id: string;
  path: string;
  label: string;
  labelRu: string;
  icon: typeof LayoutDashboard;
  accent?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', path: '/profile', label: 'Overview', labelRu: 'Обзор', icon: LayoutDashboard, accent: '#FFD700' },
  { id: 'arsenal', path: '/profile/arsenal', label: 'Arsenal', labelRu: 'Арсенал', icon: ShieldIcon, accent: '#00F5FF' },
  { id: 'forge', path: '/profile/forge', label: 'Forge', labelRu: 'Кузница', icon: Hammer, accent: '#8B5CF6' },
  { id: 'wallet', path: '/profile/wallet', label: 'Wallet', labelRu: 'Кошелёк', icon: Wallet, accent: '#00FF88' },
  { id: 'settings', path: '/profile/settings', label: 'Settings', labelRu: 'Настройки', icon: Settings, accent: '#999' },
];

function SidebarProfile({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  const displayName = user?.profile?.displayName || user?.username || 'Demiurge';
  const email = user?.email || '';

  return (
    <div className={`px-3 py-4 border-b border-white/[0.06] ${collapsed ? 'text-center' : ''}`}>
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-10 h-10 rounded-full border-2 border-[#FFD700]/40 bg-[#0D0D1A] flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
          {user?.profile?.avatar && user.profile.avatar.startsWith('http') ? (
            <img src={user.profile.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>{user?.profile?.avatar || '🌌'}</span>
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{displayName}</p>
            <p className="text-[#666] text-xs truncate">{email}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarWallet({ collapsed }: { collapsed: boolean }) {
  const tonAddress = useTonAddress();
  const { user } = useAuth();
  const linked = user?.tonAddress;

  if (collapsed) {
    return (
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <div className="flex justify-center">
          <div className={`w-3 h-3 rounded-full ${linked ? 'bg-[#00FF88] shadow-[0_0_8px_rgba(0,255,136,0.5)]' : 'bg-[#666]'}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 border-t border-white/[0.06] space-y-3">
      {linked ? (
        <div className="rounded-lg bg-gradient-to-r from-[#00FF88]/[0.08] to-[#00F5FF]/[0.05] border border-[#00FF88]/20 p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#00FF88] shadow-[0_0_6px_rgba(0,255,136,0.6)]" />
            <span className="text-[#00FF88] text-xs font-medium uppercase tracking-wider">Connected</span>
          </div>
          <CopyableText text={linked} />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[#666] text-xs">TON wallet not connected</p>
          <TonConnectButton />
        </div>
      )}
    </div>
  );
}

export default function DemiurgeLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const activeId = NAV_ITEMS.find((n) => {
    if (n.path === '/profile') return location.pathname === '/profile';
    return location.pathname.startsWith(n.path);
  })?.id || 'overview';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`px-3 py-5 border-b border-white/[0.06] flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-8 h-8 rounded-lg bg-[#FFD700]/10 flex items-center justify-center flex-shrink-0">
          <Gem className="w-5 h-5 text-[#FFD700]" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-white font-display font-bold text-sm tracking-wider">TONFORGE</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00FF88] shadow-[0_0_4px_rgba(0,255,136,0.5)]" />
              <span className="text-[#666] text-[10px] uppercase tracking-widest">Demiurge</span>
            </div>
          </div>
        )}
      </div>

      <SidebarProfile collapsed={collapsed} />

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = activeId === item.id;
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,215,0,0.15)]'
                  : 'text-[#888] hover:text-white hover:bg-white/[0.04]'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <item.icon
                className="w-5 h-5 flex-shrink-0 transition-colors"
                style={{ color: active ? item.accent : undefined }}
              />
              {!collapsed && (
                <span className="truncate">{item.labelRu}</span>
              )}
              {active && !collapsed && (
                <div
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: item.accent, boxShadow: `0 0 8px ${item.accent}60` }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <SidebarWallet collapsed={collapsed} />

      {/* Collapse toggle (desktop) */}
      <div className="hidden lg:block px-3 py-3 border-t border-white/[0.06]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg text-[#666] hover:text-white hover:bg-white/[0.04] transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-80px)]">
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full bg-[#FFD700] text-[#0A0A0A] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.3)]"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-[#0A0A0F] border-r border-white/[0.06] shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-[#666] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-white/[0.06] bg-[#0A0A0F]/80 backdrop-blur-md transition-all duration-300 flex-shrink-0 ${
          collapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
