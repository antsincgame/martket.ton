/**
 * Live smoke Phase 0 for Agent API on local/staging backend.
 */
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
const m = raw.match(/\{[\s\S]*\}/);
if (!m) throw new Error('token file missing JSON');
const { token, wallet } = JSON.parse(m[0]);

const headers = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });

async function req(method, path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: opts.headers || headers(token),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const results = {};

results.instructions = await req('GET', '/api/v1/agent/instructions');
results.status = await req('GET', '/api/v1/agent/status');
results.adminPut = await req('PUT', '/api/v1/commerce/admin/agent-instructions/behavior', {
  headers: {
    'x-commerce-admin-secret': ADMIN,
    'Content-Type': 'application/json',
  },
  body: { title: 'Conduct', body: 'test override live verify', order: 50 },
});
results.instructionsAfterAdmin = await req('GET', '/api/v1/agent/instructions');
results.productCreate = await req('POST', '/api/v1/agent/products', {
  body: { name: 'Test draft live verify', price_usd: 1, category: 'developer-tools' },
});
results.noScope = await req('POST', '/api/v1/agent/products', {
  headers: headers('tfa_invalidtoken000000000000000000000000'),
  body: { name: 'Should fail', price_usd: 1 },
});

// Token with only instructions:read — issue inline via API management if exists
results.sections = results.instructions.data?.data?.sections?.map((s) => s.section) ?? [];
results.onboarding = results.instructions.data?.data?.onboarding ?? null;
results.productStatus = results.productCreate.data?.data?.product?.status ?? null;

console.log(JSON.stringify({ wallet, API, results: {
  instructions: { status: results.instructions.status, sections: results.sections },
  status: { status: results.status.status, keys: Object.keys(results.status.data?.data ?? {}) },
  adminPut: { status: results.adminPut.status },
  instructionsOverride: results.instructionsAfterAdmin.data?.data?.sections?.find(s => s.section === 'behavior')?.body?.includes('test override'),
  productCreate: { status: results.productCreate.status, draftStatus: results.productStatus },
  invalidToken: { status: results.noScope.status, code: results.noScope.data?.code },
}}, null, 2));
