/**
 * Unified Domain Model: Product → Listing → Order → License → Device
 *
 * Single source of truth for the entire TON Web Store.
 * Used by both core (profiles/products) and commerce (listings/orders) subsystems.
 */

// ─── Branded ID types ────────────────────────────────────────────────

export type ProfileId = string & { readonly __brand: 'ProfileId' };
export type ProductId = string & { readonly __brand: 'ProductId' };
export type ListingId = string & { readonly __brand: 'ListingId' };
export type OrderId = string & { readonly __brand: 'OrderId' };
export type LicenseId = string & { readonly __brand: 'LicenseId' };
export type DisputeId = string & { readonly __brand: 'DisputeId' };
export type PurchaseSessionId = string & { readonly __brand: 'PurchaseSessionId' };
export type TonAddress = string & { readonly __brand: 'TonAddress' };

// ─── Enums ───────────────────────────────────────────────────────────

export const UserRole = {
  VIEWER: 'viewer',
  DEMIURGE: 'demiurge',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ProductStatus = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  PUBLISHED: 'published',
  SUSPENDED: 'suspended',
  REJECTED: 'rejected',
} as const;
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

export const ListingStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
} as const;
export type ListingStatus = (typeof ListingStatus)[keyof typeof ListingStatus];

export const OrderState = {
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  FULFILLED: 'fulfilled',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
} as const;
export type OrderState = (typeof OrderState)[keyof typeof OrderState];

export const LicenseState = {
  TRIAL_ACTIVE: 'trial_active',
  DEVICE_BOUND: 'device_bound',
  RELEASED: 'released',
  REVOKED: 'revoked',
} as const;
export type LicenseState = (typeof LicenseState)[keyof typeof LicenseState];

export const DisputeStatus = {
  OPEN: 'open',
  RESOLVED_REFUND: 'resolved_refund',
  RESOLVED_RELEASE: 'resolved_release',
} as const;
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

export const Currency = {
  TON: 'TON',
  JETTON: 'JETTON',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const KycStatus = {
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];

export const SecurityLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;
export type SecurityLevel = (typeof SecurityLevel)[keyof typeof SecurityLevel];

export const ScanStatus = {
  PENDING: 'pending',
  SCANNING: 'scanning',
  CLEAN: 'clean',
  SUSPICIOUS: 'suspicious',
  MALICIOUS: 'malicious',
  ERROR: 'error',
} as const;
export type ScanStatus = (typeof ScanStatus)[keyof typeof ScanStatus];

export const ScanJobStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
} as const;
export type ScanJobStatus = (typeof ScanJobStatus)[keyof typeof ScanJobStatus];

// ─── Profile (Demiurge) ─────────────────────────────────────────────

