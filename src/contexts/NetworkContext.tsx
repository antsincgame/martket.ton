import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

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
