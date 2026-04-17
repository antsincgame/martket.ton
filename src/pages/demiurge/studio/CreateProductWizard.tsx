import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileArchive, ChevronLeft, AlertCircle, Loader2, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { CopyableText } from '../../../components/ui/CopyButton';
import { useToast } from '../../../components/ui/Toast';
import { storeApiUrl } from '../../../lib/storeApi';
import { formatFileSize } from '../types';
import { PRODUCT_NAME_MAX, PRODUCT_NAME_MIN } from '../../../domain/marketplace/limits';

const ACCEPTED_EXTENSIONS = '.zip,.tar.gz,.tgz,.dmg,.exe,.msi,.deb,.rpm,.apk,.aab,.ipa,.appimage';
const SCAN_POLL_INTERVAL_MS = 5_000;
const SCAN_POLL_TIMEOUT_MS = 10 * 60_000;
type Phase = 'idle' | 'creating' | 'uploading' | 'scanning' | 'done' | 'error';
type ScanStatus = 'pending' | 'scanning' | 'clean' | 'suspicious' | 'malicious' | 'error';

interface ScanStatusResponse {
  product_id: string;
  status: string;
  scan_status: ScanStatus;
  scan_provider: string | null;
  scan_report_id: string | null;
  scan_malicious_count: number;
  scan_total_engines: number;
  scan_completed_at: string | null;
  has_clean_build: boolean;
}

interface CreateProductWizardProps {
  getToken: () => Promise<string | null>;
  onBack: () => void;
}

