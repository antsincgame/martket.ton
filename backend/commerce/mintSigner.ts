/**
 * Mint signer: wallet helper для подписи MintLicense транзакций от имени
 * Collection owner'а.
 *
 * SECURITY: mnemonic хранится только в памяти процесса, никогда не
 * логируется и не возвращается наружу. Передаётся в worker'е через
 * getNetworkConfig(), а туда приходит из env.
 */

import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { Address, beginCell, Cell, toNano } from '@ton/core';
import type { TonNetwork } from '../config/network.js';
import { logger } from '../logger.js';

type WalletV4 = WalletContractV4;
type OpenedWalletV4 = ReturnType<TonClient['open']> & {
  getSeqno(): Promise<number>;
  sendTransfer(args: {
    seqno: number;
    secretKey: Buffer;
    messages: ReturnType<typeof internal>[];
    timeout?: number;
  }): Promise<void>;
};

interface SignerHandle {
  client: TonClient;
  wallet: WalletV4;
  openedWallet: OpenedWalletV4;
  keyPair: Awaited<ReturnType<typeof mnemonicToPrivateKey>>;
  address: Address;
}

const signerCache = new Map<TonNetwork, SignerHandle>();

/**
 * Resolve или cache signer handle для данной сети.
 * Инициализация дорогая (mnemonic → keypair), но делается один раз на worker lifetime.
 */
export async function getSigner(
  network: TonNetwork,
  mnemonic: string,
  tonapiBase: string,
  tonapiKey: string,
): Promise<SignerHandle> {
  const cached = signerCache.get(network);
  if (cached) return cached;

  if (!mnemonic) {
    throw new Error(`COLLECTION_OWNER_MNEMONIC not configured for ${network}`);
  }

  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 24) {
    throw new Error(`Invalid mnemonic: expected 24 words, got ${words.length}`);
  }

  const keyPair = await mnemonicToPrivateKey(words);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });

  // TonAPI v2 эндпоинт для @ton/ton client. При отсутствии прямого RPC
  // используем TonAPI как proxy (они экспозят совместимый /v2/jsonRPC).
  // Для production лучше использовать свой TON-ноду или orbs-network.
  const endpoint = `${tonapiBase.replace(/\/+$/, '')}/v2/jsonRPC`;
  const client = new TonClient({
    endpoint,
    apiKey: tonapiKey || undefined,
  });

  // client.open() возвращает generic OpenedContract<T> который маскирует
  // специфические методы WalletContractV4. Приводим через двойной cast
  // к минимальному интерфейсу который мы реально используем.
  const openedWallet = client.open(wallet) as unknown as OpenedWalletV4;

  const handle: SignerHandle = {
    client,
    wallet,
    openedWallet,
    keyPair,
    address: wallet.address,
  };
  signerCache.set(network, handle);

  logger.info(`[mintSigner] initialized for ${network}: ${wallet.address.toString({ testOnly: network === 'testnet' })}`);
  return handle;
}

/**
 * Параметры MintLicense в формате контракта. Должны соответствовать
 * outgoing struct из escrow.tact (opcode 0x6a3aaa14).
 */
export interface MintLicenseArgs {
  queryId: bigint;
  orderId: bigint;
  buyerAddress: Address;
  sellerAddress: Address;
  treasuryAddress: Address;
  amountNano: bigint;
  sellerAmountNano: bigint;
  feeNano: bigint;
  trialWindowSec: bigint;
  transferLimit: bigint;
  individualContent: Cell;
  burnDeadline: bigint;
}

const OP_MINT_LICENSE = 0x6a3aaa14;

/**
 * Build body Cell для MintLicense message согласно Tact serialization rules.
 * Order и размер полей должен совпадать с `message(0x6a3aaa14) MintLicense { ... }`.
 */
export function buildMintLicenseBody(args: MintLicenseArgs): Cell {
  return beginCell()
    .storeUint(OP_MINT_LICENSE, 32)
    .storeUint(args.queryId, 64)
    .storeUint(args.orderId, 256)
    .storeAddress(args.buyerAddress)
    .storeAddress(args.sellerAddress)
    .storeAddress(args.treasuryAddress)
    .storeCoins(args.amountNano)
    .storeCoins(args.sellerAmountNano)
    .storeCoins(args.feeNano)
    .storeUint(args.trialWindowSec, 32)
    .storeUint(args.transferLimit, 8)
    .storeRef(args.individualContent)
    .storeUint(args.burnDeadline, 32)
    .endCell();
}

/**
 * Шлёт MintLicense в Collection от имени signer'а.
 * Value: 0.3 TON (покрывает deploy item + register back + excess).
 *
 * Возвращает ожидаемый seqno следующей транзакции для tracking'а.
 */
export async function sendMintLicense(
  signer: SignerHandle,
  collectionAddress: Address,
  args: MintLicenseArgs,
  valueNano: bigint = toNano('0.3'),
): Promise<{ seqno: number; msgValueNano: string }> {
  const body = buildMintLicenseBody(args);

  // Получаем текущий seqno для отправки (нужен для tracking confirmation).
  // openedWallet.getSeqno() под капотом делает runGetMethod.
  const seqno = await signer.openedWallet.getSeqno();

  await signer.openedWallet.sendTransfer({
    seqno,
    secretKey: signer.keyPair.secretKey,
    messages: [
      internal({
        to: collectionAddress,
        value: valueNano,
        bounce: true,
        body,
      }),
    ],
  });

  logger.info(`[mintSigner] MintLicense sent: orderId=${args.orderId}, seqno=${seqno}`);
  return { seqno, msgValueNano: valueNano.toString() };
}

/**
 * Utility: безопасное приведение order.$id (UUID-like) в bigint orderId
 * для on-chain. Должно совпадать с computeEscrow orderIdToBigint.
 */
export function orderIdToBigint(orderId: string): bigint {
  const hash = Buffer.from(orderId.replace(/-/g, '').padEnd(64, '0').slice(0, 64), 'hex');
  let n = 0n;
  for (let i = 0; i < 32; i++) {
    n = (n << 8n) | BigInt(hash[i]!);
  }
  return n;
}

/**
 * Build TEP-64 off-chain content Cell для individualContent.
 * Prefix 0x01 + snake string URI.
 */
export function buildLicenseContent(uri: string): Cell {
  return beginCell().storeUint(0x01, 8).storeStringTail(uri).endCell();
}
