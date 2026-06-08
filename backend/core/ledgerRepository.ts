import { Query, ID } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_COMPLIANCE_LEDGER } from './constants.js';
import type { LedgerEntry, ComplianceStatus, Jurisdiction, LedgerEntryType } from '../domain/types.js';

type AppwriteDoc = Record<string, unknown> & { $id: string; $createdAt: string };
const asDoc = (d: unknown) => d as AppwriteDoc;

function mapEntry(doc: AppwriteDoc): LedgerEntry {
  return {
    id: doc.$id,
    entryType: (doc['entry_type'] as LedgerEntryType) ?? 'purchase',
    refType: (doc['ref_type'] as 'order' | 'purchase') ?? 'purchase',
    refId: (doc['ref_id'] as string) ?? '',
    buyerWallet: (doc['buyer_wallet'] as string) ?? null,
    sellerWallet: (doc['seller_wallet'] as string) ?? null,
    buyerProfileId: (doc['buyer_profile_id'] as string) ?? null,
    sellerProfileId: (doc['seller_profile_id'] as string) ?? null,
    amountUsd: (doc['amount_usd'] as number) ?? 0,
    amountTonRaw: (doc['amount_ton_raw'] as string) ?? '0',
    tonUsdRate: typeof doc['ton_usd_rate'] === 'number' ? (doc['ton_usd_rate'] as number) : null,
    platformFeeUsd: (doc['platform_fee_usd'] as number) ?? 0,
    platformFeeTonRaw: (doc['platform_fee_ton_raw'] as string) ?? '0',
    txHash: (doc['tx_hash'] as string) ?? null,
    escrowAddress: (doc['escrow_address'] as string) ?? null,
    licenseAddress: (doc['license_address'] as string) ?? null,
    productName: (doc['product_name'] as string) ?? '',
    listingId: (doc['listing_id'] as string) ?? null,
    buyerCountry: (doc['buyer_country'] as string) ?? null,
    buyerIpCountry: (doc['buyer_ip_country'] as string) ?? null,
    sellerCountry: (doc['seller_country'] as string) ?? null,
    buyerIp: (doc['buyer_ip'] as string) ?? null,
    geoKycMatch: (doc['geo_kyc_match'] as boolean) ?? true,
    jurisdiction: (doc['jurisdiction'] as Jurisdiction) ?? 'UNKNOWN',
    complianceStatus: (doc['compliance_status'] as ComplianceStatus) ?? 'clean',
    notes: (doc['notes'] as string) ?? null,
    createdAt: doc.$createdAt,
  };
}

export interface InsertLedgerParams {
  entry_type: string;
  ref_type: string;
  ref_id: string;
  buyer_wallet?: string | null;
  seller_wallet?: string | null;
  buyer_profile_id?: string | null;
  seller_profile_id?: string | null;
  amount_usd?: number;
  amount_ton_raw?: string;
  ton_usd_rate?: number | null;
  platform_fee_usd?: number;
  platform_fee_ton_raw?: string;
  tx_hash?: string | null;
  escrow_address?: string | null;
  license_address?: string | null;
  product_name?: string;
  listing_id?: string | null;
  buyer_country?: string | null;
  buyer_ip_country?: string | null;
  seller_country?: string | null;
  buyer_ip?: string | null;
  geo_kyc_match?: boolean;
  jurisdiction?: string;
  compliance_status?: string;
  notes?: string | null;
}

export async function insertLedgerEntry(params: InsertLedgerParams): Promise<LedgerEntry> {
  const doc = await databases().createDocument(
    CORE_DATABASE_ID,
    COL_COMPLIANCE_LEDGER,
    ID.unique(),
    {
      entry_type: params.entry_type,
      ref_type: params.ref_type,
      ref_id: params.ref_id,
      buyer_wallet: params.buyer_wallet ?? null,
      seller_wallet: params.seller_wallet ?? null,
      buyer_profile_id: params.buyer_profile_id ?? null,
      seller_profile_id: params.seller_profile_id ?? null,
      amount_usd: params.amount_usd ?? 0,
      amount_ton_raw: params.amount_ton_raw ?? '0',
      ton_usd_rate: typeof params.ton_usd_rate === 'number' ? params.ton_usd_rate : null,
      platform_fee_usd: params.platform_fee_usd ?? 0,
      platform_fee_ton_raw: params.platform_fee_ton_raw ?? '0',
      tx_hash: params.tx_hash ?? null,
      escrow_address: params.escrow_address ?? null,
      license_address: params.license_address ?? null,
      product_name: params.product_name ?? '',
      listing_id: params.listing_id ?? null,
      buyer_country: params.buyer_country ?? null,
      buyer_ip_country: params.buyer_ip_country ?? null,
      seller_country: params.seller_country ?? null,
      buyer_ip: params.buyer_ip ?? null,
      geo_kyc_match: params.geo_kyc_match ?? true,
      jurisdiction: params.jurisdiction ?? 'UNKNOWN',
      compliance_status: params.compliance_status ?? 'clean',
      notes: params.notes ?? null,
    },
  );
  return mapEntry(asDoc(doc));
}

