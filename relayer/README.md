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

The project includes comprehensive test coverage with both unit tests and end-to-end (e2e) tests.

### Test Structure

```
src/
├── routes/
│   └── __tests__/
│       ├── orders.e2e.test.ts    # End-to-end order API tests
│       └── orders.test.ts         # Unit tests for order routes
├── utils/
│   └── __tests__/
│       └── orderHashing.test.ts  # Unit tests for order hashing
└── database/
    └── migrations/                # Database migration tests
```

### Running Tests

#### All Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

#### Unit Tests
```bash
# Run all unit tests
npm test -- --testPathPattern="\.test\.ts$"

# Run specific unit test file
npm test -- src/utils/__tests__/orderHashing.test.ts

# Run unit tests in watch mode
npm test -- --testPathPattern="\.test\.ts$" --watch
```

#### End-to-End Tests
```bash
# Run all e2e tests
npm test -- --testPathPattern="\.e2e\.test\.ts$"

# Run specific e2e test file
npm test -- src/routes/__tests__/orders.e2e.test.ts

# Run e2e tests with development database
NODE_ENV=development npm test -- src/routes/__tests__/orders.e2e.test.ts
```

#### Test Environment

**Important**: E2E tests require the development database environment to access the SQLite database with proper tables.

```bash
# For e2e tests, always use development environment
NODE_ENV=development npm test -- src/routes/__tests__/orders.e2e.test.ts
```

### Test Coverage

#### Unit Tests
- **Order Hashing**: EIP-712 signature generation and verification
- **Validation**: Input validation and sanitization
- **Database Operations**: Order insertion and retrieval
- **Utility Functions**: Secret generation and encryption

#### End-to-End Tests
- **Order Data Generation**: `POST /api/orders/data` endpoint
- **Order Creation**: `POST /api/orders` endpoint with signature verification
- **Duplicate Detection**: Order hash uniqueness validation
- **Error Handling**: Invalid signatures and malformed data
- **Database Integration**: Order persistence and retrieval

### Test Commands Reference

```bash
# Quick test runs
npm test                                    # All tests
npm test -- --verbose                      # Verbose output
npm test -- --testNamePattern="order"      # Tests matching pattern

# Specific test types
npm test -- --testPathPattern="\.test\.ts$"           # Unit tests only
npm test -- --testPathPattern="\.e2e\.test\.ts$"      # E2E tests only

# Development environment (required for e2e)
NODE_ENV=development npm test -- src/routes/__tests__/orders.e2e.test.ts

# Coverage reports
npm test -- --coverage --coverageReporters=text
npm test -- --coverage --coverageReporters=html
```

### Test Database

E2E tests use the development SQLite database located at `data/relayer.db`. The database is automatically created and migrated when running tests in development mode.

```bash
# Ensure database is set up
npm run migrate

# Run e2e tests
NODE_ENV=development npm test -- src/routes/__tests__/orders.e2e.test.ts
```

### Writing Tests

#### Unit Test Example
```typescript
import { generateOrderHash } from '../utils/orderHashing';

describe('Order Hashing', () => {
  it('should generate valid order hash', () => {
    const order = {
      maker: '0x123...',
      makerAsset: '0x456...',
      // ... other fields
    };
    
    const result = generateOrderHash(order);
    expect(result.orderHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });
});
```

#### E2E Test Example
```typescript
import request from 'supertest';
import { app } from '../index';

describe('Orders API - E2E', () => {
  it('should create order successfully', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send({ signedOrder })
      .expect(201);
      
    expect(response.body.success).toBe(true);
  });
});
```

### Troubleshooting

#### Common Issues

1. **Database Connection Errors**: Ensure you're using `NODE_ENV=development` for e2e tests
2. **Missing Tables**: Run `npm run migrate` before running e2e tests
3. **Signature Verification Failures**: Check that test wallets match order maker addresses
4. **Test Isolation**: Each test should clean up after itself to avoid interference

#### Debug Mode

```bash
# Run tests with debug logging
DEBUG=* npm test -- src/routes/__tests__/orders.e2e.test.ts

# Run specific test with verbose output
npm test -- --testNamePattern="should create order" --verbose
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