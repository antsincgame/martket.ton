import { memo, useRef, useState } from 'react';
import { Upload, Loader2, X, ImageIcon } from 'lucide-react';
import { storeApiUrl } from '../../lib/storeApi';
import { useToast } from '../ui/Toast';

export type ImageKind = 'avatar' | 'banner' | 'cover';

interface ImageUploaderProps {
  /** Current image URL — used for the preview. */
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  kind: ImageKind;
  getToken: () => Promise<string | null>;
  /** Tailwind aspect-* class for the preview tile. */
  aspectClass?: string;
  label?: string;
  hint?: string;
  /** Allow clearing the current image. */
  allowClear?: boolean;
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Reusable image uploader for avatar / banner / cover. Streams the file
 * to POST /api/r2/upload/image and assigns the returned URL via onChange.
 */
const ImageUploader = memo(function ImageUploader({
  value,
  onChange,
  kind,
  getToken,
  aspectClass = 'aspect-square',
  label,
  hint,
  allowClear = true,
}: ImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast('error', `Image is larger than ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB`);
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append('image', file);
      fd.append('kind', kind);
      const res = await fetch(storeApiUrl('/api/r2/upload/image'), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const { data } = await res.json();
      onChange(data.url);
      toast('success', 'Image uploaded');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-[#999] text-xs uppercase tracking-wider font-medium">{label}</p>}
      <div className="flex items-start gap-3 flex-wrap">
        <div
          className={`${aspectClass} w-32 rounded-xl overflow-hidden border border-white/10 bg-[#0D0D1A] flex items-center justify-center text-[#444]`}
        >
          {value ? (
            <img src={value} alt={label ? `${label} preview` : 'Image preview'} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6" aria-hidden />
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] text-xs font-semibold hover:bg-[#FFD700]/25 transition-all disabled:opacity-40"
            style={{ minHeight: 44 }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Upload className="w-3.5 h-3.5" aria-hidden />}
            {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          </button>
          {allowClear && value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#999] hover:text-white text-xs transition-colors disabled:opacity-40"
            >
              <X className="w-3 h-3" aria-hidden />
              Remove
            </button>
          )}
          {hint && <p className="text-[10px] text-[#666] max-w-[200px]">{hint}</p>}
        </div>
      </div>
    </div>
  );
});

export default ImageUploader;
