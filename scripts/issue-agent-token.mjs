/**
 * Одноразовая выдача agent PAT + сид seller_profiles (kyc approved) для live verify.
 * Usage: node --import tsx scripts/issue-agent-token.mjs [EQ...wallet]
 */
import { writeFileSync } from 'fs';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = join(root, 'backend');
dotenv.config({ path: join(backendDir, '.env.staging'), override: true });
dotenv.config({ path: join(backendDir, '.env'), override: true });

const walletArg = process.argv.find((a) => a.startsWith('EQ') || a.startsWith('UQ') || a.startsWith('0:'));
const TEST_WALLET =
  walletArg ||
  process.env.VERIFY_SELLER_WALLET ||
  'EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t';

const { issueToken } = await import('../backend/agent/tokenIssuer.js');
const { databases, ID, Query } = await import('../backend/commerce/appwrite.js');
const { DATABASE_ID, COL_SELLER_PROFILES } = await import('../backend/commerce/constants.js');
const { findUserByTonAddress } = await import('../backend/core/profileRepository.js');
const { CORE_DATABASE_ID, COL_PROFILES } = await import('../backend/core/constants.js');
const { generateId } = await import('../backend/core/generateId.js');

async function ensureSellerProfile(wallet) {
  const db = databases();
  const { documents } = await db.listDocuments(DATABASE_ID, COL_SELLER_PROFILES, [
    Query.equal('wallet', wallet),
    Query.limit(1),
  ]);
  if (documents.length > 0) {
    const doc = documents[0];
    if (doc['kyc_status'] !== 'approved') {
      await db.updateDocument(DATABASE_ID, COL_SELLER_PROFILES, doc.$id, { kyc_status: 'approved' });
    }
    return;
  }
  await db.createDocument(DATABASE_ID, COL_SELLER_PROFILES, ID.unique(), {
    wallet,
    kyc_status: 'approved',
    displayName: 'Live Verify Agent',
  });
}

async function ensureCatalogProfile(wallet) {
  const existing = await findUserByTonAddress(wallet);
  if (existing) return existing;
  const id = generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_PROFILES, id, {
    ton_address: wallet,
    name: 'Live Verify Agent',
    display_name: 'Live Verify Agent',
    role: 'demiurge',
    slug: `agent-${Date.now().toString(36)}`,
    is_active: true,
    security_level: 'low',
  });
  return findUserByTonAddress(wallet);
}

await ensureSellerProfile(TEST_WALLET);
await ensureCatalogProfile(TEST_WALLET);

const { plaintext } = await issueToken({
  wallet: TEST_WALLET,
  name: 'live-verify',
  scopes: [
    'instructions:read',
    'products:write',
    'listings:read',
    'listings:write',
    'orders:read',
    'distribution:write',
  ],
  ttlDays: 7,
});

const out = { wallet: TEST_WALLET, token: plaintext };
writeFileSync(join(root, 'scripts', '.verify-token.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ wallet: TEST_WALLET, tokenPrefix: `${plaintext.slice(0, 12)}…` }));
