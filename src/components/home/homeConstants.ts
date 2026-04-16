/**
 * Единый источник правды для констант главной страницы.
 * Раньше `AUTO_ADVANCE_MS`, `RAIL_SIZE`, `NEW_DAYS_THRESHOLD` и magic-числа
 * разлетались по HomeHero / HomePage / ProductCard, создавая hidden coupling.
 */

export const RAIL_SIZE = 8;

export const HERO_AUTO_ADVANCE_MS = 7000;
export const HERO_MAX_SLIDES = 5;

/** Релиз считается «новым», если вышел не более NEW_DAYS_THRESHOLD дней назад. */
export const NEW_DAYS_THRESHOLD = 14;

/** Цвета, которые используются в нескольких home-компонентах. */
export const HOME_NEON = {
  gold: '#FFD700',
  goldWarm: '#F4A836',
  cyan: '#00F5FF',
  violet: '#8B5CF6',
  magenta: '#FF00FF',
  emerald: '#00FF88',
  voidBg: '#0D0D1A',
  nebula: '#12121F',
} as const;

/**
 * Возвращает `true`, если ISO-дата релиза входит в окно «NEW».
 * Принимает `string | undefined` для удобства — возвращает `false` при отсутствии.
 */
export function isNewRelease(
  releaseDate: string | undefined,
  now: Date = new Date(),
  thresholdDays: number = NEW_DAYS_THRESHOLD,
): boolean {
  if (!releaseDate) return false;
  const released = new Date(releaseDate);
  if (Number.isNaN(released.getTime())) return false;
  const diffMs = now.getTime() - released.getTime();
  if (diffMs < 0) return true;
  return diffMs <= thresholdDays * 24 * 60 * 60 * 1000;
}
