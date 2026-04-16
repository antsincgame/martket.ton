import { useState, useRef } from 'react';
import {
  Hammer, Plus, Edit3, FileArchive, AlertCircle,
  Upload, CheckCircle, Loader2, Package, ChevronLeft,
} from 'lucide-react';
import { SkeletonRow } from '../../components/ui/Skeleton';
import { CopyableText } from '../../components/ui/CopyButton';
import { useToast } from '../../components/ui/Toast';
import { storeApiUrl } from '../../lib/storeApi';
import { formatFileSize } from './types';
import type { CreatedProduct } from './types';
import { PRODUCT_NAME_MAX, PRODUCT_NAME_MIN } from '../../domain/marketplace/limits';

interface ForgeProps {
  myProducts: CreatedProduct[];
  isLoading: boolean;
  getToken: () => Promise<string | null>;
  onRefresh: () => void;
}

const ACCEPTED_EXTENSIONS = '.zip,.tar.gz,.tgz,.dmg,.exe,.msi,.deb,.rpm,.apk,.aab,.ipa,.appimage';

export default function ForgeSection({ myProducts, isLoading, getToken, onRefresh }: ForgeProps) {
  const [showCreate, setShowCreate] = useState(false);

  if (showCreate) {
    return <CreateProduct getToken={getToken} onBack={() => { setShowCreate(false); onRefresh(); }} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold uppercase tracking-widest text-white flex items-center gap-3">
            <Hammer className="w-7 h-7 text-[#8B5CF6]" />
            Кузница
          </h1>
          <p className="text-[#666] text-sm mt-1">Your created products</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest text-xs px-5 py-2.5 rounded-lg hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all duration-300"
        >
          <Plus className="w-4 h-4" />
          <span>Create</span>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : myProducts.length > 0 ? (
        <div className="space-y-3">
          {myProducts.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <EmptyForge onCreate={() => setShowCreate(true)} />
      )}
    </div>
  );
}

