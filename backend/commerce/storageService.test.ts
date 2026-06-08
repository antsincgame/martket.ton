import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mSend } = vi.hoisted(() => ({ mSend: vi.fn() }));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send: mSend })),
  HeadBucketCommand: vi.fn((x: unknown) => x),
}));
vi.mock('../r2/devCredentials.js', () => ({
  isStorageEncryptionConfigured: vi.fn(() => true),
  encryptCreds: vi.fn(() => ({ iv: 'IV', tag: 'TAG', ciphertext: 'CIPHER' })),
}));
vi.mock('../r2/devClient.js', () => ({ invalidateDevS3Cache: vi.fn() }));

const db = { listDocuments: vi.fn(), createDocument: vi.fn(), updateDocument: vi.fn() };
vi.mock('./appwrite.js', () => ({
  databases: () => db,
  ID: { unique: () => 'newid' },
  Query: { equal: (...a: unknown[]) => a, limit: (n: number) => n },
}));

import { saveSellerStorage, type SaveStorageInput } from './storageService.js';
import { isStorageEncryptionConfigured } from '../r2/devCredentials.js';

const mEnc = isStorageEncryptionConfigured as unknown as ReturnType<typeof vi.fn>;

const input: SaveStorageInput = {
  provider: 'cloudflare-r2',
  accountId: 'acc',
  bucket: 'my-bucket',
  accessKeyId: 'AKIA',
  secretAccessKey: 'SECRET',
};

beforeEach(() => {
  vi.clearAllMocks();
  mEnc.mockReturnValue(true);
  mSend.mockResolvedValue({});
  db.listDocuments.mockResolvedValue({ documents: [] });
  db.createDocument.mockResolvedValue({ $id: 'sp-1' });
  db.updateDocument.mockResolvedValue({ $id: 'sp-1' });
});

describe('saveSellerStorage — shared BYOS storage path', () => {
  it('503 NO_ENCRYPTION_KEY when encryption is not configured', async () => {
    mEnc.mockReturnValue(false);
    const r = await saveSellerStorage('W', input, 'X');
    expect(r).toMatchObject({ ok: false, status: 503, code: 'NO_ENCRYPTION_KEY' });
  });

  it('400 BAD_ENDPOINT on an SSRF (private-IP) endpoint — never probes', async () => {
    const r = await saveSellerStorage('W', { ...input, endpoint: 'https://localhost/x' }, 'X');
    expect(r).toMatchObject({ ok: false, status: 400, code: 'BAD_ENDPOINT' });
    expect(mSend).not.toHaveBeenCalled();
  });

  it('400 BUCKET_PROBE_FAILED when HeadBucket rejects — nothing persisted', async () => {
    mSend.mockRejectedValue(new Error('AccessDenied'));
    const r = await saveSellerStorage('W', input, 'X');
    expect(r).toMatchObject({ ok: false, status: 400, code: 'BUCKET_PROBE_FAILED' });
    expect(db.createDocument).not.toHaveBeenCalled();
  });

  it('persists ENCRYPTED creds (never plaintext) and reports connected', async () => {
    const r = await saveSellerStorage('W', input, 'Agent Demiurge');
    expect(r.ok).toBe(true);
    const payload = db.createDocument.mock.calls[0][3] as Record<string, unknown>;
    expect(payload.storage_status).toBe('connected');
    expect(payload.storage_creds_ciphertext).toBe('CIPHER');
    expect(payload.secretAccessKey).toBeUndefined(); // plaintext secret never persisted
    expect(payload.accessKeyId).toBeUndefined();
  });
});
