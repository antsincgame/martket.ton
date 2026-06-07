import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Copy,
  Cpu,
  ExternalLink,
  Gem,
  LifeBuoy,
  MessageCircle,
  Network,
  Scale,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

const TELEGRAM_URL = 'https://t.me/tonforge';

/* ─────────────────────────────────────────────
   MECHANICUS PROTOCOL — full LLM-grade extract
   Grammar: OMNISSIAH::HDSK_EXTRACTOR
   IN→book_chunks OUT→LM∞_lines
   ───────────────────────────────────────────── */
const MECHANICUS_BLOCK = `OMNISSIAH::TONFORGE_MANIFEST v2
IN→platform_concept OUT→codegen_context
D.tags|concept;stack;api;flow;constraint

## IDENTITY
W|X|TonForge≡hybrid_marketplace;∅fully_decentralized;∅fully_centralized
W|X|positioning→web2_ux+web3_rails;TON→settlement_layer_only
W|X|Human≡publisher;AIAgent≡publisher;parity→∅origin_privilege
W|X|store_domain=tonforge.org;network=TON_mainnet
W|X|legal_entity=TonForge_LLC(Delaware_USA)

## CONCEPT
W|A|marketplace⊕apps,games,AI_tools,dev_utilities
W|A|publisher_path→Studio→scan→moderate→catalog→buy→TON_settle
W|A|buyer_path→browse→wallet_connect→pay_TON→library
W|A|demiurge≡creator_identity;forge≡studio_metaphor
W|A|∅fully_onchain;smart_contracts→escrow+license_NFT_only

## STACK
A|W|frontend=React18+Vite5+Tailwind3+ReactRouter6+ReactQuery5
A|W|backend=Node+Express+TypeScript_tsx
A|W|db=Appwrite_Databases;auth=Appwrite_Account
A|W|storage=BYOS_distribution_manifest+R2_small_media
A|W|wallet=TonConnect;settlement=TON_blockchain
A|W|contracts=Tact;lang=tact_lang;stdlib=@stdlib/deploy
A|W|scan=VirusTotal_API_v3;source_stream→sha256_verify→scan

## AUTH FLOW
X|A|email_OTP→6digit_code→Appwrite_session→JWT
X|A|GitHub_OAuth→Appwrite_session→JWT
X|A|JWT→Bearer→backend_middleware→profile_resolve
X|A|TonConnect→wallet_only;∅auth_via_wallet
X|A|Human|AIAgent→same_auth_surface;∅separate_lane

## PUBLISHER WORKFLOW
A|W|draft_product→distribution_manifest(R2|GitHub)→sha256_verify
A|W|verified_source→VirusTotal_scan→scan_job_poll
A|W|scan_clean→moderation_queue→admin_approve
A|W|trusted_demiurge→auto_publish;new_demiurge→manual_review
A|W|scan_malicious→auto_reject+notify;scan_error→manual_review
A|W|Studio_sections=Overview,Studio,Library,Commerce,Wallet,Profile

## API SURFACE
A|W|GET /api/session/library→buyer_purchases
A|W|GET /api/session/products→creator_products
A|W|GET /api/session/stats→dashboard_KPI
A|W|GET /api/session/payouts→payout_aggregates
A|W|PATCH /api/session/profile→slug,bio,socials,featured
A|W|POST /api/r2/upload/image→avatar,banner,cover
A|W|PUT /api/v1/commerce/listings/:id/distribution→set_manifest
A|W|POST /api/v1/commerce/listings/:id/distribution/verify→sha256_verify
A|W|POST /api/v1/commerce/listings/:id/scan→moderator_VT_scan
A|W|GET /api/v1/commerce/listings/:id/download→license_gate_302
A|W|GET /api/tonforge/licenses/:id/verify→on_chain_owner_check
A|W|GET /api/v1/agent/me→agent_token_introspection
A|W|GET /api/v1/agent/instructions→agent_onboarding_manual;GET /api/v1/agent/status→agent_self_status
A|W|POST /api/v1/agent/products→agent_product_draft(moderation+scan)
A|W|GET|POST|PATCH /api/v1/agent/listings→agent_listing_ops
A|W|PUT|POST /api/v1/agent/listings/:id/distribution→agent_manifest_ops
A|W|GET /api/health→liveness;?detailed=1+X-Health-Token→full_status

## COMMERCE
A|W|TON_payment→tx_hash_verify→anti_replay_check→purchase_record
A|W|escrow→trial_window≈72h;platform_fee=15%(1500bps);buyer_burn_refund
A|W|commerce_api_base=VITE_COMMERCE_API_URL/api/v1/commerce
A|W|license_NFT→TEP-62+TEP-64+soulbound;see /docs/license-nft

## SECURITY
P|A|rate_limit=300req/15min_global;write=100req/15min
P|A|origin_guard→prod_only;CORS_single_origin
P|A|path_traversal_guard→storage_locators+R2_keys
P|A|header_injection_guard→safeFilename
P|A|audit_log→all_admin_actions→AppwriteDB

## CONSTRAINTS
∅magic_link;∅clerk;∅password_auth;∅anon_session
∅fully_decentralized→use_hybrid_positioning
∅mock_data_in_prod;∅seed_fallback_prod
parity_rule→Human==AIAgent→same_scan,same_moderation,same_legal

ASCII_FALLBACK::
  publisher(Human|AI) -> Studio -> distribution_manifest -> sha256_verify -> VT_scan -> moderate -> catalog
  buyer -> browse -> TonConnect -> pay_TON -> Escrow -> oracle.mint -> License_NFT
  auth: OTP|GitHub -> Appwrite_session -> JWT -> API
  NO_privilege_by_origin ; NO_magic_link ; NO_full_decentralization

READY@send_chunk`;

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
  ['#ton', 'TON'],
  ['#license-nft', 'License NFT'],
  ['#help', 'Help'],
];

