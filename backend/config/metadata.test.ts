import { describe, it, expect, afterEach } from 'vitest';
import { licenseMetadataBaseUrl } from './metadata.js';

const orig = process.env.LICENSE_METADATA_BASE_URL;
afterEach(() => {
  if (orig === undefined) delete process.env.LICENSE_METADATA_BASE_URL;
  else process.env.LICENSE_METADATA_BASE_URL = orig;
});

describe('licenseMetadataBaseUrl', () => {
  it('uses the env value when set, stripping trailing slashes', () => {
    process.env.LICENSE_METADATA_BASE_URL = 'https://cdn.acme.io/meta///';
    expect(licenseMetadataBaseUrl()).toBe('https://cdn.acme.io/meta');
  });

  it('falls back to the TonForge CDN — never a placeholder/example domain', () => {
    delete process.env.LICENSE_METADATA_BASE_URL;
    const url = licenseMetadataBaseUrl();
    expect(url).toBe('https://cdn.tonforge.org/license-metadata');
    expect(url).not.toMatch(/example\.(org|com)/);
  });
});
