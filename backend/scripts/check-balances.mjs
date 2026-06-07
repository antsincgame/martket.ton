import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Address } from '@ton/core';
import { TonClient } from '@ton/ton';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(backendDir, '.env') });

const client = new TonClient({
  endpoint: process.env.TON_API_ENDPOINT,
  apiKey: process.env.TON_API_KEY || undefined,
});
const addrs = [
  process.env.COLLECTION_OWNER_ADDRESS_TESTNET?.replace(/"/g, ''),
  '0QCcZCSkjRaVKwj90kHQ0YLGnu7MxNDDL3Go3OrFudDsI_9Y',
];
for (const a of addrs) {
  if (!a) continue;
  const bal = await client.getBalance(Address.parse(a));
  console.log(a, (Number(bal) / 1e9).toFixed(4), 'TON');
}
