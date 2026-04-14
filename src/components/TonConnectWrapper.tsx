import React from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

function getManifestUrl(): string {
  return new URL('/tonconnect-manifest.json', window.location.origin).toString();
}

const TonConnectWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <TonConnectUIProvider manifestUrl={getManifestUrl()}>
    {children}
  </TonConnectUIProvider>
);

export default TonConnectWrapper;
