/** Phase 1 live probe — seller collection provision on testnet. */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = join(root, 'backend');
dotenv.config({ path: join(backendDir, '.env.staging'), override: true });
dotenv.config({ path: join(backendDir, '.env'), override: true });

const API = process.env.VERIFY_API_URL || 'http://127.0.0.1:8081';
const ADMIN = process.env.COMMERCE_ADMIN_SECRET || '';
const raw = readFileSync(join(root, 'scripts', '.verify-token.json'), 'utf8');
const { wallet } = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);

const res = await fetch(`${API}/api/v1/commerce/admin/seller-collections/provision`, {
  method: 'POST',
  headers: {
    'x-commerce-admin-secret': ADMIN,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sellerWallet: wallet, network: 'testnet' }),
});
const data = await res.json();
console.log(JSON.stringify({ status: res.status, data, hasMnemonic: Boolean(process.env.COLLECTION_OWNER_MNEMONIC_TESTNET) }, null, 2));
