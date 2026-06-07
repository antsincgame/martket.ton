import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { Address } from '@ton/core';
import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(backendDir, '..');
dotenv.config({ path: join(backendDir, '.env') });

const buyer = JSON.parse(readFileSync(join(root, 'scripts', '.verify-e2e-buyer.json'), 'utf8')).mnemonic;
const buyerKp = await mnemonicToPrivateKey(buyer.split(/\s+/));
const buyerWallet = WalletContractV4.create({ workchain: 0, publicKey: buyerKp.publicKey });
const buyerAddr = buyerWallet.address.toString({ testOnly: true, bounceable: false });

const ownerMnemonic = process.env.COLLECTION_OWNER_MNEMONIC_TESTNET.replace(/"/g, '');
const ownerKp = await mnemonicToPrivateKey(ownerMnemonic.split(/\s+/));
const ownerWallet = WalletContractV4.create({ workchain: 0, publicKey: ownerKp.publicKey });
const client = new TonClient({
  endpoint: process.env.TON_API_ENDPOINT,
  apiKey: process.env.TON_API_KEY || undefined,
});
const opened = client.open(ownerWallet);

const seqnoBefore = await opened.getSeqno();
console.log('owner seqno before', seqnoBefore);
await opened.sendTransfer({
  seqno: seqnoBefore,
  secretKey: ownerKp.secretKey,
  messages: [internal({ to: buyerWallet.address, value: 1_500_000_000n, bounce: false })],
});

for (let i = 0; i < 30; i += 1) {
  await new Promise((r) => setTimeout(r, 3_000));
  const seqno = await opened.getSeqno();
  const bal = await client.getBalance(buyerWallet.address);
  console.log(`tick ${i}: seqno=${seqno} buyer=${Number(bal) / 1e9} TON`);
  if (seqno > seqnoBefore && bal >= 1_000_000_000n) break;
}
