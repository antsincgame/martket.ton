// payoutsRepository — реестр выплат и транзакций для Demiurge wallet.
//
// На текущем этапе on-chain payout-cycle ещё не реализован, поэтому модуль
// строит «честную» проекцию из существующих purchases:
//   - transactions  — каждая покупка любого продукта автора как credit-event
//   - payouts       — агрегированные суммы за календарный месяц (1 group / month)
// Когда подключим commerce orders + treasury, заменим источник на реальные
// `withdrawal` записи. Контракт API сохранится.
import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, COL_PURCHASES } from './constants.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';
import { aggregatePayouts } from './payoutsHelpers.js';

export interface TransactionRow {
  id: string;
  type: 'sale' | 'payout' | 'refund';
  productId: string | null;
  productName: string | null;
  buyerId: string | null;
  amountTon: number;
  txHash: string | null;
  status: 'completed' | 'pending';
  createdAt: string;
}

export interface PayoutGroup {
  /** ISO date string `YYYY-MM-01` для группировки. */
  month: string;
  totalTon: number;
  salesCount: number;
}

export interface PayoutsLedger {
  totals: { lifetimeTon: number; thisMonthTon: number; salesAllTime: number };
  payouts: PayoutGroup[];
}

const DEFAULT_TX_LIMIT = 100;

export async function fetchTransactions(profileId: string, limit = DEFAULT_TX_LIMIT): Promise<TransactionRow[]> {
  const products = await listProductsByCreator(profileId);
  const productIds = products.map((p) => p.$id);
  if (productIds.length === 0) return [];
  const productNameById = new Map(productIds.map((id, idx) => [id, (products[idx]['name'] as string) ?? id]));

  const sales = await listPurchasesForProducts(productIds, limit);
  return sales
    .map<TransactionRow>((s) => ({
      id: s.$id,
      type: 'sale',
      productId: (s['product_id'] as string) ?? null,
      productName: productNameById.get((s['product_id'] as string) ?? '') ?? null,
      buyerId: (s['user_id'] as string) ?? null,
      amountTon: (s['price_ton'] as number) ?? 0,
      txHash: (s['tx_hash'] as string) ?? null,
      status: 'completed',
      createdAt: s.$createdAt,
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function fetchPayouts(profileId: string): Promise<PayoutsLedger> {
  const transactions = await fetchTransactions(profileId, 5000);
  return aggregatePayouts(transactions);
}

async function listProductsByCreator(profileId: string): Promise<AppwriteDoc[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, [
    Query.equal('creator_id', profileId),
    Query.limit(5000),
  ]);
  return res.documents.map((d) => asDoc(d));
}

async function listPurchasesForProducts(productIds: string[], limit: number): Promise<AppwriteDoc[]> {
  const out: AppwriteDoc[] = [];
  const CHUNK = 100;
  for (let i = 0; i < productIds.length; i += CHUNK) {
    const slice = productIds.slice(i, i + CHUNK);
    const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PURCHASES, [
      Query.equal('product_id', slice),
      Query.orderDesc('$createdAt'),
      Query.limit(Math.min(limit, 5000)),
    ]);
    for (const d of res.documents) out.push(asDoc(d));
  }
  return out;
}
