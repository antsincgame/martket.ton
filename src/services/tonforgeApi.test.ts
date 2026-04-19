import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('tonForgeBaseUrl', () => {
  it('uses VITE_TONFORGE_API_URL when set', async () => {
    vi.stubEnv('VITE_TONFORGE_API_URL', 'https://api.tonforge.org');
    vi.stubEnv('VITE_COMMERCE_API_URL', '');
    const mod = await import('./tonforgeApi');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { apps: [] } }),
    }));

    await mod.fetchTonForgeFeaturedApps();
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(call).toContain('https://api.tonforge.org/api/tonforge');
  });
});

describe('parseResponse error handling', () => {
  it('throws on non-ok response', async () => {
    vi.stubEnv('VITE_TONFORGE_API_URL', 'http://localhost:8081');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'NOT_FOUND' }),
    }));

    const { fetchTonForgeConfig } = await import('./tonforgeApi');
    await expect(fetchTonForgeConfig()).rejects.toThrow('NOT_FOUND');
  });

  it('uses generic error message when no error field', async () => {
    vi.stubEnv('VITE_TONFORGE_API_URL', 'http://localhost:8081');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    }));

    const { fetchTonForgeConfig } = await import('./tonforgeApi');
    await expect(fetchTonForgeConfig()).rejects.toThrow('TONFORGE_API_ERROR');
  });
});

describe('API functions construct correct URLs', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TONFORGE_API_URL', 'http://localhost:8081');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    }));
  });

  it('fetchTonForgeConfig calls /config', async () => {
    const { fetchTonForgeConfig } = await import('./tonforgeApi');
    await fetchTonForgeConfig();
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toMatch(/\/api\/tonforge\/config$/);
  });

  it('fetchTonForgeAppDetails encodes appId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { app: {}, reviews: [] } }),
    }));
    const { fetchTonForgeAppDetails } = await import('./tonforgeApi');
    await fetchTonForgeAppDetails('my app/1');
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('my%20app%2F1');
  });

  it('fetchDeveloperWorkspace encodes wallet address', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    }));
    const { fetchDeveloperWorkspace } = await import('./tonforgeApi');
    await fetchDeveloperWorkspace('EQ+test');
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('EQ%2Btest');
  });
});
