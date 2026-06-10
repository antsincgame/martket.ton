/**
 * Развёртывание БД Appwrite для витрины: database marketplace + коллекции + атрибуты + индексы + сид из marketplace-seed.json.
 * Требуется API key с правами databases.* (Console → Project → API keys).
 *
 * env: APPWRITE_ENDPOINT (или VITE_APPWRITE_ENDPOINT), APPWRITE_PROJECT_ID (или VITE_APPWRITE_PROJECT_ID), APPWRITE_API_KEY
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Client, Databases, IndexType, Permission, Role } from 'node-appwrite';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? process.env.VITE_APPWRITE_ENDPOINT ?? '';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? process.env.VITE_APPWRITE_PROJECT_ID ?? '';
const API_KEY = process.env.APPWRITE_API_KEY ?? '';

const DATABASE_ID = 'marketplace';
const COL_CATEGORIES = 'categories';
const COL_PRODUCTS = 'products';
const COL_REVIEWS = 'reviews';

const READ_ANY = [Permission.read(Role.any())];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {() => Promise<unknown>} fn
 */
async function ignoreConflict(fn) {
  try {
    await fn();
  } catch (error) {
    if (error.code !== 409) throw error;
  }
}

/**
 * @param {InstanceType<typeof Databases>} databases
 * @param {string} collectionId
 * @param {string} key
 */
async function waitForAttribute(databases, collectionId, key) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const attr = await databases.getAttribute(DATABASE_ID, collectionId, key);
    if (attr.status === 'available') return;
    if (attr.status === 'failed') throw new Error(`Атрибут ${collectionId}.${key}: ${attr.error}`);
    await sleep(1000);
  }
  throw new Error(`Таймаут ожидания атрибута ${collectionId}.${key}`);
}

/**
 * @param {InstanceType<typeof Databases>} databases
 */
async function ensureDatabase(databases) {
  try {
    await databases.create(DATABASE_ID, 'TON Marketplace', true);
    console.log('[appwrite] Создана БД marketplace');
  } catch (error) {
    if (error.code === 409) console.log('[appwrite] БД marketplace уже существует');
    else throw error;
  }
}

/**
 * @param {InstanceType<typeof Databases>} databases
 */
async function ensureCollection(databases, collectionId, name) {
  try {
    await databases.createCollection(DATABASE_ID, collectionId, name, READ_ANY, false, true);
    console.log(`[appwrite] Коллекция ${collectionId} создана`);
  } catch (error) {
    if (error.code === 409) console.log(`[appwrite] Коллекция ${collectionId} уже есть`);
    else throw error;
  }
}

/**
 * @param {InstanceType<typeof Databases>} databases
 */
async function setupCategories(databases) {
  await ensureCollection(databases, COL_CATEGORIES, 'Categories');
  await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, COL_CATEGORIES, 'slug', 64, true));
  await waitForAttribute(databases, COL_CATEGORIES, 'slug');
  await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, COL_CATEGORIES, 'title', 255, true));
  await waitForAttribute(databases, COL_CATEGORIES, 'title');
  await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, COL_CATEGORIES, 'description', 8000, true));
  await waitForAttribute(databases, COL_CATEGORIES, 'description');
  await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, COL_CATEGORIES, 'emoji', 16, true));
  await waitForAttribute(databases, COL_CATEGORIES, 'emoji');
  await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, COL_CATEGORIES, 'gradient', 255, true));
  await waitForAttribute(databases, COL_CATEGORIES, 'gradient');
  await ignoreConflict(() => databases.createIntegerAttribute(DATABASE_ID, COL_CATEGORIES, 'sortOrder', true));
  await waitForAttribute(databases, COL_CATEGORIES, 'sortOrder');
}

/**
 * @param {InstanceType<typeof Databases>} databases
 */
