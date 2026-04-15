import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Globe, Github, Send, Twitter, Share2, Check, Star,
  Download, Package, Calendar, ChevronLeft, ChevronRight,
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

    return () => { document.title = prevTitle; };
  }, [profile]);
}

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
    resolvePublicDeveloperProfile(slug).then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, [slug]);

  useSeoMeta(profile);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
    if (profile.twitter) links.push({ icon: Twitter, href: `https://x.com/${profile.twitter}`, label: 'X / Twitter' });
    return links;
  }, [profile]);

  const handleHover = useCallback((p: CatalogListingProduct) => setHoveredProduct(p), []);
  const handleHoverEnd = useCallback(() => setHoveredProduct(null), []);

  if (loading) return <LoadingScreen message="Loading developer profile..." />;

  if (!profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Developer not found</h2>
          <p className="text-gray-500 mb-6">The developer page you're looking for doesn't exist.</p>
          <Link to="/" className="text-[#00F5FF] hover:underline">Back to Store</Link>
        </div>
      </div>
    );
  }

  const initials = profile.displayName.charAt(0).toUpperCase();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden mb-8">
        {profile.bannerUrl ? (
          <img src={profile.bannerUrl} alt="" className="w-full h-[180px] sm:h-[220px] object-cover" />
        ) : (
          <div className="w-full h-[180px] sm:h-[220px] bg-gradient-to-r from-[#0D0D1A] via-[#1A1A2E] to-[#0D0D1A]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-5">
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.displayName} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-[#0A0A0A] object-cover flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-[#0A0A0A] bg-[#FFD700]/15 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-bold text-[#FFD700]">{initials}</span>
            </div>
          )}

          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">{profile.displayName}</h1>
            <p className="text-gray-400 text-sm mt-1 line-clamp-2">{profile.bio}</p>
          </div>

          <button
            onClick={handleShare}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00F5FF]/10 border border-[#00F5FF]/30 text-[#00F5FF] text-sm font-semibold hover:bg-[#00F5FF]/20 transition-all duration-200"
          >
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* Social Links + Stats */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Stats */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Package, label: 'Products', value: profile.productCount },
            { icon: Download, label: 'Downloads', value: formatDownloads(profile.totalDownloads) },
            { icon: Star, label: 'Avg Rating', value: profile.avgRating.toFixed(1) },
            { icon: Calendar, label: 'Since', value: formatDate(profile.joinedDate) },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#1A1A1A]/80 border border-[#FFD700]/10 rounded-xl p-3 text-center">
              <stat.icon className="w-4 h-4 text-[#FFD700]/50 mx-auto mb-1" />
              <div className="text-lg font-bold text-[#FFD700] tabular-nums">{stat.value}</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Social Links */}
        {socialLinks.length > 0 && (
          <div className="flex sm:flex-col gap-2 flex-shrink-0">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all text-sm"
              >
                <link.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{link.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/50 mb-3">Featured</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* All Products */}
      <section className="mb-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/50 mb-3">
          All Products ({profile.products.length})
        </h2>
        <div className="bg-[#1A1A1A]/50 border border-white/10 rounded-xl overflow-hidden">
          <div className="divide-y divide-white/[0.06]">
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
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              disabled={safePage === 0}
              onClick={() => setPage((p) => p - 1)}
              className="p-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-500 tabular-nums">
              {safePage + 1} / {totalPages}
            </span>
            <button
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="p-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </section>

      {/* About */}
      {profile.aboutLong && (
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFD700]/50 mb-3">About</h2>
          <div className="bg-[#1A1A1A]/80 border border-[#FFD700]/10 rounded-xl p-6">
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{profile.aboutLong}</p>
          </div>
        </section>
      )}
    </div>
  );
};

export default DeveloperPage;
