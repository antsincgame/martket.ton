/**
 * Deploy script for the AppCollection contract on TON testnet/mainnet.
 *
 * Usage:
 *   npx ts-node --esm scripts/deployCollection.ts \
 *     --network testnet \
 *     --app-id 1 \
 *     --metadata-uri https://cdn.example.com/tonforge/apps/1/collection.json \
 *     --item-base-uri https://cdn.example.com/tonforge/apps/1/items/
 *
 * Required env:
 *   DEPLOYER_MNEMONIC  - 24-word seed phrase of the wallet that will own the
 *                        AppCollection (this becomes the on-chain `ownerAddress`
 *                        and must match ORACLE_MNEMONIC of the backend).
 *
 * Optional env:
 *   TON_API_KEY        - toncenter API key (recommended for non-rate-limited deploy).
 *
 * Workflow:
 *   1. Loads compiled BOC from build/AppCollection.code.boc
 *   2. Computes the deterministic AppCollection address from (code, init data).
 *   3. Funds + deploys via WalletV4 + internal message with StateInit.
 *   4. Polls until the contract reports its `get_collection_data` getter.
 *   5. Prints the address + suggested env entries for the backend / DB.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Address,
  beginCell,
  Cell,
  internal,
  SendMode,
  toNano,
} from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import {
  AppCollection,
  buildOffchainContent,
} from '../src/AppCollectionWrapper';

interface CliArgs {
  network: 'testnet' | 'mainnet';
  appId: bigint;
  metadataUri: string;
  itemBaseUri: string;
  fundingTon: string;
}

function parseArgs(argv: string[]): CliArgs {
  const get = (flag: string, fallback?: string): string | undefined => {
    const i = argv.indexOf(flag);
    if (i === -1) return fallback;
    return argv[i + 1];
  };

  const network = (get('--network', 'testnet') ?? 'testnet') as 'testnet' | 'mainnet';
  const appIdRaw = get('--app-id');
  if (!appIdRaw) throw new Error('--app-id is required');
  const metadataUri = get('--metadata-uri');
  if (!metadataUri) throw new Error('--metadata-uri is required');
  const itemBaseUri = get('--item-base-uri');
  if (!itemBaseUri) throw new Error('--item-base-uri is required');
  const fundingTon = get('--fund', '0.1') ?? '0.1';

  if (network !== 'testnet' && network !== 'mainnet') {
    throw new Error(`--network must be testnet|mainnet, got ${network}`);
  }
  if (!metadataUri.startsWith('http')) {
    throw new Error('--metadata-uri must be an http(s) URL');
  }
  if (!itemBaseUri.startsWith('http')) {
    throw new Error('--item-base-uri must be an http(s) URL');
  }

  return {
    network,
    appId: BigInt(appIdRaw),
    metadataUri,
    itemBaseUri,
    fundingTon,
  };
}

async function loadCollectionCode(): Promise<Cell> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '..', 'build', 'AppCollection_AppCollection.code.boc'),
    path.resolve(here, '..', 'build', 'AppCollection.code.boc'),
  ];
  for (const candidate of candidates) {
    try {
      const buf = await fs.readFile(candidate);
      return Cell.fromBoc(buf)[0];
    } catch {
      /* try next */
    }
  }
  throw new Error(
    `AppCollection BOC not found in build/. Tried:\n  - ${candidates.join('\n  - ')}\nRun \`npm run build\` first.`,
  );
}

function endpoint(network: 'testnet' | 'mainnet'): string {
  return network === 'mainnet'
    ? 'https://toncenter.com/api/v2/jsonRPC'
    : 'https://testnet.toncenter.com/api/v2/jsonRPC';
}

async function waitForDeploy(
  client: TonClient,
  address: Address,
  attempts = 30,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    const state = await client.getContractState(address);
    if (state.state === 'active') return;
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`AppCollection ${address.toString()} did not become active in time`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const mnemonic = process.env.DEPLOYER_MNEMONIC;
  if (!mnemonic) {
    throw new Error('Set DEPLOYER_MNEMONIC env var (24 words). It must match ORACLE_MNEMONIC.');
  }

  const keypair = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey });

  console.log(`Network:           ${args.network}`);
  console.log(`Owner / oracle:    ${wallet.address.toString({ testOnly: args.network === 'testnet' })}`);
  console.log(`App ID:            ${args.appId.toString()}`);
  console.log(`Collection meta:   ${args.metadataUri}`);
  console.log(`Item base URI:     ${args.itemBaseUri}`);

  const code = await loadCollectionCode();
  const collectionContent = buildOffchainContent(args.metadataUri);
  const commonContent = beginCell().storeStringTail(args.itemBaseUri).endCell();

  const collection = AppCollection.fromInit(code, {
    appId: args.appId,
    ownerAddress: wallet.address,
    collectionContent,
    commonContent,
  });

  console.log(`\nDeterministic address: ${collection.address.toString({ testOnly: args.network === 'testnet' })}`);

  const client = new TonClient({
    endpoint: endpoint(args.network),
    apiKey: process.env.TON_API_KEY,
  });

  const existing = await client.getContractState(collection.address);
  if (existing.state === 'active') {
    console.log('Already deployed; nothing to do.');
    printSummary(args, collection.address);
    return;
  }

  const opened = client.open(wallet);
  const seqno = await opened.getSeqno();

  const deployBody = beginCell().storeUint(0x946a98b6, 32).storeUint(0, 64).endCell();

  await opened.sendTransfer({
    seqno,
    secretKey: keypair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [
      internal({
        to: collection.address,
        value: toNano(args.fundingTon),
        bounce: false,
        init: collection.init,
        body: deployBody,
      }),
    ],
  });

  console.log(`\nDeploy message sent. Waiting for activation…`);
  await waitForDeploy(client, collection.address);
  console.log('AppCollection is active on-chain.');

  printSummary(args, collection.address);
}

function printSummary(args: CliArgs, address: Address): void {
  const addr = address.toString({ testOnly: args.network === 'testnet' });
  console.log('\n──────── DEPLOY SUMMARY ────────');
  console.log(`Network:            ${args.network}`);
  console.log(`AppCollection addr: ${addr}`);
  console.log(`App ID:             ${args.appId}`);
  console.log('\nNext steps:');
  console.log(`  1. Save to DB / config:`);
  console.log(`     POST /api/tonforge/admin/apps/<appId>/collection`);
  console.log(`       {`);
  console.log(`         "appId": "<your-app-id>",`);
  console.log(`         "address": "${addr}",`);
  console.log(`         "metadataUriPrefix": "${args.itemBaseUri}"`);
  console.log(`       }`);
  console.log(`  2. Confirm backend ORACLE_MNEMONIC === DEPLOYER_MNEMONIC.`);
  console.log(`  3. Run an end-to-end purchase to mint the first License NFT.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
