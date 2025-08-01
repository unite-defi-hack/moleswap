'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export function EthereumConnectButton() {
  return (
    <ConnectButton 
      chainStatus="icon"
      showBalance={false}
      accountStatus={{
        smallScreen: 'avatar',
        largeScreen: 'full',
      }}
    />
  );
} 