function ProductRow({ product }: { product: CreatedProduct }) {
  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-[#111119] p-5 hover:border-white/[0.1] transition-all">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="w-11 h-11 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
          <Package className="w-5 h-5 text-[#8B5CF6]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-medium text-sm truncate">{product.name}</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                product.status === 'published'
                  ? 'bg-[#00FF88]/10 text-[#00FF88]'
                  : product.status === 'draft'
                  ? 'bg-[#FFD700]/10 text-[#FFD700]'
                  : 'bg-[#FF4444]/10 text-[#FF4444]'
              }`}
            >
              {product.status}
            </span>
            {product.version && (
              <span className="text-[#555] text-[10px]">v{product.version}</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-[#666]">
            <span><span className="text-[#FFD700]">{product.price_ton}</span> TON</span>
            <span>{product.downloads} downloads</span>
            <span>{product.category}</span>
          </div>
          {product.build_r2_key ? (
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
              <FileArchive className="w-3 h-3 text-[#00FF88]" />
              <span className="text-[#00FF88]">Build uploaded</span>
              <span className="text-[#555]">
                ({product.build_filename}{product.build_size_bytes ? `, ${formatFileSize(product.build_size_bytes)}` : ''})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
              <AlertCircle className="w-3 h-3 text-[#FFD700]" />
              <span className="text-[#FFD700]">No build uploaded</span>
            </div>
          )}
        </div>
      </div>
      <button className="border border-white/[0.1] bg-transparent px-4 py-2 rounded-lg text-[#888] text-xs font-medium hover:text-white hover:border-white/[0.2] transition-all flex items-center gap-2">
        <Edit3 className="w-3.5 h-3.5" />
        <span>Edit</span>
      </button>
    </div>
  );
}

function CreateProduct({ getToken, onBack }: { getToken: () => Promise<string | null>; onBack: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [priceTon, setPriceTon] = useState('0');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [buildFile, setBuildFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'creating' | 'uploading' | 'hashing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ sha256: string; size_bytes: number; filename: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setBuildFile(file);
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < PRODUCT_NAME_MIN) {
      setErrorMsg(`Name must be at least ${PRODUCT_NAME_MIN} characters`);
      setPhase('error');
      return;
    }
    if (trimmed.length > PRODUCT_NAME_MAX) {
      setErrorMsg(`Name must be at most ${PRODUCT_NAME_MAX} characters`);
      setPhase('error');
      return;
    }
    setSubmitting(true);
    setPhase('creating');
    setErrorMsg(null);
    setResult(null);

    try {
      const token = await getToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      const createRes = await fetch(storeApiUrl('/api/products'), {
        method: 'POST', headers,
        body: JSON.stringify({
          name: name.trim(), category: category || 'other',
          price_ton: parseFloat(priceTon) || 0,
          description: description.trim() || null,
          version: version.trim() || '1.0.0',
        }),
      });

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({ message: 'Create failed' }));
        throw new Error(body.message || `HTTP ${createRes.status}`);
      }

      const { data: product } = await createRes.json();

      if (buildFile) {
        setPhase('uploading');
        const formData = new FormData();
        formData.append('build', buildFile);
        formData.append('version', version.trim() || '1.0.0');

        const uploadRes = await fetch(storeApiUrl(`/api/r2/upload/${product.id}`), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({ message: 'Upload failed' }));
          throw new Error(body.message || `Upload HTTP ${uploadRes.status}`);
        }

        setPhase('hashing');
        await new Promise((r) => setTimeout(r, 800));

        const { data: uploadData } = await uploadRes.json();
        setResult({ sha256: uploadData.sha256, size_bytes: uploadData.size_bytes, filename: uploadData.filename });
      }

      setPhase('done');
      toast('success', `"${product.name}" forged successfully!`);
      setTimeout(onBack, 2000);
    } catch (err: unknown) {
      setPhase('error');
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setErrorMsg(msg);
      toast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#FFD700]/40 focus:ring-1 focus:ring-[#FFD700]/20 transition-all disabled:opacity-40';

  return (
    <div className="max-w-2xl space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-[#888] hover:text-white text-sm transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Back to Forge
      </button>

      <div>
        <h1 className="text-2xl font-display font-bold uppercase tracking-widest text-white flex items-center gap-3">
          <Upload className="w-7 h-7 text-[#8B5CF6]" />
          Create Product
        </h1>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111119] p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[#999] text-xs uppercase tracking-wider font-medium">Name *</label>
            <span className={`text-[10px] tabular-nums ${
              name.trim().length > PRODUCT_NAME_MAX ? 'text-[#FF4444]'
                : name.trim().length >= PRODUCT_NAME_MIN ? 'text-[#666]' : 'text-[#FFD700]/60'
            }`}>
              {name.trim().length}/{PRODUCT_NAME_MAX}
            </span>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, PRODUCT_NAME_MAX))}
            maxLength={PRODUCT_NAME_MAX}
            minLength={PRODUCT_NAME_MIN}
            disabled={submitting}
            className={inputClass}
            placeholder={`Product name (${PRODUCT_NAME_MIN}-${PRODUCT_NAME_MAX} chars)...`}
          />
          <p className="text-[10px] text-[#555] mt-1">Used in URL: /product/&lt;slug&gt;</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[#999] text-xs uppercase tracking-wider font-medium mb-2">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={submitting} className={inputClass}>
              <option value="">Select...</option>
              <option value="apps">Apps</option>
              <option value="games">Games</option>
              <option value="ai">AI Services</option>
              <option value="developer-tools">Developer Tools</option>
              <option value="finance">Finance</option>
              <option value="social">Social</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-[#999] text-xs uppercase tracking-wider font-medium mb-2">Version</label>
            <input type="text" value={version} onChange={(e) => setVersion(e.target.value)} disabled={submitting}
              className={inputClass} placeholder="1.0.0" />
          </div>
        </div>

        <div>
          <label className="block text-[#999] text-xs uppercase tracking-wider font-medium mb-2">Price (TON)</label>
          <input type="number" step="0.1" min="0" value={priceTon} onChange={(e) => setPriceTon(e.target.value)}
            disabled={submitting} className={inputClass} />
        </div>

        <div>
          <label className="block text-[#999] text-xs uppercase tracking-wider font-medium mb-2">Description</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            disabled={submitting} className={`${inputClass} resize-none`} placeholder="Describe your creation..." />
        </div>

        {/* Drag & drop */}
        <div>
          <label className="block text-[#999] text-xs uppercase tracking-wider font-medium mb-2">Build File</label>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              buildFile ? 'border-[#00FF88]/30 bg-[#00FF88]/[0.03]' : 'border-white/[0.08] hover:border-[#FFD700]/30'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setBuildFile(f); }}
              className="hidden" disabled={submitting} />
            {buildFile ? (
              <div>
                <FileArchive className="w-10 h-10 text-[#00FF88] mx-auto mb-2" />
                <p className="text-white text-sm font-medium">{buildFile.name}</p>
                <p className="text-[#666] text-xs">{formatFileSize(buildFile.size)}</p>
                <button type="button" onClick={(e) => { e.stopPropagation(); setBuildFile(null); }}
                  className="mt-2 text-[#FF4444] text-xs hover:underline">Remove</button>
              </div>
            ) : (
              <div>
                <Upload className="w-10 h-10 text-[#444] mx-auto mb-3" />
                <p className="text-[#888] text-sm">Drag & drop your build file or click to browse</p>
                <p className="text-[#555] text-xs mt-1">.zip, .dmg, .exe, .deb, .apk, .ipa (max 500 MB)</p>
              </div>
            )}
          </div>
        </div>

        {/* Progress indicator */}
        {phase !== 'idle' && phase !== 'error' && (
          <div className="rounded-lg border border-white/[0.06] bg-[#0A0A0A] p-4">
            <div className="flex items-center gap-3">
              {phase === 'done' ? (
                <CheckCircle className="w-5 h-5 text-[#00FF88] flex-shrink-0" />
              ) : (
                <Loader2 className="w-5 h-5 text-[#FFD700] animate-spin flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-white text-sm font-medium">
                  {phase === 'creating' && 'Creating product...'}
                  {phase === 'uploading' && 'Uploading to R2...'}
                  {phase === 'hashing' && 'Computing SHA-256 hash...'}
                  {phase === 'done' && 'Forged!'}
                </p>
                {result && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[#666]">SHA-256:</span>
                      <CopyableText text={result.sha256} />
                    </div>
                    <p className="text-[#666] text-xs">Size: <span className="text-white">{formatFileSize(result.size_bytes)}</span></p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === 'error' && errorMsg && (
          <div className="rounded-lg border border-[#FF4444]/20 bg-[#FF4444]/[0.05] p-3 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-[#FF4444] flex-shrink-0" />
            <p className="text-[#FF4444] text-sm">{errorMsg}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || name.trim().length < PRODUCT_NAME_MIN || name.trim().length > PRODUCT_NAME_MAX}
          className="w-full py-4 rounded-xl bg-[#FFD700] text-[#0A0A0A] font-bold uppercase tracking-widest text-sm transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,215,0,0.3)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /><span>Processing...</span></>
          ) : (
            <span>{buildFile ? 'Forge & Upload Build' : 'Forge Product'}</span>
          )}
        </button>
      </div>
    </div>
  );
}

function EmptyForge({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 rounded-full border border-[#8B5CF6]/15 flex items-center justify-center mx-auto mb-5">
        <Hammer className="w-10 h-10 text-[#333]" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">The Forge is cold</h3>
      <p className="text-[#666] text-sm max-w-xs mx-auto mb-6">
        Every Demiurge begins with a first creation. Light the forge.
      </p>
      <button
        onClick={onCreate}
        className="bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest text-xs px-8 py-3 rounded-lg hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all duration-300"
      >
        Create Your First Product
      </button>
    </div>
  );
}
