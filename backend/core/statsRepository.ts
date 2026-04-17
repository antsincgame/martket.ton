// statsRepository — сводная статистика для Demiurge cabinet Overview.
// Источник данных: legacy products (downloads, status, rating, reviewsCount)
// + purchases (как income proxy: суммируем price_ton за последние 30 дней).
//
// Подход осознанно «честный, но скромный»: пока on-chain эскроу не интегрирован
// сюда, мы не выдумываем revenue из ничего, а считаем по факту записанных
// покупок. Когда подключим commerce orders → сюда добавим join по продавцу.
import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, COL_PURCHASES } from './constants.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';

export interface SessionStats {
  /** Загрузки по всем опубликованным продуктам автора. */
  downloadsTotal: number;
  /** Сумма purchase.price_ton за все продукты автора (без временного фильтра). */
  revenueTotal: number;
  /** Сумма purchase.price_ton за продукты автора за последние 30 дней. */
  revenue30d: number;
  /** Кол-во купленных в течение последних 30 дней копий. */
  sales30d: number;
  /** Опубликованных продуктов. */
  productsPublished: number;
  /** Ожидающих модерации. */
  pendingReview: number;
  /** Черновиков. */
  drafts: number;
  /** Снятых с продажи. */
  suspended: number;
  /** Среднее значение product.rating среди опубликованных (0 — если нет). */
  avgRating: number;
  /** Сумма product.reviews_count среди опубликованных. */
  reviewsTotal: number;
  /** Кол-во купленных автором продуктов (его «библиотека»). */
  librarySize: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function fetchSessionStats(profileId: string): Promise<SessionStats> {
  const [products, ownedPurchases] = await Promise.all([
    listOwnedProducts(profileId),
    listPurchasesByUser(profileId),
  ]);

  const productIds = products.map((p) => p.$id);
  const productSales = productIds.length > 0 ? await listPurchasesForProducts(productIds) : [];

  const salesAgg = aggregateSales(productSales);
  const productAgg = aggregateProducts(products);

  return {
    ...salesAgg,
    ...productAgg,
    librarySize: ownedPurchases.length,
  };
}

function aggregateSales(sales: AppwriteDoc[]) {
  const cutoff = Date.now() - 30 * MS_PER_DAY;
  let revenue30d = 0;
  let sales30d = 0;
  let revenueTotal = 0;
  for (const sale of sales) {
    const price = (sale['price_ton'] as number) ?? 0;
    revenueTotal += price;
    const created = Date.parse(sale.$createdAt);
    if (Number.isFinite(created) && created >= cutoff) {
      revenue30d += price;
      sales30d += 1;
    }
  }
  return { revenueTotal: round2(revenueTotal), revenue30d: round2(revenue30d), sales30d };
}

function aggregateProducts(products: AppwriteDoc[]) {
  let downloadsTotal = 0;
  let productsPublished = 0;
  let pendingReview = 0;
  let drafts = 0;
  let suspended = 0;
  let ratingSum = 0;
  let ratingDenominator = 0;
  let reviewsTotal = 0;

  for (const p of products) {
    downloadsTotal += (p['downloads'] as number) ?? 0;
    const status = (p['status'] as string) ?? 'draft';
    if (status === 'published') productsPublished++;
    else if (status === 'pending_review') pendingReview++;
    else if (status === 'draft') drafts++;
    else if (status === 'suspended') suspended++;
    if (status === 'published') {
      const rating = (p['rating'] as number) ?? 0;
      if (rating > 0) { ratingSum += rating; ratingDenominator += 1; }
      reviewsTotal += (p['reviews_count'] as number) ?? 0;
    }
  }

  return {
    downloadsTotal,
    productsPublished,
    pendingReview,
    drafts,
    suspended,
    avgRating: ratingDenominator > 0 ? round2(ratingSum / ratingDenominator) : 0,
    reviewsTotal,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function listOwnedProducts(profileId: string): Promise<AppwriteDoc[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, [
    Query.equal('creator_id', profileId),
    Query.limit(5000),
  ]);
  return res.documents.map((d) => asDoc(d));
}

async function listPurchasesByUser(profileId: string): Promise<AppwriteDoc[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PURCHASES, [
    Query.equal('user_id', profileId),
    Query.limit(5000),
  ]);
  return res.documents.map((d) => asDoc(d));
}

async function listPurchasesForProducts(productIds: string[]): Promise<AppwriteDoc[]> {
  // Appwrite Query.equal accepts arrays; chunk to 100 per request to be safe.
  const out: AppwriteDoc[] = [];
  const CHUNK = 100;
  for (let i = 0; i < productIds.length; i += CHUNK) {
    const slice = productIds.slice(i, i + CHUNK);
    const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PURCHASES, [
      Query.equal('product_id', slice),
      Query.limit(5000),
    ]);
    for (const d of res.documents) out.push(asDoc(d));
  }
  return out;
}
