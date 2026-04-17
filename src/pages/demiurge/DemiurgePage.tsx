import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TonConnectWrapper from '../../components/TonConnectWrapper';
import DemiurgeLayout from '../../layouts/DemiurgeLayout';
import OverviewSection from './OverviewSection';
import ArsenalSection from './ArsenalSection';
import StudioSection from './studio/StudioSection';
import EditProductForm from './studio/EditProductForm';
import WalletSection from './WalletSection';
import ProfileSection from './ProfileSection';
import CommerceSection from './commerce/CommerceSection';
import { useLibraryQuery, useMyProductsQuery } from '../../queries/sessionQueries';

export default function DemiurgePage() {
  const { user, isAuthenticated, isLoading: isAuthLoading, getToken } = useAuth();

  const libraryQuery = useLibraryQuery();
  const productsQuery = useMyProductsQuery();

  const library = libraryQuery.data ?? [];
  const myProducts = productsQuery.data ?? [];
  const isLoadingData = libraryQuery.isLoading || productsQuery.isLoading;
  const dataError = libraryQuery.error?.message || productsQuery.error?.message || null;

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
          <Link
            to="/sign-in"
            className="block w-full bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest py-3 px-6 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] text-center"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const displayName = user.profile?.displayName || user.username || 'Demiurge';

  return (
    <TonConnectWrapper>
      <DemiurgeLayout>
        <Routes>
          <Route
            index
            element={
              <OverviewSection
                library={library}
                myProducts={myProducts}
                isLoading={isLoadingData}
                dataError={dataError}
                displayName={displayName}
              />
            }
          />

          {/* Library (formerly Arsenal) */}
          <Route
            path="library"
            element={
              <ArsenalSection
                library={library}
                isLoading={isLoadingData}
                getToken={getToken}
              />
            }
          />
          <Route path="arsenal" element={<Navigate to="/profile/library" replace />} />

          {/* Studio (formerly Forge) */}
          <Route
            path="studio"
            element={<StudioSection myProducts={myProducts} isLoading={isLoadingData} getToken={getToken} />}
          />
          <Route
            path="studio/:id/edit"
            element={<EditProductForm getToken={getToken} />}
          />
          <Route path="forge" element={<Navigate to="/profile/studio" replace />} />
          <Route path="forge/*" element={<Navigate to="/profile/studio" replace />} />

          {/* Commerce — merge SellerCommercePage */}
          <Route path="commerce/*" element={<CommerceSection />} />

          {/* Wallet */}
          <Route path="wallet" element={<WalletSection />} />

          {/* Identity (formerly Settings) */}
          <Route path="profile" element={<ProfileSection myProducts={myProducts} />} />
          <Route path="settings" element={<Navigate to="/profile/profile" replace />} />
        </Routes>
      </DemiurgeLayout>
    </TonConnectWrapper>
  );
}
