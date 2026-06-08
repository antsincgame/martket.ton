export interface CommerceListingPublic {
  id: string;
  sellerWallet: string;
  catalogProductId: string;
  title: string;
  description: string;
  currency: 'TON';
  priceAmountRaw: string;
  priceUsd?: string | null;
  decimals: number;
  platformFeeBps: number;
  status: string;
  deliveryType: string;
  assetFileId: string;
  priceTonHuman?: string;
  /** Always true after the NFT-mint bridge — kept for backward compat with old clients. */
  nftEnabled?: boolean;
  /** Pre-deployed AppCollection address for License NFTs. Empty for legacy listings. */
  collectionAddress?: string;
}

export interface CommerceConfigResponse {
  treasuryAddress: string;
  platformFeeBpsDefault: number;
  currencyTon: string;
}

export interface EscrowInfo {
  address: string;
  stateInit: string;
  payload: string;
  totalAmountRaw: string;
  trialWindowSec: number;
}

export interface GasBreakdown {
  escrowGasNano: string;
  mintGasNano: string;
  registerGasNano: string;
  totalGasNano: string;
}

export interface NftIntent {
  willMint: boolean;
  collectionAddress: string | null;
}

export interface CreateOrderResponse {
  orderId: string;
  memo: string;
  amountRaw: string;
  amountTonHuman?: string;
  /**
   * Что получит seller после escrow release (без fee).
   * Заполняется backend'ом из computeOrderAmounts.
   */
  sellerAmountRaw?: string;
  sellerAmountTonHuman?: string;
  /**
   * Platform fee (получает treasury после release).
   * Buyer видит эту сумму для прозрачности в UI.
   */
  feeAmountRaw?: string;
  feeAmountTonHuman?: string;
  /**
   * Applied fee in basis points (1500 = 15%).
   */
  feeBps?: number;
  decimals: number;
  currency: string;
  treasuryAddress: string;
  state: string;
  escrow: EscrowInfo | null;
  gasBreakdown?: GasBreakdown;
  nft?: NftIntent;
}

export type LicenseState =
  | 'mint_pending'
  | 'minted'
  | 'mint_failed'
  | 'refund_claimable'
  | 'refund_pending'
  | 'burned'
  | 'refunded';

export interface LicensePublic {
  id: string;
  orderId: string;
  listingId: string;
  catalogProductId: string | null;
  buyerWallet: string;
  sellerWallet: string;
  state: LicenseState;
  nftAddress: string | null;
  collectionAddress: string | null;
  escrowAddress: string | null;
  mintTxHash: string | null;
  burnTxHash: string | null;
  mintError: string | null;
  mintAttempts: number;
  trialEndsAt: string | null;
  mintedAt: string | null;
  burnedAt: string | null;
  refundedAt: string | null;
  /** Buyer can reclaim escrowed funds on-chain (mint never completed). */
  refundClaimable?: boolean;
  /** ISO time the on-chain grace period elapses (claim becomes valid). */
  refundAvailableAt?: string | null;
  refundReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefundClaimInfo {
  claimable: boolean;
  code: string;
  reason: string;
  availableAt: string | null;
  escrowAddress: string | null;
  /** TonConnect message the buyer signs to reclaim funds, when claimable. */
  message: { address: string; amount: string; payload: string } | null;
}

/**
 * Ответ /orders/:id/confirm.
 *
 * v4 flow: если в order был escrowAddress, backend проверяет платёж на escrow.
 *   Возвращает `mintPending: true` — order остаётся в PENDING_PAYMENT, и mint
 *   worker позже задеплоит LicenseItem, после чего state станет PAID и
 *   entitlement будет создан.
 *
 * Legacy v3 flow: backend сразу создаёт entitlement и переводит в PAID.
 *   `entitlement.deliveryPayload` доступен немедленно.
 */
export interface ConfirmOrderResponse {
  state: string;
  orderId: string;
  escrowAddress?: string;
  tonTxHash?: string;
  /**
   * true для v4 escrow flow: платёж верифицирован, но license NFT ещё не
   * заминчена. UI должен показать индикатор "Minting in progress…" и
   * поллить /orders/:id до появления deliveryPayload.
   */
  mintPending?: boolean;
  entitlement?: {
    deliveryPayload: string;
  };
  license?: { id: string; state: LicenseState };
  message?: string;
}

export interface OrderStatusResponse {
  order: {
    id: string;
    listingId: string;
    state: string;
    amountRaw: string;
    currency: string;
    memo: string;
    tonTxHash: string;
    /** v4: адрес развёрнутого escrow контракта (или '' для v3 legacy) */
    escrowAddress?: string;
    /** v4: адрес LicenseItem после mint (или '' пока не заминчен) */
    licenseAddress?: string;
  };
  deliveryPayload: string | null;
}
