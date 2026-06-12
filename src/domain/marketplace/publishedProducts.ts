import { apiFetch } from '../../lib/api';
import { logger } from '../../lib/logger';
import type { CatalogListingProduct } from './types';

/**
 * Bridge between the seller-facing product API (core.legacy_products, served by
 * GET /api/products) and the public storefront catalog (CatalogListingProduct).
 *
 * H-9: published seller products lived only behind /api/products and never
 * reached the storefront, which read a SEPARATE marketplace.products collection.
 * This pulls the published products and maps them into the catalog shape so they
 * actually appear. It is intentionally defensive — a malformed row is skipped
 * rather than rendered as a broken card, and any transport error is swallowed by
 * the caller (storefront falls back to its existing sources).
 */

interface ApiProduct {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  short_description?: unknown;
  price_usd?: unknown;
  category?: unknown;
  image?: unknown;
  rating?: unknown;
  reviews_count?: unknown;
  downloads?: unknown;
  created_at?: unknown;
  creator_name?: unknown;
}

const FALLBACK_IMAGE = '/app-icon.svg';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function mapApiProduct(p: ApiProduct): CatalogListingProduct | null {
  const id = str(p.id);
  const name = str(p.name);
  if (!id || !name) return null; // skip rows that can't render a meaningful card
  const priceUsd = num(p.price_usd);
  return {
    id,
    name,
    description: str(p.short_description) || str(p.description) || '',
    price: priceUsd ?? 0,
    priceUsd,
    rating: num(p.rating) ?? 0,
    downloads: num(p.downloads) ?? 0,
    image: str(p.image) || FALLBACK_IMAGE,
    category: str(p.category) || 'other',
    developer: str(p.creator_name) || 'Demiurge',
    isFeatured: false,
    reviewCount: num(p.reviews_count),
    releaseDate: str(p.created_at) || undefined,
  };
}

export async function fetchPublishedCatalogProducts(): Promise<CatalogListingProduct[]> {
  const res = await apiFetch<{ success: boolean; data: ApiProduct[] }>('/products');
  if (!res?.success || !Array.isArray(res.data)) return [];
  const out: CatalogListingProduct[] = [];
  for (const row of res.data) {
    const mapped = mapApiProduct(row);
    if (mapped) out.push(mapped);
  }
  logger.info(`[marketplace] Loaded ${out.length} published products from API`);
  return out;
}
