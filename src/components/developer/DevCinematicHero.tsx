import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import {
  Globe, Github, Send, Twitter, Share2, Check, ExternalLink,
  Package, Download, Star, Calendar,
} from 'lucide-react';
import type { PublicDeveloperProfile } from '../../domain/marketplace/types';
import { formatDownloads, formatDate } from '../../domain/marketplace/platformIcons';
import { buildAchievements } from './achievements';
import AchievementChip from './AchievementChip';
import GlitchText from './GlitchText';
import HexRuneAvatar from './HexRuneAvatar';
import HeroManifesto from './HeroManifesto';

interface DevCinematicHeroProps {
  profile: PublicDeveloperProfile;
  isTopDev: boolean;
}

const DevCinematicHero = memo(({ profile, isTopDev }: DevCinematicHeroProps) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const bannerY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const bannerScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);

  const socialLinks = useMemo(() => {
    const links: { icon: typeof Globe; href: string; label: string; color: string }[] = [];
    if (profile.website)
      links.push({ icon: Globe, href: profile.website, label: 'Website', color: '#00F5FF' });
    if (profile.github)
      links.push({
        icon: Github,
        href: `https://github.com/${profile.github}`,
        label: 'GitHub',
        color: '#FFFFFF',
      });
    if (profile.telegram)
      links.push({
        icon: Send,
        href: `https://t.me/${profile.telegram}`,
        label: 'Telegram',
        color: '#00F5FF',
      });
    if (profile.twitter)
      links.push({
        icon: Twitter,
        href: `https://x.com/${profile.twitter}`,
        label: 'X',
        color: '#FF00FF',
      });
    return links;
  }, [profile]);

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

  const initials = profile.displayName.charAt(0).toUpperCase();

  /** Compact metrics for the hero overlay (desktop). */
  const heroStats = useMemo(
    () => [
      { icon: Package, label: 'Artifacts', value: String(profile.productCount), color: '#00F5FF' },
      { icon: Download, label: 'Summoned', value: formatDownloads(profile.totalDownloads), color: '#8B5CF6' },
      { icon: Star, label: 'Resonance', value: profile.avgRating.toFixed(1), color: '#FFD700' },
      { icon: Calendar, label: 'Awakened', value: formatDate(profile.joinedDate), color: '#00FF88' },
    ],
    [profile.productCount, profile.totalDownloads, profile.avgRating, profile.joinedDate],
  );

  const achievements = useMemo(() => buildAchievements(profile), [profile]);

  return (
    <div ref={ref} className="relative">
      {/* ═══ Banner with parallax ═══ */}
      <div className="relative rounded-3xl overflow-hidden border border-white/5">
        <motion.div
          style={reduce ? undefined : { y: bannerY, scale: bannerScale }}
          className="w-full h-[220px] sm:h-[320px] lg:h-[480px]"
        >
          {profile.bannerUrl ? (
            <img src={profile.bannerUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full relative"
              style={{
                background:
                  'radial-gradient(ellipse at 20% 30%, rgba(255,215,0,0.15), transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(0,245,255,0.15), transparent 50%), radial-gradient(ellipse at 50% 100%, rgba(139,92,246,0.2), transparent 60%), linear-gradient(135deg, #0D0D1A, #1a0a2e, #0a1628)',
              }}
            >
              {!reduce && (
                <>
                  <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#FFD700]/10 rounded-full blur-3xl animate-pulse-slow" />
                  <div
                    className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#00F5FF]/10 rounded-full blur-3xl animate-pulse-slow"
                    style={{ animationDelay: '1.5s' }}
                  />
                </>
              )}
            </div>
          )}
        </motion.div>

        {/* Gradient fade to page background */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0F]/60 via-transparent to-[#0A0A0F]/40" />

        {/* Sacred scan-line veil */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,245,255,0.4) 0px, rgba(0,245,255,0.4) 1px, transparent 1px, transparent 4px)',
          }}
        />

        {/* ═══ Hero overlay (lg+) — avatar + name + tagline + socials + badges in one left-aligned block. ═══ */}
        <div className="hidden lg:flex absolute top-8 left-8 z-20 flex-col gap-4 w-[min(52%,640px)]">
          {/* Row 1: avatar + name + tagline */}
          <div className="flex items-start gap-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="flex-shrink-0"
            >
              <HexRuneAvatar
                avatar={profile.avatar}
                initials={initials}
                isTopDev={isTopDev}
                size={116}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="min-w-0 flex-1 pt-1"
            >
              <h1 className="text-4xl xl:text-5xl font-black uppercase tracking-tight leading-[1.02] mb-2">
                <GlitchText
                  text={profile.displayName}
                  tint={isTopDev ? 'gold' : 'cyan'}
                  intensity={isTopDev ? 'aggressive' : 'calm'}
                  as="span"
                />
              </h1>
              {profile.bio && (
                <p className="text-gray-200/90 text-sm leading-relaxed border-l-2 border-[#FFD700]/50 pl-3 italic line-clamp-2">
                  {profile.bio}
                </p>
              )}
            </motion.div>
          </div>

          {/* Row 2: socials (compact) */}
          {socialLinks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {socialLinks.map((link, i) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.06 }}
                  aria-label={link.label}
                  className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/45 backdrop-blur-md border border-white/[0.1] text-gray-200 text-[11px] font-semibold uppercase tracking-widest overflow-hidden transition-all duration-300 hover:border-white/25 hover:text-white"
                >
                  <span
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: `radial-gradient(circle at center, ${link.color}25, transparent 70%)`,
                      boxShadow: `0 0 18px ${link.color}45`,
                    }}
                  />
                  <link.icon
                    className="relative w-3.5 h-3.5 transition-colors"
                    style={{ color: link.color }}
                  />
                  <span className="relative">{link.label}</span>
                </motion.a>
              ))}
            </div>
          )}

          {/* Row 3: badges (Top Demiurge / Verified Creator) */}
          <div className="flex flex-wrap items-center gap-2">
            {isTopDev && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#FFD700]/50 bg-black/45 backdrop-blur-md text-[#FFD700] text-[10px] font-black uppercase tracking-[0.25em] shadow-[0_0_24px_rgba(255,215,0,0.35)] animate-aura-pulse"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] shadow-[0_0_8px_#FFD700]" />
                Top Demiurge
              </motion.span>
            )}
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.65 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#00F5FF]/40 bg-black/45 backdrop-blur-md text-[#00F5FF] text-[10px] font-bold uppercase tracking-[0.2em] shadow-[0_0_18px_rgba(0,245,255,0.25)]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] shadow-[0_0_8px_#00F5FF]" />
              Verified Creator
            </motion.span>
          </div>

          {/* Row 4: compact metrics — inline version of DevStatsConstellation. */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.5 }}
            className="grid grid-cols-4 gap-2"
            role="list"
            aria-label="Developer stats"
          >
            {heroStats.map((s) => (
              <div
                key={s.label}
                role="listitem"
                className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/45 backdrop-blur-md border overflow-hidden"
                style={{
                  borderColor: `${s.color}33`,
                  boxShadow: `inset 0 0 18px ${s.color}10`,
                }}
                title={s.label}
              >
                <s.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: s.color }} />
                <div className="min-w-0 leading-tight">
                  <div
                    className="text-[13px] font-black tabular-nums truncate"
                    style={{ color: '#FFFFFF', textShadow: `0 0 8px ${s.color}55` }}
                  >
                    {s.value}
                  </div>
                  <div
                    className="text-[8px] font-bold uppercase tracking-[0.2em] truncate"
                    style={{ color: `${s.color}CC` }}
                  >
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Row 5: achievement chips with interactive tooltips. */}
          {achievements.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.5 }}
              className="flex flex-wrap gap-1.5"
              role="list"
              aria-label="Achievements"
            >
              {achievements.map((ach) => (
                <AchievementChip key={ach.id} achievement={ach} compact />
              ))}
            </motion.div>
          )}
        </div>

        {/* ═══ Manifesto overlay (lg+ only, so text remains readable) ═══ */}
        {profile.aboutLong && profile.aboutLong.trim().length > 0 && (
          <div
            className="hidden lg:block absolute top-8 right-8 z-20 w-[380px] xl:w-[440px] overflow-hidden"
            style={{ maxHeight: 'calc(100% - 64px)' }}
          >
            <div className="relative h-full overflow-y-auto scrollbar-hide">
              <HeroManifesto text={profile.aboutLong} />
            </div>
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-12 rounded-b-2xl bg-gradient-to-t from-black/80 to-transparent pointer-events-none"
            />
          </div>
        )}

        {/* Share — bottom right glass capsule */}
        <button
          onClick={handleShare}
          className="absolute bottom-4 right-4 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-xl border border-white/15 text-white/85 text-xs font-semibold uppercase tracking-widest hover:bg-black/70 hover:border-[#FFD700]/40 hover:text-[#FFD700] hover:shadow-[0_0_20px_rgba(255,215,0,0.25)] transition-all duration-300"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Share2 className="w-3.5 h-3.5" />
          )}
          <span>{copied ? 'Sealed' : 'Share'}</span>
        </button>
      </div>

      {/* ═══ Hero content (mobile/tablet only) — on lg+ everything is in the banner's top-left overlay. ═══ */}
      <div className="lg:hidden relative -mt-24 sm:-mt-28 px-6 sm:px-10 z-10">
        <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-10">
          {/* Avatar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex-shrink-0"
          >
            <HexRuneAvatar
              avatar={profile.avatar}
              initials={initials}
              isTopDev={isTopDev}
              size={180}
            />
          </motion.div>

          {/* Name + bio */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 min-w-0 pb-2"
          >
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {isTopDev && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#FFD700]/40 bg-[#FFD700]/5 text-[#FFD700] text-[10px] font-black uppercase tracking-[0.25em] shadow-[0_0_20px_rgba(255,215,0,0.25)] animate-aura-pulse"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] shadow-[0_0_8px_#FFD700]" />
                  Top Demiurge
                </motion.span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#00F5FF]/25 bg-[#00F5FF]/5 text-[#00F5FF]/90 text-[10px] font-bold uppercase tracking-[0.2em]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F5FF] shadow-[0_0_8px_#00F5FF]" />
                Verified Creator
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight leading-[1.05] mb-4">
              <GlitchText
                text={profile.displayName}
                tint={isTopDev ? 'gold' : 'cyan'}
                intensity={isTopDev ? 'aggressive' : 'calm'}
                as="span"
              />
            </h1>

            <p className="text-gray-300/90 text-sm sm:text-base max-w-2xl leading-relaxed mb-6 border-l-2 border-[#FFD700]/40 pl-4 italic">
              {profile.bio}
            </p>

            {/* Social chips */}
            {socialLinks.length > 0 && (
              <div className="flex flex-wrap gap-2.5">
                {socialLinks.map((link, i) => (
                  <motion.a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.08 }}
                    className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-gray-300 text-xs font-semibold uppercase tracking-widest overflow-hidden transition-all duration-300 hover:border-white/20 hover:text-white"
                    style={{ boxShadow: `inset 0 0 0 0 ${link.color}` }}
                  >
                    <span
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: `radial-gradient(circle at center, ${link.color}20, transparent 70%)`,
                        boxShadow: `0 0 24px ${link.color}40`,
                      }}
                    />
                    <link.icon
                      className="relative w-3.5 h-3.5 transition-colors"
                      style={{ color: link.color }}
                    />
                    <span className="relative hidden sm:inline">{link.label}</span>
                    <ExternalLink className="relative w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity hidden sm:block" />
                  </motion.a>
                ))}
              </div>
            )}

            {/* Achievement chips (mobile/tablet) with tap-to-reveal tooltips */}
            {achievements.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="flex flex-wrap gap-2 mt-4"
                role="list"
                aria-label="Achievements"
              >
                {achievements.map((ach) => (
                  <AchievementChip key={ach.id} achievement={ach} />
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* ═══ Mobile/tablet manifesto — inline in the flow (NOT over the banner, so text stays readable) ═══ */}
        {profile.aboutLong && profile.aboutLong.trim().length > 0 && (
          <div className="lg:hidden mt-6">
            <HeroManifesto text={profile.aboutLong} />
          </div>
        )}
      </div>
    </div>
  );
});

DevCinematicHero.displayName = 'DevCinematicHero';

export default DevCinematicHero;
