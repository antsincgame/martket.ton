import { useEffect, useRef, useState } from 'react';
import { Download, Package, X, Loader2, Clock, Shield, FileArchive } from 'lucide-react';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { CopyableText } from '../../components/ui/CopyButton';
import { useToast } from '../../components/ui/Toast';
import { storeApiUrl } from '../../lib/storeApi';
import type { PurchaseWithProduct } from './types';

interface ArsenalProps {
  library: PurchaseWithProduct[];
  isLoading: boolean;
  getToken: () => Promise<string | null>;
}

export default function ArsenalSection({ library, isLoading, getToken }: ArsenalProps) {
  const [drawer, setDrawer] = useState<PurchaseWithProduct | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold uppercase tracking-widest text-white flex items-center gap-3">
          <Shield className="w-7 h-7 text-[#00F5FF]" />
          Арсенал
        </h1>
        <p className="text-[#666] text-sm mt-1">Your purchased applications</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : library.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {library.map((item) => (
            <ArsenalCard key={item.id} item={item} onClick={() => setDrawer(item)} />
          ))}
        </div>
      ) : (
        <EmptyArsenal />
      )}

      {/* Side drawer */}
      {drawer && (
        <ArsenalDrawer item={drawer} onClose={() => setDrawer(null)} getToken={getToken} />
      )}
    </div>
  );
}

function ArsenalCard({ item, onClick }: { item: PurchaseWithProduct; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-white/[0.06] bg-[#111119] hover:border-[#00F5FF]/30 hover:shadow-[0_0_20px_rgba(0,245,255,0.05)] transition-all duration-300 overflow-hidden group"
    >
      <div className="h-36 bg-gradient-to-br from-[#0D0D1A] to-[#111119] flex items-center justify-center">
        {item.product?.image ? (
          <img src={item.product.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <Package className="w-12 h-12 text-[#333] group-hover:text-[#00F5FF]/40 transition-colors" />
        )}
      </div>
      <div className="p-4">
        <h3 className="text-white font-medium text-sm truncate mb-1">
          {item.product?.name || 'Unknown'}
        </h3>
        <div className="flex justify-between items-center text-xs">
          <span className="text-[#666]">{new Date(item.created_at).toLocaleDateString()}</span>
          <span className="text-[#FFD700] font-semibold">{item.price_ton} TON</span>
        </div>
      </div>
    </button>
  );
}

function ArsenalDrawer({ item, onClose, getToken }: {
  item: PurchaseWithProduct;
  onClose: () => void;
  getToken: () => Promise<string | null>;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = `arsenal-drawer-title-${item.id}`;

  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleDownload = async () => {
    if (!item.product) return;
    setDownloading(true);
    setError(null);
    setDownloadUrl(null);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl(`/api/r2/download/${item.product.id}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Download failed' }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const { data } = await res.json();
      setDownloadUrl(data.download_url);
      window.open(data.download_url, '_blank');
      toast('success', 'Secure link forged. Burns in 15 minutes.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setError(msg);
      toast('error', msg);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-[#0A0A0F] border-l border-white/[0.06] shadow-2xl overflow-y-auto animate-fade-in">
        <div className="sticky top-0 bg-[#0A0A0F]/90 backdrop-blur-md border-b border-white/[0.06] px-6 py-4 flex items-center justify-between z-10">
          <h2 id={titleId} className="text-white font-semibold truncate">{item.product?.name || 'Unknown'}</h2>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Закрыть панель"
            className="text-[#666] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#00F5FF]/50 rounded"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Cover */}
          <div className="h-48 rounded-xl bg-gradient-to-br from-[#0D0D1A] to-[#111119] border border-white/[0.06] flex items-center justify-center overflow-hidden">
            {item.product?.image ? (
              <img
                src={item.product.image}
                alt={`Обложка приложения ${item.product?.name ?? ''}`.trim()}
                className="w-full h-full object-cover"
              />
            ) : (
              <FileArchive className="w-16 h-16 text-[#222]" aria-hidden />
            )}
          </div>

          {/* Info */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#666]">Purchased</span>
              <span className="text-white">{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#666]">Price</span>
              <span className="text-[#FFD700] font-semibold">{item.price_ton} TON</span>
            </div>
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={downloading || !item.product}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00F5FF] to-[#00FF88] text-[#0A0A0A] font-bold uppercase tracking-widest text-sm transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,245,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {downloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Forging secure link...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Download</span>
              </>
            )}
          </button>

          {/* Presigned URL info */}
          {downloadUrl && (
            <div className="rounded-lg border border-[#00FF88]/20 bg-[#00FF88]/[0.05] p-4 space-y-2">
              <div className="flex items-center gap-2 text-[#00FF88] text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Secure link generated — expires in 15 min</span>
              </div>
              <CopyableText text={downloadUrl} />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-[#FF4444]/20 bg-[#FF4444]/[0.05] p-3 text-[#FF4444] text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyArsenal() {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 rounded-full border border-[#00F5FF]/15 flex items-center justify-center mx-auto mb-5">
        <Shield className="w-10 h-10 text-[#333]" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Arsenal is empty</h3>
      <p className="text-[#666] text-sm max-w-xs mx-auto">
        Explore the store and acquire your first digital artifact.
      </p>
    </div>
  );
}
