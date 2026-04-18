/**
 * Resumable downloader for BYOS-hosted builds.
 *
 * The signed URL has a TTL (1h default). Once the GET request initiates, the
 * connection lives until the file finishes — even if the URL technically
 * expires mid-transfer. But if the connection drops, the buyer needs a fresh
 * URL to resume with Range.
 *
 * This helper:
 *   1) Calls our backend to get a redirect URL (302) → resolved URL
 *   2) Streams the response into a Blob, tracking byte offset
 *   3) On error, requests a new URL and resumes with `Range: bytes=N-`
 */

export interface DownloadProgress {
  loaded: number;
  total: number | null;
}

export interface DownloadOptions {
  listingId: string;
  /** Endpoint that returns a 302 redirect to the source URL. */
  resolveUrl: () => Promise<string>;
  filename?: string;
  /** Receive progress updates (bytes). */
  onProgress?: (p: DownloadProgress) => void;
  /** Cancel signal. */
  signal?: AbortSignal;
  /** Max retries on connection error. */
  maxRetries?: number;
}

const DEFAULT_MAX_RETRIES = 5;

/**
 * Downloads via fetch + Range. Returns a Blob.
 *
 * For very large files prefer streaming-to-disk via File System Access API
 * (when available) — current implementation buffers in memory which is fine
 * for builds <500 MB.
 */
export async function resumableDownload(opts: DownloadOptions): Promise<Blob> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const chunks: Uint8Array[] = [];
  let offset = 0;
  let total: number | null = null;
  let attempt = 0;

  while (true) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    let url: string;
    try {
      url = await opts.resolveUrl();
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      await sleep(backoff(attempt));
      continue;
    }

    try {
      const headers: Record<string, string> = {};
      if (offset > 0) headers.Range = `bytes=${offset}-`;
      const res = await fetch(url, { headers, signal: opts.signal });
      if (!res.ok && res.status !== 206) {
        // Some sources don't support Range — restart from 0
        if (offset > 0 && res.status === 416) {
          chunks.length = 0;
          offset = 0;
          continue;
        }
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      // Total size from Content-Range or Content-Length
      const contentRange = res.headers.get('content-range');
      const contentLength = res.headers.get('content-length');
      if (contentRange) {
        const m = /\/(\d+)$/.exec(contentRange);
        if (m) total = parseInt(m[1]!, 10);
      } else if (contentLength) {
        if (offset === 0) total = parseInt(contentLength, 10);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          offset += value.byteLength;
          opts.onProgress?.({ loaded: offset, total });
        }
        if (opts.signal?.aborted) {
          try { await reader.cancel(); } catch { /* noop */ }
          throw new DOMException('Aborted', 'AbortError');
        }
      }
      // Done!
      // BlobPart accepts ArrayBufferView arrays
      return new Blob(chunks as BlobPart[]);
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      attempt++;
      if (attempt >= maxRetries) throw err;
      await sleep(backoff(attempt));
      // continue → request new URL, resume from offset via Range
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoff(attempt: number): number {
  return Math.min(30_000, 1000 * Math.pow(2, attempt - 1));
}

/**
 * Convenience: triggers a browser download of the resulting Blob.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}