export interface Profile {
  readonly id: ProfileId;
  email: string | null;
  tonAddress: TonAddress | null;
  name: string;
  displayName: string;
  role: UserRole;
  avatar: string | null;
  bio: string | null;
  securityLevel: SecurityLevel;
  isActive: boolean;
  appwriteUserId: string | null;
  /** @deprecated Legacy from Clerk migration; new profiles use appwriteUserId. */
  clerkUserId: string | null;
  /** Storefront slug for /developer/:slug public page. */
  slug: string | null;
  /** Public banner URL (hero background). */
  bannerUrl: string | null;
  website: string | null;
  github: string | null;
  telegram: string | null;
  twitter: string | null;
  /** Long-form public manifest (max 500 chars, see ABOUT_LONG_MAX). */
  aboutLong: string | null;
  /** JSON-encoded array of product IDs the demiurge has pinned (max 4). */
  featuredProductIds: string | null;
  /** Verified demiurges get auto-publish after scan=clean (no manual moderation). */
  verified: boolean;
  /** Reputation score: +1 per approved publication, -5 per rejection. */
  trustScore: number;
  publishedCount: number;
  rejectionCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ─── Product ────────────────────────────────────────────────────────

export interface Product {
  readonly id: ProductId;
  creatorId: ProfileId;
  name: string;
  description: string | null;
  shortDescription: string | null;
  priceTon: number;
  category: string;
  image: string | null;
  rating: number;
  reviewsCount: number;
  downloads: number;
  status: ProductStatus;
  version: string | null;
  buildR2Key: string | null;
  buildSha256: string | null;
  buildSizeBytes: number | null;
  buildFilename: string | null;
  /** Antivirus scan result for the build. */
  scanStatus: ScanStatus;
  scanProvider: string | null;
  /** External report id (e.g. VirusTotal analysis id). */
  scanReportId: string | null;
  scanMaliciousCount: number;
  scanTotalEngines: number;
  scanCompletedAt: string | null;
  /** Temporary R2 key while build is in quarantine; cleared after move to public path. */
  quarantineKey: string | null;
  /** Profile id of the moderator who approved/rejected the product. */
  moderatorId: string | null;
  moderationReason: string | null;
  moderatedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ─── Scan Job (queue) ───────────────────────────────────────────────

export interface ScanJob {
  readonly id: string;
  productId: ProductId;
  quarantineKey: string;
  sha256: string;
  sizeBytes: number;
  status: ScanJobStatus;
  attempts: number;
  vtAnalysisId: string | null;
  errorMessage: string | null;
  readonly createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

// ─── Listing (Commerce) ─────────────────────────────────────────────

export interface Listing {
  readonly id: ListingId;
  sellerWallet: TonAddress;
  catalogProductId: ProductId;
  title: string;
  description: string;
  currency: Currency;
  jettonMaster: string;
  priceAmountRaw: string;
  decimals: number;
  platformFeeBps: number;
  status: ListingStatus;
  deliveryType: string;
  assetFileId: string;
}

export interface ListingSecret {
  readonly id: string;
  listingId: ListingId;
  deliveryPayload: string;
}

// ─── Order ──────────────────────────────────────────────────────────

export interface Order {
  readonly id: OrderId;
  listingId: ListingId;
  buyerWallet: TonAddress;
  amountRaw: string;
  currency: Currency;
  jettonMaster: string;
  memo: string;
  tonTxHash: string;
  state: OrderState;
  sellerNetAmountRaw: string;
  listingSnapshotTitle: string;
  readonly createdAt: string;
}

export interface Entitlement {
  readonly id: string;
  orderId: OrderId;
  buyerWallet: TonAddress;
  listingId: ListingId;
  deliveryPayload: string;
}

// ─── License (TonForge) ─────────────────────────────────────────────

export interface ActivatedDevice {
  deviceId: string;
  activatedAt: string;
}

export interface License {
  readonly licenseId: LicenseId;
  nftAddress: string;
  collectionAddress: string;
  escrowAddress: string;
  appId: string;
  buyerWallet: TonAddress;
  state: LicenseState;
  purchaseSessionId: PurchaseSessionId;
  activatedDevices: ActivatedDevice[];
  trialEndsAt: string;
  purchaseTxHash: string;
}

// ─── Purchase Session (TonForge) ────────────────────────────────────

export const PurchaseSessionState = {
  AWAITING_PAYMENT: 'awaiting_wallet_payment',
  TRIAL_ACTIVE: 'trial_active',
  RELEASED: 'released',
  REFUNDED: 'refunded',
} as const;
export type PurchaseSessionState = (typeof PurchaseSessionState)[keyof typeof PurchaseSessionState];

export interface PurchaseSession {
  readonly purchaseSessionId: PurchaseSessionId;
  buyerWallet: TonAddress;
  appId: string;
  state: PurchaseSessionState;
  amountTon: number;
  amountNano: string;
  treasuryWallet: TonAddress;
  escrowAddress: string;
  memo: string;
  readonly createdAt: string;
  trialEndsAt: string;
}

// ─── Developer Profile (TonForge) ───────────────────────────────────

export interface DeveloperProfile {
  wallet: TonAddress;
  displayName: string;
  legalName: string;
  contactEmail: string;
  country: string;
  bio: string;
  kycStatus: KycStatus;
  sellerBadge: string;
  verifiedAt: string | null;
}

// ─── TonForge App ───────────────────────────────────────────────────

export interface ArtifactInfo {
  fileName: string;
  version: string;
  sizeLabel: string;
  downloadUrl: string;
  sha256: string;
  developerSignature: string;
  malwareStatus: string;
  platforms: string[];
}

export interface LicensePolicy {
  type: string;
  transferLimit: number;
  activationPolicy: string;
  contractStatus: string;
}

export interface TrustInfo {
  sellerBadge: string;
  kycStatus: string;
  disputeRate: number;
  refundRate: number;
  rating: number;
  reviewCount: number;
}

export interface AppMetrics {
  downloads: number;
  weeklyPurchases: number;
  activeLicenses: number;
}

export interface TonForgeApp {
  readonly appId: string;
  catalogProductId: string;
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  sellerWallet: TonAddress;
  featured: boolean;
  priceTon: number;
  commissionBps: number;
  buyerProtectionHours: number;
  artifact: ArtifactInfo;
  license: LicensePolicy;
  trust: TrustInfo;
  metrics: AppMetrics;
}

// ─── Dispute ────────────────────────────────────────────────────────

export interface Dispute {
  readonly disputeId: DisputeId;
  licenseId: LicenseId;
  buyerWallet: TonAddress;
  reason: string;
  state: DisputeStatus;
  readonly createdAt: string;
}

export interface CommerceDispute {
  readonly id: DisputeId;
  orderId: OrderId;
  openedByWallet: TonAddress;
  reason: string;
  status: DisputeStatus;
  resolutionNote: string;
}

// ─── Audit ──────────────────────────────────────────────────────────

export interface AuditLog {
  readonly id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  result: string;
  metadata: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  readonly createdAt: string;
}

// ─── Purchase (Legacy Core) ─────────────────────────────────────────

export interface Purchase {
  readonly id: string;
  userId: ProfileId;
  productId: ProductId;
  priceTon: number;
  txHash: string | null;
  readonly createdAt: string;
}

// ─── TonForge State (in-memory aggregate) ───────────────────────────

export interface TonForgeState {
  treasuryWallet: TonAddress;
  developerProfiles: DeveloperProfile[];
  apps: TonForgeApp[];
  userProfiles: UserProfile[];
  reviews: AppReview[];
  licenses: License[];
  purchaseSessions: PurchaseSession[];
  scans: ScanResult[];
  disputes: Dispute[];
}

export interface UserProfile {
  wallet: TonAddress;
  displayName: string;
  email: string;
  role: string;
  totalSpentTon: number;
  totalLicenses: number;
  devicesBound: number;
  disputesOpened: number;
}

export interface AppReview {
  id: string;
  appId: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ScanResult {
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

// ─── API Response wrapper ───────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

// ─── Verification result ────────────────────────────────────────────

export interface PaymentVerification {
  ok: boolean;
  reason?: string;
  value?: string;
  expected?: string;
  comment?: string;
  details?: Record<string, unknown>;
}
