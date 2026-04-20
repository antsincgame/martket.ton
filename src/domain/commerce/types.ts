export interface CommerceListingPublic {
  id: string;
  sellerWallet: string;
  catalogProductId: string;
  title: string;
  description: string;
  currency: 'TON' | 'JETTON';
  jettonMaster: string;
  priceAmountRaw: string;
  decimals: number;
  platformFeeBps: number;
  status: string;
  deliveryType: string;
  assetFileId: string;
  priceTonHuman?: string;
}

export interface CommerceConfigResponse {
  treasuryAddress: string;
  platformFeeBpsDefault: number;
  currencyTon: string;
  currencyJetton: string;
  jettonMasterConfigured: boolean;
}

export interface EscrowInfo {
  address: string;
  stateInit: string;
  payload: string;
  totalAmountRaw: string;
  trialWindowSec: number;
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
  jettonMaster: string;
  treasuryAddress: string;
  state: string;
  escrow: EscrowInfo | null;
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
  orderId?: string;
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
