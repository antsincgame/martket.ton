// Базовый URL backend (тот же, что commerce API): профили, сессии, legacy REST.
export function storeApiBaseUrl(): string {
  const raw = import.meta.env.VITE_COMMERCE_API_URL || 'http://localhost:8081';
  return raw.replace(/\/$/, '');
}

export function storeApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${storeApiBaseUrl()}${p}`;
}
