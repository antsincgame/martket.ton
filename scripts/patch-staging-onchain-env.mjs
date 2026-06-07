/**
 * Дополняет backend/.env* BOC-ами контрактов, ORACLE (= COLLECTION_OWNER) и treasury.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'contracts', 'build');

function bocBase64(name) {
  const path = join(buildDir, name);
  return readFileSync(path).toString('base64');
}

const appCollectionBoc = bocBase64('AppCollection_AppCollection.code.boc');
const licenseItemBoc = bocBase64('LicenseItem_LicenseItem.code.boc');

function patchFile(filePath) {
  let text = readFileSync(filePath, 'utf8');
  const lines = text.split('\n').filter((l) => {
    const k = l.split('=')[0];
    return ![
      'APP_COLLECTION_CODE_BOC',
      'LICENSE_NFT_ITEM_CODE_BOC',
      'ORACLE_MNEMONIC',
      'TREASURY_WALLET_ADDRESS_TESTNET',
      'TREASURY_WALLET_ADDRESS',
      'MINT_TICK_MS',
    ].includes(k);
  });

  const ownerMnemonic = text.match(/COLLECTION_OWNER_MNEMONIC_TESTNET="([^"]+)"/)?.[1] || '';
  const ownerAddress = text.match(/COLLECTION_OWNER_ADDRESS_TESTNET="([^"]+)"/)?.[1] || '';

  lines.push(`APP_COLLECTION_CODE_BOC=${appCollectionBoc}`);
  lines.push(`LICENSE_NFT_ITEM_CODE_BOC=${licenseItemBoc}`);
  if (ownerMnemonic) lines.push(`ORACLE_MNEMONIC="${ownerMnemonic}"`);
  if (ownerAddress) {
    lines.push(`TREASURY_WALLET_ADDRESS_TESTNET="${ownerAddress}"`);
    lines.push(`TREASURY_WALLET_ADDRESS="${ownerAddress}"`);
  }
  lines.push('MINT_TICK_MS=15000');

  writeFileSync(filePath, `${lines.join('\n').trimEnd()}\n`, 'utf8');
  console.log(`Patched ${filePath}`);
}

for (const rel of ['backend/.env.staging', 'backend/.env']) {
  patchFile(join(root, rel));
}