export interface LedgerFilters {
  entryType?: string;
  jurisdiction?: string;
  complianceStatus?: string;
  buyerCountry?: string;
  geoKycMatch?: boolean;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export async function listLedgerEntries(filters: LedgerFilters = {}): Promise<{
  entries: LedgerEntry[];
  total: number;
}> {
  const queries: string[] = [];

  if (filters.entryType) queries.push(Query.equal('entry_type', filters.entryType));
  if (filters.jurisdiction) queries.push(Query.equal('jurisdiction', filters.jurisdiction));
  if (filters.complianceStatus) queries.push(Query.equal('compliance_status', filters.complianceStatus));
  if (filters.buyerCountry) queries.push(Query.equal('buyer_country', filters.buyerCountry));
  if (filters.geoKycMatch !== undefined) queries.push(Query.equal('geo_kyc_match', filters.geoKycMatch));
  if (filters.dateFrom) queries.push(Query.greaterThanEqual('$createdAt', filters.dateFrom));
  if (filters.dateTo) queries.push(Query.lessThanEqual('$createdAt', filters.dateTo));
  if (filters.search) queries.push(Query.contains('tx_hash', filters.search));

  queries.push(Query.orderDesc('$createdAt'));
  queries.push(Query.limit(filters.limit ?? 50));
  if (filters.offset) queries.push(Query.offset(filters.offset));

  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_COMPLIANCE_LEDGER, queries);
  return {
    entries: res.documents.map((d) => mapEntry(asDoc(d))),
    total: res.total,
  };
}

export async function getLedgerEntry(id: string): Promise<LedgerEntry | null> {
  try {
    const doc = await databases().getDocument(CORE_DATABASE_ID, COL_COMPLIANCE_LEDGER, id);
    return mapEntry(asDoc(doc));
  } catch {
    return null;
  }
}

export async function updateComplianceStatus(
  id: string,
  status: ComplianceStatus,
  notes?: string,
): Promise<LedgerEntry> {
  const payload: Record<string, unknown> = { compliance_status: status };
  if (notes !== undefined) payload['notes'] = notes;
  const doc = await databases().updateDocument(CORE_DATABASE_ID, COL_COMPLIANCE_LEDGER, id, payload);
  return mapEntry(asDoc(doc));
}

export interface LedgerAggregateStats {
  totalEntries: number;
  totalVolumeUsd: number;
  totalFeesUsd: number;
  byJurisdiction: Record<string, { count: number; volumeUsd: number }>;
  byEntryType: Record<string, { count: number; volumeUsd: number }>;
  byCountry: Record<string, { count: number; volumeUsd: number }>;
  vpnConflicts: number;
  pendingReview: number;
}

const APPWRITE_MAX_PAGE = 100;

async function fetchAllLedgerEntries(baseQueries: string[]): Promise<LedgerEntry[]> {
  const all: LedgerEntry[] = [];
  let offset = 0;

  while (true) {
    const pageQueries = [
      ...baseQueries,
      Query.limit(APPWRITE_MAX_PAGE),
      Query.offset(offset),
    ];
    const res = await databases().listDocuments(CORE_DATABASE_ID, COL_COMPLIANCE_LEDGER, pageQueries);
    const page = res.documents.map((d) => mapEntry(asDoc(d)));
    all.push(...page);
    if (all.length >= res.total || page.length < APPWRITE_MAX_PAGE) break;
    offset += APPWRITE_MAX_PAGE;
  }
  return all;
}

export async function getAggregateStats(dateFrom?: string, dateTo?: string): Promise<LedgerAggregateStats> {
  const baseQueries: string[] = [];
  if (dateFrom) baseQueries.push(Query.greaterThanEqual('$createdAt', dateFrom));
  if (dateTo) baseQueries.push(Query.lessThanEqual('$createdAt', dateTo));

  const entries = await fetchAllLedgerEntries(baseQueries);

  const stats: LedgerAggregateStats = {
    totalEntries: entries.length,
    totalVolumeUsd: 0,
    totalFeesUsd: 0,
    byJurisdiction: {},
    byEntryType: {},
    byCountry: {},
    vpnConflicts: 0,
    pendingReview: 0,
  };

  for (const e of entries) {
    stats.totalVolumeUsd += e.amountUsd;
    stats.totalFeesUsd += e.platformFeeUsd;

    if (!e.geoKycMatch) stats.vpnConflicts++;
    if (e.complianceStatus === 'review') stats.pendingReview++;

    const jur = e.jurisdiction || 'UNKNOWN';
    if (!stats.byJurisdiction[jur]) stats.byJurisdiction[jur] = { count: 0, volumeUsd: 0 };
    stats.byJurisdiction[jur]!.count++;
    stats.byJurisdiction[jur]!.volumeUsd += e.amountUsd;

    const etype = e.entryType;
    if (!stats.byEntryType[etype]) stats.byEntryType[etype] = { count: 0, volumeUsd: 0 };
    stats.byEntryType[etype]!.count++;
    stats.byEntryType[etype]!.volumeUsd += e.amountUsd;

    const country = e.buyerCountry || 'XX';
    if (!stats.byCountry[country]) stats.byCountry[country] = { count: 0, volumeUsd: 0 };
    stats.byCountry[country]!.count++;
    stats.byCountry[country]!.volumeUsd += e.amountUsd;
  }

  return stats;
}
