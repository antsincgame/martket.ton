// Single-use button that issues a presigned download URL via the
// authenticated commerceAuthFetch path and opens it in a new tab.
//
// Why this exists: the backend `/listings/:id/download` endpoint requires
// a JWT in `Authorization` header. Using a plain `<a href>` would 401
// because browsers don't attach the token. Frontend must hit the JSON
// branch (`Accept: application/json`) which returns the presigned URL.
import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { issueDownloadUrl } from '../../lib/commerceApi';

interface Props {
  listingId: string;
  variant?: 'emerald' | 'cyan';
  label?: string;
}

const VARIANTS = {
  emerald: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20',
  cyan: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20',
} as const;

export default function DownloadAction({ listingId, variant = 'emerald', label = 'Download' }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await issueDownloadUrl(listingId);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue download URL');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${VARIANTS[variant]}`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {label}
      </button>
      {error && <p className="text-[10px] text-rose-300">{error}</p>}
    </div>
  );
}
