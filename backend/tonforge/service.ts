import { createHash, randomUUID } from 'crypto';
import { createDemoState } from './demoData.js';
import { contractMetadata, onChainFields } from './contractMetadata.js';
import { logger } from '../logger.js';
import {
  loadOnchainConfig,
  mintLicense,
  pollItemDeployed,
  registerLicense,
  verifyLicenseOwner,
  type OwnershipResult,
} from './onchain/index.js';
import type {
  TonForgeState,
  TonForgeApp,
  License,
  PurchaseSession,
  UserProfile,
  DeveloperProfile,
  ScanResult,
  AppReview,
  TonAddress,
  LicenseId,
  PurchaseSessionId,
} from '../domain/types.js';

function buildTonAddress(prefix: string, id: string): string {
  return `EQD${prefix}${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 42)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function addHours(isoString: string, hours: number): string {
  return new Date(new Date(isoString).getTime() + hours * 60 * 60 * 1000).toISOString();
}

interface PersistOpts {
  debounceMs?: number;
  save: (state: TonForgeState) => Promise<void>;
}

export interface TonForgeService {
  listFeaturedApps(): TonForgeApp[];
  getAppById(appIdOrCatalogId: string): TonForgeApp | undefined;
  getReviews(appId: string): AppReview[];
  submitDeveloperKyc(payload: Record<string, string>): DeveloperProfile;
  scanArtifact(payload: Record<string, string>): ScanResult;
  publishApp(payload: Record<string, unknown>): TonForgeApp;
  createPurchaseSession(payload: { appId: string; buyerWallet: string }): { app: TonForgeApp; session: PurchaseSession };
  confirmPurchaseSession(payload: { purchaseSessionId: string; buyerWallet: string; txHash?: string }): { session: PurchaseSession; license: License; app: TonForgeApp | undefined };
  listWalletLicenses(wallet: string): License[];
  getLicenseById(licenseId: string): License | undefined;
  activateLicenseDevice(payload: { licenseId: string; buyerWallet: string; deviceId: string }): Promise<{ license: License; app: TonForgeApp | undefined; verify?: OwnershipResult }>;
  verifyLicenseOnchain(licenseId: string): Promise<OwnershipResult>;
  setAppCollectionAddress(appId: string, collectionAddress: string, metadataUriPrefix?: string): TonForgeApp;
  getDeveloperWorkspace(wallet: string): { developer: DeveloperProfile; apps: TonForgeApp[]; recentScans: ScanResult[] };
  getWalletProfile(wallet: string): { profile: UserProfile; licenses: License[]; stats: Record<string, number> };
  getContractOverview(): Record<string, unknown>;
  getState(): TonForgeState;
}

export function createTonForgeService(
  initialState: TonForgeState = createDemoState(),
  persistOpts: PersistOpts | null = null,
): TonForgeService {
  const state = initialState;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  function schedulePersist(): void {
    if (!persistOpts || typeof persistOpts.save !== 'function') return;
    const delay = persistOpts.debounceMs ?? 500;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      Promise.resolve()
        .then(() => persistOpts.save(state))
        .catch((err: unknown) => {
          logger.error('TonForge persist:', err);
        });
    }, delay);
  }

  function listFeaturedApps(): TonForgeApp[] {
    return state.apps.filter((app) => app.featured);
  }

  function getAppById(appIdOrCatalogId: string): TonForgeApp | undefined {
    return state.apps.find(
      (app) => app.appId === appIdOrCatalogId || app.catalogProductId === appIdOrCatalogId,
    );
  }

  function getReviews(appId: string): AppReview[] {
    return state.reviews.filter((review) => review.appId === appId);
  }

  function ensureDeveloperProfile(wallet: string): DeveloperProfile {
    const existing = state.developerProfiles.find((p) => p.wallet === wallet);
    if (existing) return existing;
    const profile: DeveloperProfile = {
      wallet: wallet as TonAddress,
      displayName: 'New TonForge Developer',
      legalName: 'Unverified legal entity',
      contactEmail: 'pending@tonforge.org',
      country: 'UNSPECIFIED',
      bio: 'Профиль создан через canonical TonForge API.',
      kycStatus: 'draft',
      sellerBadge: 'Новый продавец',
      verifiedAt: null,
    };
    state.developerProfiles.push(profile);
    schedulePersist();
    return profile;
  }

  function submitDeveloperKyc(payload: Record<string, string>): DeveloperProfile {
    const profile = ensureDeveloperProfile(payload.wallet!);
    profile.displayName = payload.displayName!.trim();
    profile.legalName = payload.legalName!.trim();
    profile.contactEmail = payload.contactEmail!.trim();
    profile.country = payload.country!.trim().toUpperCase();
    profile.bio = payload.bio!.trim();
    profile.kycStatus = 'under_review';
    profile.sellerBadge = 'KYC на проверке';
    profile.verifiedAt = null;
    schedulePersist();
    return profile;
  }

  function scanArtifact(payload: Record<string, string>): ScanResult {
    const scanId = `scan_${randomUUID()}`;
    const createdAt = nowIso();
    const source = `${payload.fileName}:${payload.artifactUrl}:${payload.sha256}:${createdAt}`;
    const integrityFingerprint = createHash('sha256').update(source).digest('hex');
    const result: ScanResult = {
      scanId,
      fileName: payload.fileName!.trim(),
      artifactUrl: payload.artifactUrl!.trim(),
      sha256: payload.sha256!.trim(),
      integrityFingerprint,
      status: 'passed',
      findings: [],
      scannedAt: createdAt,
      engines: [
        { name: 'VirusTotal', verdict: 'clean' },
        { name: 'Hybrid Analysis', verdict: 'clean' },
      ],
    };
    state.scans.unshift(result);
    schedulePersist();
    return result;
  }

  function publishApp(payload: Record<string, unknown>): TonForgeApp {
    const developer = ensureDeveloperProfile(payload.sellerWallet as string);
    const appId = `app_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const app: TonForgeApp = {
      appId,
      catalogProductId: String(payload.catalogProductId).trim(),
      slug: String(payload.slug).trim(),
      name: String(payload.name).trim(),
      category: String(payload.category).trim(),
      summary: String(payload.summary).trim(),
      description: String(payload.description).trim(),
      sellerWallet: String(payload.sellerWallet).trim() as TonAddress,
      featured: false,
      priceTon: Number(payload.priceTon),
      commissionBps: 2000,
      buyerProtectionHours: 72,
      artifact: {
        fileName: String(payload.fileName).trim(),
        version: String(payload.version).trim(),
        sizeLabel: String(payload.sizeLabel).trim(),
        downloadUrl: String(payload.artifactUrl).trim(),
        sha256: String(payload.sha256).trim(),
        developerSignature: String(payload.developerSignature).trim(),
        malwareStatus: String(payload.malwareStatus),
        platforms: payload.platforms as string[],
      },
      license: {
        type: String(payload.licenseType),
        transferLimit: Number(payload.transferLimit),
        activationPolicy: String(payload.activationPolicy),
        contractStatus: 'registry_pending',
      },
      trust: {
        sellerBadge: developer.sellerBadge,
        kycStatus: developer.kycStatus,
        refundRate: 0,
        rating: 0,
        reviewCount: 0,
      },
      metrics: { downloads: 0, weeklyPurchases: 0, activeLicenses: 0 },
    };
    state.apps.unshift(app);
    schedulePersist();
    return app;
  }

  function createPurchaseSession(payload: { appId: string; buyerWallet: string }) {
    const app = getAppById(payload.appId);
    if (!app) throw new Error('APP_NOT_FOUND');
    const createdAt = nowIso();
    const session: PurchaseSession = {
      purchaseSessionId: `session_${randomUUID()}` as PurchaseSessionId,
      buyerWallet: payload.buyerWallet.trim() as TonAddress,
      appId: app.appId,
      state: 'awaiting_wallet_payment',
      amountTon: app.priceTon,
      amountNano: String(Math.round(app.priceTon * 1_000_000_000)),
      treasuryWallet: state.treasuryWallet,
      escrowAddress: buildTonAddress('Escrow', app.appId),
      memo: `forge_${randomUUID().slice(0, 8)}`,
      createdAt,
      trialEndsAt: addHours(createdAt, app.buyerProtectionHours),
    };
    state.purchaseSessions.unshift(session);
    schedulePersist();
    return { app, session };
  }

  function ensureUserProfile(wallet: string): UserProfile {
    const existing = state.userProfiles.find((p) => p.wallet === wallet);
    if (existing) return existing;
    const profile: UserProfile = {
      wallet: wallet as TonAddress,
      displayName: 'TonForge Buyer',
      email: '',
      role: 'buyer',
      totalSpentTon: 0,
      totalLicenses: 0,
      devicesBound: 0,
    };
    state.userProfiles.push(profile);
    schedulePersist();
    return profile;
  }

  function nextLicenseIndex(appId: string): number {
    return state.licenses.filter((l) => l.appId === appId).length;
  }

  function confirmPurchaseSession(payload: { purchaseSessionId: string; buyerWallet: string; txHash?: string }) {
    const session = state.purchaseSessions.find((s) => s.purchaseSessionId === payload.purchaseSessionId);
    if (!session) throw new Error('SESSION_NOT_FOUND');
    if (session.buyerWallet !== payload.buyerWallet) throw new Error('BUYER_WALLET_MISMATCH');
    if (session.state !== 'awaiting_wallet_payment') throw new Error('SESSION_ALREADY_CONFIRMED');
    const app = getAppById(session.appId);
    const onchain = loadOnchainConfig();
    const canMintOnchain = Boolean(onchain.enabled && app?.collectionAddress);
    const collectionIndex = nextLicenseIndex(session.appId);

    const license: License = {
      licenseId: `lic_${randomUUID()}` as LicenseId,
      nftAddress: buildTonAddress('License', session.purchaseSessionId),
      collectionAddress: app?.collectionAddress || buildTonAddress('Collection', session.appId),
      escrowAddress: session.escrowAddress,
      appId: session.appId,
      buyerWallet: session.buyerWallet,
      state: canMintOnchain ? 'mint_pending' : 'trial_active',
      purchaseSessionId: session.purchaseSessionId,
      activatedDevices: [],
      trialEndsAt: session.trialEndsAt,
      purchaseTxHash: payload.txHash?.trim() || `simulated_${randomUUID().slice(0, 8)}`,
      collectionIndex,
      mintTxHash: null,
      burnTxHash: null,
      mintError: null,
    };
    session.state = 'trial_active';
    state.licenses.unshift(license);
    if (app) app.metrics.activeLicenses += 1;
    const user = ensureUserProfile(session.buyerWallet);
    user.totalSpentTon += session.amountTon;
    user.totalLicenses += 1;
    schedulePersist();

    if (canMintOnchain && app) {
      void mintLicenseAsync(license, app, session).catch((err: unknown) => {
        logger.error('[tonforge.confirm] mint kickoff failed:', err);
      });
    }

    return { session, license, app };
  }

  async function mintLicenseAsync(
    license: License,
    app: TonForgeApp,
    session: PurchaseSession,
  ): Promise<void> {
    if (!app.collectionAddress) {
      logger.warn(`[tonforge.mint] app ${app.appId} has no collectionAddress, skipping mint`);
      return;
    }
    const metadataUri =
      (app.metadataUriPrefix || `https://cdn.tonforge.org/license-metadata/${app.appId}/`) +
      `${license.collectionIndex}.json`;
    try {
      const trialEndMs = new Date(session.trialEndsAt).getTime();
      if (!Number.isFinite(trialEndMs)) {
        throw new Error('INVALID_TRIAL_ENDS_AT');
      }
      const burnDeadline = Math.floor(trialEndMs / 1000);
      const result = await mintLicense({
        collectionAddress: app.collectionAddress,
        buyerWallet: session.buyerWallet,
        escrowAddress: license.escrowAddress,
        index: BigInt(license.collectionIndex ?? 0),
        metadataUri,
        transferLimit: app.license.transferLimit ?? 0,
        burnDeadline,
      });
      license.nftAddress = result.itemAddress;
      license.mintTxHash = String(result.txQueryId);
      schedulePersist();
      logger.info(
        `[tonforge.mint] queued mint license=${license.licenseId} item=${result.itemAddress} queryId=${result.txQueryId}`,
      );
      const ok = await pollItemDeployed({ itemAddress: result.itemAddress });
      if (ok) {
        license.state = 'trial_active';
        license.mintError = null;
        logger.info(`[tonforge.mint] license ${license.licenseId} active on-chain`);
        if (license.escrowAddress) {
          try {
            await registerLicense({
              escrowAddress: license.escrowAddress,
              licenseAddress: result.itemAddress,
            });
            logger.info(`[tonforge.mint] registered license on escrow for ${license.licenseId}`);
          } catch (regErr) {
            logger.error(`[tonforge.mint] registerLicense failed for ${license.licenseId}:`, regErr);
          }
        }
      } else {
        license.state = 'mint_failed';
        license.mintError = 'POLL_TIMEOUT';
        logger.warn(`[tonforge.mint] poll timeout for license ${license.licenseId}`);
      }
      schedulePersist();
    } catch (err: unknown) {
      license.state = 'mint_failed';
      license.mintError = err instanceof Error ? err.message : String(err);
      schedulePersist();
      logger.error(`[tonforge.mint] mint failed for license ${license.licenseId}:`, err);
    }
  }

  function listWalletLicenses(wallet: string): License[] {
    return state.licenses.filter((l) => l.buyerWallet === wallet);
  }

  function getLicenseById(licenseId: string): License | undefined {
    return state.licenses.find((l) => l.licenseId === licenseId);
  }

  async function activateLicenseDevice(payload: { licenseId: string; buyerWallet: string; deviceId: string }) {
    const license = state.licenses.find((l) => l.licenseId === payload.licenseId);
    if (!license) throw new Error('LICENSE_NOT_FOUND');
    if (license.buyerWallet !== payload.buyerWallet) throw new Error('LICENSE_ACCESS_DENIED');
    if (license.state === 'revoked' || license.state === 'refunded') {
      throw new Error('LICENSE_REVOKED');
    }
    if (license.state === 'mint_failed' || license.state === 'burn_pending') {
      throw new Error('LICENSE_NOT_READY');
    }
    const app = getAppById(license.appId);

    let verify: OwnershipResult | undefined;
    const onchain = loadOnchainConfig();
    if (onchain.enabled && license.state !== 'mint_pending') {
      verify = await verifyLicenseOwner(license.nftAddress, payload.buyerWallet);
      if (!verify.ok) {
        logger.warn(
          `[tonforge.activate] on-chain verify failed for license ${license.licenseId}: ${verify.reason}`,
        );
        throw new Error('LICENSE_ONCHAIN_VERIFY_FAILED');
      }
    }

    const normalizedDeviceId = payload.deviceId.trim();
    const alreadyBound = license.activatedDevices.some((d) => d.deviceId === normalizedDeviceId);
    if (!alreadyBound) {
      license.activatedDevices.push({ deviceId: normalizedDeviceId, activatedAt: nowIso() });
    }
    if (license.state === 'trial_active') license.state = 'device_bound';
    const user = ensureUserProfile(payload.buyerWallet);
    user.devicesBound = listWalletLicenses(payload.buyerWallet).reduce((sum, l) => sum + l.activatedDevices.length, 0);
    schedulePersist();
    return { license, app, verify };
  }

  async function verifyLicenseOnchain(licenseId: string): Promise<OwnershipResult> {
    const license = state.licenses.find((l) => l.licenseId === licenseId);
    if (!license) throw new Error('LICENSE_NOT_FOUND');
    const onchain = loadOnchainConfig();
    if (!onchain.enabled) {
      return {
        ok: false,
        reason: 'ONCHAIN_DISABLED',
        ownerOnchain: undefined,
        ownerExpected: license.buyerWallet,
      };
    }
    return verifyLicenseOwner(license.nftAddress, license.buyerWallet);
  }

  function setAppCollectionAddress(appId: string, collectionAddress: string, metadataUriPrefix?: string): TonForgeApp {
    const app = getAppById(appId);
    if (!app) throw new Error('APP_NOT_FOUND');
    app.collectionAddress = collectionAddress.trim();
    if (metadataUriPrefix) app.metadataUriPrefix = metadataUriPrefix.trim();
    app.license.contractStatus = 'collection_ready';
    schedulePersist();
    return app;
  }

  function getDeveloperWorkspace(wallet: string) {
    const developer = ensureDeveloperProfile(wallet);
    const appsByDeveloper = state.apps.filter((a) => a.sellerWallet === wallet);
    const scans = state.scans.slice(0, 5);
    return { developer, apps: appsByDeveloper, recentScans: scans };
  }

  function getWalletProfile(wallet: string) {
    const profile = ensureUserProfile(wallet);
    const licenses = listWalletLicenses(wallet);
    return {
      profile,
      licenses,
      stats: {
        totalSpentTon: profile.totalSpentTon,
        totalLicenses: profile.totalLicenses,
        devicesBound: profile.devicesBound,
        activeTrials: licenses.filter((l) => l.state === 'trial_active').length,
      },
    };
  }

  function getContractOverview() {
    return {
      backendMode: 'demo-ready',
      trackedContracts: contractMetadata,
      onChainFields,
      treasuryWallet: state.treasuryWallet,
    };
  }

  return {
    listFeaturedApps,
    getAppById,
    getReviews,
    submitDeveloperKyc,
    scanArtifact,
    publishApp,
    createPurchaseSession,
    confirmPurchaseSession,
    listWalletLicenses,
    getLicenseById,
    activateLicenseDevice,
    verifyLicenseOnchain,
    setAppCollectionAddress,
    getDeveloperWorkspace,
    getWalletProfile,
    getContractOverview,
    getState: () => state,
  };
}

let tonForgeServiceInstance: TonForgeService = createTonForgeService();

export function setTonForgeService(instance: TonForgeService): void {
  tonForgeServiceInstance = instance;
}

export function getTonForgeService(): TonForgeService {
  return tonForgeServiceInstance;
}
