/**
 * GitHub Releases source adapter (public repos only, MVP).
 *
 * - validate:        GET /repos/:owner/:repo/releases/tags/:tag → find asset
 * - getDownloadUrl:  returns asset.browser_download_url (public CDN)
 * - openReadStream:  fetch(browser_download_url) body
 *
 * Rate limits (unauthenticated): 60 req/h per IP. We cache asset metadata
 * for 5 min to stay well below the limit; verify/scan are infrequent and
 * downloads bypass our server entirely (302 redirect).
 *
 * Private repos are deliberately NOT supported in MVP — they'd require storing
 * a per-demiurge token, which expands the secret surface. Use R2 for private DRM.
 */

import type { Readable } from 'node:stream';
import { Readable as NodeReadable } from 'node:stream';
import type {
  DistributionManifest,
  ReadStreamResult,
  SourceAdapter,
} from '../manifest.js';

const GH_API = 'https://api.github.com';
const ASSET_CACHE_TTL_MS = 5 * 60_000;

interface AssetCacheEntry {
  url: string;
  size: number;
  contentType?: string;
  expiresAt: number;
}

const assetCache = new Map<string, AssetCacheEntry>();

function cacheKey(repo: string, tag: string, asset: string): string {
  return `${repo}@${tag}#${asset}`;
}

function assertGh(m: DistributionManifest): asserts m is Extract<DistributionManifest, { kind: 'github' }> {
  if (m.kind !== 'github') throw new Error(`GitHub adapter received non-github manifest: ${m.kind}`);
}

interface GhAsset {
  name: string;
  size: number;
  content_type?: string;
  browser_download_url: string;
}

interface GhReleaseResponse {
  assets?: GhAsset[];
  message?: string;
}

async function fetchAssetMeta(repo: string, tag: string, assetName: string): Promise<AssetCacheEntry> {
  const key = cacheKey(repo, tag, assetName);
  const cached = assetCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const url = `${GH_API}/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`;
  const res = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'tonforge-distribution',
    },
  });
  if (res.status === 404) {
    throw new Error(`GitHub release not found: ${repo}@${tag}`);
  }
  if (res.status === 403) {
    throw new Error(`GitHub API rate limit or repo is private: ${repo}@${tag}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as GhReleaseResponse;
  const asset = (data.assets || []).find((a) => a.name === assetName);
  if (!asset) {
    const have = (data.assets || []).map((a) => a.name).join(', ') || '(none)';
    throw new Error(`Asset "${assetName}" not found in release ${repo}@${tag}. Available: ${have}`);
  }
  const entry: AssetCacheEntry = {
    url: asset.browser_download_url,
    size: asset.size,
    contentType: asset.content_type,
    expiresAt: Date.now() + ASSET_CACHE_TTL_MS,
  };
  assetCache.set(key, entry);
  return entry;
}

export const githubAdapter: SourceAdapter = {
  async validate(manifest, _ctx) {
    assertGh(manifest);
    await fetchAssetMeta(manifest.repo, manifest.tag, manifest.asset);
  },

  async getDownloadUrl(manifest, _ctx, _ttlSec) {
    assertGh(manifest);
    const meta = await fetchAssetMeta(manifest.repo, manifest.tag, manifest.asset);
    return meta.url;
  },

  async openReadStream(manifest, _ctx): Promise<ReadStreamResult> {
    assertGh(manifest);
    const meta = await fetchAssetMeta(manifest.repo, manifest.tag, manifest.asset);
    const res = await fetch(meta.url);
    if (!res.ok) {
      throw new Error(`GitHub asset fetch failed: ${res.status} ${meta.url}`);
    }
    if (!res.body) {
      throw new Error(`GitHub asset response has no body: ${meta.url}`);
    }
    const stream = NodeReadable.fromWeb(res.body as unknown as Parameters<typeof NodeReadable.fromWeb>[0]) as unknown as Readable;
    return {
      stream,
      size: meta.size,
      contentType: meta.contentType,
    };
  },
};

export function clearGithubAssetCache(): void {
  assetCache.clear();
}
