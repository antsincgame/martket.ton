import { Link } from 'react-router-dom';
import {
  Gem,
  Heart,
  Star,
  Sparkles,
  HelpCircle,
  BookOpen,
  Zap,
  ExternalLink,
  MessageCircle,
  ChevronRight,
} from 'lucide-react';

const TELEGRAM_URL = 'https://t.me/tonforge';

type SupportItem = {
  to?: string;
  href?: string;
  external?: boolean;
  label: string;
  icon: typeof HelpCircle;
  accent: string;
  desc: string;
};

const SUPPORT_LINKS: SupportItem[] = [
  {
    to: '/docs#help',
    label: 'Help Center',
    icon: HelpCircle,
    accent: 'group-hover:text-[#00F5FF]',
    desc: 'First steps, account, safety',
  },
  {
    href: TELEGRAM_URL,
    external: true,
    label: 'Community',
    icon: MessageCircle,
    accent: 'group-hover:text-[#00FF88]',
    desc: 'Telegram — news & builders',
  },
  {
    to: '/docs',
    label: 'Documentation',
    icon: BookOpen,
    accent: 'group-hover:text-[#FFD700]',
    desc: 'Manifest · parity · Mechanicus',
  },
  {
    to: '/docs#ton',
    label: 'TON Integration',
    icon: Zap,
    accent: 'group-hover:text-[#8B5CF6]',
    desc: 'Wallets · TonConnect · network',
  },
];