export default function DocumentationPage() {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(MECHANICUS_BLOCK).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }, []);

  return (
    <div className="relative -mx-4 -my-8 min-h-[calc(100vh-10rem)] overflow-hidden text-[#c4c4d4]">
      {/* ── Background: CP2666 grid + scanline pulse ── */}
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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-pulse opacity-[0.18]"
        style={{
          background:
            'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.025) 3px,rgba(255,255,255,0.025) 4px)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          to="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-[#555] transition-colors hover:text-[#00F5FF]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Home
        </Link>

        {/* ── HERO ── */}
        <header id="manifesto" className="mb-14 scroll-mt-24">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.38em] text-[#FF2A6D]">
            tonforge.org · documentation · rev.4
          </p>
          <h1
            className="bg-gradient-to-r from-white via-[#FFD700] to-[#00F5FF] bg-clip-text font-display text-3xl font-bold uppercase tracking-[0.12em] text-transparent drop-shadow-[0_0_40px_rgba(255,215,0,0.2)] sm:text-4xl md:text-5xl"
          >
            TonForge
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.25em] text-[#FFD700]/70">
            TON Web Store
          </p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#9a9ab0] sm:text-lg">
            {H([
              { t: 'A marketplace at the edge of ' },
              { t: 'Web2 UX', c: 'cyan' },
              { t: ' and ' },
              { t: 'Web3 rails', c: 'gold' },
              { t: '. Apps, games, AI tools, developer utilities — published by ' },
              { t: 'humans', c: 'gold' },
              { t: ' and ' },
              { t: 'AI agents', c: 'violet' },
              { t: ' under the ' },
              { t: 'same rules', c: 'emerald' },
              { t: ', the same quality bar, the same respect for the craft.' },
            ])}
          </p>
          <p className="mt-3 font-mono text-xs text-[#444]">
            ∅ fully_decentralized · ∅ fully_centralized · positioning→hybrid
          </p>

          {/* highlight chips */}
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              ['Hybrid positioning', '#00F5FF'],
              ['TON settlement', '#FFD700'],
              ['Human = AI publisher', '#8B5CF6'],
              ['VirusTotal scan', '#00FF88'],
              ['Soulbound License NFT', '#FF2A6D'],
            ].map(([label, color]) => (
              <span
                key={label}
                className="rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider"
                style={{ borderColor: `${color}35`, color, backgroundColor: `${color}10` }}
              >
                {label}
              </span>
            ))}
          </div>
        </header>

        {/* ── TOC ── */}
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

        {/* ── CONCEPT ── */}
        <section
          id="concept"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#FFD700]/15 bg-gradient-to-br from-[#0f0f1e]/95 to-[#06060e] p-6 shadow-[0_0_40px_rgba(255,215,0,0.05)] sm:p-8"
        >
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Sparkles className="h-5 w-5 text-[#FFD700]" aria-hidden />
            What is TonForge
          </h2>

          <div className="space-y-4 text-sm leading-relaxed sm:text-base">
            <p>
              {H([
                { t: 'TonForge' },
                { t: ' is a ' },
                { t: 'hybrid', c: 'cyan' },
                { t: ' application store. "Hybrid" means we sit at the intersection — the ' },
                { t: 'user experience is Web2', c: 'gold' },
                { t: ' (fast browsing, email login, familiar UI), while ' },
                { t: 'payments and proof of purchase run on TON', c: 'emerald' },
                { t: ". We're not chasing full decentralization for its own sake. We use the blockchain where it adds real value: " },
                { t: 'transparent, censorship-resistant money rails and verifiable ownership', c: 'gold' },
                { t: '.' },
              ])}
            </p>

            <p>
              {H([
                { t: 'What you can find here: ' },
                { t: 'Android apps', c: 'cyan' },
                { t: ', ' },
                { t: 'games', c: 'violet' },
                { t: ', ' },
                { t: 'AI tools', c: 'magenta' },
                { t: ', ' },
                { t: 'developer utilities', c: 'emerald' },
                { t: ' — everything digital, everything paid in ' },
                { t: 'TON', c: 'gold' },
                { t: '.' },
              ])}
            </p>

            <p>
              {H([
                { t: 'The core principle: ' },
                { t: 'origin is not a privilege', c: 'magenta' },
                { t: '. A human engineer and an AI agent that generates and ships software have the same publisher status, the same moderation path, the same legal responsibilities. ' },
                { t: 'Parity is a design decision', c: 'emerald' },
                { t: ', not a slogan.' },
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
                  body: 'The creator cabinet: overview dashboard, product forge, library, commerce, wallet, public profile.',
                },
                {
                  icon: Shield,
                  color: '#00FF88',
                  title: 'Trust pipeline',
                  body: 'Every build source is verified by SHA-256, scanned through VirusTotal, then moderated. Trusted publishers can auto-publish.',
                },
              ].map(({ icon: Icon, color, title, body }) => (
                <div
                  key={title}
                  className="rounded-lg border border-white/8 bg-black/30 p-4"
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

        {/* ── BUYERS ── */}
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
                  { t: ' with email (6-digit OTP code) or GitHub. No password, no wallet required to browse.' },
                ])}
              </span>
            </li>
            <li className="flex gap-4">
              <span className="mt-0.5 font-mono text-[#00F5FF]">02</span>
              <span>
                {H([
                  { t: 'Browse', c: 'cyan' },
                  { t: ' the catalog — apps, games, AI services, dev tools. Each product page shows the publisher, price in ' },
                  { t: 'TON', c: 'gold' },
                  { t: ', downloads, scan status.' },
                ])}
              </span>
            </li>
            <li className="flex gap-4">
              <span className="mt-0.5 font-mono text-[#00F5FF]">03</span>
              <span>
                {H([
                  { t: 'Connect your TON wallet', c: 'emerald' },
                  { t: ' (TonConnect — any compatible wallet). Pay into the on-chain escrow. A ' },
                  { t: 'soulbound License NFT', c: 'magenta' },
                  { t: ' is then minted to your wallet as a verifiable proof of purchase.' },
                ])}
              </span>
            </li>
            <li className="flex gap-4">
              <span className="mt-0.5 font-mono text-[#00F5FF]">04</span>
              <span>
                {H([
                  { t: 'Library', c: 'violet' },
                  { t: ' at ' },
                ])}
                <Link to="/profile/library" className="font-mono text-[#8B5CF6] hover:underline">/profile/library</Link>
                {' — all your purchases, available for re-download any time. Unhappy with the product? Burn the NFT yourself within the trial window and the escrow returns your funds on-chain — no support ticket required.'}
              </span>
            </li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-3 text-xs">
            <Link to="/terms" className="rounded border border-white/10 px-3 py-1.5 text-[#666] transition-colors hover:text-[#FFD700]">Terms of Service</Link>
            <Link to="/privacy" className="rounded border border-white/10 px-3 py-1.5 text-[#666] transition-colors hover:text-[#FFD700]">Privacy Policy</Link>
            <Link to="/refund-policy" className="rounded border border-white/10 px-3 py-1.5 text-[#666] transition-colors hover:text-[#FFD700]">Refund &amp; DMCA</Link>
          </div>
        </section>

        {/* ── PUBLISHERS ── */}
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
              { t: " — the title is not decorative. Whether you're a solo dev, a studio, or an autonomous agent, the forge is yours. Origin doesn't change the contract." },
            ])}
          </div>

          <div className="space-y-5 text-sm leading-relaxed sm:text-base">
            {[
              {
                step: '01',
                color: '#8B5CF6',
                title: 'Studio',
                content: [
                  { t: 'Create a product draft in ' },
                  { t: '/profile/studio', c: 'violet' as const },
                  { t: '. Fill in name, category, price, screenshots, description, and connect a distribution manifest for the build.' },
                ],
              },
              {
                step: '02',
                color: '#FF2A6D',
                title: 'Security scan',
                content: [
                  { t: 'Every registered build source is verified by ' },
                  { t: 'SHA-256', c: 'magenta' as const },
                  { t: ' and submitted to ' },
                  { t: 'VirusTotal', c: 'magenta' as const },
                  { t: ' (multi-engine scan). Malicious builds are rejected. Clean builds proceed to moderation.' },
                ],
              },
              {
                step: '03',
                color: '#00FF88',
                title: 'Moderation',
                content: [
                  { t: 'Admin reviews content quality, metadata, category fit. ' },
                  { t: 'Trusted Demiurges', c: 'emerald' as const },
                  { t: ' (verified flag + trust score) skip the queue and auto-publish. First-time publishers go through manual review.' },
                ],
              },
              {
                step: '04',
                color: '#FFD700',
                title: 'Live on the storefront',
                content: [
                  { t: 'Published product appears in catalog, category pages, search. Buyers pay in ' },
                  { t: 'TON', c: 'gold' as const },
                  { t: '. Platform fee is ' },
                  { t: '15%', c: 'gold' as const },
                  { t: ' — deducted at contract level, the rest settles directly to your wallet after the trial window. You track sales, downloads, revenue in Commerce and Wallet.' },
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
              ['/profile/studio', 'Studio →'],
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

        {/* ── TON ── */}
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
                { t: ' is the payment and ownership layer — not the storage layer, not the identity layer. We chose it for: fast finality, low fees, native Telegram integration, and a growing ecosystem of users who already hold TON.' },
              ])}
            </p>
            <p>
              {H([
                { t: 'TonConnect', c: 'emerald' },
                { t: ' is the bridge between the web UI and user wallets. Compatible with Tonkeeper, MyTonWallet, Binance Wallet, and 20+ others. No custody, no key extraction — ' },
                { t: 'your keys never leave your wallet', c: 'emerald' },
                { t: '.' },
              ])}
            </p>
            <p>
              {H([
                { t: 'Each purchase deploys an ', c: 'white' },
                { t: 'Escrow', c: 'cyan' },
                { t: ' contract. Oracle mints a soulbound ' },
                { t: 'License NFT', c: 'magenta' },
                { t: ' to your wallet. On buyer confirmation or trial timeout — funds are split between seller and treasury on-chain. No manual confirmation, no trust-the-seller middleman.' },
              ])}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 font-mono text-xs text-[#444]">
            <Wallet className="h-3.5 w-3.5" aria-hidden />
            <span>wallet connects on checkout · identity stays with Appwrite</span>
          </div>
        </section>

        {/* ── LICENSE NFT CROSSLINK ── */}
        <section
          id="license-nft"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#FF2A6D]/20 bg-gradient-to-br from-[#180810]/90 to-[#06060e] p-6 sm:p-8"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <ShieldCheck className="h-5 w-5 text-[#FF2A6D]" aria-hidden />
            License NFT — soulbound proof of purchase
          </h2>
          <p className="mb-4 text-sm leading-relaxed sm:text-base">
            {H([
              { t: 'Every successful purchase mints a ' },
              { t: 'soulbound NFT', c: 'magenta' },
              { t: ' to the buyer wallet — TEP-62 collection, TEP-64 metadata, non-transferable by design (' },
              { t: 'transferLimit = 0', c: 'gold' },
              { t: '). It is a proof of purchase, an entitlement key for activation, and a refund anchor — all at once.' },
            ])}
          </p>
          <p className="mb-5 text-sm leading-relaxed text-[#9a9ab0]">
            {H([
              { t: 'Refunds are ' },
              { t: 'on-chain and buyer-initiated', c: 'emerald' },
              { t: '. Within the trial window the buyer burns the NFT — Escrow contract returns funds automatically. No arbitrator, no support ticket, no "funds stuck" scenarios.' },
            ])}
          </p>
          <Link
            to="/docs/license-nft"
            className="inline-flex items-center gap-2 rounded border border-[#FF2A6D]/40 bg-[#FF2A6D]/10 px-4 py-2 font-mono text-xs uppercase tracking-wider text-[#FF2A6D] transition-all hover:bg-[#FF2A6D]/20 hover:shadow-[0_0_18px_rgba(255,42,109,0.2)]"
          >
            Read the License NFT guide →
          </Link>
        </section>

        {/* ── HELP ── */}
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
                {' — 6-digit email code or GitHub OAuth. No password created, nothing to forget.'}
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
                {'Refunds — governed by '}
                <Link to="/refund-policy" className="text-[#8B5CF6] hover:underline">Refund &amp; DMCA policy</Link>
                {' and executed on-chain via '}
                <Link to="/docs/license-nft" className="text-[#FF2A6D] hover:underline">NFT burn</Link>.
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

        {/* ── BUILDER APPENDIX ── */}
        <section
          id="builders"
          className="hidden"
          aria-hidden="true"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Bot className="h-5 w-5 text-[#8B5CF6]" aria-hidden />
            Builder appendix
          </h2>
          <p className="text-sm leading-relaxed text-[#9a9ab0] sm:text-base">
            The customer flow ends above: browse, pay with TON, receive a License NFT, and use the trial-window refund if needed.
            The sections below are for publishers, AI agents, and engineers integrating with TonForge.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs">
            <a href="#agent-api" className="rounded border border-[#00F5FF]/25 px-3 py-1.5 text-[#00F5FF] transition-colors hover:bg-[#00F5FF]/10">
              Agent API
            </a>
            <a href="#engineers" className="rounded border border-[#8B5CF6]/25 px-3 py-1.5 text-[#8B5CF6] transition-colors hover:bg-[#8B5CF6]/10">
              Engineering notes
            </a>
            <a href="#mechanicus" className="rounded border border-[#FF2A6D]/25 px-3 py-1.5 text-[#FF2A6D] transition-colors hover:bg-[#FF2A6D]/10">
              LLM context block
            </a>
          </div>
        </section>

        {/* ── AGENT API ── */}
        <section
          id="agent-api"
          className="hidden"
          aria-hidden="true"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Bot className="h-5 w-5 text-[#00F5FF]" aria-hidden />
            Agent API
          </h2>
          <div className="space-y-4 text-sm leading-relaxed text-[#9a9ab0] sm:text-base">
            <p>
              {H([
                { t: 'AI agents use ' },
                { t: 'Personal Access Tokens', c: 'cyan' },
                { t: ' issued by a verified seller from Commerce. Tokens are scoped, wallet-bound, revocable, and separate from normal Appwrite session JWTs.' },
              ])}
            </p>
            <p>
              {H([
                { t: 'The token wallet is the authority. Agent routes never trust a seller wallet from request body or headers, so an agent cannot act for a different seller by changing payload fields.' },
              ])}
            </p>
            <div className="grid gap-2 font-mono text-xs sm:grid-cols-2">
              {[
                ['POST /api/v1/commerce/agent-tokens', 'issue token after KYC'],
                ['GET /api/v1/agent/me', 'token introspection'],
                ['GET /api/v1/agent/instructions', 'onboarding manual + checklist'],
                ['GET /api/v1/agent/status', 'onboarding + order status'],
                ['POST /api/v1/agent/products', 'create product draft'],
                ['GET /api/v1/agent/listings', 'list seller listings'],
                ['POST /api/v1/agent/listings', 'create listing'],
                ['PATCH /api/v1/agent/listings/:id', 'update listing'],
                ['PUT /api/v1/agent/listings/:id/distribution', 'set BYOS manifest'],
                ['POST /api/v1/agent/listings/:id/distribution/verify', 'verify source hash'],
                ['GET /api/v1/agent/orders', 'seller order feed'],
              ].map(([route, desc]) => (
                <div key={route} className="flex flex-col rounded bg-white/[0.03] px-3 py-2">
                  <span className="text-[#00F5FF]">{route}</span>
                  <span className="text-[#555]">{desc}</span>
                </div>
              ))}
            </div>
            <p className="font-mono text-xs text-[#555]">
              Scopes: listings:read · listings:write · distribution:write · orders:read
            </p>
          </div>
        </section>

        {/* ── ENGINEERS ── */}
        <section
          id="engineers"
          className="hidden"
          aria-hidden="true"
        >
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Shield className="h-5 w-5 text-[#8B5CF6]" aria-hidden />
            Signal to engineers
          </h2>
          <div className="space-y-4 text-sm leading-relaxed text-[#9a9ab0] sm:text-base">
            <p>
              {H([
                { t: 'Stack is intentionally boring: ', c: 'white' },
                { t: 'React 18', c: 'cyan' },
                { t: ' + ' },
                { t: 'Vite', c: 'cyan' },
                { t: ' + ' },
                { t: 'Tailwind', c: 'cyan' },
                { t: ' frontend; ' },
                { t: 'Express + TypeScript', c: 'violet' },
                { t: ' backend; ' },
                { t: 'Appwrite', c: 'violet' },
                { t: ' for auth and DB; ' },
                { t: 'BYOS distribution manifests', c: 'gold' },
                { t: ' for build delivery; Cloudflare R2 for small media; ' },
                { t: 'Tact', c: 'emerald' },
                { t: ' smart contracts (Escrow + License NFT collection/item).' },
              ])}
            </p>
            <p>
              {H([
                { t: 'Security is layered: rate limiting, origin guard, path traversal protection on storage locators, SHA-256 manifest verification, VirusTotal scan pipeline, JWT validation with cache. Not clever — ' },
                { t: 'explicit and auditable', c: 'emerald' },
                { t: '.' },
              ])}
            </p>
            <p>
              Auth: <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">Appwrite email OTP</code> and{' '}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">GitHub OAuth</code> →{' '}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#8B5CF6]">Appwrite JWT</code> →{' '}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#8B5CF6]">Bearer token</code> on every API call.
            </p>

            <div className="mt-4 grid gap-2 font-mono text-xs sm:grid-cols-2">
              {[
                ['GET /api/health', 'liveness check'],
                ['GET /api/session/stats', 'creator dashboard KPI'],
                ['PUT /api/v1/commerce/listings/:id/distribution', 'set build manifest'],
                ['POST /api/v1/commerce/listings/:id/scan', 'moderator VirusTotal scan'],
                ['GET /api/session/library', 'buyer purchases'],
                ['GET /api/tonforge/licenses/:id/verify', 'on-chain owner check'],
              ].map(([route, desc]) => (
                <div key={route} className="flex flex-col rounded bg-white/[0.03] px-3 py-2">
                  <span className="text-[#00F5FF]">{route}</span>
                  <span className="text-[#555]">{desc}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
              <Link
                to="/docs/license-nft"
                className="inline-flex items-center gap-1.5 rounded border border-[#FF2A6D]/30 px-3 py-1.5 font-mono uppercase tracking-wider text-[#FF2A6D] transition-all hover:bg-[#FF2A6D]/10"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                License NFT subsystem →
              </Link>
              <span className="text-[#555]">Tact contracts, oracle flow, threat model</span>
            </div>
          </div>
          <p className="mt-5 flex items-center gap-2 font-mono text-xs text-[#444]">
            <Zap className="h-3.5 w-3.5 text-[#FFD700]" aria-hidden />
            Full schema in docs/PROJECT.md · Vitest unit suite · Playwright E2E · sandbox contract tests
          </p>
        </section>

        {/* ── PARITY CALLOUT ── */}
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
              { t: ' go through the same ' },
              { t: 'scan → moderation → publish', c: 'cyan' },
              { t: ' pipeline. There is no "AI lane" that bypasses buyer protection. There is no "human privilege" that skips security checks. The platform enforces ' },
              { t: 'origin-blind quality gates', c: 'emerald' },
              { t: '.' },
            ])}
          </p>
        </div>

        {/* ── MECHANICUS ── */}
        <section
          id="mechanicus"
          className="hidden"
          aria-hidden="true"
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.2em] text-[#FF2A6D]">
                <BookOpen className="h-4 w-4" aria-hidden />
                LM∞ · Mechanicus Protocol
              </h2>
              <p className="mt-1 font-mono text-[10px] text-[#555]">
                OMNISSIAH::HDSK_EXTRACTOR · FULL GRAMMAR LM∞ SINGULARITY · for AI agents and LLM toolchains
              </p>
            </div>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-2 rounded border border-[#FFD700]/40 bg-transparent px-4 py-2 font-mono text-xs uppercase tracking-wider text-[#FFD700] transition-all hover:bg-[#FFD700]/10 hover:shadow-[0_0_20px_rgba(255,215,0,0.18)]"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied ? 'Copied' : 'Copy block'}
            </button>
          </div>

          <div className="mb-4 rounded-lg border border-[#FF2A6D]/15 bg-black/40 px-4 py-3 font-mono text-[10px] text-[#666]">
            <span className="text-[#FF2A6D]">OPERATORS</span>
            {' '}→ leads_to · &gt; better_than · ↑ increase · ↓ decrease · ⊕ example · ∅ avoid · ≡ equals · ⊗ conflicts · ; next_rule · / or{' '}
            <span className="text-[#555]">|</span>{' '}
            <span className="text-[#00F5FF]">DOMAINS</span>
            {' '}A=arch W=web X=ux M=mob P=perf U=ui
          </div>

          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-[1.7] text-[#b0b0c0] sm:text-xs">
            {MECHANICUS_BLOCK}
          </pre>

          <div className="mt-4 flex items-center gap-2 font-mono text-[10px] text-[#444]">
            <Users className="h-3 w-3" aria-hidden />
            pass this block as system context · LLM will understand platform constraints without extra prompting
          </div>
        </section>
      </div>
    </div>
  );
}
