# MoleSwap Relayer

A cross-chain atomic swap relayer for the MoleSwap protocol, enabling secure and trustless token swaps across different blockchain networks.

## Features

- **Cross-chain Atomic Swaps**: Enable secure token swaps between Ethereum and TON networks
- **Plugin Architecture**: Extensible chain support through a plugin system
- **Secure Secret Management**: Cryptographic secret generation and distribution
- **Escrow Validation**: Automated validation of escrow contracts and balances
- **RESTful API**: Clean and documented API endpoints
- **SQLite Database**: Lightweight and reliable data storage
- **Comprehensive Logging**: Winston-based logging with multiple transports

## Project Structure

```
src/
├── database/           # Database migrations and connection
├── middleware/         # Express middleware
├── routes/            # API route handlers
├── services/          # Business logic services
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── index.ts           # Application entry point
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd moleswap-relayer
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
npm run migrate
```

5. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### Orders
- `POST /api/orders/data` - Generate order data with hashlock
- `POST /api/orders` - Create order with signed data
- `GET /api/orders` - Query orders with filters

### Secrets
- `POST /api/secrets/:orderHash` - Request secret for order

### Health
- `GET /health` - Health check endpoint

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run migrate` - Run database migrations
- `npm run migrate:make` - Create new migration

### Environment Variables

See `env.example` for all available environment variables.

### Database

The project uses SQLite with Knex.js for database management. Database files are stored in the `data/` directory.

## Architecture

### Plugin System

The relayer uses a plugin architecture to support different blockchain networks:

```typescript
interface ChainPlugin {
  name: string;
  chainId: string;
  validateEscrow(order: Order): Promise<ValidationResult>;
  checkBalance(address: string, token: string): Promise<Balance>;
}
```

### Order Flow

1. **Order Creation**: User creates an order with source and destination chains
2. **Secret Generation**: Relayer generates a cryptographic secret and hashlock
3. **Escrow Validation**: Relayer validates escrow contracts on both chains
4. **Secret Distribution**: Once validation passes, secret is shared with parties
5. **Order Completion**: Atomic swap completes on both chains

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Deployment

### Production Build

```bash
npm run build
npm start
```

### Docker (Coming Soon)

```bash
docker build -t moleswap-relayer .
docker run -p 3000:3000 moleswap-relayer
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For questions and support, please open an issue on GitHub or contact the development team. 