export interface PlatformEntry {
  name: string;
  icon: string;
}

const PLATFORM_ICON_SRC: Record<string, string> = {
  Windows: '/icons/windows.png',
  macOS: '/icons/macos.png',
  Linux: '/icons/linux.png',
  iOS: '/icons/ios.png',
  Android: '/icons/android.png',
  Web: '/icons/web.png',
};

const PLATFORM_ORDER = ['Windows', 'macOS', 'Linux', 'iOS', 'Android', 'Web'];

export function getPlatformEntries(platforms: string[]): PlatformEntry[] {
  const set = new Set(platforms);
  return PLATFORM_ORDER
    .filter((p) => set.has(p) && PLATFORM_ICON_SRC[p])
    .map((name) => ({ name, icon: PLATFORM_ICON_SRC[name] }));
}

export function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

export function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
