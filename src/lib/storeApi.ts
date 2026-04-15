// Базовый URL backend (тот же, что commerce API): профили, сессии, legacy REST.
export function storeApiBaseUrl(): string {
  const raw = import.meta.env.VITE_COMMERCE_API_URL || 'http://localhost:8081';
  return raw.replace(/\/$/, '');
}

export function storeApiUrl(path: string): string {
  const base = storeApiBaseUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  if (base.endsWith('/api') && p.startsWith('/api/')) {
    return `${base}${p.slice(4)}`;
  }
  return `${base}${p}`;
}
