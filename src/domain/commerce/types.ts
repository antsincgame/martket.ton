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
  nftEnabled?: boolean;
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
  decimals: number;
  currency: string;
  jettonMaster: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface ConfirmOrderResponse {
  state: string;
  orderId: string;
  entitlement?: { deliveryPayload: string };
  license?: { id: string; state: LicenseState };
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
  };
  deliveryPayload: string | null;
}
