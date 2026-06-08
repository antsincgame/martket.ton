/**
 * Base URL for License NFT off-chain metadata (TEP-64 content).
 *
 * Env-configurable so a placeholder/example domain is never baked into on-chain
 * license content. Set `LICENSE_METADATA_BASE_URL` to the real CDN/R2 origin in
 * each environment; the default is the TonForge CDN family used elsewhere.
 */
export function licenseMetadataBaseUrl(): string {
  return (process.env.LICENSE_METADATA_BASE_URL || 'https://cdn.tonforge.org/license-metadata').replace(/\/+$/, '');
}
