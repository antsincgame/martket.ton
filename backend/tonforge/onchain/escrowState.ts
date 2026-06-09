import { Address } from '@ton/core';
import { logger } from '../../logger.js';
import { getTonClient } from './tonClient.js';

/**
 * Чтение/ожидание саморегистрации LicenseItem в Escrow.
 *
 * Escrow.RegisterLicense требует sender() == licenseAddress, поэтому
 * регистрацию выполняет САМ LicenseItem при минте, а не oracle (см. R1 в
 * аудите — oracle-RegisterLicense гарантированно баунсится). Эти функции
 * лишь ПОДТВЕРЖДАЮТ регистрацию, читая геттер license_address эскроу.
 */

export async function getEscrowLicenseAddress(escrowAddress: string): Promise<string | null> {
  try {
    const client = getTonClient();
    const addr = Address.parse(escrowAddress);
    const res = await client.runMethod(addr, 'license_address');
    return res.stack.readAddress().toString();
  } catch (err) {
    logger.warn(
      '[onchain.escrow] license_address read failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export interface PollLicenseRegisteredOpts {
  escrowAddress: string;
  licenseAddress: string;
  /** Общее время ожидания, мс; по умолчанию 45с. */
  timeoutMs?: number;
  /** Интервал опроса, мс; по умолчанию 3с. */
  intervalMs?: number;
}

/**
 * Ждёт, пока эскроу не зарегистрирует ИМЕННО этот licenseAddress.
 * Возвращает true при подтверждении, false по таймауту (вызывающий
 * повторит на следующем тике — NFT уже у покупателя).
 */
export async function pollLicenseRegistered(opts: PollLicenseRegisteredOpts): Promise<boolean> {
  const timeout = opts.timeoutMs ?? 45_000;
  const interval = opts.intervalMs ?? 3_000;
  const deadline = Date.now() + timeout;
  const expected = Address.parse(opts.licenseAddress);
  const escrow = Address.parse(opts.escrowAddress);
  const client = getTonClient();

  while (Date.now() < deadline) {
    try {
      const res = await client.runMethod(escrow, 'license_address');
      const got = res.stack.readAddress();
      if (got && got.equals(expected)) return true;
    } catch (err) {
      logger.warn(
        '[onchain.escrow] pollLicenseRegistered attempt failed:',
        err instanceof Error ? err.message : err,
      );
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}
