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
  decimals: number;
  currency: string;
  jettonMaster: string;
  treasuryAddress: string;
  state: string;
  escrow: EscrowInfo | null;
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