async function setupProducts(databases) {
  await ensureCollection(databases, COL_PRODUCTS, 'Products');
  const stringAttrs = [
    ['name', 255, true],
    ['description', 8000, true],
    ['longDescription', 24000, true],
    ['categoryLabel', 64, true],
    ['categorySlug', 32, true],
    ['developer', 255, true],
    ['version', 64, true],
    ['size', 64, true],
    ['requirements', 4000, true],
    ['lastUpdated', 32, true],
  ];
  for (const [key, size, required] of stringAttrs) {
    await ignoreConflict(() =>
      databases.createStringAttribute(DATABASE_ID, COL_PRODUCTS, key, size, required)
    );
    await waitForAttribute(databases, COL_PRODUCTS, key);
  }
  await ignoreConflict(() => databases.createUrlAttribute(DATABASE_ID, COL_PRODUCTS, 'image', true));
  await waitForAttribute(databases, COL_PRODUCTS, 'image');
  await ignoreConflict(() => databases.createFloatAttribute(DATABASE_ID, COL_PRODUCTS, 'price', true));
  await waitForAttribute(databases, COL_PRODUCTS, 'price');
  await ignoreConflict(() => databases.createFloatAttribute(DATABASE_ID, COL_PRODUCTS, 'rating', true));
  await waitForAttribute(databases, COL_PRODUCTS, 'rating');
  await ignoreConflict(() => databases.createIntegerAttribute(DATABASE_ID, COL_PRODUCTS, 'downloads', true));
  await waitForAttribute(databases, COL_PRODUCTS, 'downloads');
  await ignoreConflict(() => databases.createBooleanAttribute(DATABASE_ID, COL_PRODUCTS, 'isFeatured', true));
  await waitForAttribute(databases, COL_PRODUCTS, 'isFeatured');
  await ignoreConflict(() => databases.createFloatAttribute(DATABASE_ID, COL_PRODUCTS, 'donationAmount', false));
  await waitForAttribute(databases, COL_PRODUCTS, 'donationAmount');
  await ignoreConflict(() =>
    databases.createIntegerAttribute(DATABASE_ID, COL_PRODUCTS, 'reviewStatsCount', true)
  );
  await waitForAttribute(databases, COL_PRODUCTS, 'reviewStatsCount');
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_PRODUCTS, 'images', 2048, true, undefined, true)
  );
  await waitForAttribute(databases, COL_PRODUCTS, 'images');
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_PRODUCTS, 'platforms', 128, true, undefined, true)
  );
  await waitForAttribute(databases, COL_PRODUCTS, 'platforms');
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_PRODUCTS, 'tags', 256, true, undefined, true)
  );
  await waitForAttribute(databases, COL_PRODUCTS, 'tags');
}

/**
 * @param {InstanceType<typeof Databases>} databases
 */
async function setupReviews(databases) {
  await ensureCollection(databases, COL_REVIEWS, 'Reviews');
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_REVIEWS, 'productId', 64, true)
  );
  await waitForAttribute(databases, COL_REVIEWS, 'productId');
  await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, COL_REVIEWS, 'author', 255, true));
  await waitForAttribute(databases, COL_REVIEWS, 'author');
  await ignoreConflict(() => databases.createFloatAttribute(DATABASE_ID, COL_REVIEWS, 'rating', true));
  await waitForAttribute(databases, COL_REVIEWS, 'rating');
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_REVIEWS, 'comment', 12000, true)
  );
  await waitForAttribute(databases, COL_REVIEWS, 'comment');
  await ignoreConflict(() => databases.createIntegerAttribute(DATABASE_ID, COL_REVIEWS, 'helpful', true));
  await waitForAttribute(databases, COL_REVIEWS, 'helpful');
  await ignoreConflict(() =>
    databases.createStringAttribute(DATABASE_ID, COL_REVIEWS, 'reviewDate', 32, true)
  );
  await waitForAttribute(databases, COL_REVIEWS, 'reviewDate');
  // Verified-buyer write-path (one review per buyer per product, moderation).
  await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, COL_REVIEWS, 'buyerWallet', 128, false));
  await waitForAttribute(databases, COL_REVIEWS, 'buyerWallet');
  await ignoreConflict(() => databases.createBooleanAttribute(DATABASE_ID, COL_REVIEWS, 'verified', false, false));
  await waitForAttribute(databases, COL_REVIEWS, 'verified');
  await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, COL_REVIEWS, 'status', 16, false, 'visible'));
  await waitForAttribute(databases, COL_REVIEWS, 'status');
  await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, COL_REVIEWS, 'moderator_id', 64, false));
  await waitForAttribute(databases, COL_REVIEWS, 'moderator_id');
  await ignoreConflict(() => databases.createStringAttribute(DATABASE_ID, COL_REVIEWS, 'moderation_reason', 1000, false));
  await waitForAttribute(databases, COL_REVIEWS, 'moderation_reason');
  await ignoreConflict(() => databases.createDatetimeAttribute(DATABASE_ID, COL_REVIEWS, 'moderated_at', false));
  await waitForAttribute(databases, COL_REVIEWS, 'moderated_at');
}

