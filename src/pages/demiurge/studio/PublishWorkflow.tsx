import { useState } from 'react';
import { Send, Pause, RotateCcw, AlertCircle, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { storeApiUrl } from '../../../lib/storeApi';
import { useToast } from '../../../components/ui/Toast';
import { useSessionInvalidator } from '../../../queries/sessionQueries';
import StudioStatusBadge, { getStatusMeta } from './StudioStatusBadge';

export type ProductStatus = 'draft' | 'pending_review' | 'published' | 'suspended' | 'rejected';
export type ScanStatus = 'pending' | 'scanning' | 'clean' | 'suspicious' | 'malicious' | 'error';

interface PublishWorkflowProps {
  productId: string;
  status: string;
  hasBuild: boolean;
  scanStatus?: ScanStatus | null;
  scanMaliciousCount?: number;
  scanTotalEngines?: number;
  getToken: () => Promise<string | null>;
  onChanged?: (newStatus: ProductStatus) => void;
}

/**
 * Workflow:
 *   draft           → Submit for review     → pending_review
 *   pending_review  → Withdraw              → draft
 *   published       → Unpublish (back to draft)
 *
 * Переходы pending_review→published/rejected — только для admin'а
 * (выполняются на бэке валидатором).
 */
export default function PublishWorkflow({
  productId,
  status,
  hasBuild,
  scanStatus,
  scanMaliciousCount,
  scanTotalEngines,
  getToken,
  onChanged,
}: PublishWorkflowProps) {
  const [busy, setBusy] = useState(false);
  const meta = getStatusMeta(status);
  const { toast } = useToast();
  const invalidator = useSessionInvalidator();
  const isScanClean = scanStatus === 'clean' || !scanStatus;
  const isScanInProgress = scanStatus === 'pending' || scanStatus === 'scanning';
  const isScanFailed = scanStatus === 'malicious' || scanStatus === 'suspicious' || scanStatus === 'error';
  const canSubmitForReview = hasBuild && isScanClean;

  const transition = async (target: ProductStatus, label: string) => {
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl(`/api/products/${productId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: target }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Action failed' }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      toast('success', label);
      invalidator.invalidateProducts();
      invalidator.invalidateStats();
      onChanged?.(target);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="publish-workflow-heading"
      className="rounded-2xl border border-white/[0.06] bg-[#111119] p-5 sm:p-6 space-y-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="publish-workflow-heading" className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/60">
            Publishing
          </h2>
          <div className="flex items-center gap-2 mt-1.5">
            <StudioStatusBadge status={status} size="md" />
          </div>
        </div>
      </header>

      <p className="text-[#888] text-sm leading-relaxed">{meta.description}</p>

      {!hasBuild && (
        <div className="rounded-lg border border-[#FFD700]/20 bg-[#FFD700]/5 p-3 flex items-center gap-2 text-xs text-[#FFD700]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden />
          Загрузите билд во вкладке «Build», чтобы отправить продукт на ревью.
        </div>
      )}

      {hasBuild && isScanInProgress && (
        <div className="rounded-lg border border-[#00F5FF]/20 bg-[#00F5FF]/5 p-3 flex items-center gap-2 text-xs text-[#00F5FF]">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 animate-pulse" aria-hidden />
          Билд в антивирусной проверке (VirusTotal). Submit будет доступен после завершения сканирования.
        </div>
      )}

      {hasBuild && isScanFailed && (
        <div className="rounded-lg border border-[#FF4444]/20 bg-[#FF4444]/5 p-3 flex items-start gap-2 text-xs text-[#FF4444]">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="font-semibold">
              {scanStatus === 'malicious' && 'Build flagged as malicious'}
              {scanStatus === 'suspicious' && 'Build flagged as suspicious'}
              {scanStatus === 'error' && 'Scan failed'}
            </p>
            {(scanTotalEngines ?? 0) > 0 && (
              <p className="opacity-80 mt-1">
                {scanMaliciousCount}/{scanTotalEngines} engines reported issues. Замените билд и загрузите заново.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {status === 'draft' && (
          <button
            type="button"
            disabled={busy || !canSubmitForReview}
            onClick={() => transition('pending_review', 'Sent to moderators')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00F5FF]/15 border border-[#00F5FF]/30 text-[#00F5FF] text-xs font-semibold uppercase tracking-wider hover:bg-[#00F5FF]/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ minHeight: 44 }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
            Submit for review
          </button>
        )}

        {status === 'pending_review' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => transition('draft', 'Withdrawn from review')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[#888] hover:text-white text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-40"
            style={{ minHeight: 44 }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <RotateCcw className="w-4 h-4" aria-hidden />}
            Withdraw
          </button>
        )}

        {status === 'published' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => transition('draft', 'Unpublished — moved to drafts')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[#888] hover:text-white text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-40"
            style={{ minHeight: 44 }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Pause className="w-4 h-4" aria-hidden />}
            Unpublish
          </button>
        )}
      </div>
    </section>
  );
}
