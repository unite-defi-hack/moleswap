# MoleSwap Resolver Service

A TypeScript-based resolver service for the MoleSwap cross-chain atomic swap protocol. This service polls the relayer for orders, checks profitability using oracle prices, and executes profitable cross-chain swaps.

## Features

- **Order Polling**: Continuously polls the relayer for active orders
- **Profitability Analysis**: Checks order prices against oracle prices
- **Cross-Chain Execution**: Executes atomic swaps between Sepolia and TON
- **TON Integration**: Full TON blockchain support with escrow creation and withdrawals
- **Mock Oracle**: Built-in mock oracle for testing and development
- **Configurable**: Highly configurable via environment variables
- **Statistics**: Real-time statistics and monitoring
- **Error Handling**: Robust error handling and graceful shutdown

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Relayer API  │    │  Oracle Service │    │ Execution Service│
│                │    │                 │    │                 │
│ • Fetch Orders │    │ • Mock Prices   │    │ • Create Escrows│
│ • Request      │    │ • Profitability │    │ • Withdraw       │
│   Secrets      │    │   Analysis      │    │ • Gas Estimation │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Resolver Service│
                    │                 │
                    │ • Orchestration │
                    │ • Order Polling │
                    │ • Profit Check  │
                    │ • Statistics    │
                    └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Running MoleSwap Relayer service
- Funded wallet for execution

### Installation

1. **Clone and install dependencies:**
```bash
cd resolver
npm install
```

2. **Set up environment variables:**
```bash
cp env.example .env
# Edit .env with your configuration
```

3. **Build the project:**
```bash
npm run build
```

4. **Start the resolver service:**
```bash
npm start
```

### Development

```bash
# Start in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RELAYER_URL` | Relayer API URL | `http://localhost:3000` |
| `SOURCE_NETWORK_ID` | Source chain ID (Sepolia) | `11155111` |
| `DESTINATION_NETWORK_ID` | Destination chain ID (TON) | `608` |
| `TAKER_PRIV` | Taker private key | Required |
| `RPC_URL` | Sepolia RPC URL | Required |
| `LOP` | Limit Order Protocol address | Required |
| `ESCROW_FACTORY` | Escrow factory address | Required |

| `TON_LOP_ADDRESS` | TON LOP address | Required |
| `TON_TAKER_ADDRESS` | TON taker address | Required |
| `TON_API_KEY` | TON API key | Required |
| `TON_TAKER_MNEMONIC` | TON taker mnemonic | Required |
| `MIN_PROFIT_PERCENT` | Minimum profit % | `1.0` |
| `POLLING_INTERVAL` | Polling interval (ms) | `10000` |
| `MAX_ORDERS_PER_POLL` | Max orders per poll | `5` |

### Example Configuration

```bash
# .env
RELAYER_URL=http://localhost:3000
SOURCE_NETWORK_ID=11155111
DESTINATION_NETWORK_ID=608
TAKER_PRIV=7f8d1d2239ec86ad679c74f28afd032d94816eb0b0e43f48c71d4e52a86f7f85
RPC_URL=https://morning-long-patina.ethereum-sepolia.quiknode.pro/17744e036defab947da5d52ec10c476736a72426/
LOP=0x991f286348580c1d2206843D5CfD7863Ff29eB15
ESCROW_FACTORY=0x5e7854fC41247FD537FE45d7Ada070b9Bfba41DA

TON_LOP_ADDRESS=kQAKu5ljI8wTH4hjMjsWWZberlM9FnD3C-VGx4VqC7g2i364
TON_TAKER_ADDRESS=0QCDScvyElUG1_R9Zm60degE6gUfWBXr-dwmdJasz4D7YwYb
TON_API_KEY=593593caf646182d2ea52265e9c203e279eab05b076ea7579c166944061a1438
TON_TAKER_MNEMONIC="brass clown vibrant work wave diesel daughter topple nuclear curious order vacuum outdoor naive essence attract excuse chair glory example metal vault depth catalog"
MIN_PROFIT_PERCENT=1.5
POLLING_INTERVAL=5000
```

