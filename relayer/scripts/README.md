# Relayer Scripts

This directory contains utility scripts for interacting with the MoleSwap Relayer.

## Available Scripts

### 1. `create-order.ts`
Creates test orders in the relayer system.

**Usage:**
```bash
# Run with default settings
npx ts-node scripts/create-order.ts

# Run with custom relayer URL
RELAYER_URL=http://localhost:3000 npx ts-node scripts/create-order.ts
```

**Features:**
- Creates real orders with proper EIP-712 signatures
- Creates complete orders with extension, secret, and secretHash
- Tests secret request functionality
- Health check before operations
- Comprehensive error handling

### 2. `list-orders.ts`
Lists all orders with optional filters and pagination.

**Usage:**
```bash
# Run with default settings
npx ts-node scripts/list-orders.ts

# Run with custom relayer URL
RELAYER_URL=http://localhost:3000 npx ts-node scripts/list-orders.ts
```

**Features:**
- Lists all orders with detailed information
- Demonstrates different filtering options:
  - By status (active, completed, cancelled, expired)
  - By asset address
  - By source chain ID
  - By destination chain ID
  - By cross-chain pair (source → destination)
  - Pagination (small, medium, large)
- Formatted output with clear order details including chain information
- Health check before operations
- Comprehensive error handling

### 3. `cleanup-db.ts`
Cleans up the database (removes test data).

**Usage:**
```bash
npx ts-node scripts/cleanup-db.ts
```

## Configuration

All scripts use the following environment variables:

- `RELAYER_URL`: The URL of the relayer (default: `http://localhost:3000`)

## Filter Options

The `list-orders.ts` script includes hardcoded filter options for demonstration:

### Status Filters
- `active`: Active orders
- `completed`: Completed orders  
- `cancelled`: Cancelled orders
- `expired`: Expired orders

### Asset Filters
- `usdc`: USDC token address
- `weth`: Wrapped ETH address
- `dai`: DAI token address

### Chain ID Filters
- `sepolia`: 11155111 (Sepolia testnet)
- `baseSepolia`: 84532 (Base Sepolia testnet)
- `ethereum`: 1 (Ethereum mainnet)
- `polygon`: 137 (Polygon)
- `arbitrum`: 42161 (Arbitrum One)
- `optimism`: 10 (Optimism)

### Pagination Options
- `small`: 10 orders per page
- `medium`: 50 orders per page (default)
- `large`: 100 orders per page

## Example Output

The `list-orders.ts` script provides comprehensive examples:

```
📋 EXAMPLE 1: All Orders (Default)
==================================================
ALL ORDERS (3 TOTAL)
==================================================

1. 
Order Hash: 0x0be3ab84391d3fffe1d309e6d10a133969415454d358f6fc0808acb1cff2df69
Status: active
Maker: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Maker Asset: 0x10563e509b718a279de002dfc3e94a8a8f642b03
Taker Asset: 0xa3578b35f092dd73eb4d5a9660d3cde8b6a4bf8c
Making Amount: 1000000000000000000
Taking Amount: 2000000000000000000
Receiver: 0x0000000000000000000000000000000000000000
Salt: 8055219788148251265908589343240715975237002832007417457800707733977
Created: 2025-07-31T00:27:54.275Z
Updated: 2025-07-31T00:27:54.275Z
Maker Traits: 0x00bd363c7762ace561ec85a122307bff99ee8832363f26c64e9a1545b1b45350
---
```

## Error Handling

All scripts include comprehensive error handling:
- Health checks before operations
- Graceful error reporting
- Detailed logging
- Process exit on critical errors

## Dependencies

The scripts require the following dependencies (already included in the main project):
- `axios`: HTTP client
- `ethers`: Ethereum utilities
- `winston`: Logging
- `ts-node`: TypeScript execution

## Development

To modify the scripts:
1. Edit the TypeScript files in this directory
2. Test with `npx ts-node scripts/script-name.ts`
3. Ensure the relayer is running before testing
4. Check logs for detailed execution information 