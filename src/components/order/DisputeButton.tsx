import { useState, useCallback } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { openCommerceDispute } from '../../lib/commerceApi';

interface Props {
  orderId: string;
  disabled?: boolean;
  onDisputeOpened?: () => void;
}

export default function DisputeButton({ orderId, disabled, onDisputeOpened }: Props) {
  const wallet = useTonAddress();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!wallet || !reason.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await openCommerceDispute(orderId, wallet, reason.trim());
      setIsOpen(false);
      setReason('');
      onDisputeOpened?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open dispute');
    } finally {
      setSubmitting(false);
    }
  }, [orderId, wallet, reason, onDisputeOpened]);

  if (!isOpen) {
    return (
      <button
        type="button"
        disabled={disabled || !wallet}
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
      >
        <AlertTriangle className="w-4 h-4" />
        Open Dispute
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-3">
      <h4 className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4" />
        Open Dispute
      </h4>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Describe the issue…"
        maxLength={2000}
        rows={3}
        className="w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500/40"
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !reason.trim()}
          className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-1.5 text-sm font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-40 transition-colors flex items-center gap-1.5"
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Submit
        </button>
        <button
          type="button"
          onClick={() => { setIsOpen(false); setError(null); }}
          className="rounded-lg border border-white/10 px-4 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
