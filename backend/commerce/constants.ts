export const DATABASE_ID = 'marketplace';
export const COL_SELLER_PROFILES = 'seller_profiles';
export const COL_LISTINGS = 'listings';
export const COL_LISTING_SECRETS = 'listing_secrets';
export const COL_ORDERS = 'orders';
export const COL_ENTITLEMENTS = 'entitlements';
export const COL_AUDIT = 'commerce_audit_logs';
export const BUCKET_ASSETS = 'commerce_assets';

export const ORDER_STATE = {
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  FULFILLED: 'fulfilled',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
} as const;

export const LISTING_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
} as const;

export const CURRENCY = {
  TON: 'TON',
  JETTON: 'JETTON',
} as const;

export const DEFAULT_PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '1500', 10);
