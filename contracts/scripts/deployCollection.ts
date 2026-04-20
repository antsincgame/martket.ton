/**
 * Deploy script for the AppCollection contract on TON testnet/mainnet.
 *
 * Uses Tact-autogen wrapper from build/AppCollection_AppCollection.ts to guarantee
 * exact state init layout matches what the contract expects (important for
 * deterministic address calculation).
 *
 * Usage:
 *   tsx scripts/deployCollection.ts \
 *     --network testnet \
 *     --app-id 1 \
 *     --metadata-uri https://cdn.example.com/tonforge/apps/1/collection.json \
 *     --item-base-uri https://cdn.example.com/tonforge/apps/1/items/
 *
 * Required env:
 *   DEPLOYER_MNEMONIC  - 24-word seed phrase of the wallet that will own the
 *                        AppCollection. Backend's COLLECTION_OWNER_MNEMONIC
 *                        must be set to the same value.
 *
 * Optional env:
 *   TON_API_KEY        - toncenter API key (recommended for non-rate-limited deploy).
 *
 * Workflow:
 *   1. Run `npm run build` first to regenerate autogen wrappers.
 *   2. This script imports AppCollection.fromInit(...) from build/.
 *   3. Computes the deterministic contract address.
 *   4. If not already deployed, funds + deploys via WalletV4 + Tact Deploy message.
 *   5. Polls until the contract reports its get_collection_data getter.
 *   6. Prints the address + suggested env entries for the backend.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Address,
  beginCell,
  Cell,
  toNano,
} from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';

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

/**
 * Build TEP-64 off-chain content cell: prefix 0x01 + snake string URI.
 */
function buildOffchainContent(uri: string): Cell {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
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

/**
 * Verify that the build directory exists — autogen wrapper must be present
 * before running this script.
 */
async function ensureBuildReady(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const buildPath = path.resolve(here, '..', 'build', 'AppCollection_AppCollection.ts');
  try {
    await fs.access(buildPath);
  } catch {
    throw new Error(
      `Tact autogen wrapper not found at ${buildPath}\nRun "npm run build" in contracts/ first.`,
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  await ensureBuildReady();

  const mnemonic = process.env.DEPLOYER_MNEMONIC;
  if (!mnemonic) {
    throw new Error('Set DEPLOYER_MNEMONIC env var (24 words). It must match backend\'s COLLECTION_OWNER_MNEMONIC.');
  }

  const keypair = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey });

  console.log(`Network:           ${args.network}`);
  console.log(`Owner / oracle:    ${wallet.address.toString({ testOnly: args.network === 'testnet' })}`);
  console.log(`App ID:            ${args.appId.toString()}`);
  console.log(`Collection meta:   ${args.metadataUri}`);
  console.log(`Item base URI:     ${args.itemBaseUri}`);

  // Dynamic import: autogen .ts files are not in tsconfig main paths
  // (they live in contracts/build/ and are gitignored). tsx resolves them at runtime.
  const { AppCollection } = await import('../build/AppCollection_AppCollection.js') as {
    AppCollection: {
      fromInit(
        appId: bigint,
        ownerAddress: Address,
        collectionContent: Cell,
        commonContent: Cell,
      ): Promise<{ address: Address; init: { code: Cell; data: Cell } }>;
    };
  };

  const collectionContent = buildOffchainContent(args.metadataUri);
  const commonContent = buildOffchainContent(args.itemBaseUri);

  const collection = await AppCollection.fromInit(
    args.appId,
    wallet.address,
    collectionContent,
    commonContent,
  );

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
  // @ts-expect-error getSeqno exists on WalletContractV4 but generic OpenedContract hides it
  const seqno: number = await opened.getSeqno();

  // Tact Deploy message opcode: 0x946a98b6
  const deployBody = beginCell().storeUint(0x946a98b6, 32).storeUint(0, 64).endCell();

  const { internal, SendMode } = await import('@ton/core');

  // @ts-expect-error sendTransfer exists on WalletContractV4 but generic OpenedContract hides it
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
  const envSuffix = args.network === 'testnet' ? 'TESTNET' : 'MAINNET';
  console.log('\n──────── DEPLOY SUMMARY ────────');
  console.log(`Network:            ${args.network}`);
  console.log(`AppCollection addr: ${addr}`);
  console.log(`App ID:             ${args.appId}`);
  console.log('\n──────── ENV VARIABLES FOR BACKEND ────────');
  console.log(`COLLECTION_ADDRESS_${envSuffix}="${addr}"`);
  console.log(`COLLECTION_OWNER_ADDRESS_${envSuffix}="<wallet-address-from-DEPLOYER_MNEMONIC>"`);
  console.log(`COLLECTION_OWNER_MNEMONIC_${envSuffix}="<same 24 words as DEPLOYER_MNEMONIC>"`);
  console.log('\n──────── NEXT STEPS ────────');
  console.log('  1. Set the above env variables on the backend server (Coolify/etc).');
  console.log('  2. Restart backend — mint worker will auto-start.');
  console.log('  3. Test the full flow: create listing → buy → verify mint.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
