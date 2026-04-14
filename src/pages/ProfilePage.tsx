import { useState, useCallback, useEffect, useRef } from 'react';
import { Download, Heart, Settings, Wallet, Gift, Trophy, Gem, TrendingUp, Upload, Shield, Star, Package, Plus, Edit3, FileArchive, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { TonConnectButton, useTonAddress } from '@tonconnect/ui-react';
import { useAuth } from '../contexts/AuthContext';
import { storeApiUrl } from '../lib/storeApi';
import TonConnectWrapper from '../components/TonConnectWrapper';

interface PurchaseWithProduct {
  id: string;
  product_id: string;
  price_ton: number;
  created_at: string;
  product: {
    id: string;
    name: string;
    image: string | null;
    creator_id: string | null;
  } | null;
}

interface CreatedProduct {
  id: string;
  name: string;
  description: string | null;
  price_ton: number;
  category: string;
  image: string | null;
  status: string;
  downloads: number;
  rating: number;
  version: string | null;
  build_r2_key: string | null;
  build_sha256: string | null;
  build_size_bytes: number | null;
  build_filename: string | null;
}

const WalletSection = () => {
  const tonAddress = useTonAddress();
  const { user, fetchProfile, getToken } = useAuth();
  const [linkStatus, setLinkStatus] = useState<'idle' | 'linking' | 'success' | 'error'>('idle');
  const [linkError, setLinkError] = useState<string | null>(null);

  const linkedAddress = user?.tonAddress;

  const handleLinkWallet = useCallback(async () => {
    if (!tonAddress) return;
    setLinkStatus('linking');
    setLinkError(null);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/session/profile'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ton_address: tonAddress }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Link failed' }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      setLinkStatus('success');
      await fetchProfile();
    } catch (err: unknown) {
      setLinkStatus('error');
      setLinkError(err instanceof Error ? err.message : 'Failed to link wallet');
    }
  }, [tonAddress, getToken, fetchProfile]);

  const handleUnlinkWallet = useCallback(async () => {
    setLinkStatus('linking');
    setLinkError(null);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/session/profile'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ton_address: null }),
      });
      if (!res.ok) throw new Error('Unlink failed');
      setLinkStatus('idle');
      await fetchProfile();
    } catch (err: unknown) {
      setLinkStatus('error');
      setLinkError(err instanceof Error ? err.message : 'Failed to unlink wallet');
    }
  }, [getToken, fetchProfile]);

  return (
    <div className="rounded-xl border border-[#FFD700]/15 bg-[#1A1A1A] p-6">
      <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
        <Wallet className="w-6 h-6 mr-3 text-[#FFD700]" />
        TON Wallet
      </h3>

      {linkedAddress ? (
        <div className="space-y-4">
          <div className="bg-[#00FF88]/10 border border-[#00FF88]/20 rounded-lg p-4">
            <p className="text-[#00FF88] text-sm font-medium mb-1">Linked Wallet</p>
            <p className="text-white font-mono text-sm break-all">{linkedAddress}</p>
          </div>
          <div className="flex gap-3">
            <TonConnectButton />
            <button
              onClick={handleUnlinkWallet}
              disabled={linkStatus === 'linking'}
              className="border border-[#FF4444]/30 hover:bg-[#FF4444]/10 text-[#FF4444] px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              Unlink
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[#999999] text-sm">
            Connect your TON wallet to enable crypto payments and receive earnings from your creations.
          </p>
          <TonConnectButton />
          {tonAddress && tonAddress !== linkedAddress && (
            <button
              onClick={handleLinkWallet}
              disabled={linkStatus === 'linking'}
              className="w-full bg-[#FFD700] text-[#0A0A0A] font-semibold py-3 px-6 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] disabled:opacity-50"
            >
              {linkStatus === 'linking' ? 'Linking...' : `Link ${tonAddress.slice(0, 6)}...${tonAddress.slice(-4)}`}
            </button>
          )}
        </div>
      )}

      {linkStatus === 'success' && (
        <p className="mt-3 text-[#00FF88] text-sm">Wallet linked successfully!</p>
      )}
      {linkError && (
        <p className="mt-3 text-[#FF4444] text-sm">{linkError}</p>
      )}
    </div>
  );
};

