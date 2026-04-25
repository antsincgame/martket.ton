import type { TonForgeState, TonAddress, LicenseId, PurchaseSessionId } from '../domain/types.js';

const DEMO_TREASURY_WALLET =
  (process.env.TREASURY_WALLET_ADDRESS || 'EQDemoTreasuryWalletTonForge0000000000000000000000000') as TonAddress;

const developerProfiles = [
  {
    wallet: 'EQBDeveloperForgeWallet0000000000000000000000000000001' as TonAddress,
    displayName: 'TonForge Labs',
    legalName: 'TonForge Labs Ltd.',
    contactEmail: 'labs@tonforge.org',
    country: 'EE',
    bio: 'Team building NFT-licensed digital software on TON.',
    kycStatus: 'approved' as const,
    sellerBadge: 'Trusted Seller',
    verifiedAt: '2026-04-01T10:00:00.000Z',
  },
  {
    wallet: 'EQBDeveloperForgeWallet0000000000000000000000000000002' as TonAddress,
    displayName: 'Quantum Apps',
    legalName: 'Quantum Apps OÜ',
    contactEmail: 'hello@quantum-apps.io',
    country: 'LT',
    bio: 'Desktop tooling and Telegram Mini Apps provider.',
    kycStatus: 'approved' as const,
    sellerBadge: 'Verified Developer',
    verifiedAt: '2026-04-03T11:15:00.000Z',
  },
];

const apps = [
  {
    appId: 'app_cosmic_code_editor',
    catalogProductId: '1',
    slug: 'cosmic-code-editor',
    name: 'Cosmic Code Editor Pro',
    category: 'developer-tools',
    summary: 'Cross-platform code editor with NFT licensing and device binding.',
    description: 'Code editor for Web, Desktop and Telegram Mini Apps with lifetime NFT license and on-chain SHA-256 artifact verification.',
    sellerWallet: developerProfiles[0]!.wallet,
    featured: true,
    priceUsd: 49.99,
    commissionBps: 2000,
    buyerProtectionHours: 72,
    artifact: { fileName: 'cosmic-code-editor-pro.zip', version: '1.4.0', sizeLabel: '84 MB', downloadUrl: 'https://downloads.tonforge.org/cosmic-code-editor-pro.zip', sha256: '3d1b81d4f96c1c44e0ab5fc55ab4a4f73f3604439b11a8894becc2ec6af4a4fd', developerSignature: 'ed25519:tonforge-labs:cosmic-code-editor-pro:v1', malwareStatus: 'passed', platforms: ['Web', 'macOS', 'Windows'] },
    license: { type: 'SBT', transferLimit: 0, activationPolicy: 'single_device', contractStatus: 'collection_ready' },
    trust: { sellerBadge: 'Trusted Seller', kycStatus: 'approved', refundRate: 0.08, rating: 4.9, reviewCount: 128 },
    metrics: { downloads: 1240, weeklyPurchases: 87, activeLicenses: 653 },
  },
  {
    appId: 'app_inner_peace_miniapp',
    catalogProductId: '2',
    slug: 'inner-peace-miniapp',
    name: 'Inner Peace Mini App',
    category: 'telegram-mini-apps',
    summary: 'Telegram Mini App with NFT licensing and 72h escrow.',
    description: 'Telegram Mini App with one-time TON payment, NFT license and 72h buyer trial window.',
    sellerWallet: developerProfiles[1]!.wallet,
    featured: true,
    priceUsd: 24.99,
    commissionBps: 2000,
    buyerProtectionHours: 72,
    artifact: { fileName: 'inner-peace-miniapp.tgz', version: '2.1.3', sizeLabel: '11 MB', downloadUrl: 'https://downloads.tonforge.org/inner-peace-miniapp.tgz', sha256: '6d4e0872617d5eb0b7763ae7cf4473e5dc2806c8f6776e6fbbca174e8165072d', developerSignature: 'ed25519:quantum-apps:inner-peace-miniapp:v2', malwareStatus: 'passed', platforms: ['Telegram', 'Web'] },
    license: { type: 'Transferable', transferLimit: 3, activationPolicy: 'single_device', contractStatus: 'registry_pending' },
    trust: { sellerBadge: 'Verified Developer', kycStatus: 'approved', refundRate: 0.11, rating: 4.7, reviewCount: 86 },
    metrics: { downloads: 2190, weeklyPurchases: 112, activeLicenses: 1110 },
  },
  {
    appId: 'app_oracle_sdk',
    catalogProductId: '3',
    slug: 'oracle-sdk',
    name: 'Oracle SDK',
    category: 'libraries-sdk',
    summary: 'SDK for AI and on-chain entitlement checks.',
    description: 'Library suite for licensing, device activation and NFT entitlement verification for paid products.',
    sellerWallet: developerProfiles[0]!.wallet,
    featured: false,
    priceUsd: 69.99,
    commissionBps: 2000,
    buyerProtectionHours: 72,
    artifact: { fileName: 'oracle-sdk.tgz', version: '0.9.2', sizeLabel: '6 MB', downloadUrl: 'https://downloads.tonforge.org/oracle-sdk.tgz', sha256: '58cce87e88604a880f417f7ca0f4ee8ae08a8741bbd3f9125cbc0b8d1e36fb31', developerSignature: 'ed25519:tonforge-labs:oracle-sdk:v1', malwareStatus: 'passed', platforms: ['npm', 'Node.js', 'Web'] },
    license: { type: 'SBT', transferLimit: 0, activationPolicy: 'multi_device_team', contractStatus: 'collection_ready' },
    trust: { sellerBadge: 'Trusted Seller', kycStatus: 'approved', refundRate: 0.04, rating: 4.95, reviewCount: 41 },
    metrics: { downloads: 610, weeklyPurchases: 29, activeLicenses: 278 },
  },
];

