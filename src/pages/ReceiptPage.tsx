import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, ExternalLink, ArrowLeft, Package, Clock } from 'lucide-react';
import { fetchCommerceOrder } from '../lib/commerceApi';
import { nanoRawToTonHuman, shortHash } from '../utils/tonAmount';
import { useTonAddress } from '@tonconnect/ui-react';

interface ReceiptData {
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

export default function ReceiptPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const tonAddress = useTonAddress();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError('Missing order id');
      return;
    }
    if (!tonAddress) {
      setLoading(false);
      setError('Connect your TON wallet to view this receipt');
      return;
    }
    setLoading(true);
    setError(null);
    let cancelled = false;
    fetchCommerceOrder(orderId, tonAddress)
      .then((data) => {
        if (!cancelled) setReceipt(data as unknown as ReceiptData);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load receipt');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, tonAddress]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Clock className="w-6 h-6 text-gray-400 animate-spin" />
        <span className="ml-3 text-gray-400">Loading receipt...</span>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <p className="text-red-400 mb-4">{error || 'Receipt not found'}</p>
        <Link to="/orders" className="text-blue-400 hover:text-blue-300">
          <ArrowLeft className="w-4 h-4 inline mr-1" /> Back to orders
        </Link>
      </div>
    );
  }

  const { order, deliveryPayload } = receipt;
  const isPaid = order.state === 'paid' || order.state === 'fulfilled';
  const tonviewerBase = 'https://tonviewer.com';

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Link to="/orders" className="text-gray-400 hover:text-white flex items-center gap-1 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to orders
      </Link>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="text-center mb-8">
          {isPaid ? (
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          ) : (
            <Package className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          )}
          <h1 className="text-2xl font-bold text-white mb-2">
            {isPaid ? 'Payment Confirmed' : `Order ${order.state.replace('_', ' ')}`}
          </h1>
          <p className="text-gray-400 text-sm">Order #{order.id.slice(0, 8)}</p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex justify-between py-3 border-b border-white/5">
            <span className="text-gray-400">Amount</span>
            <span className="text-white font-medium">
              {order.currency === 'TON' ? `${nanoRawToTonHuman(order.amountRaw)} TON` : `${order.amountRaw} ${order.currency}`}
            </span>
          </div>
          <div className="flex justify-between py-3 border-b border-white/5">
            <span className="text-gray-400">Status</span>
            <span className={`font-medium ${isPaid ? 'text-green-400' : 'text-yellow-400'}`}>
              {order.state.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          {order.tonTxHash && (
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-gray-400">Transaction</span>
              <a
                href={`${tonviewerBase}/transaction/${order.tonTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {shortHash(order.tonTxHash)} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {deliveryPayload && isPaid && (
          <div className="bg-green-400/5 border border-green-400/20 rounded-xl p-6">
            <h3 className="text-green-400 font-semibold mb-3">Delivery Information</h3>
            <pre className="text-gray-300 text-sm whitespace-pre-wrap break-words">
              {deliveryPayload}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
