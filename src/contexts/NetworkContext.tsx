import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { fetchCommerceConfig } from '../lib/commerceApi';
import { logger } from '../lib/logger';

export type TonNetwork = 'mainnet' | 'testnet';

interface NetworkContextValue {
  network: TonNetwork;
  isTestnet: boolean;
  setNetwork: (n: TonNetwork) => void;
  toggleNetwork: () => void;
}

const NetworkCtx = createContext<NetworkContextValue | null>(null);

const STORAGE_KEY = 'ton_network';

function readInitialNetwork(): TonNetwork {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('network');
    if (fromUrl === 'testnet') return 'testnet';
    if (fromUrl === 'mainnet') return 'mainnet';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'testnet') return 'testnet';
  } catch { /* SSR / restricted storage */ }
  return 'mainnet';
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkRaw] = useState<TonNetwork>(readInitialNetwork);

  const setNetwork = useCallback((n: TonNetwork) => {
    setNetworkRaw(n);
    try { localStorage.setItem(STORAGE_KEY, n); } catch { /* noop */ }
  }, []);

  // M-14: the backend pins the TON network (TON_NETWORK) and ignores the
  // client's requested network on the money path. Reconcile the UI to that
  // authoritative value so explorer links, address forms and the network badge
  // reflect the network escrows actually settle on — instead of the local
  // default/toggle drifting (mainnet UI over a testnet backend).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchCommerceConfig();
        const serverNet = cfg?.network;
        if (!cancelled && (serverNet === 'mainnet' || serverNet === 'testnet')) {
          setNetworkRaw((cur) => {
            if (cur !== serverNet) {
              try { localStorage.setItem(STORAGE_KEY, serverNet); } catch { /* noop */ }
            }
            return serverNet;
          });
        }
      } catch (err) {
        logger.warn('[network] could not reconcile to server network:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleNetwork = useCallback(() => {
    setNetwork(network === 'mainnet' ? 'testnet' : 'mainnet');
  }, [network, setNetwork]);

  const value = useMemo<NetworkContextValue>(() => ({
    network,
    isTestnet: network === 'testnet',
    setNetwork,
    toggleNetwork,
  }), [network, setNetwork, toggleNetwork]);

  return <NetworkCtx.Provider value={value}>{children}</NetworkCtx.Provider>;
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkCtx);
  if (!ctx) throw new Error('useNetwork must be used within NetworkProvider');
  return ctx;
}

export function useTonNetworkHeader(): Record<string, string> {
  const { network } = useNetwork();
  return network === 'testnet' ? { 'X-Ton-Network': 'testnet' } : {};
}