const userProfiles = [
  { wallet: 'EQBBuyerWalletTonForge00000000000000000000000000000001' as TonAddress, displayName: 'Astra Buyer', email: 'astra@tonforge.org', role: 'buyer', totalSpentTon: 47.7, totalLicenses: 2, devicesBound: 2 },
];

const reviews = [
  { id: 'review_1', appId: apps[0]!.appId, author: 'web3_builder', rating: 5, comment: 'Excellent DX, license activation takes under a minute.', createdAt: '2026-04-04T08:00:00.000Z' },
  { id: 'review_2', appId: apps[1]!.appId, author: 'telegram_founder', rating: 4, comment: 'Good Mini App flow, but would love more analytics on active devices.', createdAt: '2026-04-05T09:30:00.000Z' },
];

const licenses = [
  {
    licenseId: 'lic_demo_1' as LicenseId,
    nftAddress: 'EQDNftLicenseDemo0000000000000000000000000000000000001',
    collectionAddress: 'EQDCollectionDemo0000000000000000000000000000000001',
    escrowAddress: 'EQDEscrowDemo000000000000000000000000000000000000001',
    appId: apps[0]!.appId,
    buyerWallet: userProfiles[0]!.wallet,
    state: 'released' as const,
    purchaseSessionId: 'session_seed_1' as PurchaseSessionId,
    activatedDevices: [{ deviceId: 'astra-macbook-pro', activatedAt: '2026-04-04T10:00:00.000Z' }],
    trialEndsAt: '2026-04-07T10:00:00.000Z',
    purchaseTxHash: '0xseededpurchase1',
  },
];

export function createDemoState(): TonForgeState {
  return {
    treasuryWallet: DEMO_TREASURY_WALLET,
    developerProfiles: developerProfiles.map((item) => ({ ...item })),
    apps: apps.map((item) => ({
      ...item,
      artifact: { ...item.artifact, platforms: [...item.artifact.platforms] },
      license: { ...item.license },
      trust: { ...item.trust },
      metrics: { ...item.metrics },
    })),
    userProfiles: userProfiles.map((item) => ({ ...item })),
    reviews: reviews.map((item) => ({ ...item })),
    licenses: licenses.map((item) => ({
      ...item,
      activatedDevices: item.activatedDevices.map((device) => ({ ...device })),
    })),
    purchaseSessions: [],
    scans: [],
  };
}

export { DEMO_TREASURY_WALLET };