const LibraryCard = ({ item, getToken }: { item: PurchaseWithProduct; getToken: () => Promise<string | null> }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!item.product) return;
    setDownloading(true);
    setDownloadError(null);
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
      window.open(data.download_url, '_blank');
    } catch (err: unknown) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#FFD700]/10 bg-[#0D0D1A] p-4 hover:border-[#FFD700]/30 transition-all">
      {item.product?.image && (
        <img src={item.product.image} alt={item.product?.name || ''} className="w-full h-32 object-cover rounded-lg mb-4" />
      )}
      <h3 className="font-semibold text-white mb-1">{item.product?.name || 'Unknown'}</h3>
      <div className="flex justify-between items-center text-sm mb-3">
        <span className="text-[#666666]">{new Date(item.created_at).toLocaleDateString()}</span>
        <span className="text-[#FFD700] font-semibold">{item.price_ton} TON</span>
      </div>
      <button
        onClick={handleDownload}
        disabled={downloading || !item.product}
        className="w-full border border-[#00F5FF]/30 bg-transparent px-4 py-2 rounded-lg text-[#00F5FF] text-sm font-medium hover:bg-[#00F5FF]/10 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
      >
        {downloading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>Download</span>
          </>
        )}
      </button>
      {downloadError && (
        <p className="text-[#FF4444] text-xs mt-2">{downloadError}</p>
      )}
    </div>
  );
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const ACCEPTED_EXTENSIONS = '.zip,.tar.gz,.tgz,.dmg,.exe,.msi,.deb,.rpm,.apk,.aab,.ipa,.appimage';

interface CreateProductFormProps {
  getToken: () => Promise<string | null>;
  onCreated: () => void;
}

