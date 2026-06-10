/**
 * Deploy script for the Escrow contract.
 *
 * Usage:
 *   npx ts-node --esm scripts/deploy.ts --network testnet
 *   npx ts-node --esm scripts/deploy.ts --network mainnet
 *
 * For MVP, escrow contracts are deployed per-order by including
 * StateInit in the buyer's TonConnect transaction. This script is
 * provided for manual deployment / testing.
 *
 * Required env:
 *   DEPLOYER_MNEMONIC - 24-word seed phrase
 */

import { Address, beginCell, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { Escrow } from '../build/Escrow_Escrow';

async function main() {
  const args = process.argv.slice(2);
  const networkFlag = args.indexOf('--network');
  const network = networkFlag >= 0 ? args[networkFlag + 1] : 'testnet';

  if (network !== 'testnet' && network !== 'mainnet') {
    console.error('--network must be "testnet" or "mainnet"');
    process.exit(1);
  }

  const mnemonic = process.env.DEPLOYER_MNEMONIC;
  if (!mnemonic) {
    console.error('Set DEPLOYER_MNEMONIC env var (24 words)');
    process.exit(1);
  }

  const keypair = await mnemonicToPrivateKey(mnemonic.split(' '));
  console.log(`Network: ${network}`);
  console.log(`Deployer public key: ${keypair.publicKey.toString('hex')}`);

  const buyer = Address.parse('EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG');
  const seller = Address.parse('EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG');
  const treasury = Address.parse('EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG');

  // Демонстрационная сделка: 1 TON = 0.85 продавцу + 0.15 комиссия (split
  // обязан совпасть с amountNano, иначе init упадёт на require). Escrow.init
  // принимает 11 параметров (v4): + trialWindowSec, collectionAddress,
  // transferLimit, licenseContent — реальный деплой делает backend per-order.
  const amount = toNano('1');
  const sellerAmount = toNano('0.85');
  const feeAmount = amount - sellerAmount;
  const collection = Address.parse('EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG');
  const licenseContent = beginCell().storeStringTail('ipfs://example-license').endCell();

  const escrow = await Escrow.fromInit(
    1n,
    buyer,
    seller,
    treasury,
    amount,
    sellerAmount,
    feeAmount,
    3600n,
    collection,
    0n,
    licenseContent,
  );

  console.log(`Escrow address: ${escrow.address.toString()}`);
  console.log(`StateInit code hash: ${escrow.init?.code?.hash().toString('hex')}`);
  console.log(`StateInit data hash: ${escrow.init?.data?.hash().toString('hex')}`);
  console.log('\nFor real deployment, the buyer sends a PayEscrow message with StateInit.');
}

main().catch(console.error);
