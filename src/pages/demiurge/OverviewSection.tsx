import { Package, Download, TrendingUp, Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '../../components/ui/Skeleton';
import type { CreatedProduct, PurchaseWithProduct } from './types';

interface OverviewProps {
  library: PurchaseWithProduct[];
  myProducts: CreatedProduct[];
  isLoading: boolean;
  displayName: string;
}

export default function OverviewSection({ library, myProducts, isLoading, displayName }: OverviewProps) {
  const publishedCount = myProducts.filter((p) => p.status === 'published').length;
  const totalDownloads = myProducts.reduce((s, p) => s + (p.downloads || 0), 0);

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-display font-bold uppercase tracking-widest text-white">
          Welcome, <span className="text-[#FFD700]">{displayName}</span>
        </h1>
        <p className="text-[#666] text-sm mt-1">Your forge overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard icon={Package} label="Library" value={library.length} accent="#FFD700" />
            <StatCard icon={TrendingUp} label="Published" value={publishedCount} accent="#8B5CF6" />
            <StatCard icon={Download} label="Downloads" value={totalDownloads} accent="#00F5FF" />
            <StatCard icon={Zap} label="Products" value={myProducts.length} accent="#00FF88" />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border-2 border-dashed border-white/[0.08] hover:border-[#FFD700]/30 p-8 text-center transition-all duration-300 group cursor-pointer">
        <Link to="/profile/forge" className="block">
          <Zap className="w-10 h-10 text-[#FFD700]/40 group-hover:text-[#FFD700] mx-auto mb-3 transition-colors" />
          <p className="text-[#888] group-hover:text-white transition-colors text-sm font-medium">
            Drag & drop a <span className="text-[#FFD700]">.zip</span> file here to forge a new product
          </p>
          <p className="text-[#555] text-xs mt-1">or click to open the Forge</p>
        </Link>
      </div>

      {/* Recent creations */}
      {!isLoading && myProducts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Creations</h2>
            <Link to="/profile/forge" className="text-[#FFD700] text-xs font-medium hover:text-[#FFE066] flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {myProducts.slice(0, 4).map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-[#111119] p-4 hover:border-white/[0.1] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4.5 h-4.5 text-[#8B5CF6]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{product.name}</p>
                    <p className="text-[#666] text-xs">{product.downloads} downloads</p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                    product.status === 'published'
                      ? 'bg-[#00FF88]/10 text-[#00FF88]'
                      : 'bg-[#FFD700]/10 text-[#FFD700]'
                  }`}
                >
                  {product.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: {
  icon: typeof Package;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111119] p-5 hover:border-white/[0.1] transition-all group">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: `${accent}15` }}
      >
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
      <div className="text-[#666] text-xs uppercase tracking-wider">{label}</div>
    </div>
  );
}
