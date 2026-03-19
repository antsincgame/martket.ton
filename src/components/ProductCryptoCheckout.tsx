import { useCallback, useEffect, useState, type FC } from 'react';
import { useTonAddress } from '@tonconnect/ui-react';
import { Copy, ExternalLink, Loader2, ShieldCheck, Wallet } from 'lucide-react';
import type {
  CommerceConfigResponse,
  CommerceListingPublic,
  CreateOrderResponse,
} from '../domain/commerce/types';
import {
  confirmCommerceOrder,
  createCommerceOrder,
  fetchCommerceConfig,
  fetchCommerceOrder,
  fetchListingsForCatalog,
  openCommerceDispute,
} from '../lib/commerceApi';

interface ProductCryptoCheckoutProps {
  /** Идентификатор карточки витрины (как в URL /product/:id) */
  catalogProductId: string;
}

function copyText(text: string): void {
  void navigator.clipboard.writeText(text);
}

const ProductCryptoCheckout: FC<ProductCryptoCheckoutProps> = ({ catalogProductId }) => {
  const buyerAddress = useTonAddress();
  const [config, setConfig] = useState<CommerceConfigResponse | null>(null);
  const [primary, setPrimary] = useState<CommerceListingPublic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [order, setOrder] = useState<CreateOrderResponse | null>(null);
  const [txHash, setTxHash] = useState('');
  const [delivery, setDelivery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [orderState, setOrderState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, listings] = await Promise.all([
          fetchCommerceConfig(),
          fetchListingsForCatalog(catalogProductId),
        ]);
        if (!cancelled) {
          setConfig(cfg);
          setPrimary(listings.primary);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Commerce API недоступен');
          setPrimary(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogProductId]);

  const refreshOrder = useCallback(
    async (orderId: string, wallet: string) => {
      const st = await fetchCommerceOrder(orderId, wallet);
      setOrderState(st.order.state);
      setDelivery(st.deliveryPayload);
    },
    []
  );

  useEffect(() => {
    if (!order?.orderId || !buyerAddress) return;
    const t = window.setInterval(() => {
      void refreshOrder(order.orderId, buyerAddress).catch(() => undefined);
    }, 12_000);
    return () => window.clearInterval(t);
  }, [order?.orderId, buyerAddress, refreshOrder]);

  const onCreateOrder = async () => {
    if (!primary || !buyerAddress) return;
    setBusy(true);
    setLoadError(null);
    try {
      const o = await createCommerceOrder(primary.id, buyerAddress);
      setOrder(o);
      setOrderState(o.state);
      setDelivery(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Ошибка заказа');
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    if (!order || !buyerAddress || !txHash.trim()) return;
    setBusy(true);
    setLoadError(null);
    try {
      const res = await confirmCommerceOrder(order.orderId, buyerAddress, txHash.trim());
      setOrderState(res.state);
      setDelivery(res.entitlement?.deliveryPayload ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Подтверждение не прошло');
    } finally {
      setBusy(false);
    }
  };

  const onDispute = async () => {
    if (!order || !buyerAddress || !disputeReason.trim()) return;
    setBusy(true);
    try {
      await openCommerceDispute(order.orderId, buyerAddress, disputeReason.trim());
      setDisputeReason('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Спор не открыт');
    } finally {
      setBusy(false);
    }
  };

  const tonkeeperUrl =
    order && config?.treasuryAddress
      ? `https://app.tonkeeper.com/transfer/${encodeURIComponent(config.treasuryAddress)}?amount=${encodeURIComponent(order.amountRaw)}&text=${encodeURIComponent(order.memo)}`
      : '';

  if (loadError && !primary) {
    return (
      <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
        <p className="font-medium">Коммерция недоступна</p>
        <p className="text-yellow-200/80 mt-1">{loadError}</p>
        <p className="text-xs mt-2 text-yellow-200/60">
          Запустите backend с <code className="font-mono">TREASURY_WALLET_ADDRESS</code> и выполните{' '}
          <code className="font-mono">npm run provision:commerce</code>.
        </p>
      </div>
    );
  }

  if (!primary) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
        Для этого товара ещё нет активного листинга. Продавец может добавить его в разделе «Продажа».
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
      <div className="flex items-center gap-2 text-ton-400 font-semibold">
        <ShieldCheck className="w-5 h-5" />
        <span>Оплата в блокчейне</span>
      </div>
      <p className="text-sm text-gray-400">
        {primary.currency === 'JETTON' && !config?.jettonMasterConfigured
          ? 'Jetton: выпустите токен и задайте COMMERCE_JETTON_MASTER на сервере. Пока подтверждение jetton может быть отклонено.'
          : 'Цена фиксируется в заказе. Перевод на адрес казначейства платформы с точной суммой и комментарием (memo).'}
      </p>
      <div className="text-white">
        <span className="text-gray-400 text-sm">Листинг:</span>{' '}
        <span className="font-medium">{primary.title}</span>
        <div className="text-lg mt-1">
          {primary.currency === 'TON' && primary.priceTonHuman !== undefined
            ? `${primary.priceTonHuman} TON`
            : `${primary.priceAmountRaw} raw (${primary.currency})`}
        </div>
      </div>

      {!buyerAddress && (
        <div className="flex items-center gap-2 text-amber-300 text-sm">
          <Wallet className="w-4 h-4" />
          Подключите TON-кошелёк (кнопка в шапке), чтобы создать заказ.
        </div>
      )}

      {loadError && primary && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{loadError}</div>
      )}

      {!order && buyerAddress && (
        <button
          type="button"
          onClick={() => void onCreateOrder()}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-ton-gradient font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          Создать заказ и получить реквизиты
        </button>
      )}

      {order && config?.treasuryAddress && (
        <div className="space-y-3 text-sm border-t border-white/10 pt-4">
          <div>
            <div className="text-gray-400 mb-1">Адрес казначейства</div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs break-all bg-black/30 px-2 py-1 rounded">{config.treasuryAddress}</code>
              <button
                type="button"
                onClick={() => copyText(config.treasuryAddress)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                aria-label="Копировать адрес"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <div className="text-gray-400 mb-1">Memo (комментарий к переводу)</div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs break-all bg-black/30 px-2 py-1 rounded">{order.memo}</code>
              <button
                type="button"
                onClick={() => copyText(order.memo)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <div className="text-gray-400 mb-1">Сумма (nanoTON)</div>
            <code className="text-xs bg-black/30 px-2 py-1 rounded">{order.amountRaw}</code>
            {order.amountTonHuman !== undefined && (
              <span className="ml-2 text-ton-400">≈ {order.amountTonHuman} TON</span>
            )}
          </div>
          {tonkeeperUrl && (
            <a
              href={tonkeeperUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-purple-300 hover:text-purple-200"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть перевод в Tonkeeper
            </a>
          )}
          <div>
            <label className="text-gray-400 block mb-1">Хэш транзакции после оплаты</label>
            <input
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white font-mono text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy || !txHash.trim()}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Подтвердить оплату'}
          </button>
        </div>
      )}

      {orderState && (
        <div className="text-sm text-gray-300 border-t border-white/10 pt-4">
          Статус заказа: <span className="text-white font-mono">{orderState}</span>
        </div>
      )}

      {delivery && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <div className="text-green-300 font-medium mb-2">Доступ к покупке</div>
          <p className="text-sm text-gray-200 break-all whitespace-pre-wrap">{delivery}</p>
        </div>
      )}

      {order && buyerAddress && orderState === 'paid' && (
        <div className="border-t border-white/10 pt-4 space-y-2">
          <p className="text-sm text-gray-400">Проблема с заказом? Откройте спор.</p>
          <textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Опишите проблему"
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => void onDispute()}
            disabled={busy || !disputeReason.trim()}
            className="px-4 py-2 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-sm font-medium disabled:opacity-50"
          >
            Открыть спор
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductCryptoCheckout;
