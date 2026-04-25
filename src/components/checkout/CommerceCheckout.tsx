import { useCallback, useEffect, useRef, useState } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { Loader2, ShieldCheck, Wallet, Download, AlertTriangle, CheckCircle, Info, Sparkles } from 'lucide-react';
import { beginCell, Cell } from '@ton/core';
import {
  fetchListingsForCatalog,
  createCommerceOrder,
  confirmCommerceOrder,
  fetchCommerceOrder,
} from '../../lib/commerceApi';
import type { CreateOrderResponse } from '../../domain/commerce/types';
import type { CommerceListingPublic } from '../../domain/commerce/types';
import { logger } from '../../lib/logger';
import KycLiteModal from '../kyc/KycLiteModal';

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
  | 'minting'        // v4: payment verified, license NFT being minted by worker
  | 'done'
  | 'error';

const MINT_POLL_INTERVAL_MS = 5_000;
const MINT_POLL_MAX_ATTEMPTS = 60;  // 60 * 5s = 5 min ceiling

export default function CommerceCheckout({ catalogProductId }: Props) {
  const buyerWallet = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();

  const [listing, setListing] = useState<CommerceListingPublic | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [order, setOrder] = useState<CreateOrderResponse | null>(null);
  const [delivery, setDelivery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mintProgress, setMintProgress] = useState<number>(0);
  const [showKycLite, setShowKycLite] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup polling timer при unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

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

  /**
   * Polls /orders/:id every 5s until either:
   *  - state becomes PAID/FULFILLED + deliveryPayload is set → phase=done
   *  - max attempts exceeded → phase=error (with friendly message)
   */
  const startMintPolling = useCallback(async (orderId: string, walletAddr: string) => {
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      setMintProgress(attempts);
      try {
        const status = await fetchCommerceOrder(orderId, walletAddr);
        const isPaidOrFulfilled = status.order.state === 'paid' || status.order.state === 'fulfilled';
        if (isPaidOrFulfilled && status.deliveryPayload) {
          setDelivery(status.deliveryPayload);
          setPhase('done');
          return;
        }
      } catch (err) {
        logger.warn('[checkout] mint poll error:', err instanceof Error ? err.message : err);
        // Сетевые ошибки не считаем фатальными — продолжаем polling
      }
      if (attempts >= MINT_POLL_MAX_ATTEMPTS) {
        setError(
          'Minting taking longer than expected. Your payment is safe — license will appear in your library shortly. You can refresh the page.',
        );
        setPhase('error');
        return;
      }
      pollTimerRef.current = setTimeout(() => void poll(), MINT_POLL_INTERVAL_MS);
    };
    pollTimerRef.current = setTimeout(() => void poll(), MINT_POLL_INTERVAL_MS);
  }, []);

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

      // v4 flow: backend подтвердил платёж, но license NFT минтится worker'ом.
      // Опрашиваем /orders/:id до появления entitlement.
      if (confirmation.mintPending) {
        setPhase('minting');
        setMintProgress(0);
        await startMintPolling(ord.orderId, buyerWallet);
        return;
      }

      // Legacy v3 flow или v4 у которого worker уже успел отработать —
      // entitlement пришёл сразу.
      if (confirmation.entitlement?.deliveryPayload) {
        setDelivery(confirmation.entitlement.deliveryPayload);
      }
      setPhase('done');
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Purchase failed';
      const code = (err as { code?: string }).code;

      if (code === 'KYC_LITE_REQUIRED' || /KYC_LITE_REQUIRED/.test(raw)) {
        setPhase('ready');
        setShowKycLite(true);
        return;
      }

      let msg = raw;
      if (/OFAC_SDN|EU_CONSOLIDATED|SANCTIONED/.test(raw)) {
        msg = 'This wallet is on a public sanctions list (US OFAC / EU). The purchase is legally unavailable.';
      } else if (/KYC_REQUIRED|KYC_PENDING|KYC_REJECTED/.test(raw)) {
        msg = 'Seller verification is incomplete. Please retry later or contact support.';
      }
      setError(msg);
      setPhase('error');
    }
  }, [listing, buyerWallet, tonConnectUI, startMintPolling]);

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

  if (phase === 'minting') {
    const elapsed = mintProgress * (MINT_POLL_INTERVAL_MS / 1000);
    return (
      <div className="rounded-xl border border-[#00F5FF]/30 bg-gradient-to-b from-[#00F5FF]/10 to-transparent p-5 space-y-3">
        <div className="flex items-center gap-2 text-[#00F5FF] font-semibold">
          <Sparkles className="w-5 h-5 animate-pulse" />
          Payment received — minting your license NFT…
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <Loader2 className="w-4 h-4 animate-spin text-[#00F5FF]" />
          <span>License NFT is being deployed on-chain. This usually takes 30–60 seconds.</span>
        </div>
        <div className="text-[10px] text-gray-500 font-mono">
          Elapsed: {elapsed}s · Polling for license registration…
        </div>
        {order?.escrow && (
          <div className="text-[10px] text-gray-500 font-mono break-all">
            Escrow: {order.escrow.address.slice(0, 12)}…{order.escrow.address.slice(-8)}
          </div>
        )}
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

  const handleKycComplete = useCallback(() => {
    setShowKycLite(false);
    void handleBuy();
  }, [handleBuy]);

  const isBusy = phase === 'creating-order' || phase === 'awaiting-wallet' || phase === 'confirming';
  const sellerPriceHuman = listing?.priceTonHuman ?? humanFromRaw(listing?.priceAmountRaw ?? '0');
  // Fee breakdown виден только когда backend вернул order с fee/sellerAmount полями.
  // До создания order'а показываем estimate из listing.platformFeeBps.
  const estimatedFeeBps = order?.feeBps ?? listing?.platformFeeBps ?? 1500;
  const sellerTon = order?.sellerAmountTonHuman ?? sellerPriceHuman;
  const feeTon = order?.feeAmountTonHuman ?? estimateFeeTonHuman(sellerPriceHuman, estimatedFeeBps);
  const totalTon = order?.amountTonHuman ?? addTonHuman(sellerTon, feeTon);

  return (
    <>
    {showKycLite && (
      <KycLiteModal
        onComplete={handleKycComplete}
        onClose={() => setShowKycLite(false)}
      />
    )}
    <div className="rounded-xl border border-[#FFD700]/20 bg-gradient-to-b from-[#FFD700]/5 to-transparent p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#FFD700]" />
          <span className="text-sm font-semibold text-white">Secure TON Payment</span>
        </div>
        <span className="text-lg font-display font-bold text-[#FFD700]">{totalTon} TON</span>
      </div>

      {/* Fee breakdown */}
      <div className="rounded-lg bg-black/20 border border-white/5 p-3 space-y-1.5 text-xs">
        <div className="flex justify-between text-gray-400">
          <span>Seller price</span>
          <span className="font-mono text-gray-200">{sellerTon} TON</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span className="flex items-center gap-1">
            Platform fee
            <span title={`${(estimatedFeeBps / 100).toFixed(1)}% of seller price`}>
              <Info className="w-3 h-3 text-gray-500" />
            </span>
          </span>
          <span className="font-mono text-gray-200">+ {feeTon} TON</span>
        </div>
        <div className="border-t border-white/10 pt-1.5 flex justify-between font-semibold">
          <span className="text-white">You pay</span>
          <span className="font-mono text-[#FFD700]">{totalTon} TON</span>
        </div>
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
              Buy for {totalTon} TON
            </>
          )}
        </button>
      )}

      <p className="text-[10px] text-gray-500 text-center">
        {order?.escrow
          ? 'Funds held in on-chain escrow until you confirm delivery. Auto-release after trial window.'
          : 'Payment goes to a verified treasury address. On-chain verification via TonAPI.'}
      </p>
    </div>
    </>
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

/**
 * Estimate fee for display: seller * bps / 10000. Client-side approximation;
 * backend всё равно считает свой правильный ответ после create order.
 */
function estimateFeeTonHuman(sellerHuman: string, feeBps: number): string {
  const seller = parseFloat(sellerHuman) || 0;
  const fee = (seller * feeBps) / 10000;
  return fee.toFixed(fee < 0.01 ? 6 : 4).replace(/0+$/, '').replace(/\.$/, '');
}

function addTonHuman(a: string, b: string): string {
  const sum = (parseFloat(a) || 0) + (parseFloat(b) || 0);
  return sum.toFixed(sum < 1 ? 6 : 4).replace(/0+$/, '').replace(/\.$/, '');
}
