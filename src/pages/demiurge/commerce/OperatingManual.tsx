import { useEffect, useState, type FC } from 'react';
import { Loader2, BookOpen } from 'lucide-react';
import { fetchOperatingManual, type ManualSection } from '../../../lib/commerceApi';

/**
 * The platform operating manual — the SAME honest service description,
 * prerequisites, KYC policy, and behaviour/honesty boundary a machine agent reads
 * at GET /api/v1/agent/instructions. Human↔machine parity (singularity-debt C1):
 * one manual, both faces.
 */
const OperatingManual: FC = () => {
  const [sections, setSections] = useState<ManualSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchOperatingManual()
      .then((s) => {
        if (alive) setSections(s);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load the manual');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/60 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Loading manual…
      </div>
    );
  }
  if (error) return <div className="text-sm text-red-300">{error}</div>;

  return (
    <div className="space-y-4 text-white">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-[#00F5FF]" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">Operating manual</h2>
          <p className="text-xs text-gray-400">
            The same guide a machine agent reads at{' '}
            <code className="font-mono">GET /api/v1/agent/instructions</code> — humans and machines,
            one manual.
          </p>
        </div>
      </div>
      {sections.map((s) => (
        <section key={s.section} className="rounded-xl border border-white/10 bg-black/20 p-4">
          <h3 className="font-semibold text-sm mb-2 text-[#FFD700]">{s.title}</h3>
          <pre className="whitespace-pre-wrap font-sans text-sm text-white/80 leading-relaxed">
            {s.body}
          </pre>
        </section>
      ))}
    </div>
  );
};

export default OperatingManual;
