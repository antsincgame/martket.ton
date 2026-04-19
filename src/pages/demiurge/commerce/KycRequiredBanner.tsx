// Surfaces the seller's KYC status. Publishing flows are blocked when status
// is anything but `approved` — surface the gate up front so the seller sees
// the reason without having to fail a publish attempt first.
import { ShieldAlert, ShieldCheck, Loader2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TonForgeDeveloperWorkspace } from '../../../domain/tonforge/types';

interface Props {
  workspace: TonForgeDeveloperWorkspace | null;
}

export default function KycRequiredBanner({ workspace }: Props) {
  if (!workspace) return null;
  const status = workspace.developer.kycStatus;

  if (status === 'approved') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2 text-xs text-emerald-200">
        <ShieldCheck className="w-4 h-4 flex-shrink-0" aria-hidden />
        <span>
          KYC approved. You can publish listings, manage prices, and issue Agent API tokens.
        </span>
      </div>
    );
  }

  if (status === 'under_review') {
    return (
      <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 flex items-center gap-2 text-xs text-cyan-100">
        <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" aria-hidden />
        <span>
          KYC is under review. Publishing and Agent API are unlocked once a moderator approves it.
        </span>
      </div>
    );
  }

  // draft / rejected / unknown — same UX: prompt the seller to (re)submit.
  const isRejected = status === 'rejected';

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-amber-100">
            {isRejected ? 'KYC was rejected' : 'KYC required to publish products'}
          </p>
          <p className="text-amber-100/80 text-xs leading-relaxed">
            Sellers must complete KYC before publishing listings or activating
            existing ones. Buyers don&apos;t need KYC — they pass an automatic
            sanctions screening only.
          </p>
          <Link
            to="/profile/commerce/publishing"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 hover:text-amber-100 underline"
          >
            <ExternalLink className="w-3 h-3" aria-hidden />
            {isRejected ? 'Re-submit KYC' : 'Submit KYC in Publishing tab'}
          </Link>
        </div>
      </div>
    </div>
  );
}
