import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Library as LibraryIcon,
  Hammer,
  Wallet,
  ShoppingBag,
  UserCircle2,
  ChevronLeft,
  ChevronRight,
  Gem,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TonConnectButton, useTonAddress } from '@tonconnect/ui-react';
import { CopyableText } from '../components/ui/CopyButton';
import Breadcrumbs from '../components/Breadcrumbs';

interface NavItem {
  id: string;
  path: string;
  label: string;
  labelRu: string;
  icon: typeof LayoutDashboard;
  accent: string;
}

interface NavGroup {
  id: string;
  label: string;
  labelRu: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'creator',
    label: 'Creator',
    labelRu: 'Творчество',
    items: [
      { id: 'overview', path: '/profile', label: 'Overview', labelRu: 'Обзор', icon: LayoutDashboard, accent: '#FFD700' },
      { id: 'studio', path: '/profile/studio', label: 'Studio', labelRu: 'Студия', icon: Hammer, accent: '#8B5CF6' },
      { id: 'library', path: '/profile/library', label: 'Library', labelRu: 'Библиотека', icon: LibraryIcon, accent: '#00F5FF' },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    labelRu: 'Экономика',
    items: [
      { id: 'commerce', path: '/profile/commerce', label: 'Commerce', labelRu: 'Коммерция', icon: ShoppingBag, accent: '#FF6B6B' },
      { id: 'wallet', path: '/profile/wallet', label: 'Wallet', labelRu: 'Кошелёк', icon: Wallet, accent: '#00FF88' },
    ],
  },
  {
    id: 'identity',
    label: 'Identity',
    labelRu: 'Образ',
    items: [
      { id: 'profile', path: '/profile/profile', label: 'Profile', labelRu: 'Публичный профиль', icon: UserCircle2, accent: '#C9A6FF' },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function findActive(pathname: string): NavItem {
  // Sort by path length desc to match the most specific first.
  const sorted = [...ALL_NAV_ITEMS].sort((a, b) => b.path.length - a.path.length);
  for (const item of sorted) {
    if (item.path === '/profile') {
      if (pathname === '/profile') return item;
    } else if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
      return item;
    }
  }
  return ALL_NAV_ITEMS[0];
}

function SidebarProfile({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  const displayName = user?.profile?.displayName || user?.username || 'Demiurge';
  const email = user?.email || '';
  const avatar = user?.profile?.avatar;

  return (
    <div className={`px-3 py-4 border-b border-white/[0.06] ${collapsed ? 'text-center' : ''}`}>
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-10 h-10 rounded-full border-2 border-[#FFD700]/40 bg-[#0D0D1A] flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
          {avatar && avatar.startsWith('http') ? (
            <img src={avatar} alt={`${displayName} avatar`} className="w-full h-full object-cover" />
          ) : (
            <span aria-hidden>{avatar || '🌌'}</span>
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
  useTonAddress();
  const { user } = useAuth();
  const linked = user?.tonAddress;

  if (collapsed) {
    return (
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <div className="flex justify-center">
          <div
            className={`w-3 h-3 rounded-full ${
              linked ? 'bg-[#00FF88] shadow-[0_0_8px_rgba(0,255,136,0.5)]' : 'bg-[#666]'
            }`}
            title={linked ? 'Wallet connected' : 'Wallet not connected'}
          />
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
  const activeItem = findActive(location.pathname);

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
              <span className="text-[#666] text-[10px] uppercase tracking-widest">Studio</span>
            </div>
          </div>
        )}
      </div>

      <SidebarProfile collapsed={collapsed} />

      {/* Nav by groups */}
      <nav className="flex-1 px-2 py-4 space-y-5 overflow-y-auto" aria-label="Studio navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.id}>
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFD700]/40">
                {group.labelRu}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = activeItem.id === item.id;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,215,0,0.15)]'
                        : 'text-[#888] hover:text-white hover:bg-white/[0.04]'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <item.icon
                      className="w-5 h-5 flex-shrink-0 transition-colors"
                      style={{ color: active ? item.accent : undefined }}
                      aria-hidden
                    />
                    {!collapsed && <span className="truncate">{item.labelRu}</span>}
                    {active && !collapsed && (
                      <div
                        className="ml-auto w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: item.accent, boxShadow: `0 0 8px ${item.accent}60` }}
                        aria-hidden
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <SidebarWallet collapsed={collapsed} />

      {/* Collapse toggle (desktop) */}
      <div className="hidden lg:block px-3 py-3 border-t border-white/[0.06]">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg text-[#666] hover:text-white hover:bg-white/[0.04] transition-all"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-80px)] relative">
      {/* Sacred-light backdrop (very subtle, doesn't fight content). */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 20% 0%, rgba(139,92,246,0.08), transparent 40%), radial-gradient(circle at 80% 100%, rgba(0,245,255,0.06), transparent 50%)',
        }}
      />

      {/* Mobile top button (only opens drawer; mobile nav is the bottom tab bar). */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 right-3 z-40 w-10 h-10 rounded-lg bg-[#0A0A0F]/90 border border-white/10 text-[#FFD700] flex items-center justify-center backdrop-blur"
        aria-label="Open studio menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="relative w-72 bg-[#0A0A0F] border-r border-white/[0.06] shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-[#666] hover:text-white"
              aria-label="Close menu"
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
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <Breadcrumbs items={[{ label: 'Demiurge Studio', to: '/profile' }, { label: activeItem.labelRu }]} />
        {children}
      </main>

      {/* Mobile bottom tab bar (replaces FAB). */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0F]/95 backdrop-blur-xl"
        aria-label="Studio mobile navigation"
      >
        <ul className="grid grid-cols-6 gap-0.5 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {ALL_NAV_ITEMS.map((item) => {
            const active = activeItem.id === item.id;
            return (
              <li key={item.id}>
                <Link
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-colors ${
                    active ? 'text-white' : 'text-[#666] hover:text-white'
                  }`}
                  style={{ minHeight: 44 }}
                >
                  <item.icon
                    className="w-5 h-5"
                    style={{ color: active ? item.accent : undefined, filter: active ? `drop-shadow(0 0 6px ${item.accent}80)` : undefined }}
                    aria-hidden
                  />
                  <span className="text-[10px] leading-none truncate max-w-full">{item.labelRu.split(' ')[0]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
