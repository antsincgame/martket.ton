import geoip from 'geoip-lite';
import { logger } from '../logger.js';
import { getTonUsdPrice } from '../commerce/tonPriceOracle.js';
import { insertLedgerEntry, type InsertLedgerParams } from './ledgerRepository.js';
import type { Jurisdiction, ComplianceStatus, LedgerEntry } from '../domain/types.js';

const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

export function lookupCountryByIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const cleaned = ip.replace(/^::ffff:/, '');
  const geo = geoip.lookup(cleaned);
  return geo?.country ?? null;
}

export function classifyJurisdiction(buyerCountry: string | null, sellerCountry: string | null): Jurisdiction {
  if (buyerCountry === 'US' || sellerCountry === 'US') return 'US';
  if ((buyerCountry && EU_COUNTRIES.has(buyerCountry)) || (sellerCountry && EU_COUNTRIES.has(sellerCountry))) {
    return 'EU';
  }
  if (!buyerCountry && !sellerCountry) return 'UNKNOWN';
  return 'OTHER';
}

interface CountryResolution {
  buyerCountry: string | null;
  buyerIpCountry: string | null;
  geoKycMatch: boolean;
  autoStatus: ComplianceStatus;
  autoNotes: string | null;
}

export function resolveCountryConflict(
  geoCountry: string | null,
  kycCountry: string | null,
): CountryResolution {
  if (kycCountry && geoCountry && kycCountry !== geoCountry) {
    return {
      buyerCountry: kycCountry,
      buyerIpCountry: geoCountry,
      geoKycMatch: false,
      autoStatus: 'review',
      autoNotes: `GeoIP/KYC mismatch: IP=${geoCountry}, KYC=${kycCountry}`,
    };
  }

  if (!kycCountry && geoCountry) {
    return {
      buyerCountry: geoCountry,
      buyerIpCountry: geoCountry,
      geoKycMatch: true,
      autoStatus: 'review',
      autoNotes: 'No KYC data, using GeoIP only',
    };
  }

  if (kycCountry && !geoCountry) {
    return {
      buyerCountry: kycCountry,
      buyerIpCountry: null,
      geoKycMatch: true,
      autoStatus: 'clean',
      autoNotes: null,
    };
  }

  if (kycCountry && geoCountry && kycCountry === geoCountry) {
    return {
      buyerCountry: kycCountry,
      buyerIpCountry: geoCountry,
      geoKycMatch: true,
      autoStatus: 'clean',
      autoNotes: null,
    };
  }

  return {
    buyerCountry: null,
    buyerIpCountry: null,
    geoKycMatch: true,
    autoStatus: 'review',
    autoNotes: 'No country data available',
  };
}

export interface RecordLedgerParams {
  entryType: string;
  refType: 'order' | 'purchase';
  refId: string;
  buyerWallet?: string | null;
  sellerWallet?: string | null;
  buyerProfileId?: string | null;
  sellerProfileId?: string | null;
  amountUsd?: number;
  amountTonRaw?: string;
  platformFeeUsd?: number;
  platformFeeTonRaw?: string;
  txHash?: string | null;
  escrowAddress?: string | null;
  licenseAddress?: string | null;
  productName?: string;
  listingId?: string | null;
  buyerIp?: string | null;
  buyerKycCountry?: string | null;
  sellerCountry?: string | null;
}

export async function recordLedgerEntry(params: RecordLedgerParams): Promise<LedgerEntry | null> {
  try {
    const tonUsdRate = await getTonUsdPrice().catch(() => 0);

    const geoCountry = lookupCountryByIp(params.buyerIp);
    const resolution = resolveCountryConflict(geoCountry, params.buyerKycCountry ?? null);
    const jurisdiction = classifyJurisdiction(resolution.buyerCountry, params.sellerCountry ?? null);

    const insertParams: InsertLedgerParams = {
      entry_type: params.entryType,
      ref_type: params.refType,
      ref_id: params.refId,
      buyer_wallet: params.buyerWallet,
      seller_wallet: params.sellerWallet,
      buyer_profile_id: params.buyerProfileId,
      seller_profile_id: params.sellerProfileId,
      amount_usd: params.amountUsd ?? 0,
      amount_ton_raw: params.amountTonRaw ?? '0',
      ton_usd_rate: tonUsdRate,
      platform_fee_usd: params.platformFeeUsd ?? 0,
      platform_fee_ton_raw: params.platformFeeTonRaw ?? '0',
      tx_hash: params.txHash,
      escrow_address: params.escrowAddress,
      license_address: params.licenseAddress,
      product_name: params.productName ?? '',
      listing_id: params.listingId,
      buyer_country: resolution.buyerCountry,
      buyer_ip_country: resolution.buyerIpCountry,
      seller_country: params.sellerCountry,
      buyer_ip: params.buyerIp,
      geo_kyc_match: resolution.geoKycMatch,
      jurisdiction,
      compliance_status: resolution.autoStatus,
      notes: resolution.autoNotes,
    };

    const entry = await insertLedgerEntry(insertParams);
    logger.info(`[ledger] ${params.entryType} recorded: ${entry.id} jurisdiction=${jurisdiction}`);
    return entry;
  } catch (err) {
    logger.error('[ledger] Failed to record entry:', err instanceof Error ? err.message : err);
    return null;
  }
}
