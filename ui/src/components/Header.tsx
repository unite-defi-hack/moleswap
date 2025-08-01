'use client';

import { TonConnectButton } from "@tonconnect/ui-react";
import { EthereumConnectButton } from "./EthereumConnectButton";

export function Header() {
  return (
    <header className="w-full p-4">
      <div className="flex justify-end items-center gap-4">
        <EthereumConnectButton />
        <TonConnectButton />
      </div>
    </header>
  );
} 