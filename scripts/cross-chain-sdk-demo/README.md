# Cross-Chain SDK Demo

Demo scripts for Moleswap cross-chain order creation using the 1inch Cross-Chain SDK.

## Setup

```bash
# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env
# Edit .env with your value for:
```
MAKER_PRIV
TAKER_PRIV
RPC_URL
TON_API_KEY
TON_MNEMONIC
```

## Usage  

```bash
# Create cross-chain order
tsx 1_order_create.tsx

# Run order end to end between evm and ton
tsx evm-to-ton-end-to-end.ts
```

## Configuration

The demo uses `config.ts` to initialize custom chain and LOP address support:

- Registers custom chain IDs to SupportedChains
- Configures TRUE token mapping
- Provides a function for signing the order given custom LOP address
