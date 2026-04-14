export interface PurchaseWithProduct {
  id: string;
  product_id: string;
  price_ton: number;
  created_at: string;
  product: {
    id: string;
    name: string;
    image: string | null;
    creator_id: string | null;
  } | null;
}

export interface CreatedProduct {
  id: string;
  name: string;
  description: string | null;
  price_ton: number;
  category: string;
  image: string | null;
  status: string;
  downloads: number;
  rating: number;
  version: string | null;
  build_r2_key: string | null;
  build_sha256: string | null;
  build_size_bytes: number | null;
  build_filename: string | null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
