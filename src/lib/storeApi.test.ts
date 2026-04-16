import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storeApiBaseUrl, storeApiUrl } from './storeApi';

describe('storeApiBaseUrl', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns localhost:8081 when env is not set', () => {
    vi.stubEnv('VITE_COMMERCE_API_URL', '');
    expect(storeApiBaseUrl()).toBe('http://localhost:8081');
  });

  it('strips trailing slash from env value', () => {
    vi.stubEnv('VITE_COMMERCE_API_URL', 'https://api.example.com/');
    expect(storeApiBaseUrl()).toBe('https://api.example.com');
  });

  it('returns clean URL when no trailing slash', () => {
    vi.stubEnv('VITE_COMMERCE_API_URL', 'https://api.example.com');
    expect(storeApiBaseUrl()).toBe('https://api.example.com');
  });
});

describe('storeApiUrl', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_COMMERCE_API_URL', 'http://localhost:8081');
  });

  it('joins base and path', () => {
    expect(storeApiUrl('/api/health')).toBe('http://localhost:8081/api/health');
  });

  it('adds leading slash if missing', () => {
    expect(storeApiUrl('api/health')).toBe('http://localhost:8081/api/health');
  });

  it('avoids double /api when base ends with /api', () => {
    vi.stubEnv('VITE_COMMERCE_API_URL', 'http://localhost:8081/api');
    expect(storeApiUrl('/api/health')).toBe('http://localhost:8081/api/health');
  });

  it('handles base without /api suffix normally', () => {
    vi.stubEnv('VITE_COMMERCE_API_URL', 'http://localhost:8081');
    expect(storeApiUrl('/api/session/profile')).toBe(
      'http://localhost:8081/api/session/profile',
    );
  });
});
