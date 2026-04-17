import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { computeFileSha256, streamFileToR2, safeUnlink } = require('./streamUpload.js') as {
  computeFileSha256: (filePath: string) => Promise<string>;
  streamFileToR2: (args: {
    client: { send: (cmd: unknown) => Promise<unknown> };
    PutObjectCommand: new (input: unknown) => unknown;
    bucket: string;
    key: string;
    filePath: string;
    contentLength: number;
    contentType?: string;
    metadata?: Record<string, string>;
  }) => Promise<unknown>;
  safeUnlink: (filePath: string | null | undefined) => Promise<void>;
};

let scratch: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'r2-stream-'));
});

afterEach(() => {
  try { rmSync(scratch, { recursive: true, force: true }); } catch { /* noop */ }
});

describe('computeFileSha256', () => {
  it('matches a hash computed by Buffer.from for the same bytes', async () => {
    const file = join(scratch, 'fixture.bin');
    const data = Buffer.from('hello, machine god of mars 🜍');
    writeFileSync(file, data);

    const expected = createHash('sha256').update(data).digest('hex');
    const actual = await computeFileSha256(file);
    expect(actual).toBe(expected);
  });

  it('produces deterministic output for the same input', async () => {
    const file = join(scratch, 'a.bin');
    writeFileSync(file, Buffer.alloc(1024, 7));
    const a = await computeFileSha256(file);
    const b = await computeFileSha256(file);
    expect(a).toBe(b);
  });

  it('produces different output for different content', async () => {
    const f1 = join(scratch, 'one');
    const f2 = join(scratch, 'two');
    writeFileSync(f1, 'one');
    writeFileSync(f2, 'two');
    expect(await computeFileSha256(f1)).not.toBe(await computeFileSha256(f2));
  });

  it('handles a 1 MB file without OOM (proxy for streaming)', async () => {
    const file = join(scratch, 'big.bin');
    writeFileSync(file, Buffer.alloc(1024 * 1024, 0xAB));
    const hex = await computeFileSha256(file);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects when file does not exist', async () => {
    await expect(computeFileSha256(join(scratch, 'nope'))).rejects.toThrow();
  });
});

describe('streamFileToR2', () => {
  it('passes a Readable Body and the provided ContentLength to the SDK', async () => {
    const file = join(scratch, 'payload.bin');
    const data = Buffer.from('streaming-payload');
    writeFileSync(file, data);

    const captured: { input?: Record<string, unknown> } = {};
    class FakeCmd {
      input: Record<string, unknown>;
      constructor(input: Record<string, unknown>) {
        this.input = input;
        captured.input = input;
      }
    }
    const send = vi.fn(async (_cmd: unknown) => ({ ETag: 'fake-etag' }));

    await streamFileToR2({
      client: { send },
      PutObjectCommand: FakeCmd as unknown as new (input: unknown) => unknown,
      bucket: 'b',
      key: 'k',
      filePath: file,
      contentLength: data.length,
      contentType: 'application/octet-stream',
      metadata: { 'x-test': '1' },
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(captured.input?.Bucket).toBe('b');
    expect(captured.input?.Key).toBe('k');
    expect(captured.input?.ContentLength).toBe(data.length);
    expect(captured.input?.ContentType).toBe('application/octet-stream');
    expect(captured.input?.Metadata).toEqual({ 'x-test': '1' });
    // Body should be a stream-like object (has on() / pipe()), not a Buffer.
    const body = captured.input?.Body as { on?: unknown; pipe?: unknown } | undefined;
    expect(typeof body?.on).toBe('function');
    expect(typeof body?.pipe).toBe('function');
  });

  it('rejects invalid contentLength (NaN, zero, negative)', async () => {
    const file = join(scratch, 'p.bin');
    writeFileSync(file, 'x');
    const args = {
      client: { send: vi.fn() },
      PutObjectCommand: class {} as unknown as new (input: unknown) => unknown,
      bucket: 'b',
      key: 'k',
      filePath: file,
    };
    await expect(streamFileToR2({ ...args, contentLength: NaN })).rejects.toThrow();
    await expect(streamFileToR2({ ...args, contentLength: 0 })).rejects.toThrow();
    await expect(streamFileToR2({ ...args, contentLength: -1 })).rejects.toThrow();
  });

  it('rejects when required args are missing', async () => {
    const args = {
      client: null as unknown as { send: (cmd: unknown) => Promise<unknown> },
      PutObjectCommand: class {} as unknown as new (input: unknown) => unknown,
      bucket: 'b',
      key: 'k',
      filePath: '/tmp/x',
      contentLength: 1,
    };
    await expect(streamFileToR2(args)).rejects.toThrow(/client/);
  });

  it('propagates SDK errors so the route can clean up tmp file in finally', async () => {
    const file = join(scratch, 'p.bin');
    writeFileSync(file, 'x');
    const send = vi.fn(async () => { throw new Error('S3 down'); });
    await expect(streamFileToR2({
      client: { send },
      PutObjectCommand: class {} as unknown as new (input: unknown) => unknown,
      bucket: 'b',
      key: 'k',
      filePath: file,
      contentLength: 1,
    })).rejects.toThrow('S3 down');
  });
});

describe('integration: hash + stream upload', () => {
  it('hash computed before upload matches what the sdk receives', async () => {
    const file = join(scratch, 'integration.bin');
    const data = Buffer.alloc(64 * 1024);
    for (let i = 0; i < data.length; i++) data[i] = i % 251;
    writeFileSync(file, data);

    // 1) Compute hash via streaming helper
    const sha = await computeFileSha256(file);
    expect(sha).toMatch(/^[0-9a-f]{64}$/);

    // 2) Stream the file to a mock S3 — drain body and compare bytes
    class FakeCmd {
      input: Record<string, unknown>;
      constructor(input: Record<string, unknown>) {
        this.input = input;
      }
    }
    const send = vi.fn(async (cmd: unknown) => {
      const input = (cmd as { input: Record<string, unknown> }).input;
      const body = input.Body as NodeJS.ReadableStream;
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(chunk as Buffer);
      const drained = Buffer.concat(chunks);
      const sdkSeenHash = createHash('sha256').update(drained).digest('hex');
      expect(sdkSeenHash).toBe(sha);
      expect(drained.length).toBe(data.length);
      return { ETag: 'ok' };
    });

    await streamFileToR2({
      client: { send },
      PutObjectCommand: FakeCmd as unknown as new (input: unknown) => unknown,
      bucket: 'b',
      key: 'integration-key',
      filePath: file,
      contentLength: data.length,
      metadata: { sha256: sha, 'product-id': 'p1' },
    });

    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('safeUnlink', () => {
  it('removes an existing file', async () => {
    const file = join(scratch, 'remove-me');
    writeFileSync(file, 'x');
    expect(existsSync(file)).toBe(true);
    await safeUnlink(file);
    expect(existsSync(file)).toBe(false);
  });

  it('is a no-op for nonexistent file (does not throw)', async () => {
    await expect(safeUnlink(join(scratch, 'never-existed'))).resolves.toBeUndefined();
  });

  it('is a no-op for null/undefined/empty', async () => {
    await expect(safeUnlink(null)).resolves.toBeUndefined();
    await expect(safeUnlink(undefined)).resolves.toBeUndefined();
    await expect(safeUnlink('')).resolves.toBeUndefined();
  });
});
