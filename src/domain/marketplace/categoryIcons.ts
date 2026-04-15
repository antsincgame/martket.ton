import {
  Smartphone,
  Gamepad2,
  Bot,
  Zap,
  Palette,
  Coins,
  GraduationCap,
  ShieldCheck,
  Film,
  MessageCircle,
  HeartPulse,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HomeCategorySlug } from './types';

export const CATEGORY_ICONS: Record<HomeCategorySlug, LucideIcon> = {
  apps: Smartphone,
  games: Gamepad2,
  ai: Bot,
  'developer-tools': Zap,
  design: Palette,
  defi: Coins,
  education: GraduationCap,
  security: ShieldCheck,
  media: Film,
  social: MessageCircle,
  health: HeartPulse,
  utilities: Wrench,
};
