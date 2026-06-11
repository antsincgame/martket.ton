export function tonHumanToNanoRaw(human: string | number): string {
  const s = String(human).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('INVALID_PRICE');
  const [whole, frac = ''] = s.split('.');
  const frac9 = (frac + '000000000').slice(0, 9);
  const nano = BigInt(whole!) * 1_000_000_000n + BigInt(frac9 || '0');
  return nano.toString();
}

/**
 * Net-amount after deducting platform fee from a gross total.
 *
 * DEPRECATED: в v4 fee НЕ вычитается из seller price, а добавляется поверх
 * (fee платит buyer). Используй addFeeBps или computeOrderAmounts вместо.
 *
 * Оставлена для обратной совместимости со старым кодом; эквивалентна формуле:
 *   net = gross * (10000 - bps) / 10000
 */
export function applyFeeBps(amountRawStr: string, bps: number): string {
  const amount = BigInt(amountRawStr);
  const fee = Math.max(0, Math.min(10000, Number(bps)));
  const net = (amount * BigInt(10000 - fee)) / 10000n;
  return net.toString();
}

/**
 * Compute buyer's total payment from seller's listed price + platform fee.
 *
 * В v4 buyer платит seller_price + fee (fee поверх). Это позволяет seller
 * видеть чистый доход и не пересчитывать в уме.
 *
 * Пример: seller листит 12.5 TON, fee 1500 bps (15%)
 *   → fee = 12.5 * 0.15 = 1.875 TON
 *   → buyer платит 14.375 TON
 *   → seller получает 12.5 TON
 *   → treasury получает 1.875 TON
 */
export function addFeeBps(sellerPriceNanoStr: string, bps: number): string {
  const sellerPrice = BigInt(sellerPriceNanoStr);
  const fee = Math.max(0, Math.min(10000, Number(bps)));
  const feeAmount = (sellerPrice * BigInt(fee)) / 10000n;
  return (sellerPrice + feeAmount).toString();
}

/**
 * Полный расчёт order amounts. Принимает seller's listed price,
 * возвращает (seller_amount, fee, buyer_total).
 *
 * Все значения в nano-TON (строки чтобы не терять точность в JSON).
 */
export interface OrderAmounts {
  sellerAmountNano: string;       // Что получит seller
  feeNano: string;                // Что получит treasury
  totalAmountNano: string;        // Что buyer должен заплатить
  feeBpsApplied: number;          // Для логирования/audit
}

export function computeOrderAmounts(
  sellerPriceNanoStr: string,
  feeBps: number,
): OrderAmounts {
  const sellerPrice = BigInt(sellerPriceNanoStr);
  const bps = Math.max(0, Math.min(10000, Number(feeBps)));
  const fee = (sellerPrice * BigInt(bps)) / 10000n;
  const total = sellerPrice + fee;

  return {
    sellerAmountNano: sellerPrice.toString(),
    feeNano: fee.toString(),
    totalAmountNano: total.toString(),
    feeBpsApplied: bps,
  };
}

/**
 * The seller price an order is actually built around — the sale price when a
 * discount is active, otherwise the list price. This is the SINGLE place a
 * discount enters the money path (order amounts, escrow address, and the public
 * quote all derive from it), so applying it here keeps the whole escrow/confirm
 * chain consistent. A discount can only LOWER the seller price (validated on
 * write), never raise it or touch the platform fee.
 */
export interface SalePricingFields {
  priceAmountRaw?: string | null;
  sale_price_amount_raw?: string | null;
  sale_ends_at?: string | null;
}

export function isSaleActive(listing: SalePricingFields, now: number = Date.now()): boolean {
  const sale = (listing.sale_price_amount_raw || '').trim();
  if (!sale) return false;
  const base = String(listing.priceAmountRaw ?? '0');
  // Time window: no end → always on; an end in the past → expired.
  if (listing.sale_ends_at) {
    const ends = Date.parse(String(listing.sale_ends_at));
    if (!Number.isFinite(ends) || ends <= now) return false;
  }
  try {
    return BigInt(sale) > 0n && BigInt(sale) < BigInt(base);
  } catch {
    return false;
  }
}

export function effectiveSellerPriceRaw(listing: SalePricingFields, now: number = Date.now()): string {
  return isSaleActive(listing, now)
    ? String(listing.sale_price_amount_raw)
    : String(listing.priceAmountRaw ?? '0');
}

export function nanoRawToTonHuman(amountRawStr: string): string {
  const v = BigInt(amountRawStr);
  const whole = v / 1_000_000_000n;
  const frac = v % 1_000_000_000n;
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
  return fracStr.length ? `${whole}.${fracStr}` : whole.toString();
}

export function tonToNanoRaw(tonHuman: number): string {
  return BigInt(Math.round(tonHuman * 1_000_000_000)).toString();
}