export default function CreateProductWizard({ getToken, onBack }: CreateProductWizardProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [priceTon, setPriceTon] = useState('0');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [imageUrl, setImageUrl] = useState('');
  const [buildFile, setBuildFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<{ sha256: string; size_bytes: number; filename: string } | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [scanReport, setScanReport] = useState<ScanStatusResponse | null>(null);
  const [pollingProductId, setPollingProductId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!pollingProductId) return undefined;
    let stopped = false;
    const startedAt = Date.now();

    const tick = async () => {
      if (stopped) return;
      try {
        const token = await getToken();
        const res = await fetch(storeApiUrl(`/api/products/${pollingProductId}/scan-status`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const { data } = (await res.json()) as { data: ScanStatusResponse };
          setScanReport(data);
          setScanStatus(data.scan_status);
          if (data.scan_status === 'clean' || data.scan_status === 'malicious' || data.scan_status === 'error') {
            stopped = true;
            setPollingProductId(null);
            if (data.scan_status === 'clean') {
              setPhase('done');
              toast('success', 'Build passed virus scan');
              setTimeout(() => navigate(`/profile/studio/${pollingProductId}/edit`), 1500);
            } else if (data.scan_status === 'malicious') {
              setPhase('error');
              setErrorMsg('Build was flagged as malicious by VirusTotal — automatically rejected');
              toast('error', 'Build rejected — virus detected');
            } else {
              setPhase('error');
              setErrorMsg('Scan failed — try uploading again or contact support');
            }
            return;
          }
        }
      } catch (err) {
        if (!stopped) {
          const msg = err instanceof Error ? err.message : 'poll failed';
          // Soft fail: keep polling unless we exceed the timeout.
          if (Date.now() - startedAt > SCAN_POLL_TIMEOUT_MS) {
            stopped = true;
            setPhase('error');
            setErrorMsg(msg);
          }
        }
      }
      if (!stopped && Date.now() - startedAt > SCAN_POLL_TIMEOUT_MS) {
        stopped = true;
        setPhase('error');
        setErrorMsg('Scan timed out after 10 minutes — moderators will review manually');
      }
    };

    void tick();
    const id = setInterval(() => { void tick(); }, SCAN_POLL_INTERVAL_MS);
    return () => { stopped = true; clearInterval(id); };
  }, [pollingProductId, getToken, navigate, toast]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setBuildFile(file);
  };

  const validate = (): string | null => {
    const trimmed = name.trim();
    if (trimmed.length < PRODUCT_NAME_MIN) return `Name must be at least ${PRODUCT_NAME_MIN} characters`;
    if (trimmed.length > PRODUCT_NAME_MAX) return `Name must be at most ${PRODUCT_NAME_MAX} characters`;
    const price = parseFloat(priceTon);
    if (Number.isNaN(price) || price < 0) return 'Price must be ≥ 0';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
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
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: name.trim(),
          category: category || 'other',
          price_ton: parseFloat(priceTon) || 0,
          short_description: shortDescription.trim() || null,
          description: description.trim() || null,
          version: version.trim() || '1.0.0',
          image: imageUrl.trim() || null,
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

        if (!uploadRes.ok && uploadRes.status !== 202) {
          const body = await uploadRes.json().catch(() => ({ message: 'Upload failed' }));
          throw new Error(body.message || `Upload HTTP ${uploadRes.status}`);
        }

        const { data: uploadData } = await uploadRes.json();
        setResult({ sha256: uploadData.sha256, size_bytes: uploadData.size_bytes, filename: uploadData.filename });
        setPhase('scanning');
        setScanStatus('scanning');
        setPollingProductId(product.id);
        toast('success', 'Build queued for virus scan');
        return;
      }

      setPhase('done');
      toast('success', `"${product.name}" created`);
      setTimeout(() => navigate(`/profile/studio/${product.id}/edit`), 1200);
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
  const labelClass = 'block text-[#999] text-xs uppercase tracking-wider font-medium mb-2';

  return (
    <div className="max-w-2xl space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-[#888] hover:text-white text-sm transition-colors"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden />
        Back to Studio
      </button>

      <header>
        <h1 className="text-2xl sm:text-3xl font-display font-bold uppercase tracking-widest text-white flex items-center gap-3">
          <Upload className="w-7 h-7 text-[#8B5CF6]" aria-hidden />
          Create product
        </h1>
        <p className="text-[#666] text-sm mt-1">Создайте черновик. Опубликовать сможете после ревью.</p>
      </header>

      <div className="rounded-2xl border border-white/[0.06] bg-[#111119] p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelClass} mb-0`}>Name <span className="text-[#FF4444]">*</span></label>
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
            disabled={submitting}
            className={inputClass}
            placeholder={`Product name (${PRODUCT_NAME_MIN}-${PRODUCT_NAME_MAX} chars)…`}
          />
          <p className="text-[10px] text-[#555] mt-1">Используется в URL: /product/&lt;slug&gt;</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={submitting} className={inputClass}>
              <option value="">Select…</option>
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
            <label className={labelClass}>Version</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              disabled={submitting}
              className={inputClass}
              placeholder="1.0.0"
            />
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
            disabled={submitting}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Short description (subtitle)</label>
          <input
            type="text"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value.slice(0, 500))}
            maxLength={500}
            disabled={submitting}
            className={inputClass}
            placeholder="One sentence about your product"
          />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 5000))}
            maxLength={5000}
            disabled={submitting}
            className={`${inputClass} resize-none`}
            placeholder="Describe your creation…"
          />
        </div>

        <div>
          <label className={labelClass}>Cover image URL</label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            disabled={submitting}
            className={inputClass}
            placeholder="https://…"
          />
          <p className="text-[10px] text-[#555] mt-1">After creation you can replace it with an upload from the Edit screen.</p>
        </div>

        {/* Drag & drop */}
        <div>
          <label className={labelClass}>Build file</label>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              buildFile ? 'border-[#00FF88]/30 bg-[#00FF88]/[0.03]' : 'border-white/[0.08] hover:border-[#FFD700]/30'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            role="button"
            tabIndex={0}
            aria-label="Upload build file"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setBuildFile(f); }}
              className="hidden"
              disabled={submitting}
            />
            {buildFile ? (
              <div>
                <FileArchive className="w-10 h-10 text-[#00FF88] mx-auto mb-2" aria-hidden />
                <p className="text-white text-sm font-medium">{buildFile.name}</p>
                <p className="text-[#666] text-xs">{formatFileSize(buildFile.size)}</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setBuildFile(null); }}
                  className="mt-2 text-[#FF4444] text-xs hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <Upload className="w-10 h-10 text-[#444] mx-auto mb-3" aria-hidden />
                <p className="text-[#888] text-sm">Drag & drop your build file or click to browse</p>
                <p className="text-[#555] text-xs mt-1">.zip, .dmg, .exe, .deb, .apk, .ipa (up to 500 MB)</p>
              </div>
            )}
          </div>
        </div>

        {/* Progress */}
        {phase !== 'idle' && phase !== 'error' && (
          <div className="rounded-lg border border-white/[0.06] bg-[#0A0A0A] p-4">
            <div className="flex items-center gap-3">
              {phase === 'done' || scanStatus === 'clean' ? (
                <ShieldCheck className="w-5 h-5 text-[#00FF88] flex-shrink-0" aria-hidden />
              ) : phase === 'scanning' ? (
                <ShieldCheck className="w-5 h-5 text-[#FFD700] animate-pulse flex-shrink-0" aria-hidden />
              ) : (
                <Loader2 className="w-5 h-5 text-[#FFD700] animate-spin flex-shrink-0" aria-hidden />
              )}
              <div className="flex-1">
                <p className="text-white text-sm font-medium">
                  {phase === 'creating' && 'Creating product…'}
                  {phase === 'uploading' && 'Uploading build to quarantine…'}
                  {phase === 'scanning' && 'Scanning build with VirusTotal…'}
                  {phase === 'done' && 'Build approved — opening editor…'}
                </p>
                {phase === 'scanning' && (
                  <p className="text-[#888] text-xs mt-1">
                    Free VirusTotal tier scans take 1-3 minutes. You can close this page; we&apos;ll keep scanning.
                  </p>
                )}
                {result && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[#666]">SHA-256:</span>
                      <CopyableText text={result.sha256} />
                    </div>
                    <p className="text-[#666] text-xs">
                      Size: <span className="text-white">{formatFileSize(result.size_bytes)}</span>
                    </p>
                  </div>
                )}
                {scanReport && scanReport.scan_total_engines > 0 && (
                  <p className="text-[#666] text-xs mt-1">
                    {scanReport.scan_malicious_count}/{scanReport.scan_total_engines} engines flagged this file.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === 'error' && errorMsg && (
          <div className="rounded-lg border border-[#FF4444]/20 bg-[#FF4444]/[0.05] p-3 flex items-center gap-3">
            {scanStatus === 'malicious' ? (
              <ShieldAlert className="w-4 h-4 text-[#FF4444] flex-shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#FF4444] flex-shrink-0" aria-hidden />
            )}
            <p className="text-[#FF4444] text-sm">{errorMsg}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || name.trim().length < PRODUCT_NAME_MIN || name.trim().length > PRODUCT_NAME_MAX}
          className="w-full py-4 rounded-xl bg-[#FFD700] text-[#0A0A0A] font-bold uppercase tracking-widest text-sm transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,215,0,0.3)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ minHeight: 48 }}
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" aria-hidden /><span>Processing…</span></>
          ) : (
            <span>{buildFile ? 'Create & upload build' : 'Create product'}</span>
          )}
        </button>
      </div>
    </div>
  );
}
