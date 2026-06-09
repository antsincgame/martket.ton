// CommerceSection — merged Demiurge "Commerce" surface.
// Tabs: Listings, Orders, Publishing (URL-driven for deep-links).
// Internal state (workspace, scan, success/error) is lifted here so
// sub-tabs can share the last artifact scan across sessions.
import { useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { Link, NavLink, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useTonAddress } from '@tonconnect/ui-react';
import { ShoppingBag, Wallet as WalletIcon } from 'lucide-react';
import type { TonForgeArtifactScan, TonForgeDeveloperWorkspace } from '../../../domain/tonforge/types';
import { fetchDeveloperWorkspace } from '../../../services/tonforgeApi';
import { fetchSellerKycStatus, type SellerKycStatus } from '../../../lib/commerceApi';
import ListingsTab from './ListingsTab';
import OrdersTab from './OrdersTab';
import PublishingTab from './PublishingTab';
import StorageSettings from './StorageSettings';
import DistributionEditor from './DistributionEditor';
import NoCollectionWarning from './NoCollectionWarning';
import KycRequiredBanner from './KycRequiredBanner';
import ApiTokensTab from './ApiTokensTab';
import OnboardingGuide from './OnboardingGuide';
import OperatingManual from './OperatingManual';

interface TabDef {
  id: string;
  path: string;
  label: string;
  description: string;
}

const TABS: TabDef[] = [
  { id: 'listings', path: 'listings', label: 'Listings', description: 'Published products and their status' },
  { id: 'orders', path: 'orders', label: 'Orders', description: 'Purchases of your products on the TON blockchain' },
  { id: 'publishing', path: 'publishing', label: 'Publishing', description: 'KYC, Artifact Scan, and new app release' },
  { id: 'storage', path: 'storage', label: 'Storage', description: 'Bring Your Own R2/S3 — host builds on your bucket' },
  { id: 'api-tokens', path: 'api-tokens', label: 'API Tokens', description: 'Personal access tokens for AI agents (Agent API)' },
  { id: 'guide', path: 'guide', label: 'Guide', description: 'Operating manual — the same guide AI agents read' },
];

interface FlashState {
  error: string | null;
  success: string | null;
}

export default function CommerceSection() {
  const wallet = useTonAddress();
  const [workspace, setWorkspace] = useState<TonForgeDeveloperWorkspace | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<TonForgeArtifactScan | null>(null);
  const [sellerKyc, setSellerKyc] = useState<SellerKycStatus | null>(null);

  const refreshKycStatus = useCallback(async () => {
    if (!wallet) return;
    try {
      const status = await fetchSellerKycStatus(wallet);
      setSellerKyc(status);
    } catch {
      /* seller may not be registered yet */
    }
  }, [wallet]);
  const [flash, setFlash] = useState<FlashState>({ error: null, success: null });
  const location = useLocation();

  const reloadWorkspace = useMemo(
    () => async () => {
      if (!wallet) {
        setWorkspace(null);
        return;
      }
      setWorkspaceLoading(true);
      setWorkspaceError(null);
      try {
        const data = await fetchDeveloperWorkspace(wallet);
        setWorkspace(data);
      } catch (e) {
        setWorkspaceError(e instanceof Error ? e.message : 'Failed to load publisher workspace');
      } finally {
        setWorkspaceLoading(false);
      }
    },
    [wallet]
  );

  useEffect(() => {
    void reloadWorkspace();
    void refreshKycStatus();
  }, [reloadWorkspace, refreshKycStatus]);

  const activeTab = useMemo(() => {
    const segment = location.pathname.replace(/^\/profile\/commerce\/?/, '').split('/')[0] || 'listings';
    return TABS.find((t) => t.id === segment) ?? TABS[0];
  }, [location.pathname]);

  if (!wallet) {
    return <ConnectWalletEmptyState />;
  }

  return (
    <div className="space-y-6">
      <Header
        sellerBadge={workspace?.developer.sellerBadge ?? null}
        kycStatus={workspace?.developer.kycStatus ?? null}
      />

      {workspaceError && (
        <Banner kind="error" message={workspaceError} onDismiss={() => setWorkspaceError(null)} />
      )}
      {flash.error && <Banner kind="error" message={flash.error} onDismiss={() => setFlash((f) => ({ ...f, error: null }))} />}
      {flash.success && <Banner kind="success" message={flash.success} onDismiss={() => setFlash((f) => ({ ...f, success: null }))} />}

      <KycRequiredBanner kycStatus={sellerKyc} />
      <OnboardingGuide wallet={wallet} />
      <NoCollectionWarning wallet={wallet} />

      <Tabs activeId={activeTab.id} />

      <p className="text-xs text-[#666] -mt-2">{activeTab.description}</p>

      <Routes>
        <Route index element={<Navigate to="listings" replace />} />
        <Route
          path="listings"
          element={
            <ListingsTab
              workspace={workspace}
              workspaceLoading={workspaceLoading}
            />
          }
        />
        <Route path="orders" element={<OrdersTab wallet={wallet} />} />
        <Route
          path="publishing"
          element={
            <PublishingTab
              wallet={wallet}
              workspace={workspace}
              lastScan={lastScan}
              setLastScan={setLastScan}
              onWorkspaceChanged={reloadWorkspace}
              setFlash={setFlash}
            />
          }
        />
        <Route path="storage" element={<StorageSettings wallet={wallet} />} />
        <Route path="api-tokens" element={<ApiTokensTab workspace={workspace} />} />
        <Route path="guide" element={<OperatingManual />} />
        <Route path="listings/:listingId/distribution" element={<DistributionRoute wallet={wallet} />} />
        <Route path="*" element={<Navigate to="listings" replace />} />
      </Routes>
    </div>
  );
}

function Header({ sellerBadge, kycStatus }: { sellerBadge: string | null; kycStatus: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 flex items-center justify-center flex-shrink-0">
        <ShoppingBag className="w-6 h-6 text-[#FF6B6B]" aria-hidden />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-wide">Commerce</h1>
        <p className="text-sm text-[#888]">Listings, orders, and publishing — unified publisher console.</p>
      </div>
      <div className="flex flex-wrap gap-2 ml-auto">
        {sellerBadge && (
          <span className="rounded-full px-3 py-1 text-[11px] uppercase tracking-wider border border-[#FFD700]/30 bg-[#FFD700]/10 text-[#FFD700]">
            {sellerBadge}
          </span>
        )}
        {kycStatus && (
          <span
            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wider border ${
              kycStatus === 'approved'
                ? 'border-[#00FF88]/30 bg-[#00FF88]/10 text-[#00FF88]'
                : 'border-[#00F5FF]/30 bg-[#00F5FF]/10 text-[#00F5FF]'
            }`}
          >
            KYC: {kycStatus}
          </span>
        )}
      </div>
    </div>
  );
}

function Tabs({ activeId }: { activeId: string }) {
  return (
    <nav
      role="tablist"
      aria-label="Commerce sub-sections"
      className="flex gap-1 p-1 rounded-xl border border-white/[0.08] bg-black/30 overflow-x-auto"
    >
      {TABS.map((tab) => {
        const active = tab.id === activeId;
        return (
          <NavLink
            key={tab.id}
            to={tab.path}
            role="tab"
            aria-selected={active}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              active
                ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,107,107,0.25)]'
                : 'text-[#888] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

function Banner({
  kind,
  message,
  onDismiss,
}: {
  kind: 'error' | 'success';
  message: string;
  onDismiss?: () => void;
}) {
  const palette =
    kind === 'error'
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : 'border-green-500/30 bg-green-500/10 text-green-200';
  return (
    <div className={`rounded-xl border p-3 text-sm flex items-start gap-3 ${palette}`} role="status">
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs uppercase tracking-wider opacity-70 hover:opacity-100"
        >
          dismiss
        </button>
      )}
    </div>
  );
}

function DistributionRoute({ wallet }: { wallet: string }) {
  const { listingId } = useParams<{ listingId: string }>();
  if (!listingId) return <Navigate to="/profile/commerce/listings" replace />;
  return <DistributionEditor listingId={listingId} wallet={wallet} />;
}

function ConnectWalletEmptyState(): ReactNode {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-200">
      <div className="flex items-center gap-3 mb-2">
        <WalletIcon className="w-5 h-5" aria-hidden />
        <h2 className="font-semibold">Connect a TON wallet</h2>
      </div>
      <p className="text-sm mb-4">
        Commerce operations (listings, orders, publishing) are tied to the seller's TON wallet.
      </p>
      <Link
        to="/profile/wallet"
        className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/20 px-4 py-2 text-sm font-medium hover:bg-amber-500/30 transition-colors"
      >
        Go to Wallet →
      </Link>
    </div>
  );
}
