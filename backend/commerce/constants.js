'use strict';

const DATABASE_ID = 'marketplace';
const COL_SELLER_PROFILES = 'seller_profiles';
const COL_LISTINGS = 'listings';
const COL_LISTING_SECRETS = 'listing_secrets';
const COL_ORDERS = 'orders';
const COL_ENTITLEMENTS = 'entitlements';
const COL_DISPUTES = 'disputes';
const COL_AUDIT = 'commerce_audit_logs';
const BUCKET_ASSETS = 'commerce_assets';

const ORDER_STATE = {
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  FULFILLED: 'fulfilled',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
};

const LISTING_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
};

const DISPUTE_STATUS = {
  OPEN: 'open',
  RESOLVED_REFUND: 'resolved_refund',
  RESOLVED_RELEASE: 'resolved_release',
};

const CURRENCY = {
  TON: 'TON',
  JETTON: 'JETTON',
};

module.exports = {
  DATABASE_ID,
  COL_SELLER_PROFILES,
  COL_LISTINGS,
  COL_LISTING_SECRETS,
  COL_ORDERS,
  COL_ENTITLEMENTS,
  COL_DISPUTES,
  COL_AUDIT,
  BUCKET_ASSETS,
  ORDER_STATE,
  LISTING_STATUS,
  DISPUTE_STATUS,
  CURRENCY,
  DEFAULT_PLATFORM_FEE_BPS: parseInt(process.env.PLATFORM_FEE_BPS || '250', 10),
};
