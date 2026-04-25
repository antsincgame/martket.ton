import { useState, useCallback, type FormEvent } from 'react';
import { ShieldCheck, Loader2, X, AlertTriangle } from 'lucide-react';
import { getJwt } from '../../lib/appwriteAuth';
import { storeApiUrl } from '../../lib/storeApi';
import { logger } from '../../lib/logger';

interface Props {
  /** Fired after successful KYC submission so the caller can retry the order. */
  onComplete: () => void;
  onClose: () => void;
}

interface FormData {
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: string;
  countryCode: string;
  city: string;
  consent: boolean;
}

const INITIAL: FormData = {
  legalFirstName: '',
  legalLastName: '',
  dateOfBirth: '',
  countryCode: '',
  city: '',
  consent: false,
};

export default function KycLiteModal({ onComplete, onClose }: Props) {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!form.consent) {
        setError('You must agree to data processing to continue.');
        return;
      }
      if (!form.legalFirstName.trim() || !form.legalLastName.trim()) {
        setError('Please enter your full legal name.');
        return;
      }
      if (!form.dateOfBirth) {
        setError('Please enter your date of birth.');
        return;
      }
      if (!form.countryCode || form.countryCode.length !== 2) {
        setError('Please enter a valid 2-letter country code (e.g. US, DE, JP).');
        return;
      }

      setSubmitting(true);
      try {
        const jwt = await getJwt();
        if (!jwt) throw new Error('Not authenticated');

        const res = await fetch(storeApiUrl('/api/session/profile/kyc-lite'), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            legalFirstName: form.legalFirstName.trim(),
            legalLastName: form.legalLastName.trim(),
            dateOfBirth: form.dateOfBirth,
            countryCode: form.countryCode.toUpperCase(),
            city: form.city.trim() || undefined,
            consent: true,
          }),
        });

        const json = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          const msg =
            typeof json.message === 'string'
              ? json.message
              : typeof json.error === 'string'
                ? json.error
                : 'Verification failed. Please try again.';
          throw new Error(msg);
        }

        onComplete();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Verification failed';
        logger.warn('[KycLiteModal] submit error:', msg);
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [form, onComplete],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-[#FFD700]/20 bg-[#0F0F0F] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#FFD700]/10">
            <ShieldCheck className="w-5 h-5 text-[#FFD700]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Identity Verification</h2>
            <p className="text-xs text-gray-400">Required for your first purchase (AML compliance)</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">Legal first name *</span>
              <input
                type="text"
                required
                maxLength={100}
                value={form.legalFirstName}
                onChange={(e) => set('legalFirstName', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#FFD700]/50 focus:outline-none"
                placeholder="John"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">Legal last name *</span>
              <input
                type="text"
                required
                maxLength={100}
                value={form.legalLastName}
                onChange={(e) => set('legalLastName', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#FFD700]/50 focus:outline-none"
                placeholder="Doe"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-gray-400 mb-1 block">Date of birth *</span>
            <input
              type="date"
              required
              value={form.dateOfBirth}
              onChange={(e) => set('dateOfBirth', e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#FFD700]/50 focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">Country code * (ISO 3166)</span>
              <input
                type="text"
                required
                maxLength={2}
                value={form.countryCode}
                onChange={(e) => set('countryCode', e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 uppercase focus:border-[#FFD700]/50 focus:outline-none"
                placeholder="US"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400 mb-1 block">City (optional)</span>
              <input
                type="text"
                maxLength={200}
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#FFD700]/50 focus:outline-none"
                placeholder="New York"
              />
            </label>
          </div>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => set('consent', e.target.checked)}
              className="mt-1 rounded border-white/20 bg-white/5 text-[#FFD700] focus:ring-[#FFD700]/50"
            />
            <span className="text-xs text-gray-400 leading-relaxed">
              I consent to the processing of my personal data for AML/KYC compliance
              purposes as required by applicable regulations.
            </span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !form.consent}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#0A0A0A] font-bold flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                Verify & Continue
              </>
            )}
          </button>

          <p className="text-[10px] text-gray-500 text-center">
            Your data is encrypted and stored securely. We never share it with third parties
            beyond what is required for regulatory compliance.
          </p>
        </form>
      </div>
    </div>
  );
}
