export const DATABASE_ID = 'marketplace';
export const COL_SELLER_PROFILES = 'seller_profiles';
export const COL_LISTINGS = 'listings';
export const COL_LISTING_SECRETS = 'listing_secrets';
export const COL_ORDERS = 'orders';
export const COL_ENTITLEMENTS = 'entitlements';
export const COL_AUDIT = 'commerce_audit_logs';
export const COL_DOWNLOAD_AUDIT = 'download_audit';
export const COL_LICENSES = 'licenses';
export const COL_REVIEWS = 'reviews';
export const COL_WORKER_LOCKS = 'worker_locks';
export const COL_AGENT_TOKENS = 'agent_tokens';
export const COL_AGENT_INSTRUCTIONS = 'agent_instructions';
export const COL_SELLER_COLLECTIONS = 'seller_collections';
export const COL_AML_CHECKS = 'aml_checks';
export const BUCKET_ASSETS = 'commerce_assets';

export const ORDER_STATE = {
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  FULFILLED: 'fulfilled',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
} as const;

export const LICENSE_STATE = {
  /** Order is paid; oracle hasn't confirmed mint yet. Download blocked. */
  MINT_PENDING: 'mint_pending',
  /** NFT is on-chain and registered with escrow. Download unlocked. */
  MINTED: 'minted',
  /** Mint failed after retries; eligible for refund. Download blocked. */
  MINT_FAILED: 'mint_failed',
  /**
   * Mint failed past the dwell window and never registered an NFT — the buyer
   * can reclaim the escrowed funds on-chain via RefundIfNotMinted (buyer-only;
   * the oracle cannot refund pre-mint, by contract design). Download blocked.
   */
  REFUND_CLAIMABLE: 'refund_claimable',
  /** Buyer broadcast RefundIfNotMinted (claim recorded); awaiting on-chain settlement. */
  REFUND_PENDING: 'refund_pending',
  /** Buyer burned the NFT to claim a refund. */
  BURNED: 'burned',
  /** Funds returned to buyer (auto via OracleRefund / RefundOnBurn or manual). */
  REFUNDED: 'refunded',
} as const;
export type LicenseStateValue = (typeof LICENSE_STATE)[keyof typeof LICENSE_STATE];

export const LISTING_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  /** Auto-suspended by ops/migration (e.g. missing collection_address after NFT-bridge). */
  SUSPENDED: 'suspended',
} as const;

export const CURRENCY = {
  TON: 'TON',
} as const;

export const DEFAULT_PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '1500', 10);
