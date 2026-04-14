import { useState, useCallback } from 'react';
import { Wallet, Link2, Unlink, AlertTriangle, CheckCircle } from 'lucide-react';
import { TonConnectButton, useTonAddress } from '@tonconnect/ui-react';
import { useAuth } from '../../contexts/AuthContext';
import { storeApiUrl } from '../../lib/storeApi';
import { CopyableText } from '../../components/ui/CopyButton';
import { useToast } from '../../components/ui/Toast';

export default function WalletSection() {
  const tonAddress = useTonAddress();
  const { user, fetchProfile, getToken } = useAuth();
  const [status, setStatus] = useState<'idle' | 'linking' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const { toast } = useToast();

  const linkedAddress = user?.tonAddress;

  const handleLink = useCallback(async () => {
    if (!tonAddress) return;
    setStatus('linking');
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/session/profile'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ton_address: tonAddress }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Link failed' }));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      setStatus('success');
      toast('success', 'Wallet linked successfully');
      await fetchProfile();
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Failed to link wallet';
      setError(msg);
      toast('error', msg);
    }
  }, [tonAddress, getToken, fetchProfile, toast]);

  const handleUnlink = useCallback(async () => {
    setStatus('linking');
    setError(null);
    setShowUnlinkConfirm(false);
    try {
      const token = await getToken();
      const res = await fetch(storeApiUrl('/api/session/profile'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ton_address: null }),
      });
      if (!res.ok) throw new Error('Unlink failed');
      setStatus('idle');
      toast('info', 'Wallet unlinked');
      await fetchProfile();
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Failed to unlink';
      setError(msg);
      toast('error', msg);
    }
  }, [getToken, fetchProfile, toast]);

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-display font-bold uppercase tracking-widest text-white flex items-center gap-3">
          <Wallet className="w-7 h-7 text-[#00FF88]" />
          TON Wallet
        </h1>
        <p className="text-[#666] text-sm mt-1">Manage your blockchain identity</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111119] p-6 space-y-5">
        {linkedAddress ? (
          <>
            <div className="rounded-lg bg-gradient-to-r from-[#00FF88]/[0.08] to-[#00F5FF]/[0.04] border border-[#00FF88]/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-[#00FF88]" />
                <span className="text-[#00FF88] text-xs font-semibold uppercase tracking-wider">Linked</span>
              </div>
              <CopyableText text={linkedAddress} truncate={false} />
            </div>

            <div className="flex items-center gap-3">
              <TonConnectButton />
              <button
                onClick={() => setShowUnlinkConfirm(true)}
                disabled={status === 'linking'}
                className="border border-[#FF4444]/20 hover:bg-[#FF4444]/10 text-[#FF4444] px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Unlink className="w-3.5 h-3.5" />
                Unlink
              </button>
            </div>

            {showUnlinkConfirm && (
              <div className="rounded-lg border border-[#FF4444]/20 bg-[#FF4444]/[0.05] p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#FF4444] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-medium">Unlink wallet?</p>
                    <p className="text-[#999] text-xs mt-1">
                      You will lose access to downloads in your Arsenal until you link a wallet again.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleUnlink}
                    className="bg-[#FF4444] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#FF4444]/80 transition-colors">
                    Yes, unlink
                  </button>
                  <button onClick={() => setShowUnlinkConfirm(false)}
                    className="border border-white/10 text-[#999] text-xs px-4 py-2 rounded-lg hover:text-white transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[#888] text-sm">
              Connect your TON wallet to enable crypto payments and receive earnings from your creations.
            </p>
            <TonConnectButton />
            {tonAddress && tonAddress !== linkedAddress && (
              <button
                onClick={handleLink}
                disabled={status === 'linking'}
                className="w-full py-3 rounded-xl bg-[#FFD700] text-[#0A0A0A] font-semibold uppercase tracking-widest text-xs transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Link2 className="w-4 h-4" />
                <span>{status === 'linking' ? 'Linking...' : `Link ${tonAddress.slice(0, 6)}...${tonAddress.slice(-4)}`}</span>
              </button>
            )}
          </>
        )}

        {error && (
          <p className="text-[#FF4444] text-sm">{error}</p>
        )}
      </div>
    </div>
  );
}
