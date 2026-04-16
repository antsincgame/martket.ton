import { Crown, Flame, Zap, Hexagon, Sparkles } from 'lucide-react';
import type { PublicDeveloperProfile } from '../../domain/marketplace/types';

export interface Achievement {
  id: string;
  icon: typeof Crown;
  title: string;
  description: string;
  color: string;
}

/**
 * Правила присвоения ачивок демиургу.
 * Используется в двух местах:
 *   — hero overlay (компактные chip'ы, desktop) в DevCinematicHero
 *   — полноценная Sacred Timeline (mobile/tablet) в DevSacredTimeline
 * Держим в отдельном модуле, чтобы lazy-chunk для Timeline не ломался static-импортом из Hero.
 */
export function buildAchievements(profile: PublicDeveloperProfile): Achievement[] {
  const out: Achievement[] = [];
  const joined = new Date(profile.joinedDate);
  const now = new Date();
  const yearsAgo = (now.getTime() - joined.getTime()) / (365 * 24 * 3600 * 1000);

  if (!Number.isNaN(joined.getTime()) && yearsAgo >= 1) {
    out.push({
      id: 'ancient',
      icon: Hexagon,
      title: 'Ancient Guild',
      description: `Joined the marketplace ${Math.floor(yearsAgo)}+ year${Math.floor(yearsAgo) > 1 ? 's' : ''} ago`,
      color: '#8B5CF6',
    });
  }

  if (profile.productCount >= 5) {
    out.push({
      id: 'sovereign',
      icon: Crown,
      title: 'Sovereign Creator',
      description: `${profile.productCount} artifacts forged under one name`,
      color: '#FFD700',
    });
  }

  if (profile.totalDownloads >= 10_000) {
    out.push({
      id: 'beloved',
      icon: Flame,
      title: 'Beloved by Multitudes',
      description: `Summoned over ${(profile.totalDownloads / 1000).toFixed(0)}K times`,
      color: '#FF00FF',
    });
  }

  if (profile.avgRating >= 4.7) {
    out.push({
      id: 'divine',
      icon: Zap,
      title: 'Divine Resonance',
      description: `Average rating ${profile.avgRating.toFixed(2)} — the crowd resounds`,
      color: '#00F5FF',
    });
  }

  if (profile.featuredProductIds.length > 0) {
    out.push({
      id: 'featured',
      icon: Sparkles,
      title: 'Featured Demiurge',
      description: `${profile.featuredProductIds.length} work${profile.featuredProductIds.length > 1 ? 's' : ''} chosen by the curators`,
      color: '#00FF88',
    });
  }

  return out;
}
