import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Globe, Github, Send, Twitter, Share2, Check, Star,
  Download, Package, Calendar, ChevronLeft, ChevronRight,
  ShieldCheck, ExternalLink,
} from 'lucide-react';
import { resolvePublicDeveloperProfile } from '../domain/marketplace/marketplaceRemote';
import { formatDownloads, formatDate } from '../domain/marketplace/platformIcons';
import ProductCard from '../components/ProductCard';
import SteamProductRow from '../components/SteamProductRow';
import LoadingScreen from '../components/LoadingScreen';
import type { PublicDeveloperProfile, CatalogListingProduct } from '../domain/marketplace/types';

const PAGE_SIZE = 20;

function useSeoMeta(profile: PublicDeveloperProfile | null) {
  useEffect(() => {
    if (!profile) return;
    const prevTitle = document.title;
    document.title = `${profile.displayName} | TON Web Store`;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('og:title', profile.displayName);
    setMeta('og:description', profile.bio);
    if (profile.bannerUrl) setMeta('og:image', profile.bannerUrl);
    else if (profile.avatar) setMeta('og:image', profile.avatar);
    setMeta('og:url', window.location.href);

    return () => {
      document.title = prevTitle;
      ['og:title', 'og:description', 'og:image', 'og:url'].forEach((prop) => {
        document.querySelector(`meta[property="${prop}"]`)?.remove();
      });
    };
  }, [profile]);
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const DeveloperPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<PublicDeveloperProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(0);
  const [hoveredProduct, setHoveredProduct] = useState<CatalogListingProduct | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    resolvePublicDeveloperProfile(slug)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [slug]);

  useSeoMeta(profile);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    (navigator.clipboard?.writeText(url) ?? Promise.reject())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        window.prompt('Copy link:', url);
      });
  }, []);

  const featuredProducts = useMemo(() => {
    if (!profile) return [];
    if (profile.featuredProductIds.length === 0) return profile.products.slice(0, 4);
    return profile.featuredProductIds
      .map((id) => profile.products.find((p) => p.id === id))
      .filter(Boolean) as CatalogListingProduct[];
  }, [profile]);

  const totalPages = profile ? Math.max(1, Math.ceil(profile.products.length / PAGE_SIZE)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const pageProducts = profile?.products.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE) ?? [];

  const socialLinks = useMemo(() => {
    if (!profile) return [];
    const links: { icon: typeof Globe; href: string; label: string }[] = [];
    if (profile.website) links.push({ icon: Globe, href: profile.website, label: 'Website' });
    if (profile.github) links.push({ icon: Github, href: `https://github.com/${profile.github}`, label: 'GitHub' });
    if (profile.telegram) links.push({ icon: Send, href: `https://t.me/${profile.telegram}`, label: 'Telegram' });
    if (profile.twitter) links.push({ icon: Twitter, href: `https://x.com/${profile.twitter}`, label: 'X' });
    return links;
  }, [profile]);

  const handleHover = useCallback((p: CatalogListingProduct) => setHoveredProduct(p), []);
  const handleHoverEnd = useCallback(() => setHoveredProduct(null), []);

  const isTopDev = profile ? profile.avgRating >= 4.7 && profile.totalDownloads >= 10000 : false;

  if (loading) return <LoadingScreen message="Loading developer profile..." />;

  if (!profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FFD700]/20 to-[#00F5FF]/10 border border-[#FFD700]/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(255,215,0,0.1)]">
            <Package className="w-10 h-10 text-[#FFD700]/40" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Developer not found</h2>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            No developer with slug{' '}
            <span className="text-[#00F5FF]/70 font-mono bg-[#00F5FF]/5 px-1.5 py-0.5 rounded">
              /{slug}
            </span>{' '}
            exists yet.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#FFD700]/15 to-[#FFD700]/5 border border-[#FFD700]/25 text-[#FFD700] text-sm font-semibold hover:from-[#FFD700]/25 hover:to-[#FFD700]/10 hover:shadow-[0_0_30px_rgba(255,215,0,0.15)] transition-all duration-300"
          >
            Back to Store
          </Link>
        </motion.div>
      </div>
    );
  }

  const initials = profile.displayName.charAt(0).toUpperCase();

  return (
    <div className="max-w-7xl mx-auto">
      {/* ═══ Hero Banner ═══ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative rounded-2xl overflow-hidden"
      >
        {profile.bannerUrl ? (
          <img
            src={profile.bannerUrl}
            alt=""
            className="w-full h-[200px] sm:h-[260px] lg:h-[300px] object-cover"
          />
        ) : (
          <div className="w-full h-[200px] sm:h-[260px] lg:h-[300px] bg-gradient-to-br from-[#1a0a2e] via-[#16213e] to-[#0a1628] relative overflow-hidden">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-[#FFD700]/5 rounded-full blur-3xl animate-pulse" />
            <div
              className="absolute bottom-0 right-1/4 w-48 h-48 bg-[#00F5FF]/5 rounded-full blur-3xl animate-pulse"
              style={{ animationDelay: '1s' }}
            />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0F]/40 to-transparent" />

        {/* Share button — top right */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white/80 text-sm font-medium hover:bg-black/60 hover:border-white/20 transition-all duration-200"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            <span>{copied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>

        {/* Avatar — overlapping bottom edge */}
        <div className="absolute -bottom-14 left-6 sm:left-10 z-10">
          <div
            className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-[#0A0A0F] ${
              isTopDev
                ? 'shadow-[0_0_30px_rgba(255,215,0,0.3)]'
                : 'shadow-[0_0_20px_rgba(0,0,0,0.5)]'
            }`}
          >
            {isTopDev && (
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FFD700] opacity-40 blur-sm animate-pulse" />
            )}
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.displayName}
                className="w-full h-full rounded-full object-cover relative z-10"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gradient-to-br from-[#FFD700]/20 to-[#00F5FF]/10 flex items-center justify-center relative z-10">
                <span className="text-4xl font-bold text-[#FFD700]">{initials}</span>
              </div>
            )}
            {isTopDev && (
              <div className="absolute -bottom-1 -right-1 z-20 w-8 h-8 rounded-full bg-[#0A0A0F] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#FFD700]" />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ═══ Name + Bio + Social ═══ */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        custom={0}
        className="pt-16 sm:pt-18 pl-6 sm:pl-10 pr-6 mb-10"
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                {profile.displayName}
              </h1>
              {isTopDev && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/25 text-[#FFD700] text-[10px] font-bold uppercase tracking-widest">
                  Top Developer
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm sm:text-base mt-1 max-w-2xl leading-relaxed">
              {profile.bio}
            </p>
          </div>

          {socialLinks.length > 0 && (
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200 text-sm group"
                >
                  <link.icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{link.label}</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity hidden lg:block" />
                </a>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* ═══ Stats Bar ═══ */}
      <motion.div
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-12 px-6 sm:px-0"
      >
        {[
          {
            icon: Package,
            label: 'Products',
            value: String(profile.productCount),
            color: '#00F5FF',
          },
          {
            icon: Download,
            label: 'Downloads',
            value: formatDownloads(profile.totalDownloads),
            color: '#A855F7',
          },
          {
            icon: Star,
            label: 'Avg Rating',
            value: profile.avgRating.toFixed(1),
            color: '#FFD700',
          },
          {
            icon: Calendar,
            label: 'Member Since',
            value: formatDate(profile.joinedDate),
            color: '#34D399',
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            variants={fadeUp}
            custom={i + 1}
            className="relative group bg-[#12121A]/80 border border-white/[0.06] rounded-2xl p-5 text-center overflow-hidden hover:border-white/10 transition-all duration-300"
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: `radial-gradient(circle at center, ${stat.color}08 0%, transparent 70%)`,
              }}
            />
            <stat.icon
              className="w-5 h-5 mx-auto mb-2"
              style={{ color: `${stat.color}80` }}
            />
            <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums mb-1">
              {stat.value}
            </div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-medium">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ═══ Featured Products ═══ */}
      {featuredProducts.length > 0 && (
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={5}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-gradient-to-r from-[#FFD700]/20 to-transparent" />
            <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-[#FFD700]/60 flex items-center gap-2">
              <Star className="w-3.5 h-3.5 fill-[#FFD700]/40 text-[#FFD700]/40" />
              Featured
            </h2>
            <div className="h-px flex-1 bg-gradient-to-l from-[#FFD700]/20 to-transparent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </motion.section>
      )}

      {/* ═══ All Products ═══ */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        custom={6}
        className="mb-12"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="h-px flex-1 bg-gradient-to-r from-[#00F5FF]/20 to-transparent" />
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-[#00F5FF]/60 flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-[#00F5FF]/40" />
            All Products ({profile.products.length})
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-[#00F5FF]/20 to-transparent" />
        </div>

        <div className="bg-[#12121A]/60 border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {pageProducts.map((product) => (
              <SteamProductRow
                key={product.id}
                product={product}
                isActive={hoveredProduct?.id === product.id}
                onHover={handleHover}
                onHoverEnd={handleHoverEnd}
              />
            ))}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              disabled={safePage === 0}
              onClick={() => setPage((p) => p - 1)}
              className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-500 tabular-nums min-w-[60px] text-center">
              {safePage + 1} / {totalPages}
            </span>
            <button
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </motion.section>

      {/* ═══ About ═══ */}
      {profile.aboutLong && (
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={7}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-gradient-to-r from-[#A855F7]/20 to-transparent" />
            <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-[#A855F7]/60">
              About
            </h2>
            <div className="h-px flex-1 bg-gradient-to-l from-[#A855F7]/20 to-transparent" />
          </div>
          <div className="relative bg-[#12121A]/80 border border-white/[0.06] rounded-2xl p-6 sm:p-8 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#A855F7]/3 rounded-full blur-3xl" />
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed whitespace-pre-line relative z-10">
              {profile.aboutLong}
            </p>
          </div>
        </motion.section>
      )}
    </div>
  );
};

export default DeveloperPage;
