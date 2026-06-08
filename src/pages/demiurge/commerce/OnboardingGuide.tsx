import { useEffect, useState, type FC } from 'react';
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';
import { fetchSellerOnboarding, type SellerOnboarding } from '../../../lib/commerceApi';

const Tick: FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <div className="flex items-center gap-1.5 text-xs">
    {ok ? <CheckCircle2 className="w-4 h-4 text-[#00FF88]" /> : <Circle className="w-4 h-4 text-white/25" />}
    <span className={ok ? 'text-white/80' : 'text-white/40'}>{label}</span>
  </div>
);

/**
 * Copilot-Lite, human face: the seller's own next step toward autonomy, computed
 * from the SAME backend brain a machine agent reads at GET /api/v1/agent/status.
 * Stays silent until the seller is registered (the endpoint 403s otherwise).
 */
const OnboardingGuide: FC<{ wallet: string }> = ({ wallet }) => {
  const [data, setData] = useState<SellerOnboarding | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    fetchSellerOnboarding(wallet)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        /* not registered / not owner yet — stay quiet */
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [wallet]);

  if (!loaded || !data) return null;

  const a = data.nextAction;
  const done = a.step === 'done';

  return (
    <div
      className={`rounded-2xl border p-4 ${
        done ? 'border-[#00FF88]/30 bg-[#00FF88]/[0.06]' : 'border-[#00F5FF]/25 bg-[#00F5FF]/[0.05]'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className={`w-4 h-4 ${done ? 'text-[#00FF88]' : 'text-[#00F5FF]'}`} aria-hidden />
        <h3 className="text-sm font-semibold text-white">{done ? 'Onboarded — ready to sell' : 'Your next step'}</h3>
      </div>

      <p className="text-sm text-white/85">{a.message}</p>
      {a.external && <p className="text-xs text-amber-200/80 mt-1">Requires you: {a.external}</p>}

      {!done && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
          <span className="rounded-md bg-white/10 px-2 py-1 font-medium text-white/80 inline-flex items-center gap-1">
            {a.ui.label} <ArrowRight className="w-3 h-3" aria-hidden />
          </span>
          <span>{a.ui.hint}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/10 pt-3">
        <Tick ok={data.kyc.ok} label={`KYC: ${data.kyc.status}`} />
        <Tick ok={data.storage.connected || data.distribution.configured} label="Distribution" />
        <Tick ok={data.catalog.hasListings} label={`Listings (${data.catalog.listings})`} />
        <Tick ok={data.distribution.verified} label="Verified delivery" />
      </div>

      <p className="mt-2 text-[10px] text-white/30">
        The same guidance an AI agent receives at <code className="font-mono">GET /api/v1/agent/status</code> — humans
        and machines, one path.
      </p>
    </div>
  );
};

export default OnboardingGuide;
