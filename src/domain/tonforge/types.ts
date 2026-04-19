// Типы TonForge выравнивают фронт с канонической моделью apps/licenses/escrow/device activation из нового API.
export type TonForgeKycStatus = 'draft' | 'under_review' | 'approved' | 'rejected';

export interface TonForgeArtifact {
  fileName: string;
  version: string;
  sizeLabel: string;
  downloadUrl: string;
  sha256: string;
  developerSignature: string;
  malwareStatus: string;
  platforms: string[];
}

export interface TonForgeLicensePolicy {
  type: 'SBT' | 'Transferable';
  transferLimit: number;
  activationPolicy: string;
  contractStatus: string;
}

export interface TonForgeTrustSignals {
  sellerBadge: string;
  kycStatus: TonForgeKycStatus;
  refundRate: number;
  rating: number;
  reviewCount: number;
}

export interface TonForgeMetrics {
  downloads: number;
  weeklyPurchases: number;
  activeLicenses: number;
}

export interface TonForgeApp {
  appId: string;
  catalogProductId: string;
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  sellerWallet: string;
  featured: boolean;
  priceTon: number;
  commissionBps: number;
  buyerProtectionHours: number;
  artifact: TonForgeArtifact;
  license: TonForgeLicensePolicy;
  trust: TonForgeTrustSignals;
  metrics: TonForgeMetrics;
}

export interface TonForgeReview {
  id: string;
  appId: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface TonForgePurchaseSession {
  purchaseSessionId: string;
  buyerWallet: string;
  appId: string;
  state: string;
  amountTon: number;
  amountNano: string;
  treasuryWallet: string;
  escrowAddress: string;
  memo: string;
  createdAt: string;
  trialEndsAt: string;
}

export interface TonForgeActivatedDevice {
  deviceId: string;
  activatedAt: string;
}

export interface TonForgeLicense {
  licenseId: string;
  nftAddress: string;
  collectionAddress: string;
  escrowAddress: string;
  appId: string;
  buyerWallet: string;
  state: string;
  purchaseSessionId: string;
  activatedDevices: TonForgeActivatedDevice[];
  trialEndsAt: string;
  purchaseTxHash: string;
  collectionIndex?: number;
  mintTxHash?: string | null;
  burnTxHash?: string | null;
  mintError?: string | null;
}

export interface TonForgeUserProfile {
  wallet: string;
  displayName: string;
  email: string;
  role: string;
  totalSpentTon: number;
  totalLicenses: number;
  devicesBound: number;
}

export interface TonForgeDeveloperProfile {
  wallet: string;
  displayName: string;
  legalName: string;
  contactEmail: string;
  country: string;
  bio: string;
  kycStatus: TonForgeKycStatus;
  sellerBadge: string;
  verifiedAt: string | null;
}

export interface TonForgeArtifactScan {
  scanId: string;
  fileName: string;
  artifactUrl: string;
  sha256: string;
  integrityFingerprint: string;
  status: string;
  findings: string[];
  scannedAt: string;
  engines: Array<{ name: string; verdict: string }>;
}

export interface TonForgeDeveloperWorkspace {
  developer: TonForgeDeveloperProfile;
  apps: TonForgeApp[];
  recentScans: TonForgeArtifactScan[];
}

export interface TonForgeWalletProfile {
  profile: TonForgeUserProfile;
  licenses: TonForgeLicense[];
  stats: {
    totalSpentTon: number;
    totalLicenses: number;
    devicesBound: number;
    activeTrials: number;
  };
}

export interface TonForgeContractOverview {
  backendMode: string;
  trackedContracts: Record<
    string,
    {
      name: string;
      standard: string;
      responsibility: string;
      trackedEvents: string[];
    }
  >;
  onChainFields: string[];
  treasuryWallet: string;
}
