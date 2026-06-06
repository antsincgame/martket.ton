/**
 * Собирает backend/.env.staging из env и agent-transcripts (Appwrite staging).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'backend', '.env.staging');

function fromTranscript(varName) {
  const dir = join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.cursor',
    'projects',
    'c-Users-OneDrive-Desktop-market-martket-ton-1',
    'agent-transcripts',
  );
  if (!existsSync(dir)) return '';

  const files = [];
  function walk(p) {
    for (const entry of readdirSync(p, { withFileTypes: true })) {
      const full = join(p, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.jsonl')) files.push(full);
    }
  }
  try {
    walk(dir);
  } catch {
    return '';
  }

  const re = new RegExp(`${varName}=['"]([^'"]+)['"]`, 'g');
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const m = re.exec(text);
    if (m?.[1]) return m[1];
    re.lastIndex = 0;
  }
  return '';
}

function main() {
  const endpoint =
    process.env.APPWRITE_ENDPOINT?.trim() ||
    'https://appwrite.vibecoding.by/v1';
  const projectId =
    process.env.APPWRITE_PROJECT_ID?.trim() ||
    fromTranscript('APPWRITE_PROJECT_ID') ||
    '69d76ede001aae3bd4d7';
  const apiKey =
    process.env.APPWRITE_API_KEY?.trim() || fromTranscript('APPWRITE_API_KEY');

  if (!apiKey) {
    console.error('APPWRITE_API_KEY не найден');
    process.exit(1);
  }

  const commerceSecret =
    process.env.COMMERCE_ADMIN_SECRET?.trim() ||
    randomBytes(24).toString('hex');

  const lines = [
    '# auto-generated for live verify — gitignored',
    `APPWRITE_ENDPOINT=${endpoint}`,
    `APPWRITE_PROJECT_ID=${projectId}`,
    `APPWRITE_API_KEY=${apiKey}`,
    `COMMERCE_ADMIN_SECRET=${commerceSecret}`,
    `CORS_ORIGIN=http://127.0.0.1:8081`,
    `PORT=8081`,
    `TON_NETWORK=testnet`,
    `TON_API_ENDPOINT=https://testnet.toncenter.com/api/v2/jsonRPC`,
  ];

  for (const k of [
    'TON_API_KEY',
    'COLLECTION_OWNER_MNEMONIC_TESTNET',
    'COLLECTION_OWNER_ADDRESS_TESTNET',
    'TREASURY_WALLET_ADDRESS_TESTNET',
    'COLLECTION_METADATA_BASE',
  ]) {
    const v = process.env[k]?.trim();
    if (v) lines.push(`${k}=${v}`);
  }

  writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${outPath}`);
  console.log(`COMMERCE_ADMIN_SECRET=${commerceSecret}`);
}

main();
