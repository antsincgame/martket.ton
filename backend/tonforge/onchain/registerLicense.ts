import { Address, internal, SendMode } from '@ton/core';
import { logger } from '../../logger.js';
import { loadOnchainConfig } from './config.js';
import { getOracleWallet } from './oracleWallet.js';
import { buildRegisterLicensePayload } from './contractSchemas.js';

export interface RegisterLicenseInput {
  escrowAddress: string;
  licenseAddress: string;
}

export interface RegisterLicenseResult {
  txSeqno: number;
}

/**
 * Oracle sends RegisterLicense to the Escrow, binding the deployed
 * LicenseItem so the escrow knows which NFT can trigger a refund.
 * Must be called after mint is confirmed on-chain.
 */
export async function registerLicense(input: RegisterLicenseInput): Promise<RegisterLicenseResult> {
  const cfg = loadOnchainConfig();
  if (!cfg.enabled) {
    throw new Error('ONCHAIN_DISABLED');
  }

  const escrow = Address.parse(input.escrowAddress);
  const license = Address.parse(input.licenseAddress);

  const payload = buildRegisterLicensePayload(license);

  const oracle = await getOracleWallet();
  const seqno = await oracle.wallet.getSeqno();
  await oracle.wallet.sendTransfer({
    seqno,
    secretKey: oracle.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [
      internal({
        to: escrow,
        value: 50_000_000n,
        bounce: true,
        body: payload,
      }),
    ],
  });

  logger.info(
    `[onchain.register] sent RegisterLicense escrow=${escrow.toString()} license=${license.toString()}`,
  );

  return { txSeqno: seqno };
}
