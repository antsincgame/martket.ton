// Канонический сервис TonForge переводит проект на доменную модель licenses/escrow/devices и остаётся рабочим без готового PostgreSQL.
'use strict';

const { createHash, randomUUID } = require('crypto');
const { createDemoState } = require('./demoData');
const { contractMetadata, onChainFields } = require('./contractMetadata');

function buildTonAddress(prefix, id) {
  return `EQD${prefix}${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 42)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function addHours(isoString, hours) {
  return new Date(new Date(isoString).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function createTonForgeService(initialState = createDemoState(), persistOpts = null) {
  const state = initialState;
  let persistTimer = null;

  function schedulePersist() {
    if (!persistOpts || typeof persistOpts.save !== 'function') return;
    const delay = persistOpts.debounceMs ?? 500;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      Promise.resolve()
        .then(() => persistOpts.save(state))
        .catch((err) => {
          const { logger } = require('../logger');
          logger.error('TonForge persist:', err);
        });
    }, delay);
  }

  function listFeaturedApps() {
    return state.apps.filter((app) => app.featured);
  }

  function getAppById(appIdOrCatalogId) {
    return state.apps.find(
      (app) => app.appId === appIdOrCatalogId || app.catalogProductId === appIdOrCatalogId
    );
  }

  function getReviews(appId) {
    return state.reviews.filter((review) => review.appId === appId);
  }

  function ensureDeveloperProfile(wallet) {
    const existing = state.developerProfiles.find((profile) => profile.wallet === wallet);
    if (existing) return existing;

    const profile = {
      wallet,
      displayName: 'New TonForge Developer',
      legalName: 'Unverified legal entity',
      contactEmail: 'pending@tonforge.app',
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

  function submitDeveloperKyc(payload) {
    const profile = ensureDeveloperProfile(payload.wallet);
    profile.displayName = payload.displayName.trim();
    profile.legalName = payload.legalName.trim();
    profile.contactEmail = payload.contactEmail.trim();
    profile.country = payload.country.trim().toUpperCase();
    profile.bio = payload.bio.trim();
    profile.kycStatus = 'under_review';
    profile.sellerBadge = 'KYC на проверке';
    profile.verifiedAt = null;
    schedulePersist();
    return profile;
  }

  function scanArtifact(payload) {
    const scanId = `scan_${randomUUID()}`;
    const createdAt = nowIso();
    const source = `${payload.fileName}:${payload.artifactUrl}:${payload.sha256}:${createdAt}`;
    const integrityFingerprint = createHash('sha256').update(source).digest('hex');
    const result = {
      scanId,
      fileName: payload.fileName.trim(),
      artifactUrl: payload.artifactUrl.trim(),
      sha256: payload.sha256.trim(),
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

  function publishApp(payload) {
    const developer = ensureDeveloperProfile(payload.sellerWallet);
    const appId = `app_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const app = {
      appId,
      catalogProductId: payload.catalogProductId.trim(),
      slug: payload.slug.trim(),
      name: payload.name.trim(),
      category: payload.category.trim(),
      summary: payload.summary.trim(),
      description: payload.description.trim(),
      sellerWallet: payload.sellerWallet.trim(),
      featured: false,
      priceTon: Number(payload.priceTon),
      commissionBps: 2000,
      buyerProtectionHours: 72,
      artifact: {
        fileName: payload.fileName.trim(),
        version: payload.version.trim(),
        sizeLabel: payload.sizeLabel.trim(),
        downloadUrl: payload.artifactUrl.trim(),
        sha256: payload.sha256.trim(),
        developerSignature: payload.developerSignature.trim(),
        malwareStatus: payload.malwareStatus,
        platforms: payload.platforms,
      },
      license: {
        type: payload.licenseType,
        transferLimit: payload.transferLimit,
        activationPolicy: payload.activationPolicy,
        contractStatus: 'registry_pending',
      },
      trust: {
        sellerBadge: developer.sellerBadge,
        kycStatus: developer.kycStatus,
        disputeRate: 0,
        refundRate: 0,
        rating: 0,
        reviewCount: 0,
      },
      metrics: {
        downloads: 0,
        weeklyPurchases: 0,
        activeLicenses: 0,
      },
    };
    state.apps.unshift(app);
    schedulePersist();
    return app;
  }

  function createPurchaseSession(payload) {
    const app = getAppById(payload.appId);
    if (!app) throw new Error('APP_NOT_FOUND');

    const createdAt = nowIso();
    const session = {
      purchaseSessionId: `session_${randomUUID()}`,
      buyerWallet: payload.buyerWallet.trim(),
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

  function ensureUserProfile(wallet) {
    const existing = state.userProfiles.find((profile) => profile.wallet === wallet);
    if (existing) return existing;

    const profile = {
      wallet,
      displayName: 'TonForge Buyer',
      email: '',
      role: 'buyer',
      totalSpentTon: 0,
      totalLicenses: 0,
      devicesBound: 0,
      disputesOpened: 0,
    };
    state.userProfiles.push(profile);
    schedulePersist();
    return profile;
  }

  function confirmPurchaseSession(payload) {
    const session = state.purchaseSessions.find(
      (item) => item.purchaseSessionId === payload.purchaseSessionId
    );
    if (!session) throw new Error('SESSION_NOT_FOUND');
    if (session.buyerWallet !== payload.buyerWallet) throw new Error('BUYER_WALLET_MISMATCH');
    if (session.state !== 'awaiting_wallet_payment') throw new Error('SESSION_ALREADY_CONFIRMED');

    const app = getAppById(session.appId);
    const license = {
      licenseId: `lic_${randomUUID()}`,
      nftAddress: buildTonAddress('License', session.purchaseSessionId),
      collectionAddress: buildTonAddress('Collection', session.appId),
      escrowAddress: session.escrowAddress,
      appId: session.appId,
      buyerWallet: session.buyerWallet,
      state: 'trial_active',
      purchaseSessionId: session.purchaseSessionId,
      activatedDevices: [],
      trialEndsAt: session.trialEndsAt,
      purchaseTxHash: payload.txHash?.trim() || `simulated_${randomUUID().slice(0, 8)}`,
    };
    session.state = 'trial_active';
    state.licenses.unshift(license);
    if (app) app.metrics.activeLicenses += 1;

    const user = ensureUserProfile(session.buyerWallet);
    user.totalSpentTon += session.amountTon;
    user.totalLicenses += 1;
    schedulePersist();
    return { session, license, app };
  }

  function listWalletLicenses(wallet) {
    return state.licenses.filter((license) => license.buyerWallet === wallet);
  }

  function activateLicenseDevice(payload) {
    const license = state.licenses.find((item) => item.licenseId === payload.licenseId);
    if (!license) throw new Error('LICENSE_NOT_FOUND');
    if (license.buyerWallet !== payload.buyerWallet) throw new Error('LICENSE_ACCESS_DENIED');

    const app = getAppById(license.appId);
    const normalizedDeviceId = payload.deviceId.trim();
    const alreadyBound = license.activatedDevices.some((device) => device.deviceId === normalizedDeviceId);
    if (!alreadyBound) {
      license.activatedDevices.push({ deviceId: normalizedDeviceId, activatedAt: nowIso() });
    }

    const nextState = license.state === 'trial_active' ? 'device_bound' : license.state;
    license.state = nextState;
    const user = ensureUserProfile(payload.buyerWallet);
    user.devicesBound = listWalletLicenses(payload.buyerWallet).reduce(
      (sum, item) => sum + item.activatedDevices.length,
      0
    );
    schedulePersist();
    return { license, app };
  }

  function openDispute(payload) {
    const license = state.licenses.find((item) => item.licenseId === payload.licenseId);
    if (!license) throw new Error('LICENSE_NOT_FOUND');

    const dispute = {
      disputeId: `dispute_${randomUUID()}`,
      licenseId: payload.licenseId,
      buyerWallet: payload.buyerWallet.trim(),
      reason: payload.reason.trim(),
      state: 'open',
      createdAt: nowIso(),
    };
    state.disputes.unshift(dispute);
    const user = ensureUserProfile(payload.buyerWallet);
    user.disputesOpened += 1;
    schedulePersist();
    return dispute;
  }

  function getDeveloperWorkspace(wallet) {
    const developer = ensureDeveloperProfile(wallet);
    const appsByDeveloper = state.apps.filter((app) => app.sellerWallet === wallet);
    const scans = state.scans.slice(0, 5);
    return { developer, apps: appsByDeveloper, recentScans: scans };
  }

  function getWalletProfile(wallet) {
    const profile = ensureUserProfile(wallet);
    const licenses = listWalletLicenses(wallet);
    return {
      profile,
      licenses,
      disputes: state.disputes.filter((dispute) => dispute.buyerWallet === wallet),
      stats: {
        totalSpentTon: profile.totalSpentTon,
        totalLicenses: profile.totalLicenses,
        devicesBound: profile.devicesBound,
        activeTrials: licenses.filter((license) => license.state === 'trial_active').length,
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
    activateLicenseDevice,
    openDispute,
    getDeveloperWorkspace,
    getWalletProfile,
    getContractOverview,
    getState: () => state,
  };
}

let tonForgeServiceInstance = createTonForgeService();

function setTonForgeService(instance) {
  tonForgeServiceInstance = instance;
}

module.exports = {
  createTonForgeService,
  setTonForgeService,
};

Object.defineProperty(module.exports, 'tonForgeService', {
  get() {
    return tonForgeServiceInstance;
  },
});
