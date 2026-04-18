// Клиент TonForge API переводит фронт на канонический backend boundary apps/licenses/escrow без слома текущего Vite приложения.
import type {
  TonForgeApp,
  TonForgeArtifactScan,
  TonForgeContractOverview,
  TonForgeDeveloperProfile,
  TonForgeDeveloperWorkspace,
  TonForgeLicense,
  TonForgePurchaseSession,
  TonForgeReview,
  TonForgeWalletProfile,
} from '../domain/tonforge/types';

type ApiEnvelope<T> = { data: T };

function tonForgeBaseUrl(): string {
  const raw =
    import.meta.env.VITE_TONFORGE_API_URL ||
    import.meta.env.VITE_COMMERCE_API_URL ||
    'http://localhost:8081';
  const normalized = raw.replace(/\/$/, '');
  return normalized.endsWith('/api/tonforge') ? normalized : `${normalized}/api/tonforge`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const json = (await response.json()) as ApiEnvelope<T> & { error?: string };
  if (!response.ok) {
    throw new Error(json.error || 'TONFORGE_API_ERROR');
  }
  return json.data;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${tonForgeBaseUrl()}${path}`);
  return parseResponse<T>(response);
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${tonForgeBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

export async function fetchTonForgeConfig(): Promise<TonForgeContractOverview> {
  return getJson<TonForgeContractOverview>('/config');
}

export async function fetchTonForgeFeaturedApps(): Promise<TonForgeApp[]> {
  const data = await getJson<{ apps: TonForgeApp[] }>('/apps/featured');
  return data.apps;
}

export async function fetchTonForgeAppDetails(
  appIdOrCatalogId: string
): Promise<{ app: TonForgeApp; reviews: TonForgeReview[] }> {
  return getJson<{ app: TonForgeApp; reviews: TonForgeReview[] }>(`/apps/${encodeURIComponent(appIdOrCatalogId)}`);
}

export async function fetchDeveloperWorkspace(wallet: string): Promise<TonForgeDeveloperWorkspace> {
  return getJson<TonForgeDeveloperWorkspace>(`/developers/${encodeURIComponent(wallet)}/workspace`);
}

export async function submitDeveloperKyc(payload: {
  wallet: string;
  displayName: string;
  legalName: string;
  contactEmail: string;
  country: string;
  bio: string;
}): Promise<TonForgeDeveloperProfile> {
  const data = await postJson<{ profile: TonForgeDeveloperProfile }>('/developers/kyc', payload);
  return data.profile;
}

export async function runArtifactScan(payload: {
  fileName: string;
  artifactUrl: string;
  sha256: string;
}): Promise<TonForgeArtifactScan> {
  const data = await postJson<{ scan: TonForgeArtifactScan }>('/artifacts/scan', payload);
  return data.scan;
}

export async function publishTonForgeApp(payload: {
  sellerWallet: string;
  catalogProductId: string;
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  priceTon: number;
  fileName: string;
  version: string;
  sizeLabel: string;
  artifactUrl: string;
  sha256: string;
  developerSignature: string;
  malwareStatus: string;
  platforms: string[];
  licenseType: 'SBT' | 'Transferable';
  transferLimit: number;
  activationPolicy: string;
}): Promise<TonForgeApp> {
  const data = await postJson<{ app: TonForgeApp }>('/apps', payload);
  return data.app;
}

export async function createPurchaseSession(payload: {
  appId: string;
  buyerWallet: string;
}): Promise<{ app: TonForgeApp; session: TonForgePurchaseSession }> {
  return postJson<{ app: TonForgeApp; session: TonForgePurchaseSession }>('/purchase/session', payload);
}

export async function confirmPurchaseSession(payload: {
  purchaseSessionId: string;
  buyerWallet: string;
  txHash?: string;
}): Promise<{
  app: TonForgeApp;
  session: TonForgePurchaseSession;
  license: TonForgeLicense;
}> {
  return postJson<{
    app: TonForgeApp;
    session: TonForgePurchaseSession;
    license: TonForgeLicense;
  }>('/purchase/confirm', payload);
}

export async function fetchWalletProfile(wallet: string): Promise<TonForgeWalletProfile> {
  return getJson<TonForgeWalletProfile>(`/licenses/me?wallet=${encodeURIComponent(wallet)}`);
}

export async function activateLicenseDevice(payload: {
  licenseId: string;
  buyerWallet: string;
  deviceId: string;
}): Promise<{ app: TonForgeApp; license: TonForgeLicense }> {
  return postJson<{ app: TonForgeApp; license: TonForgeLicense }>(
    `/licenses/${encodeURIComponent(payload.licenseId)}/activate-device`,
    payload
  );
}

export interface TonForgeOnchainVerify {
  ok: boolean;
  reason?: string;
  ownerOnchain?: string;
  ownerExpected?: string;
  index?: string;
  collection?: string;
}

export async function fetchLicenseById(
  licenseId: string,
): Promise<TonForgeLicense> {
  const data = await getJson<{ license: TonForgeLicense }>(
    `/licenses/${encodeURIComponent(licenseId)}`,
  );
  return data.license;
}

export async function verifyLicenseOnchain(
  licenseId: string,
): Promise<TonForgeOnchainVerify> {
  const data = await getJson<{ verify: TonForgeOnchainVerify }>(
    `/licenses/${encodeURIComponent(licenseId)}/verify`,
  );
  return data.verify;
}

