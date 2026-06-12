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

/**
 * Read the escrow's on-chain burn/refund deadline = paidAt + trialWindowSec
 * (A-2). The LicenseItem's burnDeadline must equal THIS, not Date.now()+window:
 * paidAt is set on-chain at PayEscrow, while the backend confirm happens later,
 * so a Date.now()-derived deadline runs PAST the escrow window — a buyer could
 * pass the item's burn gate but have the escrow reject the refund. Returns null
 * on any read failure (caller falls back to the off-chain estimate).
 */
export async function getEscrowBurnDeadline(escrowAddress: string): Promise<number | null> {
  try {
    // Variable specifier so tsc doesn't resolve the gitignored Tact build
    // artifact (resolved at runtime by tsx; matches commerce/escrow.ts).
    const modPath = '../../../contracts/build/Escrow_Escrow.js';
    const mod = (await import(modPath)) as {
      Escrow: { fromAddress(a: Address): unknown };
    };
    const opened = getTonClient().open(mod.Escrow.fromAddress(Address.parse(escrowAddress)) as never);
    const details = await (opened as {
      getDetails(): Promise<{ paidAt: bigint; trialWindowSec: bigint }>;
    }).getDetails();
    const paidAt = Number(details.paidAt);
    const trialWindowSec = Number(details.trialWindowSec);
    if (!Number.isFinite(paidAt) || paidAt <= 0 || !Number.isFinite(trialWindowSec) || trialWindowSec <= 0) {
      return null;
    }
    return paidAt + trialWindowSec;
  } catch (err) {
    logger.warn('[onchain.escrow] details read failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

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