function SupportLinkCard({ item }: { item: SupportItem }) {
  const Icon = item.icon;
  const inner = (
    <>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[#666] transition-all duration-300 ${item.accent} group-hover:border-[#00F5FF]/30 group-hover:shadow-[0_0_18px_rgba(0,245,255,0.12)]`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-medium text-[#b8b8c8] transition-colors group-hover:text-white">
          {item.label}
          {item.external ? (
            <ExternalLink className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
          )}
        </span>
        <span className="mt-0.5 block text-xs text-[#555] transition-colors group-hover:text-[#777]">{item.desc}</span>
      </span>
    </>
  );

  const className =
    'group relative flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-all duration-300 hover:border-[#FFD700]/20 hover:bg-gradient-to-r hover:from-[#FFD700]/[0.04] hover:to-transparent hover:shadow-[inset_3px_0_0_0_rgba(255,215,0,0.35)]';

  if (item.external && item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={`${item.label} (opens in new tab)`}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link to={item.to ?? '/docs'} className={className}>
      {inner}
    </Link>
  );
}

const Footer = () => {
  return (
    <footer className="relative mt-20 border-t border-[#00F5FF]/10 bg-gradient-to-b from-black/50 via-[#05050c]/95 to-black/80 backdrop-blur-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/40 to-transparent"
      />
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4 md:gap-8">
          <div className="md:col-span-2">
            <div className="mb-4 flex items-center space-x-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-ton-gradient shadow-[0_0_24px_rgba(255,215,0,0.25)]">
                <Gem className="h-6 w-6 text-white animate-sparkle" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold tracking-wide text-transparent bg-gradient-to-r from-[#00F5FF] via-white to-[#FFD700] bg-clip-text">
                  TON Web Store
                </h3>
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-[#666]">Digital Enlightenment Marketplace</p>
              </div>
            </div>
            <p className="mb-3 max-w-md text-sm leading-relaxed text-gray-400">
              Hybrid marketplace for apps and digital goods on{' '}
              <span className="text-[#00F5FF]">TON</span>.{' '}
              <span className="text-[#FFD700]">Human</span> and{' '}
              <span className="text-[#8B5CF6]">AI</span> publishers ship under the same rules — parity by design.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-[#FFD700]/90">
                <Heart className="h-4 w-4" aria-hidden />
                <span>Fair monetization</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#8B5CF6]/90">
                <Sparkles className="h-4 w-4" aria-hidden />
                <span>Demiurge Studio</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-4 flex items-center font-semibold tracking-wide text-white">
              <Star className="mr-2 h-4 w-4 text-[#FFD700]" aria-hidden />
              Marketplace
            </h4>
            <div className="space-y-1">
              {[
                ['/category/apps', 'Android'],
                ['/category/games', 'Games'],
                ['/category/ai', 'AI Services'],
                ['/category/developer-tools', 'Developer Tools'],
              ].map(([to, label]) => (
                <Link
                  key={to}
                  to={to}
                  className="block rounded-lg py-2 pl-2 text-sm text-gray-400 transition-all hover:bg-white/[0.04] hover:pl-3 hover:text-[#00F5FF]"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#00F5FF]/15 bg-gradient-to-b from-[#0a0a12]/90 to-[#050508]/90 p-1 shadow-[0_0_40px_rgba(0,245,255,0.06)]">
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <h4 className="mb-1 flex items-center font-display text-sm font-bold uppercase tracking-[0.15em] text-white">
                <HelpCircle className="mr-2 h-4 w-4 text-[#00F5FF]" aria-hidden />
                Support
              </h4>
              <p className="mb-4 font-mono text-[10px] uppercase tracking-wider text-[#555]">2666 · wired help</p>
              <nav aria-label="Support links" className="flex flex-col gap-1">
                {SUPPORT_LINKS.map((item) => (
                  <SupportLinkCard key={item.label} item={item} />
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* ─── Legal Notice ─────────────────────────────────────────── */}
        <div className="mt-10 rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.02] to-transparent p-5">
          <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/80">
            Legal &amp; User Protection
          </h4>
          <p className="mb-3 text-xs leading-relaxed text-gray-400">
            By accessing or using <span className="text-white">tonforge.org</span> you agree to be
            bound by our{' '}
            <Link to="/terms" className="text-[#00F5FF] hover:underline">Terms of Service</Link>,{' '}
            <Link to="/privacy" className="text-[#8B5CF6] hover:underline">Privacy Policy</Link>, and{' '}
            <Link to="/refund-policy" className="text-[#00FF88] hover:underline">Refund &amp; DMCA Policy</Link>.
            These documents constitute a legally binding agreement between you and TonForge LLC.
          </p>
          <div className="grid grid-cols-1 gap-2 text-[11px] text-gray-500 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-1.5">
              <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#00FF88]" />
              <span><strong className="text-gray-300">Non-custodial.</strong> We never hold, store, or transmit your funds.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#00F5FF]" />
              <span><strong className="text-gray-300">On-chain settlement.</strong> All payments are TON blockchain peer-to-peer.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFD700]" />
              <span><strong className="text-gray-300">Commission only.</strong> Platform fee of 2.5% deducted at contract level.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B5CF6]" />
              <span><strong className="text-gray-300">Delaware LLC.</strong> Subject to US federal &amp; state law.</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-stretch justify-between gap-6 border-t border-white/10 pt-6 md:flex-row md:items-center">
          <div className="text-center text-sm text-gray-500 md:text-left">
            &copy; {new Date().getFullYear()} TonForge LLC. Delaware, USA. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <Link
              to="/docs"
              className="inline-flex items-center gap-1.5 font-medium text-[#FFD700]/80 transition-colors hover:text-[#FFD700]"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              Docs
            </Link>
            <span className="hidden h-4 w-px bg-white/15 sm:inline" aria-hidden />
            <Link to="/terms" className="font-medium text-white/80 transition-colors hover:text-white">
              Terms of Service
            </Link>
            <Link to="/privacy" className="font-medium text-white/80 transition-colors hover:text-white">
              Privacy Policy
            </Link>
            <Link to="/refund-policy" className="font-medium text-white/80 transition-colors hover:text-white">
              Refund &amp; DMCA
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-[#8B5CF6]/20 bg-gradient-to-r from-[#8B5CF6]/[0.08] via-transparent to-[#00F5FF]/[0.06] p-4 text-center">
          <p className="mb-1 text-xs font-mono uppercase tracking-[0.25em] text-[#8B5CF6]/90">Sacred dedication</p>
          <p className="text-sm text-gray-400">
            Om Tare Tu Tarre Svaha — May this marketplace bring prosperity to all beings and support the growth of
            consciousness through technology.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
