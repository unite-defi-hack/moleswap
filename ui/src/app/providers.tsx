'use client';

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { EthereumProvider } from "./ethereum-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <EthereumProvider>
      <TonConnectUIProvider manifestUrl="https://raw.githubusercontent.com/unite-defi-hack/moleswap/refs/heads/main/ui/public/tonconnect-manifest.json">
        {children}
      </TonConnectUIProvider>
    </EthereumProvider>
  );
} 