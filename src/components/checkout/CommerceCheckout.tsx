import { useCallback, useEffect, useState } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { Loader2, ShieldCheck, Wallet, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { beginCell, Cell } from '@ton/core';
import {
  fetchListingsForCatalog,
  createCommerceOrder,
  confirmCommerceOrder,
} from '../../lib/commerceApi';
import type { CreateOrderResponse } from '../../domain/commerce/types';
import type { CommerceListingPublic } from '../../domain/commerce/types';
import { logger } from '../../lib/logger';

interface Props {
  catalogProductId: string;
}

type Phase =
  | 'loading'
  | 'no-listing'
  | 'ready'
  | 'creating-order'
  | 'awaiting-wallet'
  | 'confirming'
  | 'done'
  | 'error';

export default function CommerceCheckout({ catalogProductId }: Props) {
  const buyerWallet = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();

  const [listing, setListing] = useState<CommerceListingPublic | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [_order, setOrder] = useState<CreateOrderResponse | null>(null);
  const [delivery, setDelivery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    fetchListingsForCatalog(catalogProductId)
      .then(({ primary }) => {
        if (cancelled) return;
        if (!primary) { setPhase('no-listing'); return; }
        setListing(primary);
        setPhase('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logger.warn('[checkout] listing fetch', err);
        setPhase('no-listing');
      });
    return () => { cancelled = true; };
  }, [catalogProductId]);

  const handleBuy = useCallback(async () => {
    if (!listing || !buyerWallet) return;
    setError(null);

    try {
      setPhase('creating-order');
      const ord = await createCommerceOrder(listing.id, buyerWallet);
      setOrder(ord);

      setPhase('awaiting-wallet');

      const useEscrow = !!ord.escrow;
      const targetAddress = useEscrow ? ord.escrow!.address : ord.treasuryAddress;
      const amount = useEscrow ? ord.escrow!.totalAmountRaw : ord.amountRaw;
      const payload = useEscrow ? ord.escrow!.payload : buildTransferBoc(ord.treasuryAddress, ord.amountRaw, ord.memo);
      const stateInit = useEscrow ? ord.escrow!.stateInit : undefined;

      const result = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: targetAddress, amount, payload, stateInit }],
      });

      const txHash = extractMsgHash(result.boc);

      setPhase('confirming');
      const confirmation = await confirmCommerceOrder(ord.orderId, buyerWallet, txHash);
      if (confirmation.entitlement?.deliveryPayload) {
        setDelivery(confirmation.entitlement.deliveryPayload);
      }
      setPhase('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Purchase failed';
      setError(msg);
      setPhase('error');
    }
  }, [listing, buyerWallet, tonConnectUI]);

  if (phase === 'loading') {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
        <Loader2 className="w-5 h-5 animate-spin text-[#00F5FF]" />
        <span className="text-sm text-gray-400">Loading checkout…</span>
      </div>
    );
  }

  if (phase === 'no-listing') {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
        <p className="text-sm text-gray-400">This product is not available for purchase yet.</p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5 space-y-3">
        <div className="flex items-center gap-2 text-green-400 font-semibold">
          <CheckCircle className="w-5 h-5" />
          Purchase complete
        </div>
        <p className="text-sm text-gray-300">
          The product has been added to your library.
        </p>
        {delivery && (
          <a
            href={delivery}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-green-500/20 border border-green-500/30 px-4 py-2 text-sm font-semibold text-green-400 hover:bg-green-500/30 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download now
          </a>
        )}
      </div>
    );
  }

  const isBusy = phase === 'creating-order' || phase === 'awaiting-wallet' || phase === 'confirming';
  const priceDisplay = listing?.priceTonHuman ?? humanFromRaw(listing?.priceAmountRaw ?? '0');

  return (
    <div className="rounded-xl border border-[#FFD700]/20 bg-gradient-to-b from-[#FFD700]/5 to-transparent p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#FFD700]" />
          <span className="text-sm font-semibold text-white">Secure TON Payment</span>
        </div>
        <span className="text-lg font-display font-bold text-[#FFD700]">{priceDisplay} TON</span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!buyerWallet ? (
        <button
          type="button"
          onClick={() => void tonConnectUI.openModal()}
          className="w-full py-3 rounded-xl bg-[#0098EA] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#0098EA]/90 transition-colors"
        >
          <Wallet className="w-5 h-5" />
          Connect Wallet to Buy
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleBuy()}
          disabled={isBusy}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#0A0A0A] font-bold flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all disabled:opacity-50"
        >
          {isBusy ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {phase === 'creating-order' && 'Creating order…'}
              {phase === 'awaiting-wallet' && 'Confirm in wallet…'}
              {phase === 'confirming' && 'Verifying payment…'}
            </>
          ) : (
            <>
              <Wallet className="w-5 h-5" />
              Buy for {priceDisplay} TON
            </>
          )}
        </button>
      )}

      <p className="text-[10px] text-gray-500 text-center">
        Payment goes to a verified treasury address. On-chain verification via TonAPI.
      </p>
    </div>
  );
}

function buildTransferBoc(to: string, amountRaw: string, memo: string): string {
  const body = beginCell().storeUint(0, 32).storeStringTail(memo).endCell();
  void to;
  void amountRaw;
  return body.toBoc().toString('base64');
}

function extractMsgHash(boc: string): string {
  try {
    const raw = Uint8Array.from(atob(boc), (c) => c.charCodeAt(0));
    // @ton/core Cell.fromBoc accepts Buffer | Uint8Array; in the browser we pass Uint8Array
    const cells = Cell.fromBoc(raw as never);
    if (cells.length === 0) return boc.slice(0, 64);
    const hashBytes = cells[0]!.hash();
    return Array.from(new Uint8Array(hashBytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return boc.slice(0, 64);
  }
}

function humanFromRaw(raw: string): string {
  if (!raw || raw === '0') return '0';
  const padded = raw.padStart(10, '0');
  const intPart = padded.slice(0, padded.length - 9);
  const frac = padded.slice(padded.length - 9).replace(/0+$/, '');
  return frac ? `${intPart}.${frac}` : intPart;
}