/**
 * @param {InstanceType<typeof Databases>} databases
 */
async function setupIndexes(databases) {
  const defs = [
    [COL_PRODUCTS, 'idx_category_slug', IndexType.Key, ['categorySlug']],
    [COL_PRODUCTS, 'idx_featured', IndexType.Key, ['isFeatured']],
    [COL_REVIEWS, 'idx_review_product', IndexType.Key, ['productId']],
    [COL_REVIEWS, 'uniq_review_buyer_product', IndexType.Unique, ['productId', 'buyerWallet']],
    [COL_CATEGORIES, 'idx_category_slug_unique', IndexType.Unique, ['slug']],
  ];
  for (const [collectionId, key, type, attributes] of defs) {
    try {
      await databases.createIndex(DATABASE_ID, collectionId, key, type, attributes);
      console.log(`[appwrite] Индекс ${collectionId}.${key}`);
    } catch (error) {
      if (error.code === 409) console.log(`[appwrite] Индекс ${collectionId}.${key} уже есть`);
      else throw error;
    }
  }
}

/**
 * @param {InstanceType<typeof Databases>} databases
 * @param {string} documentId
 * @param {Record<string, unknown>} data
 */
async function upsertDocument(databases, collectionId, documentId, data) {
  try {
    await databases.createDocument(DATABASE_ID, collectionId, documentId, data);
    console.log(`[appwrite] Документ ${collectionId}/${documentId}`);
  } catch (error) {
    if (error.code === 409) {
      await databases.updateDocument(DATABASE_ID, collectionId, documentId, data);
      console.log(`[appwrite] Обновлён ${collectionId}/${documentId}`);
    } else throw error;
  }
}

function loadSeed() {
  const path = join(__dirname, 'marketplace-seed.json');
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
    console.error(
      'Задайте APPWRITE_ENDPOINT (или VITE_APPWRITE_ENDPOINT), APPWRITE_PROJECT_ID (или VITE_APPWRITE_PROJECT_ID), APPWRITE_API_KEY'
    );
    process.exit(1);
  }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new Databases(client);

  await ensureDatabase(databases);
  await setupCategories(databases);
  await setupProducts(databases);
  await setupReviews(databases);
  await setupIndexes(databases);

  const seed = loadSeed();
  for (const row of seed.categories) {
    const { id, ...data } = row;
    await upsertDocument(databases, COL_CATEGORIES, id, data);
  }
  for (const row of seed.products) {
    const { id, ...data } = row;
    await upsertDocument(databases, COL_PRODUCTS, id, data);
  }
  for (const row of seed.reviews) {
    const { id, ...data } = row;
    await upsertDocument(databases, COL_REVIEWS, id, data);
  }

  console.log('[appwrite] Готово. Во фронте задайте VITE_APPWRITE_ENDPOINT и VITE_APPWRITE_PROJECT_ID.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
