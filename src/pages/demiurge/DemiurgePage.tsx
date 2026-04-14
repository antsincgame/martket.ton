import { useState, useCallback, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { storeApiUrl } from '../../lib/storeApi';
import TonConnectWrapper from '../../components/TonConnectWrapper';
import DemiurgeLayout from '../../layouts/DemiurgeLayout';
import OverviewSection from './OverviewSection';
import ArsenalSection from './ArsenalSection';
import ForgeSection from './ForgeSection';
import WalletSection from './WalletSection';
import SettingsSection from './SettingsSection';
import type { PurchaseWithProduct, CreatedProduct } from './types';

export default function DemiurgePage() {
  const { user, isAuthenticated, isLoading: isAuthLoading, getToken } = useAuth();
  const [library, setLibrary] = useState<PurchaseWithProduct[]>([]);
  const [myProducts, setMyProducts] = useState<CreatedProduct[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const fetchLibrary = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/session/library'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = await res.json();
        setLibrary(body.data || []);
      }
    } catch { /* network error — will show empty */ }
  }, [getToken]);

  const fetchMyProducts = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/session/products'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = await res.json();
        setMyProducts(body.data || []);
      }
    } catch { /* network error */ }
  }, [getToken]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoadingData(true);
    Promise.all([fetchLibrary(), fetchMyProducts()]).finally(() => setIsLoadingData(false));
  }, [isAuthenticated, fetchLibrary, fetchMyProducts]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="rounded-2xl border border-[#FFD700]/15 bg-[#111119] p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-display font-bold uppercase tracking-widest text-white mb-4">
            Demiurge Awaits
          </h1>
          <p className="text-[#888] mb-6">Sign in to enter the Forge.</p>
          <a href="/sign-in"
            className="block w-full bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest py-3 px-6 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] text-center">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  const displayName = user.profile?.displayName || user.username || 'Demiurge';

  return (
    <TonConnectWrapper>
      <DemiurgeLayout>
        <Routes>
          <Route index element={
            <OverviewSection library={library} myProducts={myProducts} isLoading={isLoadingData} displayName={displayName} />
          } />
          <Route path="arsenal" element={
            <ArsenalSection library={library} isLoading={isLoadingData} getToken={getToken} />
          } />
          <Route path="forge" element={
            <ForgeSection myProducts={myProducts} isLoading={isLoadingData} getToken={getToken} onRefresh={fetchMyProducts} />
          } />
          <Route path="wallet" element={<WalletSection />} />
          <Route path="settings" element={<SettingsSection />} />
        </Routes>
      </DemiurgeLayout>
    </TonConnectWrapper>
  );
}
