import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encryptCreds, decryptCreds, isStorageEncryptionConfigured } from './devCredentials.js';

const TEST_KEY = 'a'.repeat(64); // 32 bytes hex
let originalKey: string | undefined;

beforeAll(() => {
  originalKey = process.env.STORAGE_ENCRYPTION_KEY;
  process.env.STORAGE_ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  if (originalKey === undefined) delete process.env.STORAGE_ENCRYPTION_KEY;
  else process.env.STORAGE_ENCRYPTION_KEY = originalKey;
});

describe('devCredentials', () => {
  it('reports encryption configured when key is set', () => {
    expect(isStorageEncryptionConfigured()).toBe(true);
  });

  it('round-trips credentials', () => {
    const creds = { accessKeyId: 'AKIA1234567890', secretAccessKey: 'secret/with/slashes+special=chars' };
    const enc = encryptCreds(creds);
    expect(enc.iv).toMatch(/^[0-9a-f]{24}$/);
    expect(enc.tag).toMatch(/^[0-9a-f]{32}$/);
    expect(enc.ciphertext).toMatch(/^[0-9a-f]+$/);
    const dec = decryptCreds(enc);
    expect(dec).toEqual(creds);
  });

  it('produces different ciphertext for the same input (random IV)', () => {
    const creds = { accessKeyId: 'A', secretAccessKey: 'B' };
    const a = encryptCreds(creds);
    const b = encryptCreds(creds);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('rejects tampered ciphertext via GCM auth tag', () => {
    const creds = { accessKeyId: 'A', secretAccessKey: 'B' };
    const enc = encryptCreds(creds);
    const tampered = { ...enc, ciphertext: enc.ciphertext.replace(/.$/, '0') };
    expect(() => decryptCreds(tampered)).toThrow();
  });

  it('rejects tampered tag', () => {
    const creds = { accessKeyId: 'A', secretAccessKey: 'B' };
    const enc = encryptCreds(creds);
    const tampered = { ...enc, tag: '0'.repeat(32) };
    expect(() => decryptCreds(tampered)).toThrow();
  });

  it('rejects malformed records', () => {
    expect(() => decryptCreds({ iv: '', tag: '', ciphertext: '' })).toThrow();
    expect(() => decryptCreds({ iv: 'short', tag: '0'.repeat(32), ciphertext: 'aa' })).toThrow();
  });

  // Note: key validation runs on first use (lazy-loaded). Cannot test
  // post-load rejection without resetting the module state.
});
