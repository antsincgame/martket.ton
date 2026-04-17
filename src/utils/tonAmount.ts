// Утилиты форматирования сумм/адресов/хэшей TON для UI кабинета.
// Изолированы от React, чтобы их можно было покрыть лёгкими unit-тестами.

/** 1 TON = 10^9 nano. Форматирует «сырое» значение в читабельную строку. */
export function nanoRawToTonHuman(raw: string): string {
  if (!raw) return '0';
  let s = raw;
  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }
  // padStart нужен, чтобы у значений < 1 TON был ведущий ноль перед точкой.
  const padded = s.padStart(10, '0');
  const intPart = padded.slice(0, padded.length - 9);
  const frac = padded.slice(padded.length - 9).replace(/0+$/, '');
  const out = frac ? `${intPart}.${frac}` : intPart;
  return negative ? `-${out}` : out;
}

/** Форматирование суммы по валюте. TON конвертируем из nano-raw, остальное — как есть. */
export function formatAmount(amountRaw: string, currency: string): string {
  if (currency === 'TON') {
    return `${nanoRawToTonHuman(amountRaw)} TON`;
  }
  return `${amountRaw} ${currency}`;
}

/** Сокращение TON-адреса (или любого длинного идентификатора) до 4…4 символов. */
export function shortAddress(addr: string | null | undefined): string {
  if (!addr) return '—';
  return addr.length <= 10 ? addr : `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

/** Сокращение Tx-хэша до 6…4 символов. */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) return '—';
  return hash.length <= 12 ? hash : `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}
