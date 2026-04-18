// Switched to TonForge purchase flow so that purchases end with license/session/device activation instead of the legacy deliveryPayload.
import { useEffect, useMemo, useState, type FC } from 'react';
import { useTonAddress } from '@tonconnect/ui-react';
import { Copy, Loader2, ShieldCheck, Wallet, BadgeCheck, Fingerprint, ScrollText } from 'lucide-react';
import type { TonForgeApp, TonForgeLicense, TonForgePurchaseSession } from '../domain/tonforge/types';
import {
  activateLicenseDevice,
  confirmPurchaseSession,
  createPurchaseSession,
  fetchTonForgeAppDetails,
  fetchTonForgeConfig,
  fetchWalletProfile,
  openLicenseDispute,
} from '../services/tonforgeApi';

interface ProductCryptoCheckoutProps {
  /** Storefront card identifier (as in URL /product/:id) */
  catalogProductId: string;
}

function copyText(text: string): void {
  void navigator.clipboard.writeText(text);
}

function formatIso(iso: string): string {
  return new Date(iso).toLocaleString('en-US');
}

const ProductCryptoCheckout: FC<ProductCryptoCheckoutProps> = ({ catalogProductId }) => {
  const buyerAddress = useTonAddress();
  const [configWallet, setConfigWallet] = useState('');
  const [app, setApp] = useState<TonForgeApp | null>(null);
  const [session, setSession] = useState<TonForgePurchaseSession | null>(null);
  const [license, setLicense] = useState<TonForgeLicense | null>(null);
  const [txHash, setTxHash] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchTonForgeConfig(), fetchTonForgeAppDetails(catalogProductId)])
      .then(([config, details]) => {
        if (cancelled) return;
        setConfigWallet(config.treasuryWallet);
        setApp(details.app);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'TonForge API unavailable');
        setApp(null);
      });

    return () => {
      cancelled = true;
    };
  }, [catalogProductId]);

  useEffect(() => {
    if (!buyerAddress || !app) {
      setLicense(null);
      return;
    }

    let cancelled = false;
    void fetchWalletProfile(buyerAddress)
      .then((profile) => {
        if (cancelled) return;
        setLicense(profile.licenses.find((item) => item.appId === app.appId) ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setLicense(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [buyerAddress, app]);

  const checkoutState = useMemo(() => {
    if (license) return license.state;
    if (session) return session.state;
    return 'ready';
  }, [license, session]);

  const onCreateSession = async () => {
    if (!app || !buyerAddress) return;
    setBusy(true);
    setLoadError(null);
    setSuccessMessage(null);
    try {
      const created = await createPurchaseSession({ appId: app.appId, buyerWallet: buyerAddress });
      setSession(created.session);
      setLicense(null);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Failed to create purchase session');
    } finally {
      setBusy(false);
    }
  };

  const onConfirmPurchase = async () => {
    if (!session || !buyerAddress) return;
    setBusy(true);
    setLoadError(null);
    setSuccessMessage(null);
    try {
      const confirmed = await confirmPurchaseSession({
        purchaseSessionId: session.purchaseSessionId,
        buyerWallet: buyerAddress,
        txHash: txHash.trim() || undefined,
      });
      setSession(confirmed.session);
      setLicense(confirmed.license);
      setSuccessMessage('NFT license issued. Now bind a device for runtime verification.');
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Failed to confirm purchase session');
    } finally {
      setBusy(false);
    }
  };

  const onActivateDevice = async () => {
    if (!license || !buyerAddress || !deviceId.trim()) return;
    setBusy(true);
    setLoadError(null);
    try {
      const activated = await activateLicenseDevice({
        licenseId: license.licenseId,
        buyerWallet: buyerAddress,
        deviceId: deviceId.trim(),
      });
      setLicense(activated.license);
      setDeviceId('');
      setSuccessMessage('Device bound. Runtime verification can now validate device_id.');
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Failed to bind device');
    } finally {
      setBusy(false);
    }
  };

  const onOpenDispute = async () => {
    if (!license || !buyerAddress || !disputeReason.trim()) return;
    setBusy(true);
    setLoadError(null);
    try {
      await openLicenseDispute({
        licenseId: license.licenseId,
        buyerWallet: buyerAddress,
        reason: disputeReason.trim(),
      });
      setDisputeReason('');
      setSuccessMessage('Dispute opened and awaiting escrow/trial chain review.');
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Failed to open dispute');
    } finally {
      setBusy(false);
    }
  };

  if (loadError && !app) {
    return (
      <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
        <p className="font-medium">TonForge checkout unavailable</p>
        <p className="mt-1 text-yellow-200/80">{loadError}</p>
        <p className="mt-2 text-xs text-yellow-200/60">
          Start the backend route <code className="font-mono">/api/tonforge</code> and set
          <code className="font-mono"> TREASURY_WALLET_ADDRESS</code>.
        </p>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
        No TonForge license configuration exists for this product yet.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center gap-2 font-semibold text-ton-400">
        <ShieldCheck className="h-5 w-5" />
        <span>TonForge NFT License Checkout</span>
      </div>
      <p className="text-sm text-gray-400">
        Purchase creates a `purchase session`, then escrow holds the trial, and the NFT license becomes the single source of truth for device activation.
      </p>

      <div className="space-y-3 text-white">
        <div>
          <span className="text-sm text-gray-400">App:</span> <span className="font-medium">{app.name}</span>
          <div className="mt-1 text-lg">{app.priceTon} TON</div>
        </div>
        <div className="grid gap-2 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-green-400" />
            <span>{app.trust.sellerBadge} · KYC {app.trust.kycStatus === 'approved' ? 'Verified' : 'Coming Soon (MVP)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-cyan-300" />
            <span>
              {app.license.type} license · escrow {app.buyerProtectionHours}h · hash {app.artifact.sha256.slice(0, 14)}...
            </span>
          </div>
        </div>
      </div>

      {!buyerAddress && (
        <div className="flex items-center gap-2 text-sm text-amber-300">
          <Wallet className="h-4 w-4" />
          Connect a TON wallet in the header to create a purchase session.
        </div>
      )}

      {loadError && app && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{loadError}</div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
          {successMessage}
        </div>
      )}

      {!session && !license && buyerAddress && (
        <button
          type="button"
          onClick={() => void onCreateSession()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ton-gradient py-3 font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          Create purchase session
        </button>
      )}

      {session && !license && (
        <div className="space-y-3 border-t border-white/10 pt-4 text-sm">
          <div>
            <div className="mb-1 text-gray-400">Escrow address</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-black/30 px-2 py-1 text-xs">{session.escrowAddress}</code>
              <button
                type="button"
                onClick={() => copyText(session.escrowAddress)}
                className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-gray-400">Treasury wallet</div>
            <code className="break-all rounded bg-black/30 px-2 py-1 text-xs">{configWallet}</code>
          </div>
          <div>
            <div className="mb-1 text-gray-400">Memo</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-black/30 px-2 py-1 text-xs">{session.memo}</code>
              <button
                type="button"
                onClick={() => copyText(session.memo)}
                className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-gray-400">Amount</div>
            <code className="rounded bg-black/30 px-2 py-1 text-xs">{session.amountNano} nanoTON</code>
            <span className="ml-2 text-ton-400">≈ {session.amountTon} TON</span>
          </div>
          <div>
            <label className="mb-1 block text-gray-400">Transaction hash after payment</label>
            <input
              value={txHash}
              onChange={(event) => setTxHash(event.target.value)}
              placeholder="0x... or leave empty for demo confirmation"
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-mono text-sm text-white"
            />
          </div>
          <div className="text-xs text-gray-500">
            Trial ends: <span className="text-gray-300">{formatIso(session.trialEndsAt)}</span>
          </div>
          <button
            type="button"
            onClick={() => void onConfirmPurchase()}
            disabled={busy}
            className="w-full rounded-xl bg-purple-600 py-3 font-semibold disabled:opacity-50 hover:bg-purple-500"
          >
            {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Confirm license issuance'}
          </button>
        </div>
      )}

      <div className="border-t border-white/10 pt-4 text-sm text-gray-300">
        Current state: <span className="font-mono text-white">{checkoutState}</span>
      </div>

      {license && (
        <div className="space-y-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <div className="font-medium text-green-300">NFT license active</div>
          <div className="space-y-1 break-all text-sm text-gray-200">
            <p>NFT: {license.nftAddress}</p>
            <p>Collection: {license.collectionAddress}</p>
            <p>Escrow: {license.escrowAddress}</p>
            <p>Trial ends: {formatIso(license.trialEndsAt)}</p>
            <p>Purchase tx: {license.purchaseTxHash}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 flex items-center gap-2 font-medium text-white">
              <Fingerprint className="h-4 w-4 text-cyan-300" />
              Device activation
            </div>
            <input
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              placeholder="e.g. astra-macbook-pro"
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => void onActivateDevice()}
              disabled={busy || !deviceId.trim()}
              className="mt-3 w-full rounded-xl bg-cyan-600 py-3 font-semibold disabled:opacity-50 hover:bg-cyan-500"
            >
              {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Bind device_id'}
            </button>
            {license.activatedDevices.length > 0 && (
              <div className="mt-3 space-y-1 text-xs text-gray-300">
                {license.activatedDevices.map((device) => (
                  <div key={device.deviceId}>
                    {device.deviceId} · {formatIso(device.activatedAt)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {license && buyerAddress && (
        <div className="space-y-2 border-t border-white/10 pt-4">
          <p className="text-sm text-gray-400">
            If the license, artifact, or trial is not working correctly, open a dispute before the escrow expires.
          </p>
          <textarea
            value={disputeReason}
            onChange={(event) => setDisputeReason(event.target.value)}
            placeholder="Describe the issue with escrow, artifact, or activation"
            rows={3}
            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => void onOpenDispute()}
            disabled={busy || !disputeReason.trim()}
            className="rounded-lg bg-amber-600/80 px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-amber-600"
          >
            Open dispute
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductCryptoCheckout;
