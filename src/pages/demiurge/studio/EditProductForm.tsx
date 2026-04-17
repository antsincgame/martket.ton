import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Edit3, Upload, FileArchive } from 'lucide-react';
import { storeApiUrl } from '../../../lib/storeApi';
import { useToast } from '../../../components/ui/Toast';
import { logger } from '../../../lib/logger';
import { PRODUCT_NAME_MAX, PRODUCT_NAME_MIN } from '../../../domain/marketplace/limits';
import { formatFileSize } from '../types';
import StickyActionBar from '../components/StickyActionBar';
import PublishWorkflow from './PublishWorkflow';
import ImageUploader from '../../../components/studio/ImageUploader';
import { useSessionInvalidator } from '../../../queries/sessionQueries';

interface EditProductFormProps {
  getToken: () => Promise<string | null>;
}

interface ProductDetail {
  id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  price_ton: number;
  category: string;
  image: string | null;
  status: string;
  version: string | null;
  build_r2_key: string | null;
  build_filename: string | null;
  build_size_bytes: number | null;
  build_sha256: string | null;
  downloads: number;
  scan_status?: 'pending' | 'scanning' | 'clean' | 'suspicious' | 'malicious' | 'error' | null;
  scan_malicious_count?: number;
  scan_total_engines?: number;
}

const CATEGORIES = ['apps', 'games', 'ai', 'developer-tools', 'finance', 'social', 'other'];

