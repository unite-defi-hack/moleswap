'use client';

import { TonConnectUIProvider } from "@tonconnect/ui-react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl="https://raw.githubusercontent.com/unite-defi-hack/moleswap/refs/heads/main/ui/public/tonconnect-manifest.json">
      {children}
    </TonConnectUIProvider>
  );
} 