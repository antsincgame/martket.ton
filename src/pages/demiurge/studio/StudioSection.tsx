import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hammer, Plus, Edit3, FileArchive, AlertCircle, Package } from 'lucide-react';
import { SkeletonRow } from '../../../components/ui/Skeleton';
import { formatFileSize } from '../types';
import type { CreatedProduct } from '../types';
import StudioStatusBadge from './StudioStatusBadge';
import CreateProductWizard from './CreateProductWizard';
import { useSessionInvalidator } from '../../../queries/sessionQueries';

interface StudioSectionProps {
  myProducts: CreatedProduct[];
  isLoading: boolean;
  getToken: () => Promise<string | null>;
}

type Filter = 'all' | 'draft' | 'pending_review' | 'published' | 'suspended';

const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'pending_review', label: 'In review' },
  { id: 'published', label: 'Published' },
  { id: 'suspended', label: 'Suspended' },
];

export default function StudioSection({ myProducts, isLoading, getToken }: StudioSectionProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const invalidator = useSessionInvalidator();

  const visible = useMemo(() => {
    if (filter === 'all') return myProducts;
    return myProducts.filter((p) => p.status === filter);
  }, [myProducts, filter]);

  const counts = useMemo(() => {
    const initial: Record<Filter, number> = {
      all: myProducts.length, draft: 0, pending_review: 0, published: 0, suspended: 0,
    };
    for (const p of myProducts) {
      if (p.status in initial) {
        initial[p.status as Filter] = (initial[p.status as Filter] ?? 0) + 1;
      }
    }
    return initial;
  }, [myProducts]);

  if (showCreate) {
    return (
      <CreateProductWizard
        getToken={getToken}
        onBack={() => {
          setShowCreate(false);
          invalidator.invalidateProducts();
          invalidator.invalidateStats();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold uppercase tracking-widest text-white flex items-center gap-3">
            <Hammer className="w-7 h-7 text-[#8B5CF6]" />
            Studio
          </h1>
          <p className="text-[#666] text-sm mt-1">Создавайте, редактируйте и публикуйте свои творения</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="self-start sm:self-auto flex items-center gap-2 bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest text-xs px-5 py-2.5 rounded-lg hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all duration-300"
          style={{ minHeight: 44 }}
        >
          <Plus className="w-4 h-4" aria-hidden />
          <span>New product</span>
        </button>
      </header>

      {/* Filter strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = counts[f.id];
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`flex-shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                active
                  ? 'bg-[#FFD700]/15 text-[#FFD700] ring-1 ring-[#FFD700]/30'
                  : 'bg-white/[0.04] text-[#888] hover:text-white ring-1 ring-white/5'
              }`}
              aria-pressed={active}
            >
              {f.label}
              <span className="text-[10px] tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : visible.length > 0 ? (
        <div className="space-y-3">
          {visible.map((product) => <ProductRow key={product.id} product={product} />)}
        </div>
      ) : myProducts.length === 0 ? (
        <EmptyForge onCreate={() => setShowCreate(true)} />
      ) : (
        <EmptyFilter />
      )}
    </div>
  );
}

function ProductRow({ product }: { product: CreatedProduct }) {
  return (
    <article className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-[#111119] p-5 hover:border-white/[0.1] transition-all">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="w-14 h-14 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/5">
          {product.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Package className="w-6 h-6 text-[#8B5CF6]" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-white font-medium text-sm truncate">{product.name}</h3>
            <StudioStatusBadge status={product.status} />
            {product.version && (
              <span className="text-[#555] text-[10px] tabular-nums">v{product.version}</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-[#666] flex-wrap">
            <span><span className="text-[#FFD700]">{product.price_ton}</span> TON</span>
            <span>{product.downloads} downloads</span>
            <span>{product.category}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
            {product.build_r2_key ? (
              <>
                <FileArchive className="w-3 h-3 text-[#00FF88]" aria-hidden />
                <span className="text-[#00FF88]">Build uploaded</span>
                <span className="text-[#555] truncate max-w-[200px]">
                  ({product.build_filename}{product.build_size_bytes ? `, ${formatFileSize(product.build_size_bytes)}` : ''})
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-[#FFD700]" aria-hidden />
                <span className="text-[#FFD700]">No build uploaded</span>
              </>
            )}
          </div>
        </div>
      </div>
      <Link
        to={`/profile/studio/${product.id}/edit`}
        className="self-stretch lg:self-auto border border-white/[0.1] bg-transparent px-4 py-2 rounded-lg text-[#888] text-xs font-medium hover:text-white hover:border-white/[0.2] transition-all flex items-center gap-2 justify-center"
        style={{ minHeight: 44 }}
      >
        <Edit3 className="w-3.5 h-3.5" aria-hidden />
        <span>Edit</span>
      </Link>
    </article>
  );
}

function EmptyForge({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-16 rounded-2xl border border-white/[0.06] bg-[#111119]/40">
      <div className="w-20 h-20 rounded-full border border-[#8B5CF6]/15 flex items-center justify-center mx-auto mb-5">
        <Hammer className="w-10 h-10 text-[#333]" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">The Studio is quiet</h3>
      <p className="text-[#666] text-sm max-w-xs mx-auto mb-6">
        Каждый демиург начинается с первого творения. Зажги студию.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest text-xs px-8 py-3 rounded-lg hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all duration-300"
        style={{ minHeight: 44 }}
      >
        Create your first product
      </button>
    </div>
  );
}

function EmptyFilter() {
  return (
    <div className="text-center py-12 rounded-2xl border border-white/[0.06] bg-[#111119]/40">
      <p className="text-[#888] text-sm">Нет продуктов в этой категории.</p>
    </div>
  );
}
