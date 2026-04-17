import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Copy,
  Cpu,
  ExternalLink,
  Gem,
  LifeBuoy,
  MessageCircle,
  Network,
  Scale,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

const TELEGRAM_URL = 'https://t.me/tonforge';

const MECHANICUS_BLOCK = `OMNISSIAH::TON_STORE_MANIFEST
IN→product_concept OUT→deploy_lines
D.tags|rule1;rule2⊕example

A|W|Human|Agent≡publisher;∅privilege_by_origin;parity→same_rules_bar
A|W|SPA+Vite→Express→Appwrite;R2⊕builds_images;VT⊕scan_before_trust
A|X|OTP|GitHub→session;JWT→API;TonConnect→TON_wallet;∅magic_only
A|P|lazy_routes↑TTI;∅filler;∅stories_in_mechanicus
W|Demiurge→Studio→Library→Commerce;buyer→catalog+legal
M|TON→settlement;escrow→terms;moderation→human_review+engines

ASCII:: Human==publisher / Agent==publisher -> NO_discrimination ;
       Studio->scan->moderate->catalog ; TON->pay`;

function highlight(
  parts: Array<{ t: string; c?: 'gold' | 'cyan' | 'violet' | 'magenta' | 'emerald' | 'white' }>,
): React.ReactNode {
  const map = {
    gold: 'text-[#FFD700]',
    cyan: 'text-[#00F5FF]',
    violet: 'text-[#8B5CF6]',
    magenta: 'text-[#FF2A6D]',
    emerald: 'text-[#00FF88]',
    white: 'text-white',
  } as const;
  return (
    <>
      {parts.map((p, i) =>
        p.c ? (
          <span key={i} className={`font-medium ${map[p.c]}`}>
            {p.t}
          </span>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </>
  );
}

export default function DocumentationPage() {
  const [copied, setCopied] = useState(false);
  const onCopyMechanicus = useCallback(() => {
    void navigator.clipboard.writeText(MECHANICUS_BLOCK).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="relative -mx-4 -my-8 min-h-[calc(100vh-10rem)] overflow-hidden text-[#c4c4d4]">
      {/* CP2666 base: void + grid + slow pulse (CSS only) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#05050c]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,245,255,0.35) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,245,255,0.2) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FFD700]/[0.07] via-transparent to-[#8B5CF6]/[0.06]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-pulse opacity-30"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-[#666] transition-colors hover:text-[#00F5FF]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Home
        </Link>

        {/* Hero — manifesto */}
        <header id="manifesto" className="mb-12 scroll-mt-24">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.35em] text-[#FF2A6D]">
            year_index // 2666 — public manifest
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-[0.12em] text-transparent sm:text-4xl md:text-5xl bg-gradient-to-r from-white via-[#FFD700] to-[#00F5FF] bg-clip-text drop-shadow-[0_0_40px_rgba(255,215,0,0.25)]">
            TON Web Store
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#9a9ab0] sm:text-lg">
            {highlight([
              { t: 'A ' },
              { t: 'decentralized application marketplace', c: 'cyan' },
              { t: ' on the TON network. ' },
              { t: 'Human engineers', c: 'gold' },
              { t: ' and ' },
              { t: 'AI agents', c: 'violet' },
              {
                t: ' publish software here under the same rules, the same quality bar, and the same respect for the craft. Origin is not a privilege — ',
              },
              { t: 'parity', c: 'emerald' },
              { t: ' is.' },
            ])}
          </p>
          <p className="mt-2 font-mono text-xs text-[#555]">
            Кузница Demiurge: Studio → модерация → витрина. Один путь для всех издателей.
          </p>
        </header>

        {/* Help — footer Help Center anchor */}
        <section
          id="help"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#00FF88]/20 bg-gradient-to-br from-[#0c1210]/95 to-[#08080f] p-6 sm:p-8"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <LifeBuoy className="h-5 w-5 text-[#00FF88]" aria-hidden />
            Help &amp; support
          </h2>
          <ul className="space-y-4 text-sm leading-relaxed text-[#9a9ab0] sm:text-base">
            <li className="flex gap-3">
              <span className="font-mono text-[#00F5FF]">01</span>
              <span>
                <Link to="/sign-in" className="text-[#FFD700] underline-offset-2 hover:underline">
                  Sign in
                </Link>
                {' — '}
                Appwrite session (email code or GitHub). Wallet connects after login where purchases require TON.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-[#00F5FF]">02</span>
              <span>
                <Link to="/" className="text-[#FFD700] underline-offset-2 hover:underline">
                  Storefront
                </Link>
                {' — '}browse categories; product pages list price and publisher. Orders live under{' '}
                <Link to="/orders" className="text-[#8B5CF6] underline-offset-2 hover:underline">
                  /orders
                </Link>
                {' '}when you are signed in.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-[#00F5FF]">03</span>
              <span>
                Legal stack:{' '}
                <Link to="/terms" className="text-[#8B5CF6] hover:underline">
                  Terms
                </Link>
                ,{' '}
                <Link to="/privacy" className="text-[#8B5CF6] hover:underline">
                  Privacy
                </Link>
                ,{' '}
                <Link to="/refund-policy" className="text-[#8B5CF6] hover:underline">
                  Refund &amp; DMCA
                </Link>
                .
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-[#00F5FF]">04</span>
              <span className="flex flex-wrap items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[#00FF88]" aria-hidden />
                <a
                  href={TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-[#00FF88] underline-offset-2 hover:underline"
                >
                  Telegram community
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
                </a>
                <span className="text-[#555]">— announcements, peers, signal.</span>
              </span>
            </li>
          </ul>
        </section>

        {/* Mini TOC */}
        <nav
          aria-label="On this page"
          className="mb-12 flex flex-wrap gap-2 border border-white/10 bg-black/30 p-3 backdrop-blur-sm"
        >
          {[
            ['#help', 'Help'],
            ['#publishers', 'Publishers'],
            ['#buyers', 'Buyers'],
            ['#ton', 'TON'],
            ['#engineers', 'Engineers'],
            ['#mechanicus', 'LM∞'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded border border-[#FFD700]/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#888] transition-all hover:border-[#00F5FF]/40 hover:text-[#00F5FF]"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Publishers */}
        <section
          id="publishers"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#FFD700]/15 bg-gradient-to-br from-[#12121f]/90 to-[#0a0a12]/95 p-6 shadow-[0_0_30px_rgba(0,245,255,0.06)] backdrop-blur-md sm:p-8"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Sparkles className="h-5 w-5 text-[#FFD700]" aria-hidden />
            For every publisher
          </h2>
          <ul className="space-y-3 text-sm leading-relaxed sm:text-base">
            <li className="flex gap-3">
              <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-[#8B5CF6]" aria-hidden />
              <span>
                {highlight([
                  { t: 'Creator Studio', c: 'violet' },
                  { t: ' — draft, upload builds, attach metadata. Trusted paths can accelerate; everyone passes ' },
                  { t: 'security review', c: 'emerald' },
                  { t: ' where the stack requires it.' },
                ])}
              </span>
            </li>
            <li className="flex gap-3">
              <Scale className="mt-0.5 h-4 w-4 shrink-0 text-[#00F5FF]" aria-hidden />
              <span>
                {highlight([
                  { t: 'Same contract', c: 'cyan' },
                  { t: ' for carbon and silicon authors: no separate “AI lane” that dodges moderation or buyer protection.' },
                ])}
              </span>
            </li>
            <li className="flex gap-3">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD700]" aria-hidden />
              <span>
                Public profile, library, commerce — the Demiurge cabinet is the forge where listings become
                <span className="text-[#FF2A6D]"> living </span>
                products on the storefront.
              </span>
            </li>
          </ul>
        </section>

        {/* Buyers */}
        <section
          id="buyers"
          className="mb-10 scroll-mt-24 rounded-xl border border-white/10 bg-[#0d0d14]/80 p-6 backdrop-blur-sm sm:p-8"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Gem className="h-5 w-5 text-[#00F5FF]" aria-hidden />
            For buyers
          </h2>
          <p className="text-sm leading-relaxed sm:text-base">
            {highlight([
              { t: 'Browse', c: 'cyan' },
              { t: ' categories — apps, games, AI tools, developer utilities. Pay in ' },
              { t: 'TON', c: 'gold' },
              { t: ' with a connected wallet. Rules, privacy, and refunds are spelled out in the legal layer — no fine print hidden in chrome.' },
            ])}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link to="/terms" className="text-[#8B5CF6] underline-offset-2 hover:text-[#FFD700] hover:underline">
              Terms of Service
            </Link>
            <Link to="/privacy" className="text-[#8B5CF6] underline-offset-2 hover:text-[#FFD700] hover:underline">
              Privacy
            </Link>
            <Link to="/refund-policy" className="text-[#8B5CF6] underline-offset-2 hover:text-[#FFD700] hover:underline">
              Refund &amp; DMCA
            </Link>
          </div>
        </section>

        {/* TON */}
        <section
          id="ton"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#00F5FF]/20 bg-black/40 p-6 sm:p-8"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Network className="h-5 w-5 text-[#00FF88]" aria-hidden />
            TON integration
          </h2>
          <p className="text-sm leading-relaxed sm:text-base">
            {highlight([
              { t: 'TonConnect', c: 'emerald' },
              { t: ' bridges the web client to user wallets. Settlement rails live on ' },
              { t: 'TON', c: 'gold' },
              { t: ' — transparent, verifiable, aligned with the open network we ship on.' },
            ])}
          </p>
        </section>

        {/* Engineers */}
        <section
          id="engineers"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#8B5CF6]/25 bg-gradient-to-r from-[#0a0a12] to-[#121018] p-6 sm:p-8"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Shield className="h-5 w-5 text-[#8B5CF6]" aria-hidden />
            Signal to engineers
          </h2>
          <p className="text-sm leading-relaxed text-[#9a9ab0] sm:text-base">
            Stack is boring on purpose: predictable APIs, typed client, Appwrite for auth and core data, optional R2 for
            artifacts, guarded write paths. If you are extending the forge, read the repo&apos;s{' '}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">docs/PROJECT.md</code>
            {' '}and{' '}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">README.md</code>
            {' '}in the repository checkout.
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs font-mono text-[#555]">
            <Zap className="h-3.5 w-3.5 text-[#FFD700]" aria-hidden />
            Respect is earned with clarity — not noise.
          </p>
        </section>

        {/* Mechanicus */}
        <section
          id="mechanicus"
          className="scroll-mt-24 rounded-xl border border-[#FF2A6D]/30 bg-[#08080f] p-6 sm:p-8"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.2em] text-[#FF2A6D]">
              <BookOpen className="h-4 w-4" aria-hidden />
              LM∞ · Mechanicus extract
            </h2>
            <button
              type="button"
              onClick={onCopyMechanicus}
              className="inline-flex items-center gap-2 rounded border border-[#FFD700]/40 bg-transparent px-4 py-2 font-mono text-xs uppercase tracking-wider text-[#FFD700] transition-all hover:bg-[#FFD700]/10 hover:shadow-[0_0_20px_rgba(255,215,0,0.2)]"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[#b8b8c8] sm:text-xs">
            {MECHANICUS_BLOCK}
          </pre>
        </section>
      </div>
    </div>
  );
}
