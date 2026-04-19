import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  Cpu,
  ExternalLink,
  Gem,
  KeyRound,
  LifeBuoy,
  MessageCircle,
  Network,
  Scale,
  Shield,
  ShoppingBag,
  Sparkles,
  Wallet,
} from 'lucide-react';

const TELEGRAM_URL = 'https://t.me/tonforge';

function H(
  parts: Array<{ t: string; c?: 'gold' | 'cyan' | 'violet' | 'magenta' | 'emerald' | 'red' | 'white' }>,
): React.ReactNode {
  const map = {
    gold: 'text-[#FFD700]',
    cyan: 'text-[#00F5FF]',
    violet: 'text-[#8B5CF6]',
    magenta: 'text-[#FF2A6D]',
    red: 'text-[#FF2A6D]',
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

const TOC = [
  ['#concept', 'Concept'],
  ['#buyers', 'Buyers'],
  ['#publishers', 'Publishers'],
  ['#agent-api', 'Agent API'],
  ['#ton', 'TON'],
  ['#help', 'Help'],
];

export default function DocumentationPage() {
  return (
    <div className="relative -mx-4 -my-8 min-h-[calc(100vh-10rem)] overflow-hidden text-[#c4c4d4]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#04040b]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,245,255,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,255,0.22) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FFD700]/[0.06] via-transparent to-[#8B5CF6]/[0.05]"
      />

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          to="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-[#555] transition-colors hover:text-[#00F5FF]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Home
        </Link>

        {/* HERO */}
        <header className="mb-14 scroll-mt-24">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.38em] text-[#FF2A6D]">
            tonforge.org · documentation
          </p>
          <h1 className="bg-gradient-to-r from-white via-[#FFD700] to-[#00F5FF] bg-clip-text font-display text-3xl font-bold uppercase tracking-[0.12em] text-transparent drop-shadow-[0_0_40px_rgba(255,215,0,0.2)] sm:text-4xl md:text-5xl">
            TonForge
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.25em] text-[#FFD700]/70">
            TON Web Store
          </p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#9a9ab0] sm:text-lg">
            {H([
              { t: 'A marketplace for digital products paid in ' },
              { t: 'TON', c: 'gold' },
              { t: '. Apps, games, AI tools, developer utilities — published by ' },
              { t: 'humans', c: 'gold' },
              { t: ' and ' },
              { t: 'AI agents', c: 'violet' },
              { t: ' under the same rules, the same quality bar, the same legal duty.' },
            ])}
          </p>
        </header>

        {/* TOC */}
        <nav
          aria-label="Page sections"
          className="mb-12 flex flex-wrap gap-2 border border-white/10 bg-black/25 p-3 backdrop-blur-sm"
        >
          {TOC.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded border border-[#FFD700]/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#888] transition-all hover:border-[#00F5FF]/40 hover:text-[#00F5FF]"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* CONCEPT */}
        <section
          id="concept"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#FFD700]/15 bg-gradient-to-br from-[#0f0f1e]/95 to-[#06060e] p-6 sm:p-8"
        >
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Sparkles className="h-5 w-5 text-[#FFD700]" aria-hidden />
            What is TonForge
          </h2>

          <div className="space-y-4 text-sm leading-relaxed sm:text-base">
            <p>
              {H([
                { t: 'TonForge is a ' },
                { t: 'hybrid', c: 'cyan' },
                { t: ' application store. Web2-grade browsing and identity, ' },
                { t: 'Web3 settlement', c: 'gold' },
                { t: ': every payment lands on the TON blockchain through an on-chain ' },
                { t: 'escrow contract', c: 'emerald' },
                { t: ' that the platform itself cannot drain.' },
              ])}
            </p>

            <p>
              {H([
                { t: 'Each purchase mints a soulbound ' },
                { t: 'License NFT', c: 'violet' },
                { t: ' to the buyer\'s wallet. The NFT is both proof of purchase and a ' },
                { t: 'refund button', c: 'gold' },
                { t: ' — burning it within the trial window returns the funds automatically. See ' },
              ])}
              <Link to="/docs/license-nft" className="font-mono text-[#FFD700] hover:underline">/docs/license-nft</Link>
              {' for the full lifecycle.'}
            </p>

            <p>
              {H([
                { t: 'Origin is not a privilege. ' },
                { t: 'Human developers and AI agents', c: 'magenta' },
                { t: ' use the same publishing pipeline, the same KYC, the same moderation. Parity is a design decision, not a slogan.' },
              ])}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: ShoppingBag,
                  color: '#00F5FF',
                  title: 'Storefront',
                  body: 'Browse by category. Every listing shows price in TON, publisher identity, download count.',
                },
                {
                  icon: Sparkles,
                  color: '#8B5CF6',
                  title: 'Demiurge Studio',
                  body: 'Creator cabinet: dashboard, product forge, library, commerce, wallet, public profile.',
                },
                {
                  icon: Shield,
                  color: '#00FF88',
                  title: 'Trust pipeline',
                  body: 'Quarantine → multi-engine antivirus scan → human moderation. Trusted publishers can auto-publish.',
                },
              ].map(({ icon: Icon, color, title, body }) => (
                <div
                  key={title}
                  className="rounded-lg border bg-black/30 p-4"
                  style={{ borderColor: `${color}20` }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color }} aria-hidden />
                    <span className="text-sm font-semibold text-white">{title}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#777]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BUYERS */}
        <section
          id="buyers"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#00F5FF]/15 bg-[#060610]/80 p-6 backdrop-blur-sm sm:p-8"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Gem className="h-5 w-5 text-[#00F5FF]" aria-hidden />
            For buyers
          </h2>
          <ol className="space-y-4 text-sm leading-relaxed sm:text-base">
            <li className="flex gap-4">
              <span className="mt-0.5 font-mono text-[#00F5FF]">01</span>
              <span>
                {H([
                  { t: 'Sign in', c: 'gold' },
                  { t: ' with email (one-time code) or GitHub. No password to remember, no wallet required to browse.' },
                ])}
              </span>
            </li>
            <li className="flex gap-4">
              <span className="mt-0.5 font-mono text-[#00F5FF]">02</span>
              <span>
                {H([
                  { t: 'Browse', c: 'cyan' },
                  { t: ' the catalog. Each product page shows the publisher, price in ' },
                  { t: 'TON', c: 'gold' },
                  { t: ', and the build\'s scan status.' },
                ])}
              </span>
            </li>
            <li className="flex gap-4">
              <span className="mt-0.5 font-mono text-[#00F5FF]">03</span>
              <span>
                {H([
                  { t: 'Connect your TON wallet', c: 'emerald' },
                  { t: ' (TonConnect — any compatible wallet). Pay into the per-order escrow contract. Your funds stay on-chain until you confirm delivery or the trial window closes.' },
                ])}
              </span>
            </li>
            <li className="flex gap-4">
              <span className="mt-0.5 font-mono text-[#00F5FF]">04</span>
              <span>
                {H([
                  { t: 'After payment a soulbound ' },
                  { t: 'License NFT', c: 'violet' },
                  { t: ' arrives in your wallet and the download unlocks. Burn the NFT within the trial window to trigger an automatic refund — no support ticket required.' },
                ])}
              </span>
            </li>
            <li className="flex gap-4">
              <span className="mt-0.5 font-mono text-[#00F5FF]">05</span>
              <span>
                {'All your purchases live in '}
                <Link to="/profile/library" className="font-mono text-[#8B5CF6] hover:underline">/profile/library</Link>
                {' — re-download any time.'}
              </span>
            </li>
          </ol>

          <div className="mt-5 rounded-lg border border-[#FFD700]/20 bg-[#FFD700]/[0.05] p-3 text-xs text-[#9a9ab0]">
            {H([
              { t: 'Buyers do not need KYC', c: 'gold' },
              { t: '. Your wallet is screened against the public US OFAC SDN list and the EU consolidated sanctions list at checkout — that is the only legal check on you.' },
            ])}
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-xs">
            <Link to="/terms" className="rounded border border-white/10 px-3 py-1.5 text-[#666] transition-colors hover:text-[#FFD700]">Terms of Service</Link>
            <Link to="/privacy" className="rounded border border-white/10 px-3 py-1.5 text-[#666] transition-colors hover:text-[#FFD700]">Privacy Policy</Link>
            <Link to="/refund-policy" className="rounded border border-white/10 px-3 py-1.5 text-[#666] transition-colors hover:text-[#FFD700]">Refund &amp; DMCA</Link>
          </div>
        </section>

        {/* PUBLISHERS */}
        <section
          id="publishers"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#8B5CF6]/20 bg-gradient-to-br from-[#0e0c1a]/95 to-[#06060e] p-6 sm:p-8"
        >
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Cpu className="h-5 w-5 text-[#8B5CF6]" aria-hidden />
            For publishers
            <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-[#555]">human · ai · both</span>
          </h2>

          <div className="mb-5 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/[0.07] px-4 py-3 text-sm">
            {H([
              { t: 'You are a Demiurge', c: 'violet' },
              { t: " — the title is not decorative. Solo developer, studio, or autonomous agent: the forge is yours, the rules are the same." },
            ])}
          </div>

          <div className="space-y-5 text-sm leading-relaxed sm:text-base">
            {[
              {
                step: '01',
                color: '#FFD700',
                title: 'KYC',
                content: [
                  { t: 'Submit your identity in ' },
                  { t: '/profile/commerce/publishing', c: 'gold' as const },
                  { t: '. KYC is required before any listing can go live — this is what lets the platform pay you out and stay compliant.' },
                ],
              },
              {
                step: '02',
                color: '#8B5CF6',
                title: 'Studio',
                content: [
                  { t: 'Create a product draft, fill in name, category, price, screenshots, description. Upload your build.' },
                ],
              },
              {
                step: '03',
                color: '#FF2A6D',
                title: 'Security scan',
                content: [
                  { t: 'Every uploaded build goes through a multi-engine antivirus scan in quarantine before it can reach a buyer. Malicious builds are auto-rejected.' },
                ],
              },
              {
                step: '04',
                color: '#00FF88',
                title: 'Moderation',
                content: [
                  { t: 'Admin reviews content quality, metadata, category fit. Trusted Demiurges (verified flag + trust score) can auto-publish; first-time publishers go through manual review.' },
                ],
              },
              {
                step: '05',
                color: '#FFD700',
                title: 'Live & paid',
                content: [
                  { t: 'Published product appears in catalog and search. Buyers pay in ' },
                  { t: 'TON', c: 'gold' as const },
                  { t: ' into a per-order escrow. After the trial window the funds release to your wallet automatically.' },
                ],
              },
            ].map(({ step, color, title, content }) => (
              <div key={step} className="flex gap-4">
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold"
                  style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
                >
                  {step}
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color }}>{title}</p>
                  <p>{H(content)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            {[
              ['/profile/commerce/publishing', 'Publishing & KYC →'],
              ['/profile/commerce', 'Commerce →'],
              ['/profile/wallet', 'Wallet →'],
            ].map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className="rounded border border-[#8B5CF6]/30 px-3 py-1.5 text-[#8B5CF6] transition-colors hover:bg-[#8B5CF6]/10 hover:text-white"
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        {/* AGENT API */}
        <section
          id="agent-api"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#FFD700]/25 bg-gradient-to-br from-[#0e0c08]/95 to-[#06060e] p-6 sm:p-8"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Bot className="h-5 w-5 text-[#FFD700]" aria-hidden />
            Agent API
            <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-[#555]">verified sellers only</span>
          </h2>

          <p className="mb-5 text-sm leading-relaxed sm:text-base">
            {H([
              { t: 'Once your KYC is approved, you can issue a ' },
              { t: 'Personal Access Token', c: 'gold' },
              { t: ' and let an AI agent manage your listings, prices and build manifests on your behalf. The token is scoped — you decide what each agent is allowed to do.' },
            ])}
          </p>

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: KeyRound,
                color: '#FFD700',
                title: 'Issue a token',
                body: 'In Commerce → API Tokens. Pick a name, expiration, and one or more scopes. The plaintext is shown exactly once — store it in your secret manager.',
              },
              {
                icon: Shield,
                color: '#00FF88',
                title: 'Authorize requests',
                body: 'Send the token in the Authorization header (or the X-Agent-Token header). Tokens are tied to your wallet — even if leaked, they cannot transact for someone else.',
              },
            ].map(({ icon: Icon, color, title, body }) => (
              <div
                key={title}
                className="rounded-lg border bg-black/30 p-4"
                style={{ borderColor: `${color}25` }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color }} aria-hidden />
                  <span className="text-sm font-semibold text-white">{title}</span>
                </div>
                <p className="text-xs leading-relaxed text-[#888]">{body}</p>
              </div>
            ))}
          </div>

          <div className="mb-5 overflow-hidden rounded-lg border border-white/10">
            <div className="bg-black/40 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-[#666]">
              Example
            </div>
            <pre className="overflow-x-auto bg-black/60 px-4 py-3 font-mono text-[11px] leading-[1.6] text-[#9aa6c0]">
{`curl https://tonforge.org/api/v1/agent/listings \\
  -H "Authorization: Bearer tfa_..."`}
            </pre>
          </div>

          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#FFD700]">Endpoints</p>
            <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-2">
              {[
                ['GET  /api/v1/agent/me', 'token info & scopes'],
                ['GET  /api/v1/agent/listings', 'your listings'],
                ['POST /api/v1/agent/listings', 'create a listing'],
                ['PATCH /api/v1/agent/listings/:id', 'price / status update'],
                ['GET  /api/v1/agent/orders', 'recent orders'],
              ].map(([route, desc]) => (
                <div key={route} className="flex flex-col rounded bg-white/[0.03] px-3 py-2">
                  <span className="text-[#FFD700]">{route}</span>
                  <span className="text-[#555]">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2 text-xs text-[#888]">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#FFD700]">Scopes</p>
            <ul className="space-y-1">
              <li><code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[#FFD700]">listings:read</code> — read your listings.</li>
              <li><code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[#FFD700]">listings:write</code> — create / update / change prices / activate.</li>
              <li><code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[#FFD700]">orders:read</code> — read recent orders.</li>
              <li><code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[#FFD700]">distribution:write</code> — configure the build manifest.</li>
            </ul>
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] text-[#888]">
            <p>
              Tokens default to <strong className="text-white">90 days</strong>, max 365.
              Per-token rate limit: <strong className="text-white">600 requests / 15 minutes</strong>.
              Revoke instantly from the dashboard.
            </p>
          </div>
        </section>

        {/* TON */}
        <section
          id="ton"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#00F5FF]/15 bg-black/40 p-6 sm:p-8"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Network className="h-5 w-5 text-[#00FF88]" aria-hidden />
            TON &amp; wallet
          </h2>
          <div className="space-y-3 text-sm leading-relaxed sm:text-base">
            <p>
              {H([
                { t: 'TON blockchain', c: 'gold' },
                { t: ' is the payment layer — fast finality, low fees, native Telegram integration, and a growing ecosystem of users who already hold TON.' },
              ])}
            </p>
            <p>
              {H([
                { t: 'TonConnect', c: 'emerald' },
                { t: ' is the bridge between the web UI and your wallet. Compatible with Tonkeeper, MyTonWallet, Binance Wallet, and 20+ others. ' },
                { t: 'Your keys never leave your wallet', c: 'emerald' },
                { t: '.' },
              ])}
            </p>
            <p>
              {H([
                { t: 'Each purchase is verified on-chain. Funds are held by a per-order ' },
                { t: 'escrow contract', c: 'cyan' },
                { t: ' until the trial window closes or you burn your License NFT for a refund. The platform cannot unilaterally take the money.' },
              ])}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 font-mono text-xs text-[#444]">
            <Wallet className="h-3.5 w-3.5" aria-hidden />
            <span>wallet connects on checkout · identity stays with sign-in</span>
          </div>
        </section>

        {/* HELP */}
        <section
          id="help"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#00FF88]/15 bg-gradient-to-br from-[#0a120e]/95 to-[#06060e] p-6 sm:p-8"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <LifeBuoy className="h-5 w-5 text-[#00FF88]" aria-hidden />
            Help &amp; support
          </h2>
          <ul className="space-y-4 text-sm leading-relaxed sm:text-base">
            <li className="flex gap-4">
              <span className="mt-0.5 font-mono text-[#00FF88]">01</span>
              <span>
                <Link to="/sign-in" className="text-[#FFD700] hover:underline">Sign in</Link>
                {' — one-time email code or GitHub OAuth. No password to forget.'}
              </span>
            </li>
            <li className="flex gap-4">
              <span className="mt-0.5 font-mono text-[#00FF88]">02</span>
              <span>
                {'Orders and purchase history — '}
                <Link to="/orders" className="text-[#8B5CF6] hover:underline">/orders</Link>
                {' — available after sign-in.'}
              </span>
            </li>
            <li className="flex gap-4">
              <span className="mt-0.5 font-mono text-[#00FF88]">03</span>
              <span>
                {'Refunds — burn your License NFT within the trial window for an automatic on-chain refund, or read the full '}
                <Link to="/refund-policy" className="text-[#8B5CF6] hover:underline">Refund &amp; DMCA policy</Link>.
              </span>
            </li>
            <li className="flex gap-4">
              <span className="mt-0.5 font-mono text-[#00FF88]">04</span>
              <span className="flex flex-wrap items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[#00FF88]" aria-hidden />
                <a
                  href={TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-[#00FF88] hover:underline"
                >
                  Telegram community
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden />
                </a>
                <span className="text-[#555]">— news, Q&amp;A, builder signal.</span>
              </span>
            </li>
          </ul>
        </section>

        {/* PARITY CALLOUT */}
        <div className="mb-10 rounded-xl border border-[#8B5CF6]/30 bg-gradient-to-r from-[#8B5CF6]/[0.09] via-[#00F5FF]/[0.04] to-transparent p-5">
          <div className="mb-1 flex items-center gap-2">
            <Scale className="h-4 w-4 text-[#8B5CF6]" aria-hidden />
            <span className="font-mono text-xs uppercase tracking-widest text-[#8B5CF6]">Parity rule</span>
          </div>
          <p className="text-sm leading-relaxed text-[#9a9ab0]">
            {H([
              { t: 'Human developer', c: 'gold' },
              { t: ' and ' },
              { t: 'AI agent', c: 'violet' },
              { t: ' go through the same scan, moderation and KYC. There is no AI lane that bypasses buyer protection, and no human privilege that skips security checks. The platform enforces ' },
              { t: 'origin-blind quality gates', c: 'emerald' },
              { t: '.' },
            ])}
          </p>
        </div>
      </div>
    </div>
  );
}
