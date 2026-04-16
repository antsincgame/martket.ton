import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import { resolvePublicDeveloperProfile } from '../domain/marketplace/marketplaceRemote';
import { slugify } from '../utils/slugify';
import LoadingScreen from '../components/LoadingScreen';
import DevSacredBackground from '../components/developer/DevSacredBackground';
import DevCinematicHero from '../components/developer/DevCinematicHero';
import DevStatsConstellation from '../components/developer/DevStatsConstellation';
import DevArsenal from '../components/developer/DevArsenal';
import GlitchText from '../components/developer/GlitchText';
import type { PublicDeveloperProfile } from '../domain/marketplace/types';

const DevSacredTimeline = lazy(() => import('../components/developer/DevSacredTimeline'));

function useSeoMeta(profile: PublicDeveloperProfile | null) {
  useEffect(() => {
    if (!profile) return;
    const prevTitle = document.title;
    document.title = `${profile.displayName} · Demiurge of TON Web Store`;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('og:type', 'profile');
    setMeta('og:title', profile.displayName);
    setMeta('og:description', profile.bio);
    if (profile.bannerUrl) setMeta('og:image', profile.bannerUrl);
    else if (profile.avatar) setMeta('og:image', profile.avatar);
    setMeta('og:url', window.location.href);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', profile.displayName);
    setMeta('twitter:description', profile.bio);

    return () => {
      document.title = prevTitle;
      ['og:type', 'og:title', 'og:description', 'og:image', 'og:url', 'twitter:card', 'twitter:title', 'twitter:description'].forEach((prop) => {
        document.querySelector(`meta[property="${prop}"]`)?.remove();
      });
    };
  }, [profile]);
}

const DeveloperPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicDeveloperProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    resolvePublicDeveloperProfile(slug)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [slug]);

  // Canonical URL: если слаг в адресе отличается от канонического (например, id или старый slug) — незаметно заменяем.
  useEffect(() => {
    if (!profile || !slug) return;
    const canonical = slugify(profile.displayName);
    if (canonical && canonical !== slug) {
      navigate(`/developer/${canonical}`, { replace: true });
    }
  }, [profile, slug, navigate]);

  useSeoMeta(profile);

  if (loading) return <LoadingScreen message="Summoning the demiurge..." />;

  if (!profile) {
    return (
      <div className="relative min-h-[70vh] flex items-center justify-center px-6">
        <DevSacredBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative text-center max-w-md z-10"
        >
          <div className="relative w-28 h-28 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#FFD700]/20 to-[#00F5FF]/10 border border-[#FFD700]/20 flex items-center justify-center shadow-[0_0_60px_rgba(255,215,0,0.2)]">
              <Package className="w-10 h-10 text-[#FFD700]/50" />
            </div>
            <div className="absolute -inset-2 rounded-full border border-[#FFD700]/20 animate-aura-pulse" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-3">
            <GlitchText text="Void Signal" tint="cyan" intensity="aggressive" as="span" />
          </h2>

          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            No demiurge answers at{' '}
            <span className="text-[#00F5FF] font-mono bg-[#00F5FF]/5 px-1.5 py-0.5 rounded">
              /{slug}
            </span>
            . The sigil you seek does not yet exist in the forge.
          </p>

          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#FFD700]/15 to-[#FFD700]/5 border border-[#FFD700]/30 text-[#FFD700] text-xs font-black uppercase tracking-[0.3em] hover:from-[#FFD700]/25 hover:to-[#FFD700]/10 hover:shadow-[0_0_40px_rgba(255,215,0,0.25)] transition-all duration-300"
          >
            Return to the Store
          </Link>
        </motion.div>
      </div>
    );
  }

  const isTopDev = profile.avgRating >= 4.7 && profile.totalDownloads >= 10000;

  return (
    <div className="relative max-w-7xl mx-auto pb-16">
      <DevSacredBackground />

      <div className="relative space-y-10 sm:space-y-14">
        <DevCinematicHero profile={profile} isTopDev={isTopDev} />

        {/*
          Stats и Sacred Timeline на desktop (lg+) уже встроены компактно в hero overlay
          (DevCinematicHero → Ряд 4/5). На mobile/tablet места достаточно — показываем полные секции.
        */}
        <div className="lg:hidden px-6 sm:px-10">
          <DevStatsConstellation profile={profile} />
        </div>

        <div className="px-6 sm:px-10">
          <DevArsenal profile={profile} />
        </div>

        <Suspense fallback={<div className="px-6 py-10 text-center text-gray-600 text-xs uppercase tracking-widest">Unveiling sacred path…</div>}>
          <div className="lg:hidden px-6 sm:px-10">
            <DevSacredTimeline profile={profile} />
          </div>
        </Suspense>
      </div>
    </div>
  );
};

export default DeveloperPage;