export default function EditProductForm({ getToken }: EditProductFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const invalidator = useSessionInvalidator();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [priceTon, setPriceTon] = useState('0');
  const [category, setCategory] = useState('other');
  const [version, setVersion] = useState('1.0.0');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(storeApiUrl(`/api/products/${id}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        const data = body?.data as ProductDetail | null;
        if (!data) throw new Error('Product not found');
        setProduct(data);
        setName(data.name ?? '');
        setShortDescription(data.short_description ?? '');
        setDescription(data.description ?? '');
        setPriceTon(String(data.price_ton ?? 0));
        setCategory(data.category ?? 'other');
        setVersion(data.version ?? '1.0.0');
        setImageUrl(data.image ?? '');
      } catch (err) {
        logger.warn('[EditProductForm] load failed', err);
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load product');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, getToken]);

  const isDirty = useMemo(() => {
    if (!product) return false;
    return (
      name !== (product.name ?? '') ||
      shortDescription !== (product.short_description ?? '') ||
      description !== (product.description ?? '') ||
      String(product.price_ton ?? 0) !== priceTon ||
      category !== (product.category ?? 'other') ||
      version !== (product.version ?? '1.0.0') ||
      imageUrl !== (product.image ?? '')
    );
  }, [product, name, shortDescription, description, priceTon, category, version, imageUrl]);

  const validate = (): string | null => {
    if (name.trim().length < PRODUCT_NAME_MIN) return `Name must be at least ${PRODUCT_NAME_MIN} characters`;
    if (name.trim().length > PRODUCT_NAME_MAX) return `Name must be at most ${PRODUCT_NAME_MAX} characters`;
    const price = parseFloat(priceTon);
    if (Number.isNaN(price) || price < 0) return 'Price must be ≥ 0';
    return null;
  };

  const handleSave = async () => {
    if (!product) return;
    const err = validate();
    if (err) {
      toast('error', err);
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl(`/api/products/${product.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          short_description: shortDescription.trim() || null,
          description: description.trim() || null,
          price_ton: parseFloat(priceTon) || 0,
          category,
          version: version.trim() || '1.0.0',
          image: imageUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Save failed' }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const { data: updated } = await res.json();
      setProduct(updated);
      invalidator.invalidateProducts();
      toast('success', 'Product saved');
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!product) return;
    setName(product.name ?? '');
    setShortDescription(product.short_description ?? '');
    setDescription(product.description ?? '');
    setPriceTon(String(product.price_ton ?? 0));
    setCategory(product.category ?? 'other');
    setVersion(product.version ?? '1.0.0');
    setImageUrl(product.image ?? '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#FFD700] animate-spin" aria-hidden />
      </div>
    );
  }

  if (loadError || !product) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <p className="text-[#FF4444] text-sm">{loadError || 'Product not found'}</p>
        <button
          type="button"
          onClick={() => navigate('/profile/studio')}
          className="text-[#FFD700] text-sm hover:underline"
        >
          ← Back to Studio
        </button>
      </div>
    );
  }

  const inputClass = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#FFD700]/40 focus:ring-1 focus:ring-[#FFD700]/20 transition-all disabled:opacity-40';
  const labelClass = 'block text-[#999] text-xs uppercase tracking-wider font-medium mb-2';

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        to="/profile/studio"
        className="inline-flex items-center gap-2 text-[#888] hover:text-white text-sm transition-colors"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden />
        Back to Studio
      </Link>

      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold uppercase tracking-widest text-white flex items-center gap-3">
            <Edit3 className="w-7 h-7 text-[#8B5CF6]" aria-hidden />
            Edit product
          </h1>
          <p className="text-[#666] text-sm mt-1 truncate max-w-md">{product.name}</p>
        </div>
      </header>

      {/* Publishing workflow */}
      <PublishWorkflow
        productId={product.id}
        status={product.status}
        hasBuild={Boolean(product.build_r2_key)}
        scanStatus={product.scan_status ?? null}
        scanMaliciousCount={product.scan_malicious_count ?? 0}
        scanTotalEngines={product.scan_total_engines ?? 0}
        getToken={getToken}
        onChanged={(next) => setProduct({ ...product, status: next })}
      />

      {/* Build summary */}
      <section
        aria-labelledby="build-heading"
        className="rounded-2xl border border-white/[0.06] bg-[#111119] p-5 sm:p-6 space-y-3"
      >
        <h2 id="build-heading" className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/60">Build</h2>
        {product.build_r2_key ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <FileArchive className="w-5 h-5 text-[#00FF88]" aria-hidden />
            <span className="text-white font-medium truncate max-w-[260px]">{product.build_filename ?? 'build'}</span>
            <span className="text-[#666] tabular-nums">
              {product.build_size_bytes ? formatFileSize(product.build_size_bytes) : ''}
            </span>
            <span className="text-[#666]">v{product.version ?? '1.0.0'}</span>
            <span className="text-[#666]">{product.downloads} downloads</span>
          </div>
        ) : (
          <p className="text-[#888] text-sm flex items-center gap-2">
            <Upload className="w-4 h-4" aria-hidden />
            No build uploaded. Use "Create new version" (available after the first build; for the initial upload — recreate via Studio → New product).
          </p>
        )}
      </section>

      {/* Editable fields */}
      <section
        aria-labelledby="details-heading"
        className="rounded-2xl border border-white/[0.06] bg-[#111119] p-5 sm:p-6 space-y-5"
      >
        <h2 id="details-heading" className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/60">Details</h2>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelClass} mb-0`}>Name <span className="text-[#FF4444]">*</span></label>
            <span className={`text-[10px] tabular-nums ${
              name.trim().length > PRODUCT_NAME_MAX ? 'text-[#FF4444]'
                : name.trim().length >= PRODUCT_NAME_MIN ? 'text-[#666]' : 'text-[#FFD700]/60'
            }`}>{name.trim().length}/{PRODUCT_NAME_MAX}</span>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, PRODUCT_NAME_MAX))}
            disabled={saving}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={saving} className={inputClass}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Version</label>
            <input type="text" value={version} onChange={(e) => setVersion(e.target.value)} disabled={saving} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Price (TON)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={priceTon}
            onChange={(e) => setPriceTon(e.target.value)}
            disabled={saving}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Short description</label>
          <input
            type="text"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value.slice(0, 500))}
            maxLength={500}
            disabled={saving}
            className={inputClass}
            placeholder="One line that lands the pitch"
          />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
            maxLength={5000}
            disabled={saving}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className={labelClass}>Cover image</label>
          <ImageUploader
            value={imageUrl || null}
            onChange={(url) => setImageUrl(url ?? '')}
            kind="cover"
            getToken={getToken}
            aspectClass="aspect-video"
            hint="PNG/JPG/WebP, up to 5 MB. The cover will appear in the marketplace."
          />
          <div className="mt-3">
            <label className="block text-[10px] uppercase tracking-wider text-[#666] mb-1">…or paste URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={saving}
              className={inputClass}
              placeholder="https://…"
            />
          </div>
        </div>
      </section>

      {/* Sticky bar */}
      <StickyActionBar
        visible={isDirty}
        saving={saving}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