## Usage

### Basic Usage

The resolver service runs automatically and:

1. **Polls for orders** from the relayer every 10 seconds
2. **Checks profitability** using the mock oracle
3. **Executes profitable orders** using the 1inch SDK
4. **Reports statistics** every minute

### API Integration

```typescript
import { ResolverService, RelayerService, OracleService, ExecutionService } from './src';

// Initialize services
const relayerService = new RelayerService('http://localhost:3000');
const oracleService = new OracleService();
const executionService = new ExecutionService(config, relayerService);

// Create resolver
const resolver = new ResolverService(relayerService, oracleService, executionService);

// Start the service
await resolver.start();

// Get statistics
resolver.printStats();
```

### Manual Order Execution

```typescript
// Execute a specific order
const result = await resolver.executeSingleOrder('0x...');
if (result?.success) {
  console.log('Order executed successfully!');
}
```

## Order Execution Flow

1. **Order Discovery**: Poll relayer for active orders
2. **Profitability Check**: Compare order price with oracle price
3. **Source Escrow**: Create escrow on source chain
4. **Destination Escrow**: Create escrow on destination chain
5. **Secret Request**: Request secret from relayer
6. **Withdrawal**: Withdraw tokens from both escrows
7. **Profit Calculation**: Calculate and track profit

## Mock Oracle

The resolver includes a mock oracle service for testing:

```typescript
const oracle = new OracleService();

// Get price for a token
const price = await oracle.getPrice('0x...');

// Check profitability
const comparison = await oracle.checkProfitability(
  makerAsset,
  takerAsset,
  makingAmount,
  takingAmount,
  minProfitPercent
);
```

## Statistics

The resolver provides real-time statistics:

```
=== MoleSwap Resolver Statistics ===
Status: Running
Last Poll: 2024-01-01T12:00:00.000Z
Total Orders Processed: 150
Successful Executions: 45
Failed Executions: 5
Total Profit: 0.123456
Success Rate: 90.00%
=====================================
```

## Error Handling

The resolver includes comprehensive error handling:

- **Relayer Health Checks**: Validates relayer availability
- **Wallet Balance Checks**: Ensures sufficient funds
- **Gas Estimation**: Estimates gas costs before execution
- **Graceful Shutdown**: Handles SIGINT/SIGTERM signals
- **Retry Logic**: Implements exponential backoff for failures

## Development

### Project Structure

```
src/
├── config.ts              # Configuration management
├── index.ts               # Main entry point
├── types/                 # TypeScript type definitions
│   └── index.ts
└── services/              # Business logic services
    ├── relayerService.ts  # Relayer API integration
    ├── oracleService.ts   # Price oracle service
    ├── executionService.ts # Order execution logic
    └── resolverService.ts # Main orchestrator
```

### Adding Real Oracle Integration

Replace the mock oracle with real price feeds:

```typescript
// In oracleService.ts
async getPrice(tokenAddress: string): Promise<OraclePrice | null> {
  // Integrate with CoinGecko, Chainlink, or other price feeds
  const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`);
  const data = await response.json();
  
  return {
    token: tokenAddress,
    price: data[tokenId].usd,
    timestamp: Date.now(),
    source: 'coingecko'
  };
}
```

### Testing

```bash
# Run all tests
npm test

# Run specific test
npm test -- --testNamePattern="OracleService"

# Run with coverage
npm test -- --coverage
```

## Troubleshooting

### Common Issues

1. **"Relayer is not healthy"**
   - Ensure the relayer service is running
   - Check `RELAYER_URL` configuration

2. **"Insufficient wallet balance"**
   - Fund the wallet with native tokens for gas
   - Check `PRIVATE_KEY` configuration

3. **"Order execution failed"**
   - Check gas price and limits
   - Verify contract addresses
   - Review transaction logs

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details. 