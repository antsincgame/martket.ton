// ArtifactScanCard — extracted from SellerCommercePage. Runs artifact through
// /api/tonforge/artifacts/scan, stores the last successful scan in the shared
// CommerceSection state so PublishAppCard can use it.
import { FileSearch } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TonForgeArtifactScan } from '../../../domain/tonforge/types';
import { runArtifactScan } from '../../../services/tonforgeApi';

const scanSchema = z.object({
  fileName: z.string().min(3, 'Minimum 3 characters'),
  artifactUrl: z.string().url('Full URL required'),
  sha256: z.string().length(64, 'SHA-256 must be exactly 64 characters'),
});

type ScanFormValues = z.infer<typeof scanSchema>;

interface ArtifactScanCardProps {
  lastScan: TonForgeArtifactScan | null;
  setLastScan: (next: TonForgeArtifactScan | null) => void;
  setFlash: (next: { error: string | null; success: string | null }) => void;
}

export default function ArtifactScanCard({ lastScan, setLastScan, setFlash }: ArtifactScanCardProps) {
  const form = useForm<ScanFormValues>({
    resolver: zodResolver(scanSchema),
    defaultValues: {
      fileName: '',
      artifactUrl: '',
      sha256: '',
    },
  });

  const onSubmit = async (values: ScanFormValues) => {
    setFlash({ error: null, success: null });
    try {
      const scan = await runArtifactScan(values);
      setLastScan(scan);
      setFlash({ success: 'Artifact verified. You can now publish the app.', error: null });
    } catch (e) {
      setFlash({ error: e instanceof Error ? e.message : 'Artifact scan failed', success: null });
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-black/30 p-5">
      <header className="mb-4 flex items-center gap-2">
        <FileSearch className="w-5 h-5 text-[#00F5FF]" aria-hidden />
        <h2 className="text-base font-semibold text-white">Artifact Scan</h2>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <Field label="File name" error={form.formState.errors.fileName?.message}>
          <input {...form.register('fileName')} className={inputClass} placeholder="app-v1.0.0.zip" />
        </Field>
        <Field label="Artifact URL" error={form.formState.errors.artifactUrl?.message}>
          <input
            {...form.register('artifactUrl')}
            className={inputClass}
            placeholder="https://downloads.example.com/app.zip"
          />
        </Field>
        <Field label="SHA-256" error={form.formState.errors.sha256?.message}>
          <input
            {...form.register('sha256')}
            className={`${inputClass} font-mono`}
            placeholder="64-character hash"
            maxLength={64}
          />
        </Field>
        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="rounded-lg bg-[#00F5FF]/20 border border-[#00F5FF]/40 text-[#00F5FF] font-semibold uppercase tracking-wider px-4 py-2 text-sm hover:bg-[#00F5FF]/30 disabled:opacity-50"
        >
          {form.formState.isSubmitting ? 'Scanning…' : 'Verify artifact'}
        </button>
      </form>

      {lastScan && (
        <div className="mt-4 rounded-xl border border-[#00FF88]/30 bg-[#00FF88]/5 p-3 text-xs text-[#aaffcc] space-y-1">
          <p>
            <span className="text-[#888]">Status:</span>{' '}
            <span className="text-white font-semibold">{lastScan.status}</span>
          </p>
          <p className="font-mono break-all">
            <span className="text-[#888]">Fingerprint:</span> {lastScan.integrityFingerprint}
          </p>
          {lastScan.findings.length > 0 && (
            <p>
              <span className="text-[#888]">Findings:</span> {lastScan.findings.join(', ')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

const inputClass =
  'w-full rounded-lg border border-white/[0.1] bg-black/40 px-3 py-2 text-sm text-white placeholder-[#555] focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30';

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-[#666] mb-1">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-300 mt-1">{error}</span>}
    </label>
  );
}
