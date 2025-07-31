'use client';

import { TonConnectButton } from "@tonconnect/ui-react";

export function Header() {
  return (
    <header className="w-full p-4">
      <div className="flex justify-end">
        <TonConnectButton />
      </div>
    </header>
  );
} 