const CreateProductForm = ({ getToken, onCreated }: CreateProductFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [priceTon, setPriceTon] = useState('0');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [buildFile, setBuildFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'creating' | 'uploading' | 'done' | 'error'>('idle');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [buildResult, setBuildResult] = useState<{ sha256: string; size_bytes: number; filename: string } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setBuildFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setBuildFile(file);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setResultMessage('Product name is required');
      setUploadProgress('error');
      return;
    }
    setSubmitting(true);
    setUploadProgress('creating');
    setResultMessage(null);
    setBuildResult(null);

    try {
      const token = await getToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      const createRes = await fetch(storeApiUrl('/api/products'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name.trim(),
          category: category || 'other',
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
        setUploadProgress('uploading');
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

        const { data: uploadData } = await uploadRes.json();
        setBuildResult({
          sha256: uploadData.sha256,
          size_bytes: uploadData.size_bytes,
          filename: uploadData.filename,
        });
      }

      setUploadProgress('done');
      setResultMessage(`Product "${product.name}" created successfully!`);
      setTimeout(() => onCreated(), 2000);
    } catch (err: unknown) {
      setUploadProgress('error');
      setResultMessage(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold uppercase tracking-widest text-white mb-6 flex items-center">
        <Upload className="w-6 h-6 mr-3 text-[#8B5CF6]" />
        Create New Product
      </h2>
      <div className="max-w-2xl mx-auto">
        <div className="rounded-xl border border-[#FFD700]/15 bg-[#0D0D1A] p-6 space-y-6">
          <div>
            <label className="block text-white font-medium mb-2 text-sm uppercase tracking-wider">Product Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-[#666666] focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 transition-all disabled:opacity-50"
              placeholder="Enter product name..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white font-medium mb-2 text-sm uppercase tracking-wider">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={submitting}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 transition-all disabled:opacity-50"
              >
                <option value="">Select category...</option>
                <option value="apps">Apps</option>
                <option value="games">Games</option>
                <option value="ai">AI Services</option>
                <option value="developer-tools">Developer Tools</option>
                <option value="finance">Finance</option>
                <option value="social">Social</option>
                <option value="wellness">Wellness</option>
                <option value="creative">Creative</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-white font-medium mb-2 text-sm uppercase tracking-wider">Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                disabled={submitting}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-[#666666] focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 transition-all disabled:opacity-50"
                placeholder="1.0.0"
              />
            </div>
          </div>
          <div>
            <label className="block text-white font-medium mb-2 text-sm uppercase tracking-wider">Price (TON)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={priceTon}
              onChange={(e) => setPriceTon(e.target.value)}
              disabled={submitting}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-[#666666] focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 transition-all disabled:opacity-50"
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="block text-white font-medium mb-2 text-sm uppercase tracking-wider">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-[#666666] focus:outline-none focus:border-[#FFD700]/50 focus:ring-1 focus:ring-[#FFD700]/30 transition-all resize-none disabled:opacity-50"
              placeholder="Describe your creation..."
            />
          </div>
          <div>
            <label className="block text-white font-medium mb-2 text-sm uppercase tracking-wider">Build File</label>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                buildFile
                  ? 'border-[#00FF88]/30 bg-[#00FF88]/5'
                  : 'border-white/10 hover:border-[#FFD700]/30'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileSelect}
                className="hidden"
                disabled={submitting}
              />
              {buildFile ? (
                <div>
                  <FileArchive className="w-12 h-12 text-[#00FF88] mx-auto mb-3" />
                  <p className="text-white font-medium mb-1">{buildFile.name}</p>
                  <p className="text-[#999999] text-sm">{formatFileSize(buildFile.size)}</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setBuildFile(null); }}
                    className="mt-3 text-[#FF4444] text-sm hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="w-12 h-12 text-[#666666] mx-auto mb-4" />
                  <p className="text-[#999999] mb-2">Drag and drop your build file here or click to browse</p>
                  <p className="text-[#666666] text-sm">Supported: .zip, .dmg, .exe, .deb, .apk, .ipa (max 500 MB)</p>
                </div>
              )}
            </div>
          </div>

          {uploadProgress !== 'idle' && uploadProgress !== 'error' && (
            <div className="rounded-lg border border-[#FFD700]/15 bg-[#0A0A0A] p-4">
              <div className="flex items-center space-x-3">
                {uploadProgress === 'done' ? (
                  <CheckCircle className="w-5 h-5 text-[#00FF88] flex-shrink-0" />
                ) : (
                  <Loader2 className="w-5 h-5 text-[#FFD700] animate-spin flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">
                    {uploadProgress === 'creating' && 'Creating product...'}
                    {uploadProgress === 'uploading' && 'Uploading build to R2...'}
                    {uploadProgress === 'done' && 'Complete!'}
                  </p>
                  {buildResult && (
                    <div className="mt-2 text-xs space-y-1">
                      <p className="text-[#999999]">SHA-256: <span className="text-[#00F5FF] font-mono">{buildResult.sha256.slice(0, 16)}...{buildResult.sha256.slice(-8)}</span></p>
                      <p className="text-[#999999]">Size: <span className="text-white">{formatFileSize(buildResult.size_bytes)}</span></p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {uploadProgress === 'error' && resultMessage && (
            <div className="rounded-lg border border-[#FF4444]/20 bg-[#FF4444]/5 p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-[#FF4444] flex-shrink-0 mt-0.5" />
              <p className="text-[#FF4444] text-sm">{resultMessage}</p>
            </div>
          )}

          {uploadProgress === 'done' && resultMessage && (
            <div className="rounded-lg border border-[#00FF88]/20 bg-[#00FF88]/5 p-4 flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-[#00FF88] flex-shrink-0 mt-0.5" />
              <p className="text-[#00FF88] text-sm">{resultMessage}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="w-full bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest py-4 px-6 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{buildFile ? 'Create & Upload Build' : 'Create Product'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfilePage = () => {
  const { user, hasRole, isAuthenticated, isLoading: isAuthLoading, getToken } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
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
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
  }, [getToken]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoadingData(true);
    Promise.all([fetchLibrary(), fetchMyProducts()]).finally(() => setIsLoadingData(false));
  }, [isAuthenticated, fetchLibrary, fetchMyProducts]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-bold uppercase tracking-widest text-white mb-2">Loading Profile...</h2>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="rounded-2xl border border-[#FFD700]/20 bg-[#1A1A1A] p-8 max-w-md w-full text-center shadow-[0_0_40px_rgba(255,215,0,0.08)]">
          <div className="w-20 h-20 rounded-full border-2 border-[#FFD700]/30 flex items-center justify-center mx-auto mb-6">
            <Settings className="w-10 h-10 text-[#FFD700]" />
          </div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-white mb-4">Demiurge Awaits</h1>
          <p className="text-[#999999] mb-6">
            Sign in to access your creative realm and manage your digital treasures.
          </p>
          <a
            href="/sign-in"
            className="block w-full bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest py-3 px-6 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] text-center"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  const displayName = user.profile?.displayName || user.username || 'Demiurge';
  const avatarEmoji = user.profile?.avatar || '\u{1F30C}';
  const publishedCount = myProducts.filter(p => p.status === 'published').length;
  const totalDownloads = myProducts.reduce((s, p) => s + (p.downloads || 0), 0);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'wallet', label: 'TON Wallet', icon: Wallet },
    { id: 'library', label: 'Library', icon: Download },
    { id: 'creations', label: 'My Creations', icon: Gem },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'donations', label: 'Donations', icon: Gift },
    ...(hasRole('admin') || hasRole('super_admin')
      ? [{ id: 'security', label: 'Security', icon: Shield }]
      : []),
  ];

  return (
    <TonConnectWrapper>
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Profile Header */}
          <div className="rounded-2xl border border-[#FFD700]/15 bg-[#1A1A1A] p-8 mb-8 shadow-[0_0_60px_rgba(255,215,0,0.05)]">
            <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-[#FFD700]/40 flex items-center justify-center text-5xl bg-[#0D0D1A]">
                  {avatarEmoji}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-[#FFD700] rounded-full p-2">
                  <Star className="w-5 h-5 text-[#0A0A0A]" />
                </div>
              </div>

              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold uppercase tracking-widest text-white mb-1">{displayName}</h1>
                <p className="text-[#FFD700] font-medium uppercase tracking-[3px] text-sm mb-1">Demiurge</p>
                <p className="text-[#666666] mb-4">{user.email || ''}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="rounded-xl border border-[#FFD700]/10 bg-[#0D0D1A] p-4 text-center">
                    <div className="text-2xl font-bold text-[#FFD700] mb-1">{library.length}</div>
                    <div className="text-[#666666] text-xs uppercase tracking-wider">Library</div>
                  </div>
                  <div className="rounded-xl border border-[#8B5CF6]/20 bg-[#0D0D1A] p-4 text-center">
                    <div className="text-2xl font-bold text-[#8B5CF6] mb-1">{publishedCount}</div>
                    <div className="text-[#666666] text-xs uppercase tracking-wider">Published</div>
                  </div>
                  <div className="rounded-xl border border-[#00F5FF]/20 bg-[#0D0D1A] p-4 text-center">
                    <div className="text-2xl font-bold text-[#00F5FF] mb-1">{totalDownloads}</div>
                    <div className="text-[#666666] text-xs uppercase tracking-wider">Downloads</div>
                  </div>
                  <div className="rounded-xl border border-[#00FF88]/20 bg-[#0D0D1A] p-4 text-center">
                    <div className="text-2xl font-bold text-[#00FF88] mb-1">{user.tonAddress ? 'Yes' : 'No'}</div>
                    <div className="text-[#666666] text-xs uppercase tracking-wider">Wallet</div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button className="border border-[#FFD700]/50 bg-transparent px-6 py-3 rounded-lg text-[#FFD700] font-semibold uppercase tracking-[3px] text-sm hover:bg-[#FFD700]/10 transition-all duration-300 flex items-center justify-center space-x-2">
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Profile</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="rounded-2xl border border-[#FFD700]/10 bg-[#1A1A1A] p-2 mb-8">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap text-sm ${
                    activeTab === tab.id
                      ? 'bg-[#FFD700] text-[#0A0A0A] shadow-[0_0_15px_rgba(255,215,0,0.3)]'
                      : 'text-[#999999] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="rounded-2xl border border-[#FFD700]/15 bg-[#1A1A1A] p-8">
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-widest text-white mb-6 flex items-center">
                  <TrendingUp className="w-6 h-6 mr-3 text-[#FFD700]" />
                  Overview
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="rounded-xl border border-[#FFD700]/10 bg-[#0D0D1A] p-6">
                    <div className="w-12 h-12 rounded-xl bg-[#FFD700]/10 flex items-center justify-center mb-4">
                      <Package className="w-6 h-6 text-[#FFD700]" />
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">{myProducts.length}</div>
                    <div className="text-[#666666] text-sm">Total Creations</div>
                  </div>
                  <div className="rounded-xl border border-[#00F5FF]/10 bg-[#0D0D1A] p-6">
                    <div className="w-12 h-12 rounded-xl bg-[#00F5FF]/10 flex items-center justify-center mb-4">
                      <Download className="w-6 h-6 text-[#00F5FF]" />
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">{totalDownloads}</div>
                    <div className="text-[#666666] text-sm">Total Downloads</div>
                  </div>
                  <div className="rounded-xl border border-[#00FF88]/10 bg-[#0D0D1A] p-6">
                    <div className="w-12 h-12 rounded-xl bg-[#00FF88]/10 flex items-center justify-center mb-4">
                      <Download className="w-6 h-6 text-[#00FF88]" />
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">{library.length}</div>
                    <div className="text-[#666666] text-sm">Library Items</div>
                  </div>
                </div>

                {myProducts.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-white mb-4">Recent Creations</h3>
                    <div className="space-y-3">
                      {myProducts.slice(0, 3).map((product) => (
                        <div key={product.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-[#0D0D1A] p-4">
                          <div>
                            <p className="text-white font-medium">{product.name}</p>
                            <p className="text-[#666666] text-sm">{product.downloads} downloads</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            product.status === 'published'
                              ? 'bg-[#00FF88]/10 text-[#00FF88]'
                              : 'bg-[#FFD700]/10 text-[#FFD700]'
                          }`}>
                            {product.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'wallet' && <WalletSection />}

            {activeTab === 'library' && (
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-widest text-white mb-6 flex items-center">
                  <Download className="w-6 h-6 mr-3 text-[#FFD700]" />
                  Library
                </h2>
                {isLoadingData ? (
                  <div className="text-center py-12">
                    <div className="w-10 h-10 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[#999999]">Loading library...</p>
                  </div>
                ) : library.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {library.map((item) => (
                      <LibraryCard key={item.id} item={item} getToken={getToken} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full border border-[#FFD700]/20 flex items-center justify-center mx-auto mb-4">
                      <Package className="w-8 h-8 text-[#666666]" />
                    </div>
                    <p className="text-[#999999]">Your library is empty. Explore the store to find creations.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'creations' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold uppercase tracking-widest text-white flex items-center">
                    <Gem className="w-6 h-6 mr-3 text-[#8B5CF6]" />
                    My Creations
                  </h2>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest text-xs px-5 py-2.5 rounded-lg hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all duration-300 flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create</span>
                  </button>
                </div>

                {isLoadingData ? (
                  <div className="text-center py-12">
                    <div className="w-10 h-10 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[#999999]">Loading creations...</p>
                  </div>
                ) : myProducts.length > 0 ? (
                  <div className="space-y-4">
                    {myProducts.map((product) => (
                      <div key={product.id} className="rounded-xl border border-[#FFD700]/10 bg-[#0D0D1A] p-6 hover:border-[#FFD700]/25 transition-all">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-lg font-semibold text-white">{product.name}</h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                product.status === 'published'
                                  ? 'bg-[#00FF88]/10 text-[#00FF88]'
                                  : product.status === 'draft'
                                  ? 'bg-[#FFD700]/10 text-[#FFD700]'
                                  : 'bg-[#FF4444]/10 text-[#FF4444]'
                              }`}>
                                {product.status}
                              </span>
                              {product.version && (
                                <span className="text-[#666666] text-xs">v{product.version}</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-[#666666]">Price</span>
                                <div className="text-[#FFD700] font-semibold">{product.price_ton} TON</div>
                              </div>
                              <div>
                                <span className="text-[#666666]">Downloads</span>
                                <div className="text-[#00F5FF] font-semibold">{product.downloads}</div>
                              </div>
                              <div>
                                <span className="text-[#666666]">Rating</span>
                                <div className="text-[#FFD700] font-semibold">{product.rating}</div>
                              </div>
                              <div>
                                <span className="text-[#666666]">Category</span>
                                <div className="text-white font-medium">{product.category}</div>
                              </div>
                            </div>
                            {product.build_r2_key ? (
                              <div className="mt-3 flex items-center space-x-2 text-xs">
                                <FileArchive className="w-3.5 h-3.5 text-[#00FF88]" />
                                <span className="text-[#00FF88]">Build uploaded</span>
                                <span className="text-[#666666]">({product.build_filename}, {product.build_size_bytes ? formatFileSize(product.build_size_bytes) : ''})</span>
                              </div>
                            ) : (
                              <div className="mt-3 flex items-center space-x-2 text-xs">
                                <AlertCircle className="w-3.5 h-3.5 text-[#FFD700]" />
                                <span className="text-[#FFD700]">No build uploaded</span>
                              </div>
                            )}
                          </div>
                          <button className="border border-[#FFD700]/30 bg-transparent px-4 py-2 rounded-lg text-[#FFD700] text-sm font-medium hover:bg-[#FFD700]/10 transition-all flex items-center space-x-2">
                            <Edit3 className="w-4 h-4" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 rounded-full border border-[#8B5CF6]/20 flex items-center justify-center mx-auto mb-4">
                      <Gem className="w-10 h-10 text-[#8B5CF6]" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">No Creations Yet</h3>
                    <p className="text-[#999999] mb-6">
                      Every Demiurge begins with a first creation. Upload your digital treasure.
                    </p>
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest text-sm px-8 py-3 rounded-lg hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all duration-300"
                    >
                      Create Your First Product
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'upload' && (
              <CreateProductForm
                getToken={getToken}
                onCreated={() => { fetchMyProducts(); setActiveTab('creations'); }}
              />
            )}

            {activeTab === 'achievements' && (
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-widest text-white mb-6 flex items-center">
                  <Trophy className="w-6 h-6 mr-3 text-[#FFD700]" />
                  Achievements
                </h2>
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full border border-[#FFD700]/20 flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-[#666666]" />
                  </div>
                  <p className="text-[#999999]">Achievements coming soon. Keep creating and exploring!</p>
                </div>
              </div>
            )}

            {activeTab === 'donations' && (
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-widest text-white mb-6 flex items-center">
                  <Gift className="w-6 h-6 mr-3 text-[#00FF88]" />
                  Donations
                </h2>
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-full border border-[#00FF88]/20 flex items-center justify-center mx-auto mb-4">
                    <Heart className="w-10 h-10 text-[#00FF88]" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Support Creators</h3>
                  <p className="text-[#999999] max-w-md mx-auto mb-6">
                    Your donations help fellow Demiurges create more amazing digital realms.
                  </p>
                  <button className="border border-[#FFD700]/50 bg-transparent px-8 py-3 rounded-lg text-[#FFD700] font-semibold uppercase tracking-[3px] text-sm hover:bg-[#FFD700]/10 transition-all duration-300">
                    Make a Donation
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'security' && (hasRole('admin') || hasRole('super_admin')) && (
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-widest text-white mb-6 flex items-center">
                  <Shield className="w-6 h-6 mr-3 text-[#FF4444]" />
                  Security Center
                </h2>
                <p className="text-[#999999]">Security monitoring is available in the Admin Dashboard.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </TonConnectWrapper>
  );
};

export default ProfilePage;
